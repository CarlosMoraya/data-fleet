import React, { Suspense, lazy, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { usePersistentTabState } from '../../hooks/usePersistentUiState';
import { cn } from '../../lib/utils';
import RouteFallback from '../RouteFallback';

const BudgetApprovals = lazy(() => import('../../pages/BudgetApprovals'));
const BudgetHistoryTab = lazy(() => import('./BudgetHistoryTab'));

type BudgetSegmentId = 'pending' | 'history';

interface SegmentDef {
  id: BudgetSegmentId;
  label: string;
  render: () => React.ReactNode;
}

const SEGMENTS: SegmentDef[] = [
  { id: 'pending', label: 'Pendentes', render: () => <BudgetApprovals embedded /> },
  { id: 'history', label: 'Histórico', render: () => <BudgetHistoryTab /> },
];

export default function BudgetApprovalsTab(): React.ReactElement | null {
  const [searchParams, setSearchParams] = useSearchParams();

  const [persistedSegment, setPersistedSegment] = usePersistentTabState(
    'financeiro',
    'budgetSegment',
    '',
  );

  const urlSegment = searchParams.get('segment');
  const isAllowed = (id: string | null): id is BudgetSegmentId =>
    SEGMENTS.some((s) => s.id === id);

  const resolvedId: BudgetSegmentId =
    (isAllowed(urlSegment) ? urlSegment : undefined)
    ?? (isAllowed(persistedSegment) ? persistedSegment : undefined)
    ?? SEGMENTS[0]!.id;

  useEffect(() => {
    if (persistedSegment !== resolvedId) {
      setPersistedSegment(resolvedId);
    }
  }, [resolvedId, persistedSegment, setPersistedSegment]);

  function selectSegment(id: BudgetSegmentId) {
    setPersistedSegment(id);
    const next = new URLSearchParams(searchParams);
    next.set('segment', id);
    setSearchParams(next);
  }

  const active = SEGMENTS.find((s) => s.id === resolvedId) ?? SEGMENTS[0]!;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div
        className="flex w-full gap-1 overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 p-1"
        role="tablist"
        aria-label="Segmentos de orçamentos"
      >
        {SEGMENTS.map((s) => {
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