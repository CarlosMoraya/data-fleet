import React from 'react';

import MultiSelectDropdown from '../MultiSelectDropdown';

import type { MultiSelectOption } from '../MultiSelectDropdown';

interface MeliUtilizationFiltersBarProps {
  range: { from: string; to: string };
  onRangeChange: (next: { from: string; to: string }) => void;
  unitOptions: MultiSelectOption[];
  selectedUnits: string[];
  onUnitsChange: (next: string[]) => void;
  disabled: boolean;
}

export default function MeliUtilizationFiltersBar({
  range,
  onRangeChange,
  unitOptions,
  selectedUnits,
  onUnitsChange,
  disabled,
}: MeliUtilizationFiltersBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-1">
        <label htmlFor="meli-utilization-from" className="text-xs text-zinc-500">
          De
        </label>
        <input
          id="meli-utilization-from"
          type="date"
          value={range.from}
          max={range.to}
          disabled={disabled}
          onChange={(event) => onRangeChange({ ...range, from: event.target.value })}
          className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 focus:ring-2 focus:ring-orange-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="meli-utilization-to" className="text-xs text-zinc-500">
          Até
        </label>
        <input
          id="meli-utilization-to"
          type="date"
          value={range.to}
          min={range.from}
          disabled={disabled}
          onChange={(event) => onRangeChange({ ...range, to: event.target.value })}
          className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 focus:ring-2 focus:ring-orange-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
        />
      </div>
      <MultiSelectDropdown
        label="Unidade Operacional"
        options={unitOptions}
        selected={selectedUnits}
        onChange={onUnitsChange}
        emptyLabel="Nenhuma unidade"
        disabled={disabled}
      />
    </div>
  );
}
