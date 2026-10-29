/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkFormalityDependencies,
  setFormalityStatus,
  canCloseCase,
  canRecordAmlDecision,
  voidScreeningCheck,
  canAccessAml,
  instantiateSaleFormalities,
} from './services.ts';
import { validateGuardText, maskDocumentNumber, generateHmacFingerprint } from './guards.ts';
import { appendAuditEntry, verifyChainIntegrity, GENESIS_HASH } from './auditChain.ts';
import { Formality, Case, ScreeningCheck, AmlReview, AuditLogEntry } from './types.ts';

test('Invariant 1: canCloseCase rejects closure when open formalities exist', () => {
  const mockCase: Case = {
    id: 'case-1',
    reference: 'VTE-2026-001',
    titleFr: 'Vente Appartement Guéliz',
    titleAr: 'بيع شقة جليز',
    actCategory: 'vente',
    actTypeLabel: 'Vente immobilière',
    status: 'formalities_in_progress',
    openedAt: '2026-01-10T00:00:00Z',
    parties: [],
    formalities: [
      {
        id: 'f1',
        caseId: 'case-1',
        code: 'quittance_cdg',
        labelFr: 'Quittance CDG',
        labelAr: 'توصيل CDG',
        status: 'completed',
        updatedAt: '2026-01-11T00:00:00Z',
        updatedBy: 'Notaire',
      },
      {
        id: 'f2',
        caseId: 'case-1',
        code: 'conservation_fonciere',
        labelFr: 'Conservation Foncière (CF)',
        labelAr: 'المحافظة العقارية',
        status: 'in_progress', // OPEN!
        updatedAt: '2026-01-12T00:00:00Z',
        updatedBy: 'Notaire',
      },
    ],
  };

  const result = canCloseCase(mockCase);
  assert.equal(result.allowed, false);
  assert.equal(result.openCount, 1);
  assert.match(result.reason || '', /Loi 32-09/);
});

test('Invariant 1: Formality dependency blocks solde_prix before CF, syndic, concessionnaire, dgi_att', () => {
  const formalities: Formality[] = instantiateSaleFormalities('case-100', 'Maître');

  // Attempting solde_prix while dependencies are pending
  const checkInitial = checkFormalityDependencies('solde_prix', formalities);
  assert.equal(checkInitial.allowed, false);
  assert.equal(checkInitial.blockingCodes.length, 4);

  // Complete CF, syndic, and dgi_att, but leave concessionnaire pending
  const cfIndex = formalities.findIndex((f) => f.code === 'conservation_fonciere');
  const syndicIndex = formalities.findIndex((f) => f.code === 'syndic');
  const dgiIndex = formalities.findIndex((f) => f.code === 'dgi_att');
  formalities[cfIndex].status = 'completed';
  formalities[syndicIndex].status = 'completed';
  formalities[dgiIndex].status = 'waived'; // Waived satisfies dependency

  const checkPartial = checkFormalityDependencies('solde_prix', formalities);
  assert.equal(checkPartial.allowed, false);
  assert.deepEqual(checkPartial.blockingCodes, ['concessionnaire']);

  // Complete concessionnaire
  const concIndex = formalities.findIndex((f) => f.code === 'concessionnaire');
  formalities[concIndex].status = 'completed';

  const checkFinal = checkFormalityDependencies('solde_prix', formalities);
  assert.equal(checkFinal.allowed, true);
  assert.equal(checkFinal.blockingCodes.length, 0);
});

test('Invariant 2: A completed formality never reopens', () => {
  const completedFormality: Formality = {
    id: 'f-comp',
    caseId: 'c-1',
    code: 'enregistrement_dgi',
    labelFr: 'Enregistrement DGI',
    labelAr: 'التسجيل',
    status: 'completed',
    updatedAt: '2026-02-01T00:00:00Z',
    updatedBy: 'Maître',
  };

  const attemptReopen = setFormalityStatus(
    completedFormality,
    [completedFormality],
    'in_progress',
    'Clerc'
  );
  assert.equal(attemptReopen.success, false);
  assert.match(attemptReopen.error || '', /Invariant 2/);
});

test('Invariant 1 & AML: AmlReview.decide refuses decision without identity, sanctions & PEP checks', () => {
  const review: AmlReview = {
    id: 'aml-1',
    caseId: 'c-1',
    cashAmountMad: 150000,
    thresholdExceeded: true,
    decision: 'pending',
    anrfDeclarationRequired: false,
  };

  // 1. No checks at all
  const res1 = canRecordAmlDecision(review, [], 'approved');
  assert.equal(res1.allowed, false);
  assert.match(res1.reason || '', /pièce d'identité manquante/);

  // 2. Identity check added, but sanctions list missing
  const idCheck: ScreeningCheck = {
    id: 'chk-1',
    amlReviewId: 'aml-1',
    partyId: 'p-1',
    partyName: 'Amine B.',
    checkType: 'identity',
    sourceName: 'CNIE Marocaine',
    sourceVersionDate: '2026-01-01',
    outcome: 'clear',
    checkedAt: '2026-02-01T00:00:00Z',
    checkedBy: 'Maître',
    voided: false,
  };
  const res2 = canRecordAmlDecision(review, [idCheck], 'approved');
  assert.equal(res2.allowed, false);
  assert.match(res2.reason || '', /listes de sanctions/);

  // 3. Sanctions check without named source
  const badSanctionsCheck: ScreeningCheck = {
    id: 'chk-2',
    amlReviewId: 'aml-1',
    partyId: 'p-1',
    partyName: 'Amine B.',
    checkType: 'sanctions',
    sourceName: '', // EMPTY!
    sourceVersionDate: '2026-01-01',
    outcome: 'clear',
    checkedAt: '2026-02-01T00:00:00Z',
    checkedBy: 'Maître',
    voided: false,
  };
  const res3 = canRecordAmlDecision(review, [idCheck, badSanctionsCheck], 'approved');
  assert.equal(res3.allowed, false);
  assert.match(res3.reason || '', /source de la liste de sanctions doit être expressément nommée/);

  // 4. Valid sanctions check, but PEP missing
  const validSanctionsCheck: ScreeningCheck = {
    ...badSanctionsCheck,
    sourceName: 'CNASNU / Résolutions Conseil Sécurité ONU',
  };
  const res4 = canRecordAmlDecision(review, [idCheck, validSanctionsCheck], 'approved');
  assert.equal(res4.allowed, false);
  assert.match(res4.reason || '', /contrôle PPE/);

  // 5. All three checks present and clear
  const pepCheck: ScreeningCheck = {
    id: 'chk-3',
    amlReviewId: 'aml-1',
    partyId: 'p-1',
    partyName: 'Amine B.',
    checkType: 'pep',
    sourceName: 'Déclaration sur l\'honneur & base interne',
    sourceVersionDate: '2026-01-01',
    outcome: 'clear',
    checkedAt: '2026-02-01T00:00:00Z',
    checkedBy: 'Maître',
    voided: false,
  };
  const res5 = canRecordAmlDecision(review, [idCheck, validSanctionsCheck, pepCheck], 'approved');
  assert.equal(res5.allowed, true);
});

test('Invariant 2: Nothing is deleted to correct a mistake; check is voided with attribution', () => {
  const check: ScreeningCheck = {
    id: 'chk-err',
    amlReviewId: 'aml-1',
    partyId: 'p-1',
    partyName: 'Karim E.',
    checkType: 'pep',
    sourceName: 'Base interne',
    sourceVersionDate: '2026-01-01',
    outcome: 'match',
    checkedAt: '2026-02-01T00:00:00Z',
    checkedBy: 'Clerc',
    voided: false,
  };

  const voidResult = voidScreeningCheck(
    check,
    'Maître Notaire',
    'Homonymie constatée avec une PPE après vérification de filiation'
  );
  assert.equal(voidResult.success, true);
  assert.equal(voidResult.updatedCheck?.voided, true);
  assert.equal(voidResult.updatedCheck?.voidedBy, 'Maître Notaire');
  assert.match(voidResult.updatedCheck?.voidReason || '', /Homonymie constatée/);
});

test('Invariant 10: Free-text fields reject CIN, IBAN, and long digit strings', () => {
  const badCin = 'Paiement effectué par M. Alami porteur de la CIN AB123456 pour les frais';
  const badIban = 'Virement vers MA64011500000000000000000001 effectué';
  const badDigits = 'Code confidentiel 9876543210 reçu';
  const cleanText = 'Formalité accomplie auprès de la recette des impôts de Guéliz';

  assert.equal(validateGuardText(badCin).valid, false);
  assert.equal(validateGuardText(badIban).valid, false);
  assert.equal(validateGuardText(badDigits).valid, false);
  assert.equal(validateGuardText(cleanText).valid, true);
});

test('Invariant 4: Party documents masked and fingerprinted without storing clear text', () => {
  const rawCin = 'BJ49812';
  const { lastFour, maskedDisplay } = maskDocumentNumber(rawCin);
  assert.equal(lastFour, '9812');
  assert.equal(maskedDisplay, '••••••9812');

  const fingerprint = generateHmacFingerprint(rawCin);
  assert.ok(fingerprint.startsWith('hmac_'));
  assert.equal(fingerprint, generateHmacFingerprint('bj 49812 ')); // normalization
});

test('Invariant 3: Cryptographic SHA-256 Audit Chain verifies integrity and detects tampering', () => {
  const chain: AuditLogEntry[] = [];

  const entry1 = appendAuditEntry(chain, 'CREATION_DOSSIER', 'VTE-2026-084', 'notaire', 'Ouverture dossier vente');
  assert.equal(entry1.success, true);
  chain.push(entry1.entry!);

  const entry2 = appendAuditEntry(chain, 'FORMALITE_CONSERVATION', 'VTE-2026-084', 'clerc', 'Dépôt réquisition CF');
  assert.equal(entry2.success, true);
  chain.push(entry2.entry!);

  // Verify untampered
  const verification = verifyChainIntegrity(chain);
  assert.equal(verification.valid, true);

  // Now tamper with entry 1
  const tamperedChain: AuditLogEntry[] = JSON.parse(JSON.stringify(chain));
  tamperedChain[0].stateSummary = 'Modification clandestine';

  const tamperedCheck = verifyChainIntegrity(tamperedChain);
  assert.equal(tamperedCheck.valid, false);
  assert.equal(tamperedCheck.tamperedIndex, 0);
  assert.match(tamperedCheck.message, /altérée au bloc 0/);
});

test('Invariant 5: AML access restriction returns 403 for secretary', () => {
  assert.equal(canAccessAml('notaire').allowed, true);
  assert.equal(canAccessAml('notaire').statusCode, 200);

  const secAccess = canAccessAml('secretaire');
  assert.equal(secAccess.allowed, false);
  assert.equal(secAccess.statusCode, 403);
  assert.match(secAccess.message || '', /Loi 43-05/);
});
