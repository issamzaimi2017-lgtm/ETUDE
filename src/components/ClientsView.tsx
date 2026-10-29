/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserCheck, Shield, Search, Key, FolderOpen, AlertTriangle } from 'lucide-react';
import { Client, Case } from '../domain/types.ts';
import { Language, DICTIONARY } from '../domain/i18n.ts';
import { generateHmacFingerprint, isCinQuery, normalizeDocumentNumber } from '../domain/guards.ts';

interface ClientsViewProps {
  clients: Client[];
  cases: Case[];
  language: Language;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  clients,
  cases,
  language,
}) => {
  const t = DICTIONARY[language];
  const [search, setSearch] = useState('');

  const isCin = isCinQuery(search);
  const searchFingerprint = isCin ? generateHmacFingerprint(search) : null;

  const filteredClients = clients.filter((cli) => {
    if (!search) return true;
    if (isCin && searchFingerprint) {
      return cli.hmacFingerprint === searchFingerprint;
    }
    const q = search.toLowerCase();
    return (
      cli.fullNameFr.toLowerCase().includes(q) ||
      cli.fullNameAr.includes(q) ||
      cli.documentLastFour.includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Overview & Security Guarantees */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-purple-900 bg-purple-100 px-2 py-0.5 rounded border border-purple-200">
                Loi 09-08 • Protection des données
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {clients.length} clients identifiés
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 font-serif">
              {t.navClients} (Distinction Party ≠ Client)
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Invariant 4 & 6 : Les numéros d'identité sont strictement masqués. L'empreinte HMAC-SHA256 permet la recherche sans jamais stocker le numéro en clair.
            </p>
          </div>

          {/* Search by CIN or Name */}
          <div className="relative w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher nom ou CIN complète..."
              className="w-full text-xs pl-8 pr-20 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
            />
            {isCin && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono bg-purple-900 text-purple-200 px-1.5 py-0.5 rounded font-bold">
                HMAC
              </span>
            )}
          </div>
        </div>

        {/* Security Rule Explanation */}
        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-600">
          <div className="flex items-start gap-2">
            <Key className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-800">Empreinte HMAC-SHA256 :</span>{' '}
              Un CIN complet n'est jamais écrit en base. La recherche hache la requête à la volée avec le sel secret de l'étude (PEPPER).
            </div>
          </div>
          <div className="flex items-start gap-2">
            <UserCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-800">Distinction Party / Client :</span>{' '}
              La partie représente la désignation dans l'acte du jour ; le client est la personne morale ou physique suivie à travers l'historique des dossiers.
            </div>
          </div>
        </div>
      </div>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredClients.map((client) => {
          // Find associated dossiers for this client
          const associatedCases = cases.filter((c) =>
            c.parties.some((p) => p.clientId === client.id)
          );

          return (
            <div
              key={client.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:border-slate-300 transition-all text-xs"
            >
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-200 font-bold font-serif">
                    {client.fullNameFr.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {client.fullNameFr}
                    </h3>
                    <p className="font-arabic text-slate-600 text-sm">{client.fullNameAr}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold block text-[11px]">
                    {client.documentType}: ••••••{client.documentLastFour}
                  </span>
                  {client.amlFlagged && (
                    <span className="text-[10px] uppercase font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded inline-block mt-1">
                      Signalé LCB-FT
                    </span>
                  )}
                </div>
              </div>

              {/* Cryptographic Key Details */}
              <div className="mb-3 p-2 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono text-slate-600">
                <span className="text-slate-400 block text-[9px] uppercase font-bold">
                  {t.maskedCinLabel}
                </span>
                <span className="truncate block text-slate-700">{client.hmacFingerprint}</span>
              </div>

              {/* History of Acts / Cases */}
              <div>
                <span className="text-slate-500 font-bold block mb-1.5 flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-amber-700" />
                  <span>Dossiers associés à l'étude ({associatedCases.length}) :</span>
                </span>
                <div className="space-y-1">
                  {associatedCases.map((c) => (
                    <div
                      key={c.id}
                      className="p-1.5 bg-slate-50 border border-slate-200/80 rounded flex items-center justify-between text-[11px]"
                    >
                      <span className="font-mono font-bold text-amber-900">{c.reference}</span>
                      <span className="text-slate-700 truncate max-w-[200px]">{c.titleFr}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(c.openedAt).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
