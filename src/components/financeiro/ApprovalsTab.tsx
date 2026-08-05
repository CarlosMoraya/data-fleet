import React, { Suspense, lazy, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { usePersistentTabState } from '../../hooks/usePersistentUiState';
import { canApproveExtraPayments, canApprovePayments } from '../../lib/rolePermissions';
import { cn } from '../../lib/utils';
import RouteFallback from '../RouteFallback';

const PaymentApprovalsTab = lazy(() => import('./PaymentApprovalsTab'));
const ExtraPaymentApprovalsTab = lazy(() => import('./ExtraPaymentApprovalsTab'));

type SegmentId = 'payments' | 'extras';

interface SegmentDef {
  id: SegmentId;
  label: string;
  render: () => React.ReactNode;
}

interface ApprovalsTabProps {
  initialSegment?: SegmentId;
}

export default function ApprovalsTab({ initialSegment }: ApprovalsTabProps): React.ReactElement | null {
  const { user } = useAuth();
  const role = user?.role;
  const [searchParams, setSearchParams] = useSearchParams();

  const segments = useMemo<SegmentDef[]>(() => {
    const list: SegmentDef[] = [];
    if (canApprovePayments(role)) {
      list.push({ id: 'payments', label: 'Pagamentos', render: () => <PaymentApprovalsTab /> });
    }
    if (canApproveExtraPayments(role)) {
      list.push({ id: 'extras', label: 'Extras', render: () => <ExtraPaymentApprovalsTab /> });
    }
    return list;
  }, [role]);

  const [persistedSegment, setPersistedSegment] = usePersistentTabState(
    'financeiro',
    'approvalSegment',
    initialSegment ?? '',
  );

  const urlSegment = searchParams.get('segment');
  const isAllowed = (id: string | null): id is SegmentId =>
    segments.some((s) => s.id === id);

  const resolvedId: SegmentId | undefined =
    (isAllowed(urlSegment) ? urlSegment : undefined)
    ?? (isAllowed(persistedSegment) ? persistedSegment : undefined)
    ?? segments[0]?.id;

  useEffect(() => {
    if (resolvedId && persistedSegment !== resolvedId) {
      setPersistedSegment(resolvedId);
    }
  }, [resolvedId, persistedSegment, setPersistedSegment]);

  function selectSegment(id: SegmentId) {
    setPersistedSegment(id);
    const next = new URLSearchParams(searchParams);
    next.set('segment', id);
    setSearchParams(next);
  }

  if (segments.length === 0 || !resolvedId) {
    return null;
  }

  const active = segments.find((s) => s.id === resolvedId) ?? segments[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div
        className="flex w-full gap-1 overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 p-1"
        role="tablist"
        aria-label="Segmentos de aprovação"
      >
        {segments.map((s) => {
          const isActive = s.id === active.id;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => selectSegment(s.id)}
              className={cn(
                'flex-1 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                isActive ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700',
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <Suspense fallback={<RouteFallback />}>{active.render()}</Suspense>
      </div>
    </div>
  );
}
