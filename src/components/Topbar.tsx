import { ChevronDown, User as UserIcon, Menu } from 'lucide-react';
import React from 'react';

import { useAuth } from '../context/AuthContext';
import { getRoleLabel } from '../lib/rolePermissions';

interface TopbarProps {
  onMenuClick: () => void;
}

function ClientLogo({ name, logoUrl }: { name: string; logoUrl?: string }) {
  if (logoUrl) {
    return <img src={logoUrl} alt={name} className="h-10 w-auto max-w-[140px] object-contain" />;
  }
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-xs font-bold text-blue-700">
      {initials}
    </span>
  );
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { user, currentClient, clients, switchClient, canSwitchClient, workshopPartnerships } = useAuth();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 md:px-6">
      <div className="flex flex-1 items-center gap-3 md:gap-4">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 lg:hidden"
        >
          <Menu className="h-5 w-5 md:h-6 md:w-6" />
        </button>
        {canSwitchClient ? (
          <div className="flex items-center gap-2">
            {currentClient ? (
              <ClientLogo name={currentClient.name} logoUrl={currentClient.logoUrl} />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100">
                <Menu className="h-4 w-4 text-zinc-400" />
              </div>
            )}
            <div className="relative">
              <select
                aria-label="Selecionar transportadora"
                value={currentClient?.id ?? ''}
                onChange={(e) => switchClient(e.target.value)}
                className="cursor-pointer appearance-none rounded-lg border border-zinc-200 bg-transparent py-1.5 pr-8 pl-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50 focus:ring-0 focus:outline-none"
              >
                {(user?.role === 'Admin Master' || (user?.role === 'Workshop' && workshopPartnerships.length > 1)) && (
                  <option value="">Todos os Clientes</option>
                )}
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <ClientLogo name={currentClient?.name ?? ''} logoUrl={currentClient?.logoUrl} />
            <span className="text-sm font-medium text-zinc-900">{currentClient?.name}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 border-l border-zinc-200 pl-4">
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium text-zinc-900">{user?.name}</span>
            <span className="text-xs text-zinc-500">{getRoleLabel(user?.role)}</span>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100">
            <UserIcon className="h-5 w-5 text-zinc-600" />
          </div>
        </div>
      </div>
    </header>
  );
}
