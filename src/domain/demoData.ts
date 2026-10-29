/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Case, Client, AmlReview, ScreeningCheck, AuditLogEntry, Correspondance } from './types.ts';
import { generateHmacFingerprint } from './guards.ts';
import { appendAuditEntry, GENESIS_HASH } from './auditChain.ts';
import { instantiateSaleFormalities } from './services.ts';

// Pre-computed clients
export const INITIAL_CLIENTS: Client[] = [
  {
    id: 'cli-001',
    fullNameFr: 'Haj Abdelkader Benjelloun',
    fullNameAr: 'الحاج عبد القادر بنجلون',
    documentType: 'CIN',
    documentLastFour: '4821',
    hmacFingerprint: generateHmacFingerprint('AB44821'),
    firstRecordedAt: '2024-03-15T10:00:00Z',
    caseCount: 3,
    amlFlagged: false,
  },
  {
    id: 'cli-002',
    fullNameFr: 'Laila Mansouri',
    fullNameAr: 'ليلى المنصوري',
    documentType: 'CIN',
    documentLastFour: '7723',
    hmacFingerprint: generateHmacFingerprint('EE17723'),
    firstRecordedAt: '2025-06-20T14:30:00Z',
    caseCount: 1,
    amlFlagged: false,
  },
  {
    id: 'cli-003',
    fullNameFr: 'Mehdi Tazi',
    fullNameAr: 'مهدي التازي',
    documentType: 'CIN',
    documentLastFour: '1092',
    hmacFingerprint: generateHmacFingerprint('C881092'),
    firstRecordedAt: '2023-11-04T09:15:00Z',
    caseCount: 4,
    amlFlagged: true,
  },
  {
    id: 'cli-004',
    fullNameFr: 'Fatima Zahra El Alami',
    fullNameAr: 'فاطمة الزهراء العلمي',
    documentType: 'CIN',
    documentLastFour: '5561',
    hmacFingerprint: generateHmacFingerprint('BK35561'),
    firstRecordedAt: '2025-09-12T11:00:00Z',
    caseCount: 2,
    amlFlagged: false,
  },
];

// Initialize Formalities for Case 1 (VTE-2026-084)
const case1Formalities = instantiateSaleFormalities('case-vte-084', 'Maître Alami');
// Mark some steps as progressed/completed according to Moroccan notarial pipeline
case1Formalities[0].status = 'completed'; // Quittance CDG
case1Formalities[0].repertoireRef = 'REP-2026/0412';
case1Formalities[0].completionDate = '2026-02-02T10:00:00Z';

case1Formalities[1].status = 'completed'; // Enregistrement DGI
case1Formalities[1].repertoireRef = 'DGI/MRK/9021';
case1Formalities[1].completionDate = '2026-02-05T14:00:00Z';

case1Formalities[2].status = 'completed'; // TPI
case1Formalities[2].completionDate = '2026-02-07T11:30:00Z';

case1Formalities[3].status = 'completed'; // Taxes
case1Formalities[3].completionDate = '2026-02-08T09:00:00Z';

case1Formalities[4].status = 'completed'; // dgi_att
case1Formalities[4].completionDate = '2026-02-10T16:00:00Z';

case1Formalities[5].status = 'completed'; // Conservation Foncière (CF)
case1Formalities[5].repertoireRef = 'DEP-CF-45892';
case1Formalities[5].completionDate = '2026-02-14T11:00:00Z';

case1Formalities[6].status = 'in_progress'; // Syndic (in progress, waiting for syndicate attestation)
case1Formalities[7].status = 'in_progress'; // Concessionnaire (RADEEMA)
case1Formalities[8].status = 'pending'; // Changement de propriétaire
case1Formalities[9].status = 'pending'; // Solde de prix (BLOCKED by syndic, concessionnaire)
case1Formalities[10].status = 'completed'; // Engagement impôt
case1Formalities[11].status = 'in_progress'; // Lettre de relance engagement

// Case 2 Formalities (VTE-2026-079)
const case2Formalities = instantiateSaleFormalities('case-vte-079', 'Maître Alami');
case2Formalities[0].status = 'completed';
case2Formalities[1].status = 'in_progress';

// Case 3 Formalities (STE-2026-012)
const case3Formalities = [
  {
    id: 'form_ste_1',
    caseId: 'case-ste-012',
    code: 'certificat_negatif',
    labelFr: 'Certificat Négatif (OMPIC)',
    labelAr: 'الشهادة السلبية',
    status: 'completed' as const,
    updatedAt: '2026-02-18T10:00:00Z',
    updatedBy: 'Clerc',
    completionDate: '2026-02-18T10:00:00Z',
  },
  {
    id: 'form_ste_2',
    caseId: 'case-ste-012',
    code: 'blocage_capital',
    labelFr: 'Attestation de blocage de capital',
    labelAr: 'شهادة تجميد رأس المال',
    status: 'completed' as const,
    updatedAt: '2026-02-20T11:00:00Z',
    updatedBy: 'Maître Alami',
    completionDate: '2026-02-20T11:00:00Z',
  },
  {
    id: 'form_ste_3',
    caseId: 'case-ste-012',
    code: 'enregistrement_statuts',
    labelFr: 'Enregistrement DGI des statuts',
    labelAr: 'تسجيل القانون الأساسي بالضرائب',
    status: 'completed' as const,
    updatedAt: '2026-02-22T15:00:00Z',
    updatedBy: 'Clerc',
    completionDate: '2026-02-22T15:00:00Z',
  },
  {
    id: 'form_ste_4',
    caseId: 'case-ste-012',
    code: 'depot_greffe_tpi',
    labelFr: 'Dépôt au Greffe du TPI & Immatriculation RC',
    labelAr: 'الإيداع بكتابة الضبط والسجل التجاري بالمحكمة الابتدائية',
    status: 'in_progress' as const,
    updatedAt: '2026-02-25T09:00:00Z',
    updatedBy: 'Clerc',
  },
  {
    id: 'form_ste_5',
    caseId: 'case-ste-012',
    code: 'publication_bop',
    labelFr: 'Publication Bulletin Officiel & Journal d\'Annonces Légales',
    labelAr: 'النشر بالجريدة الرسمية وجريدة الإعلانات القانونية',
    status: 'pending' as const,
    updatedAt: '2026-02-25T09:00:00Z',
    updatedBy: 'Clerc',
  },
];

// Initial Cases
export const INITIAL_CASES: Case[] = [
  {
    id: 'case-vte-084',
    reference: 'VTE-2026-084',
    titleFr: 'Vente Appartement Résidence Al-Boustane, Marrakech',
    titleAr: 'بيع شقة سكنية إقامة البستان، جليز، مراكش',
    actCategory: 'vente',
    actTypeLabel: 'Vente immobilière',
    status: 'formalities_in_progress',
    openedAt: '2026-01-28T09:00:00Z',
    propertyTitleNumber: 'TF 45892/04',
    conservationBureau: 'Conservation Foncière Marrakech-Guéliz',
    priceMad: 1850000,
    parties: [
      {
        id: 'pty-101',
        caseId: 'case-vte-084',
        clientId: 'cli-001',
        role: 'vendeur',
        fullNameFr: 'Haj Abdelkader Benjelloun',
        fullNameAr: 'الحاج عبد القادر بنجلون',
        documentType: 'CIN',
        documentLastFour: '4821',
        hmacFingerprint: generateHmacFingerprint('AB44821'),
        nationality: 'Marocaine',
        isPep: false,
      },
      {
        id: 'pty-102',
        caseId: 'case-vte-084',
        clientId: 'cli-002',
        role: 'acquereur',
        fullNameFr: 'Laila Mansouri',
        fullNameAr: 'ليلى المنصوري',
        documentType: 'CIN',
        documentLastFour: '7723',
        hmacFingerprint: generateHmacFingerprint('EE17723'),
        nationality: 'Marocaine',
        isPep: false,
      },
    ],
    formalities: case1Formalities,
    amlReviewId: 'aml-rev-084',
    notes: 'Dossier standard. Prix intégralement consigné sur le compte CDG de l\'étude.',
  },
  {
    id: 'case-vte-079',
    reference: 'VTE-2026-079',
    titleFr: 'Vente Villa Quartier Californie, Casablanca',
    titleAr: 'بيع فيلا سكنية حي كاليفورنيا، الدار البيضاء',
    actCategory: 'vente',
    actTypeLabel: 'Vente immobilière',
    status: 'formalities_in_progress',
    openedAt: '2026-01-15T11:00:00Z',
    propertyTitleNumber: 'TF 98124/C',
    conservationBureau: 'Conservation Foncière Casablanca-Anfa',
    priceMad: 5400000,
    parties: [
      {
        id: 'pty-201',
        caseId: 'case-vte-079',
        clientId: 'cli-003',
        role: 'vendeur',
        fullNameFr: 'Mehdi Tazi',
        fullNameAr: 'مهدي التازي',
        documentType: 'CIN',
        documentLastFour: '1092',
        hmacFingerprint: generateHmacFingerprint('C881092'),
        nationality: 'Marocaine',
        isPep: true,
      },
      {
        id: 'pty-202',
        caseId: 'case-vte-079',
        clientId: 'cli-004',
        role: 'acquereur',
        fullNameFr: 'Fatima Zahra El Alami',
        fullNameAr: 'فاطمة الزهراء العلمي',
        documentType: 'CIN',
        documentLastFour: '5561',
        hmacFingerprint: generateHmacFingerprint('BK35561'),
        nationality: 'Marocaine',
        isPep: false,
      },
    ],
    formalities: case2Formalities,
    amlReviewId: 'aml-rev-079',
    notes: 'Vente avec acompte espèces de 180 000 MAD. Seuil Loi 43-05 franchi.',
  },
  {
    id: 'case-ste-012',
    reference: 'STE-2026-012',
    titleFr: 'Constitution SARL AU "Atlas Logistique"',
    titleAr: 'تأسيس شركة ذات المسؤولية المحدودة بشريك وحيد أطلس للوجستيك',
    actCategory: 'societe',
    actTypeLabel: 'Constitution de société',
    status: 'formalities_in_progress',
    openedAt: '2026-02-15T14:00:00Z',
    priceMad: 100000, // Capital social
    parties: [
      {
        id: 'pty-301',
        caseId: 'case-ste-012',
        clientId: 'cli-003',
        role: 'gerant',
        fullNameFr: 'Mehdi Tazi',
        fullNameAr: 'مهدي التازي',
        documentType: 'CIN',
        documentLastFour: '1092',
        hmacFingerprint: generateHmacFingerprint('C881092'),
        nationality: 'Marocaine',
        isPep: true,
      },
    ],
    formalities: case3Formalities,
    amlReviewId: 'aml-rev-012',
    notes: 'Capital entièrement libéré en compte bancaire bloqué.',
  },
  {
    id: 'case-don-003',
    reference: 'DON-2026-003',
    titleFr: 'Donation entre vifs (Hiba / صدقة) - Propriété Ourika',
    titleAr: 'هبة عقارية لوجه الله بين الأصول والفروع - ملك أوريكا',
    actCategory: 'donation',
    actTypeLabel: 'Donation (Hiba)',
    status: 'pending_signature',
    openedAt: '2026-02-01T10:00:00Z',
    propertyTitleNumber: 'TF 18402/M',
    conservationBureau: 'Conservation Foncière Tahannaout',
    priceMad: 0,
    parties: [
      {
        id: 'pty-401',
        caseId: 'case-don-003',
        clientId: 'cli-001',
        role: 'donateur',
        fullNameFr: 'Haj Abdelkader Benjelloun',
        fullNameAr: 'الحاج عبد القادر بنجلون',
        documentType: 'CIN',
        documentLastFour: '4821',
        hmacFingerprint: generateHmacFingerprint('AB44821'),
        nationality: 'Marocaine',
        isPep: false,
      },
    ],
    formalities: [
      {
        id: 'form_don_1',
        caseId: 'case-don-003',
        code: 'enregistrement_dgi',
        labelFr: 'Enregistrement DGI (Droit fixe donation directe)',
        labelAr: 'التسجيل بإدارة الضرائب بنسبة الإعفاء النسبي للأصول',
        status: 'completed',
        updatedAt: '2026-02-10T12:00:00Z',
        updatedBy: 'Maître Alami',
        completionDate: '2026-02-10T12:00:00Z',
      },
      {
        id: 'form_don_2',
        caseId: 'case-don-003',
        code: 'inscription_cf',
        labelFr: 'Inscription Conservation Foncière (CF)',
        labelAr: 'التقييد بالمحافظة العقارية',
        status: 'in_progress',
        updatedAt: '2026-02-15T15:00:00Z',
        updatedBy: 'Clerc',
      },
    ],
    amlReviewId: 'aml-rev-003',
    notes: 'Donation parents à enfants, conformité Code des Droits Réels (Loi 39-08).',
  },
];

// Initial AML Reviews
export const INITIAL_AML_REVIEWS: Record<string, AmlReview> = {
  'aml-rev-084': {
    id: 'aml-rev-084',
    caseId: 'case-vte-084',
    cashAmountMad: 0,
    thresholdExceeded: false,
    decision: 'approved',
    decisionDate: '2026-01-29T15:30:00Z',
    decidedBy: 'Maître Alami',
    decisionNote: 'Paiement intégralement scriptural par virement bancaire CDG. Profil acquéreur et vendeur sans anomalie.',
    anrfDeclarationRequired: false,
  },
  'aml-rev-079': {
    id: 'aml-rev-079',
    caseId: 'case-vte-079',
    cashAmountMad: 180000, // > 100 000 MAD threshold
    thresholdExceeded: true,
    decision: 'approved_with_monitoring',
    decisionDate: '2026-01-18T16:00:00Z',
    decidedBy: 'Maître Alami',
    decisionNote: 'Seuil espèces franchi (180 000 MAD). Justificatif d\'origine des fonds examiné (retrait bancaire nominatif avec bordereau). Vendeur identifié comme PPE (ancien élu local). Vigilance renforcée appliquée conformément à l\'article 6 de la loi 43-05.',
    anrfDeclarationRequired: false,
  },
  'aml-rev-012': {
    id: 'aml-rev-012',
    caseId: 'case-ste-012',
    cashAmountMad: 0,
    thresholdExceeded: false,
    decision: 'pending',
    anrfDeclarationRequired: false,
  },
  'aml-rev-003': {
    id: 'aml-rev-003',
    caseId: 'case-don-003',
    cashAmountMad: 0,
    thresholdExceeded: false,
    decision: 'approved',
    decisionDate: '2026-02-02T10:00:00Z',
    decidedBy: 'Maître Alami',
    decisionNote: 'Transmission à titre gratuit au profit d\'un descendant direct.',
    anrfDeclarationRequired: false,
  },
};

// Initial Screening Checks
export const INITIAL_SCREENING_CHECKS: ScreeningCheck[] = [
  // For Case 084
  {
    id: 'chk-084-1',
    amlReviewId: 'aml-rev-084',
    partyId: 'pty-101',
    partyName: 'Haj Abdelkader Benjelloun',
    checkType: 'identity',
    sourceName: 'CNIE Marocaine (DGSN)',
    sourceVersionDate: '2026-01-28',
    outcome: 'clear',
    checkedAt: '2026-01-28T09:30:00Z',
    checkedBy: 'Maître Alami',
    voided: false,
  },
  {
    id: 'chk-084-2',
    amlReviewId: 'aml-rev-084',
    partyId: 'pty-101',
    partyName: 'Haj Abdelkader Benjelloun',
    checkType: 'sanctions',
    sourceName: 'CNASNU (Commission Nationale des Sanctions) & ONU Res. 1267/1988/2253',
    sourceVersionDate: '2026-01-20',
    outcome: 'clear',
    checkedAt: '2026-01-28T09:40:00Z',
    checkedBy: 'Maître Alami',
    voided: false,
  },
  {
    id: 'chk-084-3',
    amlReviewId: 'aml-rev-084',
    partyId: 'pty-101',
    partyName: 'Haj Abdelkader Benjelloun',
    checkType: 'pep',
    sourceName: 'Déclaration souscrite & Registre national des personnes politiquement exposées',
    sourceVersionDate: '2026-01-28',
    outcome: 'clear',
    checkedAt: '2026-01-28T09:45:00Z',
    checkedBy: 'Maître Alami',
    voided: false,
  },
  {
    id: 'chk-084-4',
    amlReviewId: 'aml-rev-084',
    partyId: 'pty-102',
    partyName: 'Laila Mansouri',
    checkType: 'identity',
    sourceName: 'CNIE Marocaine (DGSN)',
    sourceVersionDate: '2026-01-28',
    outcome: 'clear',
    checkedAt: '2026-01-28T10:00:00Z',
    checkedBy: 'Maître Alami',
    voided: false,
  },
  {
    id: 'chk-084-5',
    amlReviewId: 'aml-rev-084',
    partyId: 'pty-102',
    partyName: 'Laila Mansouri',
    checkType: 'sanctions',
    sourceName: 'CNASNU & ONU Res. 1267',
    sourceVersionDate: '2026-01-20',
    outcome: 'clear',
    checkedAt: '2026-01-28T10:05:00Z',
    checkedBy: 'Maître Alami',
    voided: false,
  },
  {
    id: 'chk-084-6',
    amlReviewId: 'aml-rev-084',
    partyId: 'pty-102',
    partyName: 'Laila Mansouri',
    checkType: 'pep',
    sourceName: 'Déclaration souscrite PPE',
    sourceVersionDate: '2026-01-28',
    outcome: 'clear',
    checkedAt: '2026-01-28T10:10:00Z',
    checkedBy: 'Maître Alami',
    voided: false,
  },

  // For Case 079 (Includes a VOIDED check showing Invariant 2)
  {
    id: 'chk-079-voided',
    amlReviewId: 'aml-rev-079',
    partyId: 'pty-201',
    partyName: 'Mehdi Tazi',
    checkType: 'sanctions',
    sourceName: 'Liste générale non vérifiée',
    sourceVersionDate: '2025-12-01',
    outcome: 'match',
    factualNote: 'Signalement initial sur homonymie avec une personne sous gel des avoirs.',
    checkedAt: '2026-01-16T11:00:00Z',
    checkedBy: 'Clerc',
    voided: true,
    voidedAt: '2026-01-16T15:30:00Z',
    voidedBy: 'Maître Alami',
    voidReason: 'Homonymie infondée: la personne sous mandat a une date de naissance distincte et réside à l\'étranger. Invalidation motivée.',
  },
  {
    id: 'chk-079-1',
    amlReviewId: 'aml-rev-079',
    partyId: 'pty-201',
    partyName: 'Mehdi Tazi',
    checkType: 'identity',
    sourceName: 'CNIE Marocaine (DGSN)',
    sourceVersionDate: '2026-01-16',
    outcome: 'clear',
    checkedAt: '2026-01-16T16:00:00Z',
    checkedBy: 'Maître Alami',
    voided: false,
  },
  {
    id: 'chk-079-2',
    amlReviewId: 'aml-rev-079',
    partyId: 'pty-201',
    partyName: 'Mehdi Tazi',
    checkType: 'sanctions',
    sourceName: 'CNASNU (Mise à jour officielle consolidée)',
    sourceVersionDate: '2026-01-15',
    outcome: 'clear',
    checkedAt: '2026-01-16T16:10:00Z',
    checkedBy: 'Maître Alami',
    voided: false,
  },
  {
    id: 'chk-079-3',
    amlReviewId: 'aml-rev-079',
    partyId: 'pty-201',
    partyName: 'Mehdi Tazi',
    checkType: 'pep',
    sourceName: 'Déclaration d\'intérêts & Statut d\'ancien président de chambre professionnelle',
    sourceVersionDate: '2026-01-16',
    outcome: 'match',
    factualNote: 'Personne Politiquement Exposée nationale: ancien titulaire d\'un mandat électif public (fonction cessée il y a 18 mois). Vigilance accrue requise.',
    checkedAt: '2026-01-16T16:15:00Z',
    checkedBy: 'Maître Alami',
    voided: false,
  },
];

// Initial Audit Trail (Pre-chained with real SHA-256 blocks, zero PII)
export const INITIAL_AUDIT_LOG: AuditLogEntry[] = (() => {
  const chain: AuditLogEntry[] = [];
  
  const entriesData = [
    { action: 'INITIALISATION_SYSTEME', caseRef: 'ETUDE-INIT', role: 'notaire' as const, summary: 'Démarrage du journal cryptographique de l\'étude', time: '2026-01-01T08:00:00Z' },
    { action: 'CREATION_DOSSIER', caseRef: 'VTE-2026-079', role: 'notaire' as const, summary: 'Ouverture dossier vente villa Californie', time: '2026-01-15T11:00:00Z' },
    { action: 'LCBFT_CONTROLE_INITIE', caseRef: 'VTE-2026-079', role: 'notaire' as const, summary: 'Contrôle listes sanctions et PPE exécuté', time: '2026-01-16T16:15:00Z' },
    { action: 'LCBFT_DECISION_VALIDEE', caseRef: 'VTE-2026-079', role: 'notaire' as const, summary: 'Décision de vigilance renforcée validée avec surveillance', time: '2026-01-18T16:00:00Z' },
    { action: 'CREATION_DOSSIER', caseRef: 'VTE-2026-084', role: 'notaire' as const, summary: 'Ouverture dossier vente appartement Guéliz', time: '2026-01-28T09:00:00Z' },
    { action: 'FORMALITE_VALIDE', caseRef: 'VTE-2026-084', role: 'clerc' as const, summary: 'Validation quittance CDG et enregistrement DGI', time: '2026-02-05T14:00:00Z' },
    { action: 'FORMALITE_CONSERVATION', caseRef: 'VTE-2026-084', role: 'notaire' as const, summary: 'Inscription effectuée à la Conservation Foncière', time: '2026-02-14T11:00:00Z' },
  ];

  for (const item of entriesData) {
    const res = appendAuditEntry(chain, item.action, item.caseRef, item.role, item.summary, item.time);
    if (res.success && res.entry) {
      chain.push(res.entry);
    }
  }

  return chain;
})();

// Initial Correspondances (Letters of commitment / Relances)
export const INITIAL_CORRESPONDANCES: Correspondance[] = [
  {
    id: 'corresp-001',
    caseId: 'case-vte-084',
    formalityCode: 'lettre_engagement',
    recipient: 'Receveur de l\'Administration Fiscale - Direction Régionale Marrakech',
    recipientRole: 'Administration fiscale',
    channel: 'lettre_recommandee_ar',
    sentDate: '2026-02-12',
    trackingNumber: 'RR-88421092-MA',
    acknowledgedDate: '2026-02-15',
    deadlineDate: '2026-03-15',
    commitmentHonored: null,
    notes: 'Notification de l\'engagement fiscal de paiement en l\'acquit du cédant pour mainlevée.',
  },
  {
    id: 'corresp-002',
    caseId: 'case-vte-084',
    formalityCode: 'syndic',
    recipient: 'Syndic de copropriété - Résidence Al-Boustane Marrakech',
    recipientRole: 'Syndic',
    channel: 'porteur',
    sentDate: '2026-02-16',
    trackingNumber: 'ACC-PORT-2026/18',
    acknowledgedDate: '2026-02-16',
    deadlineDate: '2026-02-28',
    commitmentHonored: null,
    notes: 'Demande urgente de délivrance du quitus de charges de copropriété conformément à l\'article 24 de la loi 18-00.',
  },
];
