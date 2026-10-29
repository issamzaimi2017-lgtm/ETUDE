/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Shield, Scale, Search, Globe, UserCheck, AlertCircle } from 'lucide-react';
import { UserRole } from '../domain/types.ts';
import { Language, DICTIONARY } from '../domain/i18n.ts';
import { isCinQuery } from '../domain/guards.ts';

interface HeaderProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  auditChainValid: boolean;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onRoleChange,
  language,
  onLanguageChange,
  searchQuery,
  onSearchChange,
  auditChainValid,
  activeTab,
  onTabChange,
}) => {
  const t = DICTIONARY[language];
  const isCin = isCinQuery(searchQuery);

  return (
    <header className="bg-slate-900 text-slate-100 border-b border-slate-800 sticky top-0 z-40 shadow-md">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-col sm:flex-row items-center justify-between gap-2.5 border-b border-slate-800/80 text-xs">
        <div className="flex items-center gap-2 text-amber-400/90 font-medium tracking-wide text-[11px] sm:text-xs">
          <Scale className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate">{t.legalFrameBadge}</span>
          <span className="text-slate-500 hidden sm:inline">•</span>
          <span className="text-slate-400 hidden sm:inline">Royaume du Maroc</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 w-full sm:w-auto">
          {/* Audit Chain Status Indicator */}
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono text-[11px] ${
              auditChainValid
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                : 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
            }`}
            title="Intégrité du registre cryptographique SHA-256"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>SHA-256: {auditChainValid ? 'Intègre' : 'Altération'}</span>
          </div>

          {/* Role Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 px-2 py-0.5 rounded-md border border-slate-700">
            <UserCheck className="w-3.5 h-3.5 text-slate-400" />
            <select
              id="role-select"
              value={currentRole}
              onChange={(e) => onRoleChange(e.target.value as UserRole)}
              className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer"
            >
              <option value="notaire" className="bg-slate-900 text-white">
                {t.roleNotaire}
              </option>
              <option value="clerc" className="bg-slate-900 text-white">
                {t.roleClerc}
              </option>
              <option value="secretaire" className="bg-slate-900 text-white">
                {t.roleSecretaire}
              </option>
            </select>
          </div>

          {/* Bilingual Switch (French / Arabic) */}
          <button
            type="button"
            onClick={() => onLanguageChange(language === 'fr' ? 'ar' : 'fr')}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-colors text-xs font-semibold cursor-pointer shrink-0"
            title="Changer de langue / تغيير اللغة"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{language === 'fr' ? 'العربية' : 'Français'}</span>
          </button>
        </div>
      </div>

      {/* Main Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center text-white shadow-inner border border-amber-500/40">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white font-serif">{t.appTitle}</h1>
              <span className="text-[10px] uppercase font-bold tracking-widest bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                LAN Notarial
              </span>
            </div>
            <p className="text-xs text-slate-400">{t.appSubtitle}</p>
          </div>
        </div>

        {/* Global Search Bar with CIN Auto-Hashing Indicator */}
        <div className="flex-1 max-w-md mx-2 relative">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg pl-9 pr-24 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
            />
            {isCin && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono bg-purple-950/90 text-purple-300 border border-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span>HMAC CIN</span>
              </span>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto py-1">
          <button
            type="button"
            onClick={() => onTabChange('cases')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'cases'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            {t.navCases}
          </button>
          <button
            type="button"
            onClick={() => onTabChange('aml')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'aml'
                ? 'bg-amber-600 text-white shadow-sm'
                : currentRole === 'secretaire'
                ? 'text-slate-500 hover:text-slate-400'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            {t.navAml}
            {currentRole === 'secretaire' && (
              <span className="text-[9px] bg-rose-900/60 text-rose-300 px-1 rounded">403</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => onTabChange('audit')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            {t.navAudit}
          </button>
          <button
            type="button"
            onClick={() => onTabChange('clients')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'clients'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            {t.navClients}
          </button>
          <button
            type="button"
            onClick={() => onTabChange('correspondance')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'correspondance'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            {t.navCorrespondance}
          </button>
        </nav>
      </div>

      {/* Role Alert Banner if Secretary */}
      {currentRole === 'secretaire' && (
        <div className="bg-amber-950/40 border-t border-amber-900/50 px-4 py-1.5 text-[11px] text-amber-300/90 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              Session secrétaire active: accès aux formalités et à l'accueil. L'accès au dossier LCB-FT (Art. 18 Loi 43-05) est restreint au notaire.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onRoleChange('notaire')}
            className="text-amber-200 underline font-semibold hover:text-white"
          >
            Basculer en Maître
          </button>
        </div>
      )}
    </header>
  );
};
