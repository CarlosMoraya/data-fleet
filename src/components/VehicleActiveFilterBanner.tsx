import { Search } from 'lucide-react';

import type { ReactElement } from 'react';

interface VehicleActiveFilterBannerProps {
  issueLabel: string | null;
  onClearIssue: () => void;
}

export default function VehicleActiveFilterBanner({
  issueLabel,
  onClearIssue,
}: VehicleActiveFilterBannerProps): ReactElement | null {
  if (issueLabel === null) {
    return null;
  }

  return (
    <div
      data-testid="active-filter-banner"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-orange-200 bg-white px-4 py-3 shadow-sm"
    >
      <Search className="h-4 w-4 text-orange-500" aria-hidden="true" />
      <span className="text-sm font-medium text-zinc-700">Filtro ativo:</span>
      <span className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-1 text-sm font-medium text-orange-700">
        <span>{issueLabel}</span>
        <button
          type="button"
          aria-label="Remover filtro"
          onClick={onClearIssue}
          className="text-orange-700 transition-colors hover:text-orange-800"
        >
          ✕
        </button>
      </span>
    </div>
  );
}
