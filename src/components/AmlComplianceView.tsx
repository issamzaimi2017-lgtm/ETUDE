/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lock,
  Plus,
  Eye,
  FileCheck,
  Ban,
  User,
  Info,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Case, AmlReview, ScreeningCheck, UserRole, ScreeningType, ScreeningOutcome, AmlDecision } from '../domain/types.ts';
import { Language, DICTIONARY } from '../domain/i18n.ts';
import { canAccessAml, canRecordAmlDecision, voidScreeningCheck } from '../domain/services.ts';
import { validateGuardText } from '../domain/guards.ts';

interface AmlComplianceViewProps {
  cases: Case[];
  selectedCaseId: string;
  onSelectCase: (caseId: string) => void;
  amlReviews: Record<string, AmlReview>;
  screeningChecks: ScreeningCheck[];
  onAddScreeningCheck: (newCheck: Omit<ScreeningCheck, 'id' | 'checkedAt' | 'voided'>) => void;
  onVoidScreeningCheck: (checkId: string, voidReason: string) => void;
  onRecordAmlDecision: (
    caseId: string,
    decision: AmlDecision,
    cashAmount: number,
    decisionNote: string,
    anrfRequired: boolean,
    anrfRef?: string
  ) => void;
  currentRole: UserRole;
  language: Language;
}

export const AmlComplianceView: React.FC<AmlComplianceViewProps> = ({
  cases,
  selectedCaseId,
  onSelectCase,
  amlReviews,
  screeningChecks,
  onAddScreeningCheck,
  onVoidScreeningCheck,
  onRecordAmlDecision,
  currentRole,
  language,
}) => {
  const t = DICTIONARY[language];
  const access = canAccessAml(currentRole);

  const selectedCase = cases.find((c) => c.id === selectedCaseId) || cases[0];
  const currentReview = selectedCase?.amlReviewId ? amlReviews[selectedCase.amlReviewId] : null;
  const currentChecks = screeningChecks.filter(
    (chk) => chk.amlReviewId === selectedCase?.amlReviewId
  );

  // Modal: Add Screening Check
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [checkType, setCheckType] = useState<ScreeningType>('identity');
  const [sourceName, setSourceName] = useState('');
  const [sourceVersionDate, setSourceVersionDate] = useState(new Date().toISOString().split('T')[0]);
  const [outcome, setOutcome] = useState<ScreeningOutcome>('clear');
  const [factualNote, setFactualNote] = useState('');
  const [addCheckError, setAddCheckError] = useState<string | null>(null);

  // Modal: Void Check
  const [voidingCheck, setVoidingCheck] = useState<ScreeningCheck | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState<string | null>(null);

  // Decision Form
  const [candidateDecision, setCandidateDecision] = useState<AmlDecision>(
    currentReview?.decision || 'pending'
  );
  const [cashAmount, setCashAmount] = useState<number>(currentReview?.cashAmountMad || 0);
  const [decisionNote, setDecisionNote] = useState<string>(currentReview?.decisionNote || '');
  const [anrfRequired, setAnrfRequired] = useState<boolean>(
    currentReview?.anrfDeclarationRequired || false
  );
  const [anrfRef, setAnrfRef] = useState<string>(
    currentReview?.anrfDeclarationReference || ''
  );
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionSuccess, setDecisionSuccess] = useState<boolean>(false);

  // Strict 403 screen for secretary role (Invariant 5)
  if (!access.allowed) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-rose-200 p-8 text-center max-w-2xl mx-auto my-12 animate-in fade-in">
        <div className="w-16 h-16 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-300">
          <Lock className="w-8 h-8" />
        </div>
        <span className="inline-block px-3 py-1 bg-rose-900 text-rose-200 font-mono text-xs font-bold rounded-full mb-2">
          HTTP 403 FORBIDDEN • SECRET PROFESSIONNEL STRICT
        </span>
        <h2 className="text-xl font-bold text-slate-900 mb-2 font-serif">
          {t.amlForbidden403}
        </h2>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          {access.message}
        </p>
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-left text-xs text-slate-600 space-y-2">
          <p className="font-semibold text-slate-800">Fondement légal (Royaume du Maroc) :</p>
          <ul className="list-disc list-inside space-y-1 text-slate-600">
            <li>Loi n° 43-05 modifiée et complétée par la loi n° 12-18 (Lutte contre le blanchiment de capitaux)</li>
            <li>Article 18 : Confidentialité absolue des déclarations de soupçon transmises à l'ANRF</li>
            <li>Décret d'application relatif aux obligations de vigilance incombant aux notaires</li>
          </ul>
        </div>
      </div>
    );
  }

  const handleOpenAddModal = () => {
    if (selectedCase && selectedCase.parties.length > 0) {
      setSelectedPartyId(selectedCase.parties[0].id);
    }
    setCheckType('identity');
    setSourceName('CNIE Marocaine (DGSN)');
    setSourceVersionDate(new Date().toISOString().split('T')[0]);
    setOutcome('clear');
    setFactualNote('');
    setAddCheckError(null);
    setShowAddModal(true);
  };

  const handleSaveCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !selectedPartyId) return;

    if (!sourceName || sourceName.trim().length === 0) {
      setAddCheckError('Le nom de la source interrogée est strictement obligatoire.');
      return;
    }

    if (!sourceVersionDate) {
      setAddCheckError('La date de version ou de consultation de la liste est obligatoire.');
      return;
    }

    if (outcome === 'match' && (!factualNote || factualNote.trim().length < 6)) {
      setAddCheckError('Une note factuelle circonstanciée est obligatoire en cas de concordance (match).');
      return;
    }

    // PII Guard check on note
    if (factualNote) {
      const guard = validateGuardText(factualNote);
      if (!guard.valid) {
        setAddCheckError(guard.violationReason || 'Données sensibles interdites');
        return;
      }
    }

    const party = selectedCase.parties.find((p) => p.id === selectedPartyId);

    onAddScreeningCheck({
      amlReviewId: selectedCase.amlReviewId || `aml-${selectedCase.id}`,
      partyId: selectedPartyId,
      partyName: party?.fullNameFr || 'Partie',
      checkType,
      sourceName: sourceName.trim(),
      sourceVersionDate,
      outcome,
      factualNote: factualNote.trim() || undefined,
      checkedBy: currentRole === 'notaire' ? 'Maître Alami' : 'Clerc de notaire',
    });

    setShowAddModal(false);
  };

  const handleOpenVoidModal = (check: ScreeningCheck) => {
    setVoidingCheck(check);
    setVoidReason('');
    setVoidError(null);
  };

  const handleConfirmVoid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidingCheck) return;

    const res = voidScreeningCheck(
      voidingCheck,
      currentRole === 'notaire' ? 'Maître Alami' : 'Clerc de notaire',
      voidReason
    );

    if (!res.success) {
      setVoidError(res.error || 'Erreur lors de l\'invalidation');
      return;
    }

    onVoidScreeningCheck(voidingCheck.id, voidReason);
    setVoidingCheck(null);
  };

  const handleSaveDecision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !currentReview) return;

    // Guard on decision note
    if (decisionNote) {
      const guard = validateGuardText(decisionNote);
      if (!guard.valid) {
        setDecisionError(guard.violationReason || 'Données sensibles interdites');
        return;
      }
    }

    // Check invariant rule
    const check = canRecordAmlDecision(currentReview, currentChecks, candidateDecision, decisionNote);
    if (!check.allowed) {
      setDecisionError(check.reason || 'Décision non conforme');
      setDecisionSuccess(false);
      return;
    }

    setDecisionError(null);
    onRecordAmlDecision(
      selectedCase.id,
      candidateDecision,
      cashAmount,
      decisionNote,
      anrfRequired,
      anrfRef
    );
    setDecisionSuccess(true);
    setTimeout(() => setDecisionSuccess(false), 4000);
  };

  const isThresholdExceeded = cashAmount > 100000;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Case Selector Sidebar */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 font-serif">
                {t.navAml}
              </h2>
              <p className="text-xs text-slate-500">Obligation de vigilance (Loi 43-05)</p>
            </div>
            <span className="text-[10px] font-mono bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold">
              ANRF • CIK
            </span>
          </div>

          <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {cases.map((c) => {
              const review = c.amlReviewId ? amlReviews[c.amlReviewId] : null;
              const isSelected = selectedCase?.id === c.id;

              return (
                <div
                  key={c.id}
                  onClick={() => onSelectCase(c.id)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'border-amber-600 bg-amber-50/50 shadow-sm ring-1 ring-amber-600/30'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-slate-800">
                      {c.reference}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        review?.decision === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : review?.decision === 'approved_with_monitoring'
                          ? 'bg-purple-100 text-purple-800'
                          : review?.decision === 'refused'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {review?.decision === 'approved'
                        ? t.amlClear
                        : review?.decision === 'approved_with_monitoring'
                        ? t.amlMonitoring
                        : review?.decision === 'refused'
                        ? t.amlRefused
                        : t.amlPending}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-900 truncate">
                    {language === 'ar' ? c.titleAr : c.titleFr}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                    <span>Espèces déclarées:</span>
                    <span
                      className={`font-mono font-bold ${
                        (review?.cashAmountMad || 0) > 100000 ? 'text-rose-600' : 'text-slate-700'
                      }`}
                    >
                      {(review?.cashAmountMad || 0).toLocaleString('fr-FR')} MAD
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* AML Workspace for Selected Case */}
      <div className="lg:col-span-8 space-y-5">
        {selectedCase && (
          <>
            {/* Header / Threshold Banner */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded">
                      {selectedCase.reference}
                    </span>
                    <span className="text-xs text-slate-500">
                      Diligences LCB-FT du Notaire
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900">
                    {language === 'ar' ? selectedCase.titleAr : selectedCase.titleFr}
                  </h2>
                </div>

                {/* Threshold Badge */}
                <div
                  className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-2 ${
                    isThresholdExceeded
                      ? 'bg-rose-50 border-rose-300 text-rose-900 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  {isThresholdExceeded ? (
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  <span>
                    Espèces : {cashAmount.toLocaleString('fr-FR')} MAD{' '}
                    {isThresholdExceeded ? '(Seuil > 100k MAD franchi)' : '(Sous le seuil)'}
                  </span>
                </div>
              </div>

              {isThresholdExceeded && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 flex items-start gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Alerte Seuil Légal (Loi 43-05, Art. 13-1) : </span>
                    <span>{t.amlThresholdWarning}</span>
                  </div>
                </div>
              )}

              {/* Mandatory Checks Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-serif flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-amber-700" />
                    <span>{t.screeningChecksTitle}</span>
                  </h3>
                  <button
                    type="button"
                    onClick={handleOpenAddModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded text-xs font-semibold shadow-xs cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.addScreeningCheck}</span>
                  </button>
                </div>

                {/* Checks List */}
                <div className="space-y-2.5">
                  {currentChecks.length === 0 ? (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs text-slate-500">
                      Aucun contrôle enregistré. La décision du Notaire ne peut être validée sans vérification d'identité, de sanctions et PPE.
                    </div>
                  ) : (
                    currentChecks.map((chk) => (
                      <div
                        key={chk.id}
                        className={`p-3 rounded-lg border text-xs transition-colors ${
                          chk.voided
                            ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-70'
                            : chk.outcome === 'match'
                            ? 'bg-purple-50 border-purple-200 text-purple-950'
                            : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                                chk.checkType === 'identity'
                                  ? 'bg-blue-100 text-blue-800'
                                  : chk.checkType === 'sanctions'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-purple-100 text-purple-900'
                              }`}
                            >
                              {chk.checkType === 'identity'
                                ? 'Identité'
                                : chk.checkType === 'sanctions'
                                ? 'Sanctions ONU/CNASNU'
                                : 'PPE'}
                            </span>
                            <span className="font-semibold text-slate-900">{chk.partyName}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {chk.voided ? (
                              <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded text-[10px]">
                                <Ban className="w-3 h-3" />
                                Invalidé (Void)
                              </span>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[10px] ${
                                  chk.outcome === 'clear'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : chk.outcome === 'match'
                                    ? 'bg-purple-100 text-purple-900'
                                    : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                {chk.outcome === 'clear' ? (
                                  <>
                                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                                    {t.outcomeClear}
                                  </>
                                ) : chk.outcome === 'match' ? (
                                  <>
                                    <AlertTriangle className="w-3 h-3 text-purple-700" />
                                    {t.outcomeMatch}
                                  </>
                                ) : (
                                  <>
                                    <Info className="w-3 h-3 text-amber-600" />
                                    {t.outcomeInconclusive}
                                  </>
                                )}
                              </span>
                            )}

                            {!chk.voided && (
                              <button
                                type="button"
                                onClick={() => handleOpenVoidModal(chk)}
                                className="text-slate-400 hover:text-rose-600 text-[11px] underline ml-2 cursor-pointer"
                                title="Invalider ce contrôle avec motif (Invariant 2)"
                              >
                                {t.voidCheckBtn}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-600 space-y-0.5">
                          <p>
                            <span className="text-slate-400">Source :</span>{' '}
                            <span className="font-medium text-slate-800">{chk.sourceName}</span>{' '}
                            <span className="text-slate-400">| Version :</span>{' '}
                            <span className="font-mono">{chk.sourceVersionDate}</span>
                          </p>
                          {chk.factualNote && (
                            <p className="p-2 bg-white/70 border border-slate-200 rounded mt-1 text-slate-800 italic">
                              Note factuelle : {chk.factualNote}
                            </p>
                          )}
                          {chk.voided && (
                            <div className="mt-1 p-2 bg-rose-50 border border-rose-200 rounded text-rose-900">
                              <span className="font-bold">Motif d'invalidation (Art. 43-05) : </span>
                              <span>{chk.voidReason}</span>
                              <span className="block text-[10px] text-rose-700 mt-0.5">
                                Par {chk.voidedBy} le {new Date(chk.voidedAt!).toLocaleString('fr-FR')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Decision & Notary Recording Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-serif mb-3">
                Décision de conformité du Notaire (Loi 43-05)
              </h3>

              {decisionError && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-900">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{decisionError}</span>
                </div>
              )}

              {decisionSuccess && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2 text-xs text-emerald-900">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Décision enregistrée avec succès et cryptographiquement inscrite au journal.</span>
                </div>
              )}

              <form onSubmit={handleSaveDecision} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Cash Amount */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.amlCashDeclared} (MAD)
                    </label>
                    <input
                      type="number"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(Number(e.target.value))}
                      className="w-full text-xs font-mono p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Seuil de vigilance : 100 000 MAD.
                    </span>
                  </div>

                  {/* Decision Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Décision formelle
                    </label>
                    <select
                      value={candidateDecision}
                      onChange={(e) => setCandidateDecision(e.target.value as AmlDecision)}
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600 bg-white"
                    >
                      <option value="pending">En attente d'instruction</option>
                      <option value="approved">Conforme (Opération autorisée)</option>
                      <option value="approved_with_monitoring">Conforme avec vigilance renforcée</option>
                      <option value="refused">Refus d'instrumenter (Soupçon non levé)</option>
                    </select>
                  </div>
                </div>

                {/* Decision Note (with PII Guard) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Motivation juridique et constats de vigilance (Garde Loi 09-08 actif)
                  </label>
                  <textarea
                    rows={3}
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    placeholder="Ex: Justificatif bancaire d'origine des fonds examiné, concordance PPE sans anomalie..."
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Obligatoire en cas de concordance (match) ou de seuil espèces franchi.
                  </span>
                </div>

                {/* ANRF Declaration Toggle (Confidential) */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={anrfRequired}
                      onChange={(e) => setAnrfRequired(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                    />
                    <span>{t.amlAnrfAlert} (Loi 43-05 art. 18)</span>
                  </label>
                  {anrfRequired && (
                    <div className="pl-6 pt-1">
                      <label className="block text-[11px] text-slate-600 mb-1">
                        Numéro de référence du télé-déclaration ANRF
                      </label>
                      <input
                        type="text"
                        value={anrfRef}
                        onChange={(e) => setAnrfRef(e.target.value)}
                        placeholder="Ex: ANRF-DECL-2026-08492"
                        className="text-xs font-mono p-1.5 border border-slate-300 rounded w-full max-w-sm"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
                  >
                    {t.recordDecisionBtn}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>

      {/* Add Screening Check Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900 font-serif">
                {t.addScreeningCheck}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {addCheckError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-900">
                {addCheckError}
              </div>
            )}

            <form onSubmit={handleSaveCheck} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Partie concernée
                </label>
                <select
                  value={selectedPartyId}
                  onChange={(e) => setSelectedPartyId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  {selectedCase?.parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullNameFr} ({p.role}) - ••••••{p.documentLastFour}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nature de la vérification
                </label>
                <select
                  value={checkType}
                  onChange={(e) => {
                    const ct = e.target.value as ScreeningType;
                    setCheckType(ct);
                    if (ct === 'identity') setSourceName('CNIE Marocaine (DGSN)');
                    else if (ct === 'sanctions') setSourceName('CNASNU / Résolutions Conseil de Sécurité ONU');
                    else setSourceName('Déclaration souscrite PPE & Registre national');
                  }}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="identity">{t.checkTypeIdentity}</option>
                  <option value="sanctions">{t.checkTypeSanctions}</option>
                  <option value="pep">{t.checkTypePep}</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {t.sourceNameLabel}
                  </label>
                  <input
                    type="text"
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    placeholder="Ex: CNASNU"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {t.sourceVersionLabel}
                  </label>
                  <input
                    type="date"
                    value={sourceVersionDate}
                    onChange={(e) => setSourceVersionDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.outcomeLabel}
                </label>
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as ScreeningOutcome)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="clear">{t.outcomeClear}</option>
                  <option value="match">{t.outcomeMatch}</option>
                  <option value="inconclusive">{t.outcomeInconclusive}</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.factualNoteLabel} {outcome === 'match' && '(Obligatoire)'}
                </label>
                <textarea
                  rows={2}
                  value={factualNote}
                  onChange={(e) => setFactualNote(e.target.value)}
                  placeholder="Notes factuelles sans PII nominatif..."
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 border rounded text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded font-bold"
                >
                  Enregistrer le contrôle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Void Check Modal (Invariant 2) */}
      {voidingCheck && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900 font-serif">
                {t.voidCheckTitle}
              </h3>
              <button
                type="button"
                onClick={() => setVoidingCheck(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 mb-3">
              {t.voidCheckExplanation}
            </div>

            {voidError && (
              <div className="mb-3 p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-900">
                {voidError}
              </div>
            )}

            <form onSubmit={handleConfirmVoid} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Motif d'invalidation (obligatoire)
                </label>
                <textarea
                  rows={3}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder={t.voidReasonPlaceholder}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setVoidingCheck(null)}
                  className="px-3 py-1.5 border rounded text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded font-bold"
                >
                  Confirmer l'invalidation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
