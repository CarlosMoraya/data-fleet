import { BadgeCheck, ClipboardCheck, Truck, Wallet } from 'lucide-react';
import React, { Suspense, lazy, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import RouteFallback from '../components/RouteFallback';
import { useAuth } from '../context/AuthContext';
import { usePersistentTabState } from '../hooks/usePersistentUiState';
import {
  canApproveExtraPayments,
  canApprovePayments,
  canViewBudgetTab,
  canViewExtraPayments,
  canViewPayments,
} from '../lib/rolePermissions';
import { cn } from '../lib/utils';

import type { Role } from '../types';
import type { LucideIcon } from 'lucide-react';

const BudgetApprovals = lazy(() => import('./BudgetApprovals'));
const PaymentsTab = lazy(() => import('../components/financeiro/PaymentsTab'));
const ApprovalsTab = lazy(() => import('../components/financeiro/ApprovalsTab'));
const ExtraPaymentsTab = lazy(() => import('../components/financeiro/ExtraPaymentsTab'));

type TabId = 'budget' | 'payments' | 'approvals' | 'extras';

interface TabDef {
  id: TabId;
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
  canAccess: (role: Role | undefined | null) => boolean;
  render: (legacySegment?: 'extras') => React.ReactNode;
}

const TAB_DEFS: TabDef[] = [
  {
    id: 'budget',
    label: 'Aprovação de Orçamentos',
    title: 'Aprovação de Orçamentos',
    description: 'OS aguardando revisão — ordem de chegada',
    icon: BadgeCheck,
    canAccess: canViewBudgetTab,
    render: () => (
      <Suspense fallback={<RouteFallback />}>
        <BudgetApprovals embedded />
      </Suspense>
    ),
  },
  {
    id: 'payments',
    label: 'Pagamentos',
    title: 'Pagamentos',
    description: 'Cadastre, consulte, exporte e marque parcelas como pagas',
    icon: Wallet,
    canAccess: canViewPayments,
    render: () => (
      <Suspense fallback={<RouteFallback />}>
        <PaymentsTab />
      </Suspense>
    ),
  },
  {
    id: 'approvals',
    label: 'Aprovações',
    title: 'Aprovações',
    description: 'Revise e autorize pagamentos e despesas extras',
    icon: ClipboardCheck,
    canAccess: (role) => canApprovePayments(role) || canApproveExtraPayments(role),
    render: (legacySegment) => (
      <Suspense fallback={<RouteFallback />}>
        <ApprovalsTab initialSegment={legacySegment} />
      </Suspense>
    ),
  },
  {
    id: 'extras',
    label: 'Pagamentos Extras',
    title: 'Pagamentos Extras',
    description: 'Guincho, borracheiro, chaveiro e outros',
    icon: Truck,
    canAccess: canViewExtraPayments,
    render: () => (
      <Suspense fallback={<RouteFallback />}>
        <ExtraPaymentsTab />
      </Suspense>
    ),
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Financeiro() {
  const { user } = useAuth();
  const role = user?.role;
  const [searchParams, setSearchParams] = useSearchParams();

  const allowedTabs = useMemo(() => TAB_DEFS.filter((t) => t.canAccess(role)), [role]);

  const [persistedTab, setPersistedTab] = usePersistentTabState('financeiro', 'activeTab', '');

  const isLegacyExtraApprovals = persistedTab === 'extra-approvals';
  const normalizedPersisted: TabId | '' = isLegacyExtraApprovals ? 'approvals' : (persistedTab as TabId);

  useEffect(() => {
    if (isLegacyExtraApprovals) {
      setPersistedTab('approvals');
    }
  }, [isLegacyExtraApprovals, setPersistedTab]);

  const urlTab = searchParams.get('tab');
  const isAllowed = (id: string | null): id is TabId => allowedTabs.some((t) => t.id === id);

  const resolvedId: TabId | '' =
    (isAllowed(urlTab) ? urlTab : undefined)
    ?? (isAllowed(normalizedPersisted) ? normalizedPersisted : undefined)
    ?? (allowedTabs[0]?.id ?? '');

  useEffect(() => {
    if (resolvedId && normalizedPersisted !== resolvedId) {
      setPersistedTab(resolvedId);
    }
  }, [resolvedId, normalizedPersisted, setPersistedTab]);

  function selectTab(id: TabId) {
    setPersistedTab(id);
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    if (id !== 'approvals') {
      next.delete('segment');
    }
    setSearchParams(next);
  }

  if (allowedTabs.length === 0 || !resolvedId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-400">
        <Wallet className="h-8 w-8" />
        <p className="text-sm font-medium">Sem acesso ao módulo financeiro.</p>
      </div>
    );
  }

  const active = allowedTabs.find((t) => t.id === resolvedId) ?? allowedTabs[0];
  const ActiveIcon = active.icon;

  return (
    <div className="flex h-full flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Wallet className="h-6 w-6 text-orange-500" />
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Financeiro</h1>
          <p className="text-sm text-zinc-500">
            Orçamentos, pagamentos, aprovações e despesas extras
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 overflow-x-auto border-b border-zinc-200 whitespace-nowrap"
        role="tablist"
      >
        {allowedTabs.map((t) => {
          const isActive = t.id === active.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => selectTab(t.id)}
              className={cn(
                'rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-orange-500 text-zinc-900'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700',
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Compact header of the active tab */}
      <div className="flex items-center gap-2">
        <ActiveIcon className="h-5 w-5 text-orange-500" />
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{active.title}</h2>
          <p className="text-sm text-zinc-500">{active.description}</p>
        </div>
      </div>

      {/* Active tab content */}
      <div className="flex min-h-0 flex-1 flex-col">
        {active.render(isLegacyExtraApprovals && active.id === 'approvals' ? 'extras' : undefined)}
      </div>
    </div>
  );
}
