/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  RefreshCw,
  Hash,
  Clock,
  User,
  CheckCircle2,
  FileText,
  Shield,
  Search
} from 'lucide-react';
import { AuditLogEntry, UserRole } from '../domain/types.ts';
import { Language, DICTIONARY } from '../domain/i18n.ts';
import { verifyChainIntegrity } from '../domain/auditChain.ts';

interface AuditChainViewProps {
  auditLog: AuditLogEntry[];
  currentRole: UserRole;
  language: Language;
}

export const AuditChainView: React.FC<AuditChainViewProps> = ({
  auditLog,
  language,
}) => {
  const t = DICTIONARY[language];
  const [filterQuery, setFilterQuery] = useState('');
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    message: string;
    checkedAt: string;
  } | null>(null);

  const handleVerifyChain = () => {
    const res = verifyChainIntegrity(auditLog);
    setVerificationResult({
      valid: res.valid,
      message: res.message,
      checkedAt: new Date().toLocaleTimeString('fr-FR'),
    });
  };

  const filteredEntries = auditLog.filter((entry) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      entry.caseRef.toLowerCase().includes(q) ||
      entry.action.toLowerCase().includes(q) ||
      entry.currentHash.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner: Cryptographic Guarantees */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                {t.auditBadgeChain}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {auditLog.length} blocs scellés
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 font-serif">
              {t.auditTabTitle}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Conformité Loi 32-09 & Invariant 3 : traçabilité absolue sans rétention de données nominatives.
            </p>
          </div>

          <button
            type="button"
            onClick={handleVerifyChain}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-emerald-400" />
            <span>{t.verifyChainBtn}</span>
          </button>
        </div>

        {/* Verification Result Banner */}
        {verificationResult && (
          <div
            className={`mt-4 p-4 rounded-lg border text-xs flex items-start gap-3 animate-in fade-in ${
              verificationResult.valid
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-rose-50 border-rose-300 text-rose-950'
            }`}
          >
            {verificationResult.valid ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm">
                  {verificationResult.valid
                    ? 'Preuve cryptographique vérifiée : Chaîne intègre'
                    : 'Alerte : Altération détectée dans le registre !'}
                </span>
                <span className="font-mono text-[11px] opacity-75">
                  Vérifié à {verificationResult.checkedAt}
                </span>
              </div>
              <p className="leading-relaxed">{verificationResult.message}</p>
            </div>
          </div>
        )}

        {/* Identity Guard Banner (Invariant 3) */}
        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-between text-xs text-purple-950">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-700 shrink-0" />
            <span className="font-medium">{t.identityGuardBadge}</span>
          </div>
          <span className="font-mono text-[11px] text-purple-800">Garde SENSITIVE_ACTIONS actif</span>
        </div>
      </div>

      {/* Audit Blocks List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-100 mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-serif">
            Registre chronologique des blocs scellés
          </h3>
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filtrer réf dossier, action..."
              className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:border-amber-600 font-mono"
            />
          </div>
        </div>

        <div className="space-y-3">
          {filteredEntries.map((entry) => (
            <div
              key={entry.index}
              className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs hover:border-slate-300 transition-colors"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold bg-slate-200 text-slate-800 px-2 py-0.5 rounded text-[11px]">
                    Bloc #{entry.index}
                  </span>
                  <span className="font-mono font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded text-[11px]">
                    {entry.caseRef}
                  </span>
                  <span className="font-bold text-slate-900 text-xs">{entry.action}</span>
                </div>

                <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {new Date(entry.timestamp).toLocaleString('fr-FR')}
                  </span>
                  <span className="flex items-center gap-1 bg-slate-200/80 px-2 py-0.5 rounded text-slate-700 font-medium">
                    <User className="w-3 h-3 text-slate-400" />
                    {entry.actorRole}
                  </span>
                </div>
              </div>

              {/* State Summary (Guaranteed zero PII) */}
              <div className="mb-2.5">
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                  {t.stateSummaryLabel}
                </span>
                <p className="text-slate-800 font-medium mt-0.5">{entry.stateSummary}</p>
              </div>

              {/* Cryptographic Linkage Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono bg-white p-2 rounded border border-slate-200 text-slate-600">
                <div className="truncate">
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">
                    prevHash
                  </span>
                  <span className="truncate block font-mono text-[10px] text-slate-500">
                    {entry.prevHash}
                  </span>
                </div>
                <div className="truncate">
                  <span className="text-emerald-700 block text-[9px] uppercase font-bold">
                    currentHash (SHA-256)
                  </span>
                  <span className="truncate block font-mono text-[10px] text-emerald-900 font-bold">
                    {entry.currentHash}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
