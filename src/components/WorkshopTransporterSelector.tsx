import { ChevronDown, Building2 } from 'lucide-react';
import React from 'react';

import { useAuth } from '../context/AuthContext';

/**
 * Dropdown para oficina selecionar a transportadora ativa.
 * Só é exibido quando a oficina tem 2+ partnerships.
 */
export default function WorkshopTransporterSelector() {
  const { user, currentClient, workshopPartnerships, switchClient } = useAuth();

  // Só exibir para Workshop com múltiplas transportadoras
  if (user?.role !== 'Workshop' || workshopPartnerships.length <= 1) {
    return null;
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 flex-shrink-0 text-zinc-400" />
        <div className="relative">
          <select
            value={currentClient?.id ?? ''}
            onChange={e => switchClient(e.target.value)}
            className="cursor-pointer appearance-none rounded-lg border border-zinc-200 bg-white py-1.5 pr-7 pl-2 text-sm text-zinc-700 shadow-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
          >
            {workshopPartnerships.map(p => (
              <option key={p.clientId} value={p.clientId}>
                {p.clientName}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
        </div>
      </div>
    </div>
  );
}
