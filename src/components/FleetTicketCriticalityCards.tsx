import { AlertOctagon, CircleAlert, CircleDot, CircleHelp, CircleSlash, Siren } from 'lucide-react';
import React from 'react';

import { cn } from '../lib/utils';

import type { FleetTicketCardFilter, FleetTicketCounts } from '../types/fleetTicket';

interface FleetTicketCriticalityCardsProps {
  counts: FleetTicketCounts;
  activeFilter: FleetTicketCardFilter;
  onChange: (filter: FleetTicketCardFilter) => void;
}

const cards: Array<{
  filter: FleetTicketCardFilter;
  label: string;
  color: string;
  activeColor: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { filter: 'sos', label: 'S.O.S.', color: 'border-red-200 bg-red-50 text-red-700', activeColor: 'ring-2 ring-red-400', icon: Siren },
  { filter: 'unclassified', label: 'Não classificados', color: 'border-zinc-200 bg-zinc-50 text-zinc-700', activeColor: 'ring-2 ring-zinc-400', icon: CircleHelp },
  { filter: 'critical', label: 'Crítico', color: 'border-red-200 bg-red-50 text-red-700', activeColor: 'ring-2 ring-red-400', icon: AlertOctagon },
  { filter: 'high', label: 'Alto', color: 'border-orange-200 bg-orange-50 text-orange-700', activeColor: 'ring-2 ring-orange-400', icon: CircleAlert },
  { filter: 'medium', label: 'Médio', color: 'border-amber-200 bg-amber-50 text-amber-700', activeColor: 'ring-2 ring-amber-400', icon: CircleDot },
  { filter: 'low', label: 'Baixo', color: 'border-emerald-200 bg-emerald-50 text-emerald-700', activeColor: 'ring-2 ring-emerald-400', icon: CircleSlash },
  { filter: 'all', label: 'Todos', color: 'border-zinc-200 bg-white text-zinc-700', activeColor: 'ring-2 ring-orange-400', icon: CircleDot },
];

export default function FleetTicketCriticalityCards({ counts, activeFilter, onChange }: FleetTicketCriticalityCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {cards.map((card) => {
        const Icon = card.icon;
        const count = counts[card.filter];
        const isSosActive = card.filter === 'sos' && count > 0;
        return (
          <button
            key={card.filter}
            type="button"
            onClick={() => onChange(card.filter)}
            className={cn(
              'rounded-2xl border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
              card.color,
              activeFilter === card.filter && card.activeColor,
              isSosActive && 'animate-pulse shadow-lg shadow-red-200',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="text-2xl font-bold">{count}</span>
            </div>
            <p className="mt-2 text-xs font-semibold">{card.label}</p>
          </button>
        );
      })}
    </div>
  );
}
