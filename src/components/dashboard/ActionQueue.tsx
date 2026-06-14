import React from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import type { ActionItem } from '../../lib/dashboardKpi';

interface ActionQueueProps {
  items: ActionItem[];
  onItemClick?: (category: ActionItem['category']) => void;
}

export default function ActionQueue({ items, onItemClick }: ActionQueueProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">Fila de Ação</h3>
        <p className="mt-3 text-sm text-zinc-500">
          Nenhuma ação crítica pendente. Frota em dia.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900">Fila de Ação</h3>
      <div className="mt-4 space-y-2">
        {items.map((item) => {
          const isHigh = item.severity === 'high';
          const Icon = isHigh ? AlertTriangle : Clock;
          const textClass = isHigh ? 'text-red-700' : 'text-amber-700';
          const badgeBg = isHigh ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
          const interactive = onItemClick !== undefined;

          const content = (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <Icon className={`h-5 w-5 shrink-0 ${textClass}`} />
                <span className={`text-sm font-medium ${textClass}`}>{item.label}</span>
              </div>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeBg}`}>
                {item.count}
              </span>
            </div>
          );

          if (interactive) {
            return (
              <button
                key={item.category}
                type="button"
                onClick={() => onItemClick(item.category)}
                className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-zinc-50 transition-colors"
              >
                {content}
              </button>
            );
          }

          return (
            <div
              key={item.category}
              className="rounded-lg px-3 py-2.5"
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
