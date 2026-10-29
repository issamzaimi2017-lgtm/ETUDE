/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Plus, Trash2, Building, Scale, AlertTriangle } from 'lucide-react';
import { Case, PartyRole, ActCategory, UserRole } from '../domain/types.ts';
import { Language, DICTIONARY } from '../domain/i18n.ts';
import { generateHmacFingerprint, maskDocumentNumber, validateGuardText } from '../domain/guards.ts';
import { instantiateSaleFormalities } from '../domain/services.ts';

interface NewCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateCase: (newCase: Case) => void;
  currentRole: UserRole;
  language: Language;
}

interface TempParty {
  fullNameFr: string;
  fullNameAr: string;
  role: PartyRole;
  documentType: 'CIN' | 'Passeport' | 'Carte_Sejour' | 'RC';
  docNumber: string;
  nationality: string;
  isPep: boolean;
}

export const NewCaseModal: React.FC<NewCaseModalProps> = ({
  isOpen,
  onClose,
  onCreateCase,
  currentRole,
  language,
}) => {
  const t = DICTIONARY[language];

  const [actCategory, setActCategory] = useState<ActCategory>('vente');
  const [reference, setReference] = useState(`VTE-2026-${Math.floor(100 + Math.random() * 900)}`);
  const [titleFr, setTitleFr] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [propertyTitle, setPropertyTitle] = useState('');
  const [conservationBureau, setConservationBureau] = useState('Conservation Foncière Marrakech-Guéliz');
  const [priceMad, setPriceMad] = useState<number>(1200000);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [parties, setParties] = useState<TempParty[]>([
    {
      fullNameFr: '',
      fullNameAr: '',
      role: 'vendeur',
      documentType: 'CIN',
      docNumber: '',
      nationality: 'Marocaine',
      isPep: false,
    },
    {
      fullNameFr: '',
      fullNameAr: '',
      role: 'acquereur',
      documentType: 'CIN',
      docNumber: '',
      nationality: 'Marocaine',
      isPep: false,
    },
  ]);

  if (!isOpen) return null;

  const handleAddParty = () => {
    setParties([
      ...parties,
      {
        fullNameFr: '',
        fullNameAr: '',
        role: 'conjoint',
        documentType: 'CIN',
        docNumber: '',
        nationality: 'Marocaine',
        isPep: false,
      },
    ]);
  };

  const handleRemoveParty = (index: number) => {
    setParties(parties.filter((_, idx) => idx !== index));
  };

  const handleUpdateParty = (index: number, field: keyof TempParty, value: any) => {
    const updated = [...parties];
    updated[index] = { ...updated[index], [field]: value };
    setParties(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!titleFr.trim()) {
      setFormError('L\'intitulé du dossier en français est obligatoire.');
      return;
    }

    if (parties.some((p) => !p.fullNameFr.trim() || !p.docNumber.trim())) {
      setFormError('Chaque partie doit avoir un nom et un numéro de document d\'identité.');
      return;
    }

    // PII Guard check on title and notes
    if (notes) {
      const guard = validateGuardText(notes);
      if (!guard.valid) {
        setFormError(guard.violationReason || 'Données sensibles interdites');
        return;
      }
    }

    const caseId = `case_${Date.now()}`;

    // Process parties with masked identity and HMAC (Invariant 4)
    const processedParties = parties.map((p, idx) => {
      const { lastFour } = maskDocumentNumber(p.docNumber);
      const hmacFingerprint = generateHmacFingerprint(p.docNumber);

      return {
        id: `pty_${caseId}_${idx + 1}`,
        caseId,
        clientId: `cli_${hmacFingerprint.slice(0, 12)}`,
        role: p.role,
        fullNameFr: p.fullNameFr.trim(),
        fullNameAr: p.fullNameAr.trim() || p.fullNameFr.trim(),
        documentType: p.documentType,
        documentLastFour: lastFour,
        hmacFingerprint,
        nationality: p.nationality,
        isPep: p.isPep,
      };
    });

    // Instantiate 12-step formalities pipeline
    const formalities = instantiateSaleFormalities(
      caseId,
      currentRole === 'notaire' ? 'Maître Alami' : 'Premier Clerc'
    );

    const newCase: Case = {
      id: caseId,
      reference: reference.trim(),
      titleFr: titleFr.trim(),
      titleAr: titleAr.trim() || titleFr.trim(),
      actCategory,
      actTypeLabel:
        actCategory === 'vente'
          ? 'Vente immobilière'
          : actCategory === 'societe'
          ? 'Constitution de société'
          : actCategory === 'donation'
          ? 'Donation (Hiba)'
          : 'Acte notarié',
      status: 'formalities_in_progress',
      openedAt: new Date().toISOString(),
      propertyTitleNumber: propertyTitle.trim() || undefined,
      conservationBureau: conservationBureau.trim() || undefined,
      priceMad,
      parties: processedParties,
      formalities,
      amlReviewId: `aml_${caseId}`,
      notes: notes.trim() || undefined,
    };

    onCreateCase(newCase);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 animate-in fade-in zoom-in-95 my-8">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div>
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">
              Ouverture de dossier (Loi 32-09)
            </span>
            <h3 className="text-base font-bold text-slate-900 font-serif">
              {t.newCase}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            ✕
          </button>
        </div>

        {formError && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Category & Reference */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Nature de l'acte notarié
              </label>
              <select
                value={actCategory}
                onChange={(e) => {
                  const cat = e.target.value as ActCategory;
                  setActCategory(cat);
                  const prefix = cat === 'vente' ? 'VTE' : cat === 'societe' ? 'STE' : 'DON';
                  setReference(`${prefix}-2026-${Math.floor(100 + Math.random() * 900)}`);
                }}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="vente">Vente immobilière (12 formalités)</option>
                <option value="societe">Constitution de société</option>
                <option value="donation">Donation entre vifs (Hiba)</option>
                <option value="succession">Succession et liquidation</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Numéro de référence au répertoire
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>
          </div>

          {/* Bilingual Titles */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Désignation de l'opération (Français)
              </label>
              <input
                type="text"
                value={titleFr}
                onChange={(e) => setTitleFr(e.target.value)}
                placeholder="Ex: Vente Appartement Majorelle Marrakech"
                className="w-full p-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Désignation en Arabe (عربي)
              </label>
              <input
                type="text"
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
                placeholder="مثال: بيع شقة سكنية ماجوريل مراكش"
                dir="rtl"
                className="w-full p-2 border border-slate-300 rounded-lg font-arabic text-right"
              />
            </div>
          </div>

          {/* Property Title & Price */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Titre Foncier (TF)
              </label>
              <input
                type="text"
                value={propertyTitle}
                onChange={(e) => setPropertyTitle(e.target.value)}
                placeholder="Ex: TF 54109/04"
                className="w-full p-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Bureau de Conservation
              </label>
              <input
                type="text"
                value={conservationBureau}
                onChange={(e) => setConservationBureau(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Prix stipulé (MAD)
              </label>
              <input
                type="number"
                value={priceMad}
                onChange={(e) => setPriceMad(Number(e.target.value))}
                className="w-full p-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          {/* Parties Section */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">
                Parties à l'acte (Masquage PII Loi 09-08 & Invariant 4)
              </span>
              <button
                type="button"
                onClick={handleAddParty}
                className="text-amber-800 hover:text-amber-900 font-bold flex items-center gap-1 text-[11px]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter une partie</span>
              </button>
            </div>

            <div className="space-y-3">
              {parties.map((party, index) => (
                <div
                  key={index}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 relative"
                >
                  {parties.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveParty(index)}
                      className="absolute right-2 top-2 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold">Qualité</label>
                      <select
                        value={party.role}
                        onChange={(e) =>
                          handleUpdateParty(index, 'role', e.target.value as PartyRole)
                        }
                        className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs"
                      >
                        <option value="vendeur">Vendeur</option>
                        <option value="acquereur">Acquéreur</option>
                        <option value="conjoint">Conjoint</option>
                        <option value="gerant">Gérant</option>
                        <option value="associe">Associé</option>
                        <option value="donateur">Donateur</option>
                        <option value="donataire">Donataire</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold">Nom complet (FR)</label>
                      <input
                        type="text"
                        value={party.fullNameFr}
                        onChange={(e) => handleUpdateParty(index, 'fullNameFr', e.target.value)}
                        placeholder="Ex: Mohamed Tazi"
                        className="w-full p-1.5 border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold">الاسم الكامل (عربي)</label>
                      <input
                        type="text"
                        value={party.fullNameAr}
                        onChange={(e) => handleUpdateParty(index, 'fullNameAr', e.target.value)}
                        placeholder="محمد التازي"
                        dir="rtl"
                        className="w-full p-1.5 border border-slate-300 rounded text-xs text-right font-arabic"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 items-center">
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold">Type document</label>
                      <select
                        value={party.documentType}
                        onChange={(e) =>
                          handleUpdateParty(index, 'documentType', e.target.value as any)
                        }
                        className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs"
                      >
                        <option value="CIN">CIN Marocaine</option>
                        <option value="Passeport">Passeport</option>
                        <option value="Carte_Sejour">Carte de séjour</option>
                        <option value="RC">Registre de Commerce</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold">
                        Numéro (Transformé en HMAC)
                      </label>
                      <input
                        type="text"
                        value={party.docNumber}
                        onChange={(e) => handleUpdateParty(index, 'docNumber', e.target.value)}
                        placeholder="Ex: AB123456"
                        className="w-full p-1.5 border border-slate-300 rounded text-xs font-mono"
                      />
                    </div>
                    <div className="pt-3">
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={party.isPep}
                          onChange={(e) => handleUpdateParty(index, 'isPep', e.target.checked)}
                          className="rounded text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-purple-900 font-semibold text-[11px]">
                          PPE Déclarée
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-slate-700"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-bold shadow-sm"
            >
              Créer le dossier et instancier les formalités
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
