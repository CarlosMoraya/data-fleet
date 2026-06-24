import React from 'react';

import type { HorizonOption } from '../../lib/dashboardKpi';

interface HorizonSelectorProps {
  value: HorizonOption;
  onChange: (h: HorizonOption) => void;
}

const OPTIONS: { id: HorizonOption; label: string }[] = [
  { id: '3m', label: 'Últimos 3 meses' },
  { id: '6m', label: 'Últimos 6 meses' },
  { id: '12m', label: 'Últimos 12 meses' },
  { id: 'current_year', label: 'Ano atual' },
];

export default function HorizonSelector({ value, onChange }: HorizonSelectorProps) {
  return (
    <div className="inline-flex border-b border-zinc-200">
      {OPTIONS.map((opt) => {
        const isActive = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(opt.id)}
            className={`border-b-2 px-4 py-2 text-sm transition-colors ${
              isActive
                ? 'border-orange-500 font-medium text-orange-600'
                : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
