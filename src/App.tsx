/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { CasePipelineView } from './components/CasePipelineView.tsx';
import { AmlComplianceView } from './components/AmlComplianceView.tsx';
import { AuditChainView } from './components/AuditChainView.tsx';
import { ClientsView } from './components/ClientsView.tsx';
import { CorrespondanceView } from './components/CorrespondanceView.tsx';
import { NewCaseModal } from './components/NewCaseModal.tsx';

import {
  Case,
  UserRole,
  FormalityStatus,
  ScreeningCheck,
  AmlDecision,
  Correspondance,
} from './domain/types.ts';
import { Language } from './domain/i18n.ts';
import {
  INITIAL_CASES,
  INITIAL_CLIENTS,
  INITIAL_AML_REVIEWS,
  INITIAL_SCREENING_CHECKS,
  INITIAL_AUDIT_LOG,
  INITIAL_CORRESPONDANCES,
} from './domain/demoData.ts';
import { appendAuditEntry, verifyChainIntegrity } from './domain/auditChain.ts';
import { canCloseCase, matchOrCreateClient } from './domain/services.ts';
import { isCinQuery, generateHmacFingerprint } from './domain/guards.ts';

export default function App() {
  const [currentRole, setCurrentRole] = useState<UserRole>('notaire');
  const [language, setLanguage] = useState<Language>('fr');
  const [activeTab, setActiveTab] = useState<string>('cases');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Main state entities
  const [cases, setCases] = useState<Case[]>(INITIAL_CASES);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(INITIAL_CASES[0]?.id || '');
  const [clients, setClients] = useState(INITIAL_CLIENTS);
  const [amlReviews, setAmlReviews] = useState(INITIAL_AML_REVIEWS);
  const [screeningChecks, setScreeningChecks] = useState<ScreeningCheck[]>(INITIAL_SCREENING_CHECKS);
  const [auditLog, setAuditLog] = useState(INITIAL_AUDIT_LOG);
  const [correspondances, setCorrespondances] = useState<Correspondance[]>(INITIAL_CORRESPONDANCES);

  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState(false);

  // Sync RTL direction with language
  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  // Append entry to audit log helper (Invariant 3)
  const recordAudit = (action: string, caseRef: string, summary: string) => {
    const res = appendAuditEntry(auditLog, action, caseRef, currentRole, summary);
    if (res.success && res.entry) {
      setAuditLog((prev) => [...prev, res.entry!]);
    }
  };

  // Formality update handler
  const handleUpdateFormality = (
    caseId: string,
    formalityCode: string,
    newStatus: FormalityStatus,
    repertoireRef?: string,
    notes?: string
  ) => {
    setCases((prevCases) =>
      prevCases.map((c) => {
        if (c.id !== caseId) return c;
        const updatedFormalities = c.formalities.map((f) => {
          if (f.code !== formalityCode) return f;
          return {
            ...f,
            status: newStatus,
            updatedAt: new Date().toISOString(),
            updatedBy: currentRole === 'notaire' ? 'Maître Alami' : 'Premier Clerc',
            repertoireRef: repertoireRef || f.repertoireRef,
            completionDate: newStatus === 'completed' ? new Date().toISOString() : f.completionDate,
            notes: notes !== undefined ? notes : f.notes,
          };
        });
        return { ...c, formalities: updatedFormalities };
      })
    );

    const targetCase = cases.find((c) => c.id === caseId);
    recordAudit(
      'MISE_A_JOUR_FORMALITE',
      targetCase?.reference || 'DOSSIER',
      `Formalité ${formalityCode} passée au statut ${newStatus}`
    );
  };

  // Case Close handler (Invariant 1)
  const handleCloseCase = (caseId: string) => {
    const target = cases.find((c) => c.id === caseId);
    if (!target) return;

    const check = canCloseCase(target);
    if (!check.allowed) return;

    setCases((prev) =>
      prev.map((c) => (c.id === caseId ? { ...c, status: 'closed', closedAt: new Date().toISOString() } : c))
    );

    recordAudit('CLOTURE_DOSSIER', target.reference, 'Clôture définitive du dossier après purge complète des formalités');
  };

  // Add screening check
  const handleAddScreeningCheck = (newCheck: Omit<ScreeningCheck, 'id' | 'checkedAt' | 'voided'>) => {
    const checkId = `chk_${Date.now()}`;
    const fullCheck: ScreeningCheck = {
      ...newCheck,
      id: checkId,
      checkedAt: new Date().toISOString(),
      voided: false,
    };

    setScreeningChecks((prev) => [...prev, fullCheck]);

    const targetCase = cases.find((c) => c.amlReviewId === newCheck.amlReviewId);
    recordAudit(
      'LCBFT_CONTROLE_AJOUTE',
      targetCase?.reference || 'DOSSIER',
      `Contrôle ${newCheck.checkType} enregistré - Résultat ${newCheck.outcome}`
    );
  };

  // Void screening check (Invariant 2)
  const handleVoidScreeningCheck = (checkId: string, voidReason: string) => {
    setScreeningChecks((prev) =>
      prev.map((chk) => {
        if (chk.id !== checkId) return chk;
        return {
          ...chk,
          voided: true,
          voidedAt: new Date().toISOString(),
          voidedBy: currentRole === 'notaire' ? 'Maître Alami' : 'Premier Clerc',
          voidReason,
        };
      })
    );

    const target = screeningChecks.find((c) => c.id === checkId);
    recordAudit(
      'LCBFT_CONTROLE_INVALIDE',
      'DOSSIER',
      `Contrôle de vigilance invalidé pour motif formel (Invariant 2)`
    );
  };

  // Record AML decision
  const handleRecordAmlDecision = (
    caseId: string,
    decision: AmlDecision,
    cashAmount: number,
    decisionNote: string,
    anrfRequired: boolean,
    anrfRef?: string
  ) => {
    const targetCase = cases.find((c) => c.id === caseId);
    if (!targetCase || !targetCase.amlReviewId) return;

    setAmlReviews((prev) => ({
      ...prev,
      [targetCase.amlReviewId!]: {
        ...prev[targetCase.amlReviewId!],
        decision,
        cashAmountMad: cashAmount,
        thresholdExceeded: cashAmount > 100000,
        decisionDate: new Date().toISOString(),
        decidedBy: currentRole === 'notaire' ? 'Maître Alami' : 'Premier Clerc',
        decisionNote,
        anrfDeclarationRequired: anrfRequired,
        anrfDeclarationReference: anrfRef,
        anrfDeclarationDate: anrfRequired ? new Date().toISOString() : undefined,
      },
    }));

    recordAudit(
      'LCBFT_DECISION_NOTAIRE',
      targetCase.reference,
      `Décision LCB-FT ${decision} enregistrée par le notaire`
    );
  };

  // Create new case (Invariant 6: Party ≠ Client)
  const handleCreateCase = (newCase: Case) => {
    // Sync clients with parties
    newCase.parties.forEach((party) => {
      const match = matchOrCreateClient(
        {
          fullNameFr: party.fullNameFr,
          fullNameAr: party.fullNameAr,
          documentType: party.documentType,
          rawDocNumber: party.documentLastFour, // Normalized match
        },
        clients
      );
      if (match.isNew) {
        setClients((prev) => [...prev, match.client]);
      }
    });

    // Initialize AML Review for new case
    if (newCase.amlReviewId) {
      setAmlReviews((prev) => ({
        ...prev,
        [newCase.amlReviewId!]: {
          id: newCase.amlReviewId!,
          caseId: newCase.id,
          cashAmountMad: 0,
          thresholdExceeded: false,
          decision: 'pending',
          anrfDeclarationRequired: false,
        },
      }));
    }

    setCases((prev) => [newCase, ...prev]);
    setSelectedCaseId(newCase.id);

    recordAudit('CREATION_DOSSIER', newCase.reference, `Ouverture dossier ${newCase.actTypeLabel} et instanciation formalités`);
  };

  // Add correspondance
  const handleAddCorrespondance = (newCorr: Omit<Correspondance, 'id'>) => {
    const item: Correspondance = {
      ...newCorr,
      id: `corresp_${Date.now()}`,
    };
    setCorrespondances((prev) => [item, ...prev]);

    const targetCase = cases.find((c) => c.id === newCorr.caseId);
    recordAudit('CORRESPONDANCE_NOTIFIEE', targetCase?.reference || 'DOSSIER', `Envoi correspondance d'engagement fiscal`);
  };

  // Update commitment status
  const handleUpdateCommitmentStatus = (id: string, honored: boolean) => {
    setCorrespondances((prev) =>
      prev.map((c) => (c.id === id ? { ...c, commitmentHonored: honored } : c))
    );
    recordAudit('STATUT_ENGAGEMENT_MIS_A_JOUR', 'DOSSIER', `Statut d'engagement mis à jour: ${honored ? 'honoré' : 'défaut'}`);
  };

  // Search filter across cases
  const isCin = isCinQuery(searchQuery);
  const searchFingerprint = isCin ? generateHmacFingerprint(searchQuery) : null;

  const filteredCases = cases.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();

    // CIN search: matches HMAC fingerprint
    if (isCin && searchFingerprint) {
      return c.parties.some((p) => p.hmacFingerprint === searchFingerprint);
    }

    // Standard multi-field search
    return (
      c.reference.toLowerCase().includes(q) ||
      c.titleFr.toLowerCase().includes(q) ||
      c.titleAr.includes(q) ||
      c.actTypeLabel.toLowerCase().includes(q) ||
      (c.propertyTitleNumber && c.propertyTitleNumber.toLowerCase().includes(q)) ||
      c.parties.some(
        (p) =>
          p.fullNameFr.toLowerCase().includes(q) ||
          p.fullNameAr.includes(q) ||
          p.documentLastFour.includes(q)
      )
    );
  });

  const chainIntegrity = verifyChainIntegrity(auditLog);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800">
      {/* Header */}
      <Header
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        language={language}
        onLanguageChange={setLanguage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        auditChainValid={chainIntegrity.valid}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'cases' && (
          <CasePipelineView
            cases={filteredCases}
            selectedCaseId={selectedCaseId}
            onSelectCase={setSelectedCaseId}
            onUpdateFormality={handleUpdateFormality}
            onCloseCase={handleCloseCase}
            onOpenNewCaseModal={() => setIsNewCaseModalOpen(true)}
            onNavigateToAml={(caseId) => {
              setSelectedCaseId(caseId);
              setActiveTab('aml');
            }}
            currentRole={currentRole}
            language={language}
          />
        )}

        {activeTab === 'aml' && (
          <AmlComplianceView
            cases={filteredCases}
            selectedCaseId={selectedCaseId}
            onSelectCase={setSelectedCaseId}
            amlReviews={amlReviews}
            screeningChecks={screeningChecks}
            onAddScreeningCheck={handleAddScreeningCheck}
            onVoidScreeningCheck={handleVoidScreeningCheck}
            onRecordAmlDecision={handleRecordAmlDecision}
            currentRole={currentRole}
            language={language}
          />
        )}

        {activeTab === 'audit' && (
          <AuditChainView
            auditLog={auditLog}
            currentRole={currentRole}
            language={language}
          />
        )}

        {activeTab === 'clients' && (
          <ClientsView
            clients={clients}
            cases={cases}
            language={language}
          />
        )}

        {activeTab === 'correspondance' && (
          <CorrespondanceView
            correspondances={correspondances}
            cases={cases}
            onAddCorrespondance={handleAddCorrespondance}
            onUpdateCommitmentStatus={handleUpdateCommitmentStatus}
            currentRole={currentRole}
            language={language}
          />
        )}
      </main>

      {/* New Case Creation Modal */}
      <NewCaseModal
        isOpen={isNewCaseModalOpen}
        onClose={() => setIsNewCaseModalOpen(false)}
        onCreateCase={handleCreateCase}
        currentRole={currentRole}
        language={language}
      />

      {/* Discreet Legal Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-serif font-bold text-slate-700">Étude Notariale</span> • Conforme aux lois 32-09, 43-05 (LCB-FT), 09-08 • Ordre National des Notaires du Maroc
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            SHA-256 Ledger: {auditLog.length} blocs • Zéro PII en journal • Isolation LAN
          </div>
        </div>
      </footer>
    </div>
  );
}
