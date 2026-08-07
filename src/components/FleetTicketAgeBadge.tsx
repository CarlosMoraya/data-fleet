import { AlertTriangle, Clock } from 'lucide-react';
import React from 'react';

import { cn } from '../lib/utils';

import type { FleetTicketSlaEvaluation } from '../lib/fleetTicketSla';

export interface FleetTicketAgeBadgeProps {
  evaluation: FleetTicketSlaEvaluation | null;
  className?: string;
}

export default function FleetTicketAgeBadge({ evaluation, className }: FleetTicketAgeBadgeProps) {
  if (evaluation === null) return null;

  if (!evaluation.breached) {
    return (
      <span className={cn('mt-1 block text-xs text-zinc-400', className)} title={evaluation.description}>
        {evaluation.label}
      </span>
    );
  }

  if (evaluation.scope === 'open') {
    return (
      <span
        className={cn('mt-1 inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700', className)}
        title={evaluation.description}
        aria-label={evaluation.description}
      >
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        {evaluation.label}
      </span>
    );
  }

  return (
    <span
      className={cn('mt-1 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700', className)}
      title={evaluation.description}
      aria-label={evaluation.description}
    >
      <Clock className="h-3 w-3" aria-hidden="true" />
      {evaluation.label}
    </span>
  );
}
