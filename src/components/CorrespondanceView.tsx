/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Mail, Clock, AlertTriangle, CheckCircle, Send, Plus, Filter } from 'lucide-react';
import { Correspondance, Case, UserRole } from '../domain/types.ts';
import { Language, DICTIONARY } from '../domain/i18n.ts';
import { validateGuardText } from '../domain/guards.ts';

interface CorrespondanceViewProps {
  correspondances: Correspondance[];
  cases: Case[];
  onAddCorrespondance: (newCorr: Omit<Correspondance, 'id'>) => void;
  onUpdateCommitmentStatus: (id: string, honored: boolean) => void;
  currentRole: UserRole;
  language: Language;
}

export const CorrespondanceView: React.FC<CorrespondanceViewProps> = ({
  correspondances,
  cases,
  onAddCorrespondance,
  onUpdateCommitmentStatus,
  language,
}) => {
  const t = DICTIONARY[language];
  const [filter, setFilter] = useState<'all' | 'pending' | 'defaulted' | 'honored'>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // New letter form
  const [selectedCaseId, setSelectedCaseId] = useState(cases[0]?.id || '');
  const [recipient, setRecipient] = useState('');
  const [recipientRole, setRecipientRole] = useState('Administration fiscale');
  const [channel, setChannel] = useState<'lettre_recommandee_ar' | 'porteur' | 'courrier_simple'>('lettre_recommandee_ar');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = correspondances.filter((c) => {
    if (filter === 'pending') return c.commitmentHonored === null;
    if (filter === 'honored') return c.commitmentHonored === true;
    if (filter === 'defaulted') return c.commitmentHonored === false;
    return true;
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || !deadlineDate) {
      setFormError('Le destinataire et la date d\'échéance légale sont obligatoires.');
      return;
    }

    if (notes) {
      const guard = validateGuardText(notes);
      if (!guard.valid) {
        setFormError(guard.violationReason || 'Données sensibles interdites');
        return;
      }
    }

    onAddCorrespondance({
      caseId: selectedCaseId,
      formalityCode: 'lettre_engagement',
      recipient: recipient.trim(),
      recipientRole: recipientRole.trim(),
      channel,
      sentDate: new Date().toISOString().split('T')[0],
      trackingNumber: trackingNumber.trim() || undefined,
      deadlineDate,
      commitmentHonored: null,
      notes: notes.trim() || undefined,
    });

    setShowAddModal(false);
    setRecipient('');
    setTrackingNumber('');
    setNotes('');
    setFormError(null);
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                Loi 32-09 • Art. 47
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {correspondances.length} courriers enregistrés
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 font-serif">
              {t.lettersTitle}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">{t.lettersDesc}</p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle correspondance d'engagement</span>
          </button>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-2 mt-4 text-xs">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-md transition-colors ${
              filter === 'all'
                ? 'bg-slate-800 text-white font-medium'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Toutes ({correspondances.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`px-3 py-1 rounded-md transition-colors ${
              filter === 'pending'
                ? 'bg-slate-800 text-white font-medium'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            En attente ({correspondances.filter((c) => c.commitmentHonored === null).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('honored')}
            className={`px-3 py-1 rounded-md transition-colors ${
              filter === 'honored'
                ? 'bg-slate-800 text-white font-medium'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Honorés ({correspondances.filter((c) => c.commitmentHonored === true).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('defaulted')}
            className={`px-3 py-1 rounded-md transition-colors ${
              filter === 'defaulted'
                ? 'bg-slate-800 text-white font-medium'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Défauts / Non honorés ({correspondances.filter((c) => c.commitmentHonored === false).length})
          </button>
        </div>
      </div>

      {/* Letters List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="divide-y divide-slate-100">
          {filtered.map((item) => {
            const linkedCase = cases.find((c) => c.id === item.caseId);
            const isOverdue =
              item.commitmentHonored === null && new Date(item.deadlineDate) < new Date();

            return (
              <div key={item.id} className="py-4 first:pt-0 last:pb-0 text-xs">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded text-[11px]">
                          {linkedCase?.reference || 'Dossier'}
                        </span>
                        <span className="font-semibold text-slate-900 text-xs">
                          {item.recipient}
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {item.recipientRole}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px]">
                        Canal :{' '}
                        <span className="font-medium text-slate-700">
                          {item.channel === 'lettre_recommandee_ar'
                            ? 'Lettre Recommandée avec Accusé de Réception (AR)'
                            : item.channel === 'porteur'
                            ? 'Porteur avec décharge'
                            : 'Courrier simple'}
                        </span>
                        {item.trackingNumber && (
                          <span className="font-mono ml-2 text-slate-700">
                            (N° : {item.trackingNumber})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Commitment Status Controls */}
                  <div className="flex items-center gap-2">
                    {item.commitmentHonored === null ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onUpdateCommitmentStatus(item.id, true)}
                          className="px-2.5 py-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 rounded text-[11px] font-semibold cursor-pointer"
                        >
                          Marquer Honoré
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateCommitmentStatus(item.id, false)}
                          className="px-2.5 py-1 bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-300 rounded text-[11px] font-semibold cursor-pointer"
                        >
                          Déclarer Défaut
                        </button>
                      </div>
                    ) : item.commitmentHonored === true ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded font-bold text-[11px]">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Engagement Honoré
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-100 text-rose-800 rounded font-bold text-[11px]">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Défaut constaté
                      </span>
                    )}
                  </div>
                </div>

                {/* Dates & Observations */}
                <div className="ml-11 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-slate-400 block">Date d'expédition :</span>
                    <span className="font-medium">{new Date(item.sentDate).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Échéance de réponse :</span>
                    <span className={`font-medium ${isOverdue ? 'text-rose-600 font-bold' : ''}`}>
                      {new Date(item.deadlineDate).toLocaleDateString('fr-FR')}{' '}
                      {isOverdue && '(Délai expiré)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Observations :</span>
                    <span className="italic truncate block">{item.notes || 'Aucune note'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900 font-serif">
                Nouvelle correspondance d'engagement (Loi 32-09, Art. 47)
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-900">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Dossier rattaché
                </label>
                <select
                  value={selectedCaseId}
                  onChange={(e) => setSelectedCaseId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.reference} - {c.titleFr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Destinataire
                </label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="Ex: Direction Régionale des Impôts Marrakech"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Qualité du destinataire
                  </label>
                  <input
                    type="text"
                    value={recipientRole}
                    onChange={(e) => setRecipientRole(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Canal d'acheminement
                  </label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as any)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="lettre_recommandee_ar">Lettre Recommandée AR</option>
                    <option value="porteur">Porteur avec décharge</option>
                    <option value="courrier_simple">Courrier simple</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Numéro de suivi / décharge
                  </label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Ex: RR-109283-MA"
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Date d'échéance légale
                  </label>
                  <input
                    type="date"
                    value={deadlineDate}
                    onChange={(e) => setDeadlineDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Objet de l'engagement (Garde PII actif)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Engagement fiscal de versement pour mainlevée..."
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
                  Enregistrer l'engagement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
