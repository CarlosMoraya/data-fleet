import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

import FuelSupplyFiltersBar from '../components/fuel/FuelSupplyFiltersBar';
import FuelSupplyKpiCards from '../components/fuel/FuelSupplyKpiCards';
import FuelSupplyTable from '../components/fuel/FuelSupplyTable';
import { useAuth } from '../context/AuthContext';
import { useFuelSupplyAccess } from '../hooks/useFuelSupplyAccess';
import {
  applyFuelSupplyFilters,
  countUnmatchedSupplies,
  parseFuelSupplyFiltersFromParams,
  writeFuelSupplyFiltersToParams,
} from '../lib/fuelSupplyFilters';
import { calculateFuelSupplyKpis } from '../lib/fuelSupplyKpi';
import { filterOperationalUnitsByShippers } from '../lib/operationsManagerScope';
import { getFuelSupplies, triggerVeloeFuelSync } from '../services/fuelSupplyService';

import type { FuelSupplyFilters } from '../lib/fuelSupplyFilters';
import type { FuelSupply } from '../types/fuelSupply';

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { from: iso(first), to: iso(last) };
}

export default function FuelSupplies() {
  const { currentClient } = useAuth();
  const { canView, canSync } = useFuelSupplyAccess();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [range, setRange] = useState(currentMonthRange);

  const filters = useMemo(
    () => parseFuelSupplyFiltersFromParams(searchParams),
    [searchParams]
  );

  const {
    data: supplies = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<FuelSupply[]>({
    queryKey: ['fuelSupplies', currentClient?.id, range.from, range.to],
    queryFn: () => getFuelSupplies(currentClient!.id, range),
    enabled: canView && !!currentClient?.id,
    staleTime: 3 * 60 * 1000,
  });

  const syncMutation = useMutation({
    mutationFn: triggerVeloeFuelSync,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['fuelSupplies'] });
    },
  });

  const shipperOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const supply of supplies) {
      if (supply.shipperId && supply.shipperName) map.set(supply.shipperId, supply.shipperName);
    }
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [supplies]);

  const allUnitOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string; shipperId: string }>();
    for (const supply of supplies) {
      if (supply.operationalUnitId && supply.operationalUnitName && supply.shipperId) {
        map.set(supply.operationalUnitId, {
          value: supply.operationalUnitId,
          label: supply.operationalUnitName,
          shipperId: supply.shipperId,
        });
      }
    }
    return [...map.values()].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
    );
  }, [supplies]);

  const unitOptions = useMemo(() => {
    if (filters.shipperIds.length === 0) {
      return allUnitOptions.map(({ value, label }) => ({ value, label }));
    }
    const units = allUnitOptions.map((unit) => ({ id: unit.value, shipperId: unit.shipperId }));
    const visibleIds = filterOperationalUnitsByShippers(
      units.map((unit) => unit.id),
      filters.shipperIds,
      units
    );
    const visible = new Set(visibleIds);
    return allUnitOptions
      .filter((unit) => visible.has(unit.value))
      .map(({ value, label }) => ({ value, label }));
  }, [allUnitOptions, filters.shipperIds]);

  const filtered = useMemo(() => applyFuelSupplyFilters(supplies, filters), [supplies, filters]);
  const kpis = useMemo(() => calculateFuelSupplyKpis(filtered), [filtered]);
  const unmatchedCount = countUnmatchedSupplies(supplies);

  if (!canView) return <Navigate to="/" replace />;

  const handleFiltersChange = (next: FuelSupplyFilters) => {
    // `q` é digitado tecla a tecla: grava com replace para não poluir o histórico.
    const replace = next.plateQuery !== filters.plateQuery;
    setSearchParams(writeFuelSupplyFiltersToParams(next), { replace });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Abastecimento</h1>
        <p className="text-sm text-zinc-500">
          Histórico de abastecimentos sincronizado diariamente com a Veloe.
        </p>
      </div>

      <FuelSupplyFiltersBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        shipperOptions={shipperOptions}
        unitOptions={unitOptions}
        range={range}
        onRangeChange={setRange}
        onRangeReset={() => setRange(currentMonthRange())}
        canSync={canSync}
        isSyncing={syncMutation.isPending}
        onSync={() => syncMutation.mutate()}
      />

      {syncMutation.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {syncMutation.error instanceof Error
            ? syncMutation.error.message
            : 'Não foi possível sincronizar os abastecimentos.'}
        </div>
      )}

      {isError ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>Não foi possível carregar os abastecimentos.</span>
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          <FuelSupplyKpiCards kpis={kpis} />

          {unmatchedCount > 0 && (
            <p className="text-xs text-zinc-500">
              {unmatchedCount} abastecimento(s) sem veículo identificado
            </p>
          )}

          <FuelSupplyTable supplies={filtered} isLoading={isLoading} />
        </>
      )}
    </div>
  );
}
