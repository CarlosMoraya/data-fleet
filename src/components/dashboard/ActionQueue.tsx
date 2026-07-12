import { AlertTriangle, Clock } from 'lucide-react';
import React from 'react';

export interface ActionQueueItemLike {
  category: string;
  label: string;
  count: number;
  severity: 'high' | 'medium';
  details: string[];
}

interface ActionQueueProps {
  items: ActionQueueItemLike[];
  onItemClick?: (category: string) => void;
  title?: string;
}

export default function ActionQueue({ items, onItemClick, title = 'Fila de Ação' }: ActionQueueProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
        <p className="mt-3 text-sm text-zinc-500">
          Nenhuma ação crítica pendente. Frota em dia.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
      <div className="mt-4 space-y-2">
        {items.map((item) => {
          const isHigh = item.severity === 'high';
          const Icon = isHigh ? AlertTriangle : Clock;
          const textClass = isHigh ? 'text-red-700' : 'text-amber-700';
          const badgeBg = isHigh ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
          const interactive = onItemClick !== undefined;
          const uniqueDetails = [...new Set(item.details)];
          const visibleDetails = uniqueDetails.slice(0, 5);
          const hiddenDetailsCount = uniqueDetails.length - visibleDetails.length;

          const content = (
            <div className="w-full">
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 shrink-0 ${textClass}`} />
                  <span className={`text-sm font-medium ${textClass}`}>{item.label}</span>
                </div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeBg}`}>
                  {item.count}
                </span>
              </div>
              {item.details.length > 0 && (
                <div className="mt-2 ml-8 flex flex-wrap gap-1.5 text-xs text-zinc-500">
                  {visibleDetails.map((detail) => (
                    <span key={detail} className="rounded-full bg-zinc-100 px-2 py-0.5">
                      {detail}
                    </span>
                  ))}
                  {hiddenDetailsCount > 0 && <span className="px-1 py-0.5">+{hiddenDetailsCount} mais</span>}
                </div>
              )}
            </div>
          );

          if (interactive) {
            return (
              <button
                key={item.category}
                type="button"
                onClick={() => onItemClick(item.category)}
                className="w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-zinc-50"
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
