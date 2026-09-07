import { RefreshCw } from 'lucide-react';
import React from 'react';

import { filterPlate } from '../../lib/inputHelpers';
import PeriodRangeFilter from '../dashboard/PeriodRangeFilter';
import MultiSelectDropdown from '../MultiSelectDropdown';

import type { FuelSupplyFilters } from '../../lib/fuelSupplyFilters';
import type { MultiSelectOption } from '../MultiSelectDropdown';

interface FuelSupplyFiltersBarProps {
  filters: FuelSupplyFilters;
  onFiltersChange: (next: FuelSupplyFilters) => void;
  shipperOptions: MultiSelectOption[];
  unitOptions: MultiSelectOption[];
  range: { from: string; to: string };
  onRangeChange: (next: { from: string; to: string }) => void;
  onRangeReset: () => void;
  canSync: boolean;
  isSyncing: boolean;
  onSync: () => void;
}

export default function FuelSupplyFiltersBar({
  filters,
  onFiltersChange,
  shipperOptions,
  unitOptions,
  range,
  onRangeChange,
  onRangeReset,
  canSync,
  isSyncing,
  onSync,
}: FuelSupplyFiltersBarProps) {
  return (
    <div className="space-y-4">
      <PeriodRangeFilter value={range} onChange={onRangeChange} onReset={onRangeReset} />

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <MultiSelectDropdown
          label="Embarcador"
          options={shipperOptions}
          selected={filters.shipperIds}
          onChange={(next) => onFiltersChange({ ...filters, shipperIds: next })}
        />
        <MultiSelectDropdown
          label="Unidade operacional"
          options={unitOptions}
          selected={filters.unitIds}
          onChange={(next) => onFiltersChange({ ...filters, unitIds: next })}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="fuel-supply-plate" className="text-xs text-zinc-500">
            Placa
          </label>
          <input
            id="fuel-supply-plate"
            type="text"
            value={filters.plateQuery}
            placeholder="ABC1D23"
            onChange={(e) =>
              onFiltersChange({ ...filters, plateQuery: filterPlate(e.target.value) })
            }
            className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 focus:ring-2 focus:ring-orange-400 focus:outline-none"
          />
        </div>

        {canSync && (
          <button
            type="button"
            onClick={onSync}
            disabled={isSyncing}
            className="ml-auto flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {isSyncing ? 'Sincronizando…' : 'Sincronizar agora'}
          </button>
        )}
      </div>
    </div>
  );
}
