/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'notaire' | 'clerc' | 'secretaire';

export type ActCategory = 'vente' | 'societe' | 'donation' | 'succession' | 'credit';

export type FormalityStatus = 'pending' | 'in_progress' | 'completed' | 'waived';

export interface FormalityTypeDefinition {
  code: string;
  labelFr: string;
  labelAr: string;
  glossFr?: string;
  requires: string[]; // List of formality codes that must be completed or waived
  order: number;
}

export interface Formality {
  id: string;
  caseId: string;
  code: string;
  labelFr: string;
  labelAr: string;
  status: FormalityStatus;
  updatedAt: string;
  updatedBy: string;
  repertoireRef?: string; // Numéro d'ordre au répertoire ou date
  completionDate?: string;
  notes?: string;
}

export type PartyRole = 'vendeur' | 'acquereur' | 'conjoint' | 'gerant' | 'associe' | 'donateur' | 'donataire' | 'heritier' | 'creancier';

export interface Party {
  id: string;
  caseId: string;
  clientId?: string;
  role: PartyRole;
  fullNameFr: string;
  fullNameAr: string;
  documentType: 'CIN' | 'Passeport' | 'Carte_Sejour' | 'RC';
  documentLastFour: string; // e.g. "4921"
  hmacFingerprint: string; // HMAC-SHA256 of normalized document number
  nationality: string;
  isPep: boolean; // Personne politiquement exposée
}

export interface Client {
  id: string;
  fullNameFr: string;
  fullNameAr: string;
  documentType: 'CIN' | 'Passeport' | 'Carte_Sejour' | 'RC';
  documentLastFour: string;
  hmacFingerprint: string;
  firstRecordedAt: string;
  caseCount: number;
  amlFlagged: boolean;
}

export type ScreeningType = 'identity' | 'sanctions' | 'pep';
export type ScreeningOutcome = 'clear' | 'match' | 'inconclusive';

export interface ScreeningCheck {
  id: string;
  amlReviewId: string;
  partyId: string;
  partyName: string;
  checkType: ScreeningType;
  sourceName: string; // mandatory named source (e.g. "CNASNU", "Registre National", "ONU Résolutions")
  sourceVersionDate: string; // mandatory date/version (e.g. "2026-10-15")
  outcome: ScreeningOutcome;
  factualNote?: string; // mandatory if outcome === 'match'
  checkedAt: string;
  checkedBy: string;
  voided: boolean;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
}

export type AmlDecision = 'pending' | 'approved' | 'approved_with_monitoring' | 'refused';

export interface AmlReview {
  id: string;
  caseId: string;
  cashAmountMad: number;
  thresholdExceeded: boolean; // cash > 100 000 MAD (Loi 43-05 art. 13-1)
  decision: AmlDecision;
  decisionDate?: string;
  decidedBy?: string;
  decisionNote?: string;
  anrfDeclarationRequired: boolean; // Déclaration de soupçon à l'ANRF
  anrfDeclarationReference?: string;
  anrfDeclarationDate?: string;
}

export interface Correspondance {
  id: string;
  caseId: string;
  formalityCode: string;
  recipient: string;
  recipientRole: string;
  channel: 'lettre_recommandee_ar' | 'porteur' | 'courrier_simple';
  sentDate: string;
  trackingNumber?: string;
  acknowledgedDate?: string;
  deadlineDate: string;
  commitmentHonored: boolean | null; // null if pending, true if honored, false if defaulted
  notes?: string;
}

export interface AuditLogEntry {
  index: number;
  prevHash: string;
  currentHash: string;
  timestamp: string;
  action: string;
  caseRef: string;
  actorRole: UserRole;
  stateSummary: string; // Sanitized summary - guaranteed zero personal data
}

export interface Case {
  id: string;
  reference: string; // e.g. "VTE-2026-084"
  titleFr: string;
  titleAr: string;
  actCategory: ActCategory;
  actTypeLabel: string;
  status: 'open' | 'formalities_in_progress' | 'pending_signature' | 'closed';
  openedAt: string;
  closedAt?: string;
  propertyTitleNumber?: string; // Numéro Titre Foncier, e.g. "TF 45892/04"
  conservationBureau?: string; // e.g. "Marrakech Guéliz", "Casablanca Anfa"
  priceMad?: number;
  parties: Party[];
  formalities: Formality[];
  amlReviewId?: string;
  notes?: string;
}
