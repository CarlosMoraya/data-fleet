import React from 'react';
import { CalendarDays } from 'lucide-react';

interface PeriodRangeFilterProps {
  value: { from: string; to: string };
  onChange: (next: { from: string; to: string }) => void;
  onReset: () => void;
}

export default function PeriodRangeFilter({
  value,
  onChange,
  onReset,
}: PeriodRangeFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-zinc-500" />
        <div>
          <h3 className="text-base font-semibold text-zinc-900">Período de análise</h3>
          <p className="text-sm text-zinc-500">Os indicadores desta aba refletem o período selecionado</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500">De</label>
          <input
            type="date"
            value={value.from}
            max={value.to}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500">Até</label>
          <input
            type="date"
            value={value.to}
            min={value.from}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <button
          onClick={onReset}
          className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 transition-colors"
        >
          Mês atual
        </button>
      </div>
    </div>
  );
}
