import { Wallet } from 'lucide-react';
import React, { Suspense, lazy, useMemo } from 'react';

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

const BudgetApprovals = lazy(() => import('./BudgetApprovals'));
const PaymentsTab = lazy(() => import('../components/financeiro/PaymentsTab'));
const PaymentApprovalsTab = lazy(
  () => import('../components/financeiro/PaymentApprovalsTab'),
);
const ExtraPaymentsTab = lazy(() => import('../components/financeiro/ExtraPaymentsTab'));
const ExtraPaymentApprovalsTab = lazy(
  () => import('../components/financeiro/ExtraPaymentApprovalsTab'),
);

type TabId = 'budget' | 'payments' | 'approvals' | 'extras' | 'extra-approvals';

interface TabDef {
  id: TabId;
  label: string;
  canAccess: (role: Role | undefined | null) => boolean;
  render: () => React.ReactNode;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Financeiro() {
  const { user } = useAuth();
  const role = user?.role;

  const tabs = useMemo<TabDef[]>(() => {
    return [
      {
        id: 'budget',
        label: 'Orçamento',
        canAccess: canViewBudgetTab,
        render: () => (
          <Suspense fallback={<RouteFallback />}>
            <BudgetApprovals />
          </Suspense>
        ),
      },
      {
        id: 'payments',
        label: 'Pagamentos',
        canAccess: canViewPayments,
        render: () => (
          <Suspense fallback={<RouteFallback />}>
            <PaymentsTab />
          </Suspense>
        ),
      },
      {
        id: 'approvals',
        label: 'Aprovação de Pagamentos',
        canAccess: canApprovePayments,
        render: () => (
          <Suspense fallback={<RouteFallback />}>
            <PaymentApprovalsTab />
          </Suspense>
        ),
      },
      {
        id: 'extras',
        label: 'Pagamentos Extras',
        canAccess: canViewExtraPayments,
        render: () => (
          <Suspense fallback={<RouteFallback />}>
            <ExtraPaymentsTab />
          </Suspense>
        ),
      },
      {
        id: 'extra-approvals',
        label: 'Aprovação de Extras',
        canAccess: canApproveExtraPayments,
        render: () => (
          <Suspense fallback={<RouteFallback />}>
            <ExtraPaymentApprovalsTab />
          </Suspense>
        ),
      },
    ];
  }, []);

  const allowedTabs = useMemo(() => tabs.filter((t) => t.canAccess(role)), [tabs, role]);

  const [activeTab, setActiveTab] = usePersistentTabState(
    'financeiro',
    'activeTab',
    '',
  );

  // Garante que a aba ativa é permitida; se não for, cai na primeira permitida.
  const currentId: TabId | '' = (activeTab && allowedTabs.some((t) => t.id === activeTab))
    ? (activeTab as TabId)
    : '';
  const resolvedId = currentId || (allowedTabs[0]?.id ?? '');

  React.useEffect(() => {
    if (activeTab !== resolvedId && resolvedId) {
      setActiveTab(resolvedId);
    }
  }, [activeTab, resolvedId, setActiveTab]);

  if (allowedTabs.length === 0 || !resolvedId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-400">
        <Wallet className="h-8 w-8" />
        <p className="text-sm font-medium">Sem acesso ao módulo financeiro.</p>
      </div>
    );
  }

  const active = allowedTabs.find((t) => t.id === resolvedId) ?? allowedTabs[0];

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Wallet className="h-6 w-6 text-orange-500" />
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Financeiro</h1>
          <p className="text-sm text-zinc-500">
            Orçamentos, pagamentos, extras e aprovação
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200" role="tablist">
        {allowedTabs.map((t) => {
          const isActive = t.id === active.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(t.id)}
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

      {/* Active tab content */}
      <div className="flex min-h-0 flex-1 flex-col">{active.render()}</div>
    </div>
  );
}