/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Case,
  Formality,
  FormalityTypeDefinition,
  FormalityStatus,
  AmlReview,
  ScreeningCheck,
  AmlDecision,
  UserRole,
  Party,
  Client,
} from './types.ts';
import { generateHmacFingerprint, normalizeDocumentNumber, validateGuardText } from './guards.ts';

// Standard 12-step Sale Pipeline for Moroccan Notarial Practice (Vente immobilière)
// Verbatim reference labels copied as instructed in prompt invariant 8:
export const SALE_FORMALITY_TEMPLATES: FormalityTypeDefinition[] = [
  { code: 'quittance_cdg', labelFr: 'Quittance CDG', labelAr: 'توصيل صندوق الإيداع والتدبير', order: 1, requires: [] },
  { code: 'enregistrement_dgi', labelFr: 'Enregistrement DGI', labelAr: 'التسجيل بإدارة الضرائب', order: 2, requires: [] },
  { code: 'tpi', labelFr: 'TPI', labelAr: 'ضريبة الأرباح العقارية', glossFr: 'Taxe sur profits immobiliers', order: 3, requires: [] },
  { code: 'taxes', labelFr: 'Taxes', labelAr: 'الرسوم الجماعية والخدمات', glossFr: 'Taxes communales et taxe d\'habitation', order: 4, requires: [] },
  { code: 'dgi_att', labelFr: 'Attestation fiscale DGI (dgi_att)', labelAr: 'شهادة الإبراء الضريبي', order: 5, requires: [] },
  { code: 'conservation_fonciere', labelFr: 'Conservation Foncière (CF)', labelAr: 'المحافظة العقارية', order: 6, requires: [] },
  { code: 'syndic', labelFr: 'Attestation de syndic', labelAr: 'شهادة إبراء السنديك', order: 7, requires: [] },
  { code: 'concessionnaire', labelFr: 'Concessionnaire (Eau & Électricité)', labelAr: 'وكالة توزيع الماء والكهرباء', glossFr: 'Lydec, RADEEMA, Redal, etc.', order: 8, requires: [] },
  { code: 'changement_proprio', labelFr: 'Changement de propriétaire', labelAr: 'تغيير اسم المالك في العدادات', order: 9, requires: [] },
  {
    code: 'solde_prix',
    labelFr: 'Libération solde de prix (solde_prix)',
    labelAr: 'الإفراج عن باقي الثمن والوديعة',
    glossFr: 'Mainlevée et paiement vendeur après purge des oppositions',
    order: 10,
    requires: ['conservation_fonciere', 'syndic', 'concessionnaire', 'dgi_att'],
  },
  { code: 'engagement_impot', labelFr: 'Engagement impôt', labelAr: 'التزام ضريبي', order: 11, requires: [] },
  {
    code: 'lettre_engagement',
    labelFr: 'Lettre de relance engagement',
    labelAr: 'رسالة التذكير بالالتزام',
    order: 12,
    requires: ['engagement_impot'],
  },
];

/**
 * Creates standard formalities for a newly instantiated Moroccan sale case
 */
export function instantiateSaleFormalities(caseId: string, currentUser: string): Formality[] {
  const now = new Date().toISOString();
  return SALE_FORMALITY_TEMPLATES.map((tmpl) => ({
    id: `form_${caseId}_${tmpl.code}`,
    caseId,
    code: tmpl.code,
    labelFr: tmpl.labelFr,
    labelAr: tmpl.labelAr,
    status: 'pending' as FormalityStatus,
    updatedAt: now,
    updatedBy: currentUser,
  }));
}

/**
 * Validates dependencies before transitioning a formality to completed.
 * Invariant 1: A formality cannot complete while a dependency is open.
 * "Waived" counts as satisfied.
 */
export function checkFormalityDependencies(
  targetCode: string,
  formalities: Formality[]
): { allowed: boolean; blockingCodes: string[]; reason?: string } {
  const tmpl = SALE_FORMALITY_TEMPLATES.find((t) => t.code === targetCode);
  if (!tmpl || tmpl.requires.length === 0) {
    return { allowed: true, blockingCodes: [] };
  }

  const blockingCodes: string[] = [];

  for (const reqCode of tmpl.requires) {
    const dep = formalities.find((f) => f.code === reqCode);
    if (!dep) {
      blockingCodes.push(reqCode);
      continue;
    }
    // Only 'completed' or 'waived' satisfy dependency
    if (dep.status !== 'completed' && dep.status !== 'waived') {
      blockingCodes.push(reqCode);
    }
  }

  if (blockingCodes.length > 0) {
    const blockingLabels = blockingCodes
      .map((code) => {
        const found = SALE_FORMALITY_TEMPLATES.find((t) => t.code === code);
        return found ? found.labelFr : code;
      })
      .join(', ');

    return {
      allowed: false,
      blockingCodes,
      reason: `Dépendances non purgées: la formalité requiert préalablement l'accomplissement ou la dispense de [${blockingLabels}].`,
    };
  }

  return { allowed: true, blockingCodes: [] };
}

/**
 * Sets formality status with strict invariant enforcement.
 * Invariant 1 & 2: A completed formality never reopens; dependencies must be met to complete.
 */
export function setFormalityStatus(
  currentFormality: Formality,
  allFormalities: Formality[],
  newStatus: FormalityStatus,
  user: string,
  repertoireRef?: string,
  notes?: string
): { success: boolean; updatedFormality?: Formality; error?: string } {
  // Invariant 2: A completed formality never reopens
  if (currentFormality.status === 'completed' && newStatus !== 'completed') {
    return {
      success: false,
      error: 'Règle métier stricte (Invariant 2): Une formalité accomplie et enregistrée au répertoire ne peut être réouverte.',
    };
  }

  // Free-text guard check on notes
  if (notes) {
    const guardCheck = validateGuardText(notes);
    if (!guardCheck.valid) {
      return { success: false, error: guardCheck.violationReason };
    }
  }

  // If transitioning to completed, verify dependencies
  if (newStatus === 'completed') {
    const depCheck = checkFormalityDependencies(currentFormality.code, allFormalities);
    if (!depCheck.allowed) {
      return { success: false, error: depCheck.reason };
    }
  }

  const updated: Formality = {
    ...currentFormality,
    status: newStatus,
    updatedAt: new Date().toISOString(),
    updatedBy: user,
    repertoireRef: repertoireRef || currentFormality.repertoireRef,
    completionDate: newStatus === 'completed' ? new Date().toISOString() : currentFormality.completionDate,
    notes: notes !== undefined ? notes : currentFormality.notes,
  };

  return { success: true, updatedFormality: updated };
}

/**
 * Case.close() rule
 * Invariant 1: A case cannot close with an open formality.
 */
export function canCloseCase(c: Case): { allowed: boolean; openCount: number; reason?: string } {
  const openFormalities = c.formalities.filter(
    (f) => f.status === 'pending' || f.status === 'in_progress'
  );

  if (openFormalities.length > 0) {
    return {
      allowed: false,
      openCount: openFormalities.length,
      reason: `Clôture impossible (Art. 36 Loi 32-09 & Invariant 1): ${openFormalities.length} formalité(s) encore en cours ou en attente (${openFormalities.map((f) => f.labelFr).slice(0, 3).join(', ')}...).`,
    };
  }

  return { allowed: true, openCount: 0 };
}

/**
 * AML Review Decision Rule
 * Invariant 1 & Loi 43-05:
 * A decision cannot be recorded without screening checks:
 * 1. Identity check exists and is not voided
 * 2. Sanctions-list check exists, is not voided, has a named source and version/date
 * 3. PEP check exists and is not voided
 * If any active check has outcome 'match', a factual note is mandatory.
 */
export function canRecordAmlDecision(
  _review: AmlReview,
  checks: ScreeningCheck[],
  candidateDecision: AmlDecision,
  candidateNote?: string
): { allowed: boolean; reason?: string } {
  if (candidateDecision === 'pending') {
    return { allowed: true };
  }

  const activeChecks = checks.filter((c) => !c.voided);

  // 1. Identity check verification
  const idCheck = activeChecks.find((c) => c.checkType === 'identity');
  if (!idCheck) {
    return {
      allowed: false,
      reason: 'Décision LCB-FT refusée: vérification formelle de la pièce d\'identité manquante.',
    };
  }

  // 2. Sanctions list check verification (must have named source and version/date)
  const sanctionsCheck = activeChecks.find((c) => c.checkType === 'sanctions');
  if (!sanctionsCheck) {
    return {
      allowed: false,
      reason: 'Décision LCB-FT refusée: filtrage sur les listes de sanctions (ONU / CNASNU) manquant.',
    };
  }
  if (!sanctionsCheck.sourceName || sanctionsCheck.sourceName.trim() === '') {
    return {
      allowed: false,
      reason: 'Décision LCB-FT refusée: la source de la liste de sanctions doit être expressément nommée (ex: CNASNU, ONU).',
    };
  }
  if (!sanctionsCheck.sourceVersionDate || sanctionsCheck.sourceVersionDate.trim() === '') {
    return {
      allowed: false,
      reason: 'Décision LCB-FT refusée: la date ou version de la liste de sanctions consultée est obligatoire.',
    };
  }

  // 3. PEP (PPE) check verification
  const pepCheck = activeChecks.find((c) => c.checkType === 'pep');
  if (!pepCheck) {
    return {
      allowed: false,
      reason: 'Décision LCB-FT refusée: contrôle PPE (Personne Politiquement Exposée) manquant.',
    };
  }

  // 4. Outcome 'match' check requirement
  const matchExists = activeChecks.some((c) => c.outcome === 'match');
  if (matchExists) {
    const hasNote = (candidateNote && candidateNote.trim().length > 5) || activeChecks.some(c => c.outcome === 'match' && c.factualNote && c.factualNote.trim().length > 5);
    if (!hasNote) {
      return {
        allowed: false,
        reason: 'Décision LCB-FT refusée: une concordance (match) a été relevée lors du filtrage. Une note factuelle circonstanciée est obligatoire avant toute décision.',
      };
    }
  }

  return { allowed: true };
}

/**
 * Voiding a screening check instead of deleting it.
 * Invariant 2: Nothing is deleted to correct a mistake. A wrong check is voided (dated, attributed, reasoned).
 */
export function voidScreeningCheck(
  check: ScreeningCheck,
  user: string,
  voidReason: string
): { success: boolean; updatedCheck?: ScreeningCheck; error?: string } {
  if (!voidReason || voidReason.trim().length < 5) {
    return {
      success: false,
      error: 'Un motif d\'invalidation précis est obligatoirement requis pour annuler un contrôle de vigilance.',
    };
  }

  const guardCheck = validateGuardText(voidReason);
  if (!guardCheck.valid) {
    return { success: false, error: guardCheck.violationReason };
  }

  const updated: ScreeningCheck = {
    ...check,
    voided: true,
    voidedAt: new Date().toISOString(),
    voidedBy: user,
    voidReason: voidReason.trim(),
  };

  return { success: true, updatedCheck: updated };
}

/**
 * AML Access Control (RBAC)
 * Invariant 5: The AML file is a separate application, table and permission.
 * Secretary gets 403 / access denied, not an empty screen.
 * Under Moroccan Law 43-05 (Art. 18), suspicious transaction records are strictly confidential.
 */
export function canAccessAml(role: UserRole): {
  allowed: boolean;
  statusCode: number;
  message?: string;
} {
  if (role === 'notaire') {
    return { allowed: true, statusCode: 200 };
  }

  if (role === 'clerc') {
    // Clerc can view but cannot validate ANRF declarations or final decisions
    return { allowed: true, statusCode: 200 };
  }

  // Secretary is strictly forbidden by law
  return {
    allowed: false,
    statusCode: 403,
    message: 'Accès 403 Refusé: Le registre de vigilance LCB-FT et les déclarations de soupçon relèvent du secret légal (Loi 43-05, Art. 18). Accès strictement réservé au Notaire titulaire.',
  };
}

/**
 * Matches a Party to an existing Client across dossiers or prepares a new Client.
 * Invariant 6: Party ≠ Client.
 */
export function matchOrCreateClient(
  party: {
    fullNameFr: string;
    fullNameAr: string;
    documentType: 'CIN' | 'Passeport' | 'Carte_Sejour' | 'RC';
    rawDocNumber: string;
  },
  existingClients: Client[]
): { client: Client; isNew: boolean } {
  const fingerprint = generateHmacFingerprint(party.rawDocNumber);
  const normalizedLastFour = normalizeDocumentNumber(party.rawDocNumber).slice(-4);

  // 1. Primary match: by HMAC fingerprint
  const matchByFingerprint = existingClients.find((c) => c.hmacFingerprint === fingerprint);
  if (matchByFingerprint) {
    return { client: matchByFingerprint, isNew: false };
  }

  // 2. Fallback match: exact normalized name match
  const matchByName = existingClients.find(
    (c) => c.fullNameFr.trim().toLowerCase() === party.fullNameFr.trim().toLowerCase()
  );
  if (matchByName) {
    return { client: matchByName, isNew: false };
  }

  // Create new client record
  const newClient: Client = {
    id: `cli_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    fullNameFr: party.fullNameFr.trim(),
    fullNameAr: party.fullNameAr.trim(),
    documentType: party.documentType,
    documentLastFour: normalizedLastFour,
    hmacFingerprint: fingerprint,
    firstRecordedAt: new Date().toISOString(),
    caseCount: 1,
    amlFlagged: false,
  };

  return { client: newClient, isNew: true };
}
