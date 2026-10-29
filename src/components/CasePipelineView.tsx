/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Lock,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Building,
  User,
  Plus,
  Ban,
  ArrowRight
} from 'lucide-react';
import { Case, Formality, FormalityStatus, UserRole } from '../domain/types.ts';
import { Language, DICTIONARY } from '../domain/i18n.ts';
import { SALE_FORMALITY_TEMPLATES, setFormalityStatus, canCloseCase, checkFormalityDependencies } from '../domain/services.ts';
import { validateGuardText } from '../domain/guards.ts';

interface CasePipelineViewProps {
  cases: Case[];
  selectedCaseId: string;
  onSelectCase: (caseId: string) => void;
  onUpdateFormality: (
    caseId: string,
    formalityCode: string,
    newStatus: FormalityStatus,
    repertoireRef?: string,
    notes?: string
  ) => void;
  onCloseCase: (caseId: string) => void;
  onOpenNewCaseModal: () => void;
  onNavigateToAml: (caseId: string) => void;
  currentRole: UserRole;
  language: Language;
}

export const CasePipelineView: React.FC<CasePipelineViewProps> = ({
  cases,
  selectedCaseId,
  onSelectCase,
  onUpdateFormality,
  onCloseCase,
  onOpenNewCaseModal,
  onNavigateToAml,
  currentRole,
  language,
}) => {
  const t = DICTIONARY[language];
  const selectedCase = cases.find((c) => c.id === selectedCaseId) || cases[0];

  // State for Formality update modal
  const [editingFormality, setEditingFormality] = useState<Formality | null>(null);
  const [newStatus, setNewStatus] = useState<FormalityStatus>('in_progress');
  const [repertoireRef, setRepertoireRef] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [formalityError, setFormalityError] = useState<string | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredCases = cases.filter((c) => {
    if (statusFilter === 'all') return true;
    return c.status === statusFilter;
  });

  const handleOpenEditModal = (formality: Formality) => {
    setEditingFormality(formality);
    setNewStatus(formality.status);
    setRepertoireRef(formality.repertoireRef || '');
    setNotes(formality.notes || '');
    setFormalityError(null);
  };

  const handleSaveFormality = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFormality || !selectedCase) return;

    // Check guard text on notes
    if (notes) {
      const guard = validateGuardText(notes);
      if (!guard.valid) {
        setFormalityError(guard.violationReason || 'Données sensibles interdites');
        return;
      }
    }

    // Call service to validate invariants
    const result = setFormalityStatus(
      editingFormality,
      selectedCase.formalities,
      newStatus,
      currentRole,
      repertoireRef,
      notes
    );

    if (!result.success) {
      setFormalityError(result.error || 'Erreur lors de la mise à jour');
      return;
    }

    onUpdateFormality(selectedCase.id, editingFormality.code, newStatus, repertoireRef, notes);
    setEditingFormality(null);
  };

  const closeCheck = selectedCase ? canCloseCase(selectedCase) : { allowed: false, openCount: 0 };

  const getStatusBadge = (status: FormalityStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            {t.stepCompleted}
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full">
            <Clock className="w-3 h-3 text-amber-600" />
            {t.stepInProgress}
          </span>
        );
      case 'waived':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 rounded-full">
            <Ban className="w-3 h-3 text-slate-500" />
            {t.stepWaived}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full">
            <Clock className="w-3 h-3 text-slate-400" />
            {t.stepPending}
          </span>
        );
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Sidebar: Case Dossiers List */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 font-serif">
                {t.navCases}
              </h2>
              <p className="text-xs text-slate-500">
                {filteredCases.length} {filteredCases.length > 1 ? 'dossiers répertoriés' : 'dossier'}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenNewCaseModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.newCase}</span>
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 mb-3 overflow-x-auto text-xs pb-1">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'all'
                  ? 'bg-slate-800 text-white font-medium'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tous ({cases.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('formalities_in_progress')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'formalities_in_progress'
                  ? 'bg-slate-800 text-white font-medium'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Formalités en cours
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('closed')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'closed'
                  ? 'bg-slate-800 text-white font-medium'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Clôturés
            </button>
          </div>

          {/* Dossiers List */}
          <div className="space-y-2.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {filteredCases.map((c) => {
              const completedCount = c.formalities.filter(
                (f) => f.status === 'completed' || f.status === 'waived'
              ).length;
              const totalFormalities = c.formalities.length;
              const percent = totalFormalities > 0 ? Math.round((completedCount / totalFormalities) * 100) : 0;
              const isSelected = selectedCase?.id === c.id;

              return (
                <div
                  key={c.id}
                  onClick={() => onSelectCase(c.id)}
                  className={`p-3.5 rounded-lg border transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'border-amber-600 bg-amber-50/50 shadow-sm ring-1 ring-amber-600/30'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded">
                      {c.reference}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        c.status === 'closed'
                          ? 'bg-slate-100 text-slate-700 border border-slate-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}
                    >
                      {c.status === 'closed' ? t.caseClosed : 'En cours'}
                    </span>
                  </div>

                  <h3 className="text-xs font-semibold text-slate-900 line-clamp-1 mb-1">
                    {language === 'ar' ? c.titleAr : c.titleFr}
                  </h3>

                  {c.propertyTitleNumber && (
                    <div className="text-[11px] text-slate-500 font-mono mb-2 flex items-center gap-1">
                      <Building className="w-3 h-3 text-slate-400" />
                      <span>{c.propertyTitleNumber}</span>
                      {c.conservationBureau && (
                        <span className="text-slate-400 truncate">({c.conservationBureau})</span>
                      )}
                    </div>
                  )}

                  {/* Progress Bar */}
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1">
                      <span>Formalités</span>
                      <span className="font-mono font-bold text-slate-800">
                        {completedCount}/{totalFormalities} ({percent}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          percent === 100 ? 'bg-emerald-500' : 'bg-amber-600'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Column: Case Details & 12-Step Moroccan Formalities Pipeline */}
      <div className="lg:col-span-8 space-y-5">
        {selectedCase && (
          <>
            {/* Case Overview Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-mono text-sm font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded border border-amber-200">
                      {selectedCase.reference}
                    </span>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {selectedCase.actTypeLabel}
                    </span>
                    {selectedCase.status === 'closed' && (
                      <span className="text-xs font-bold text-slate-600 bg-slate-200 px-2.5 py-0.5 rounded flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        {t.caseClosed}
                      </span>
                    )}
                  </div>
                  <h2 className="text-base font-bold text-slate-900">
                    {language === 'ar' ? selectedCase.titleAr : selectedCase.titleFr}
                  </h2>
                </div>

                {/* Case Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigateToAml(selectedCase.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg border border-slate-300 transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-amber-700" />
                    <span>Dossier LCB-FT</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>

                  {selectedCase.status !== 'closed' && (
                    <button
                      type="button"
                      disabled={!closeCheck.allowed}
                      onClick={() => onCloseCase(selectedCase.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        closeCheck.allowed
                          ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm cursor-pointer'
                          : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      }`}
                      title={closeCheck.reason || 'Clôturer le dossier'}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>{t.closeCaseBtn}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Invariant 1 Warning Banner if trying to close while formalities open */}
              {!closeCheck.allowed && selectedCase.status !== 'closed' && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Règle de clôture (Loi 32-09, Art. 36 & Invariant 1) : </span>
                    <span>{closeCheck.reason}</span>
                  </div>
                </div>
              )}

              {/* Key Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-xs">
                <div>
                  <span className="text-slate-400 block">{t.propertyTitle}</span>
                  <span className="font-mono font-bold text-slate-800">
                    {selectedCase.propertyTitleNumber || 'Non applicable'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">{t.conservation}</span>
                  <span className="font-medium text-slate-800">
                    {selectedCase.conservationBureau || 'Non spécifiée'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">{t.price}</span>
                  <span className="font-mono font-bold text-emerald-800">
                    {selectedCase.priceMad ? `${selectedCase.priceMad.toLocaleString('fr-FR')} MAD` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">{t.openedAt}</span>
                  <span className="font-medium text-slate-800">
                    {new Date(selectedCase.openedAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>

              {/* Parties in this Act with Masked Identity (Invariant 4) */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2 font-serif">
                  {t.parties} ({selectedCase.parties.length})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {selectedCase.parties.map((p) => (
                    <div
                      key={p.id}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {language === 'ar' ? p.fullNameAr : p.fullNameFr}
                          </p>
                          <span className="text-[10px] uppercase font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                            {p.role}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-slate-500 text-[11px] block">
                          {p.documentType}: ••••••{p.documentLastFour}
                        </span>
                        {p.isPep && (
                          <span className="text-[9px] uppercase font-bold text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded border border-purple-200">
                            PPE Déclarée
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 12-Step Moroccan Formalities Pipeline */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 font-serif flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-700" />
                    <span>{t.formalityProgress}</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Registre des formalités administratives et fiscales (Loi 32-09, Art. 44, 47, 50, 51)
                  </p>
                </div>
                <div className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-mono">
                  Colonnes pré-imprimées du registre
                </div>
              </div>

              {/* Pre-printed Ledger Style Table */}
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {selectedCase.formalities.map((formality, idx) => {
                  const tmpl = SALE_FORMALITY_TEMPLATES.find((t) => t.code === formality.code);
                  const depCheck = checkFormalityDependencies(formality.code, selectedCase.formalities);
                  const hasDependencies = tmpl && tmpl.requires.length > 0;
                  const isCompleted = formality.status === 'completed';

                  return (
                    <div
                      key={formality.id}
                      className={`p-3.5 flex flex-wrap items-center justify-between gap-3 transition-colors ${
                        isCompleted
                          ? 'bg-slate-50/50'
                          : formality.status === 'in_progress'
                          ? 'bg-amber-50/30'
                          : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      {/* Step Number & Label */}
                      <div className="flex items-start gap-3 flex-1 min-w-[280px]">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-mono text-xs font-bold flex items-center justify-center shrink-0 border border-slate-300">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              {language === 'ar' ? formality.labelAr : formality.labelFr}
                            </span>
                            {getStatusBadge(formality.status)}
                            {isCompleted && (
                              <span
                                className="text-slate-400"
                                title={t.cannotReopenDesc}
                              >
                                <Lock className="w-3.5 h-3.5 text-slate-400" />
                              </span>
                            )}
                          </div>

                          {/* Gloss or Law Note */}
                          {tmpl?.glossFr && (
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              ({tmpl.glossFr})
                            </p>
                          )}

                          {/* Dependencies Notice */}
                          {hasDependencies && (
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                              <span className="text-slate-400">Conditionné par :</span>
                              {tmpl.requires.map((reqCode) => {
                                const reqForm = selectedCase.formalities.find((f) => f.code === reqCode);
                                const isSatisfied =
                                  reqForm?.status === 'completed' || reqForm?.status === 'waived';
                                return (
                                  <span
                                    key={reqCode}
                                    className={`px-1.5 py-0.5 rounded font-mono ${
                                      isSatisfied
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800 font-semibold'
                                    }`}
                                  >
                                    {reqCode} {isSatisfied ? '✓' : '✗'}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Repertoire Reference if recorded */}
                          {formality.repertoireRef && (
                            <div className="text-[11px] text-slate-600 font-mono mt-1">
                              Réf. Répertoire : <span className="font-bold text-slate-800">{formality.repertoireRef}</span>
                              {formality.completionDate && (
                                <span className="text-slate-400 ml-2">
                                  ({new Date(formality.completionDate).toLocaleDateString('fr-FR')})
                                </span>
                              )}
                            </div>
                          )}

                          {/* Free-text Notes (Guarded) */}
                          {formality.notes && (
                            <p className="text-[11px] text-slate-600 italic mt-0.5">
                              Note : {formality.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action Button */}
                      <div>
                        {isCompleted ? (
                          <div
                            className="flex items-center gap-1 text-[11px] text-slate-400 px-2 py-1 bg-slate-100 rounded border border-slate-200"
                            title="Règle Invariant 2: une formalité accomplie ne se réouvre jamais"
                          >
                            <Lock className="w-3 h-3" />
                            <span>Verrouillée</span>
                          </div>
                        ) : selectedCase.status === 'closed' ? (
                          <span className="text-xs text-slate-400 italic">Dossier clos</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(formality)}
                            className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                          >
                            {t.updateStatus}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Edit Formality Modal */}
      {editingFormality && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                  Mise à jour d'étape
                </span>
                <h3 className="text-base font-bold text-slate-900 font-serif">
                  {language === 'ar' ? editingFormality.labelAr : editingFormality.labelFr}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingFormality(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            {/* Error Banner */}
            {formalityError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-900">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{formalityError}</span>
              </div>
            )}

            <form onSubmit={handleSaveFormality} className="space-y-4">
              {/* Target Status */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nouveau statut de la formalité
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewStatus('in_progress')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center cursor-pointer transition-colors ${
                      newStatus === 'in_progress'
                        ? 'bg-amber-100 border-amber-600 text-amber-900 font-bold'
                        : 'border-slate-300 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {t.markAsInProgress}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewStatus('completed')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center cursor-pointer transition-colors ${
                      newStatus === 'completed'
                        ? 'bg-emerald-100 border-emerald-600 text-emerald-900 font-bold'
                        : 'border-slate-300 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {t.markAsCompleted}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewStatus('waived')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center cursor-pointer transition-colors ${
                      newStatus === 'waived'
                        ? 'bg-slate-200 border-slate-600 text-slate-900 font-bold'
                        : 'border-slate-300 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {t.markAsWaived}
                  </button>
                </div>
              </div>

              {/* Warning if setting solde_prix while dependencies not satisfied */}
              {editingFormality.code === 'solde_prix' && newStatus === 'completed' && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900">
                  <p className="font-bold mb-1">Règle légale du solde du prix :</p>
                  <p>{t.soldePrixDepNotice}</p>
                </div>
              )}

              {/* Repertoire Reference Number (Art. 37 Loi 32-09) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.repertoireNumber}
                </label>
                <input
                  type="text"
                  value={repertoireRef}
                  onChange={(e) => setRepertoireRef(e.target.value)}
                  placeholder={t.repertoirePlaceholder}
                  className="w-full text-xs font-mono p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Enregistrement obligatoire sur le registre des formalités de l'étude (Art. 37).
                </span>
              </div>

              {/* Notes with PII Guard (Invariant 10) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observations et suivi (Garde PII Loi 09-08 actif)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Quitus remis par le syndic sans réserve..."
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Invariant 10: CIN, numéros de compte/IBAN ou données nominatives sensibles sont automatiquement rejetés.
                </span>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingFormality(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer transition-colors"
                >
                  Valider et enregistrer au journal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
