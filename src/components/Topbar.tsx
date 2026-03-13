import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ChevronDown, User as UserIcon, Menu } from 'lucide-react';

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
  const { user, currentClient, clients, switchClient, canSwitchClient } = useAuth();

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
            <ClientLogo name={currentClient?.name ?? ''} logoUrl={currentClient?.logoUrl} />
            <div className="relative">
              <select
                value={currentClient?.id}
                onChange={(e) => switchClient(e.target.value)}
                className="appearance-none bg-transparent py-1.5 pl-3 pr-8 text-sm font-medium text-zinc-900 focus:outline-none focus:ring-0 border border-zinc-200 rounded-lg hover:bg-zinc-50 cursor-pointer"
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
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
            <span className="text-xs text-zinc-500">{user?.role}</span>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 border border-zinc-200">
            <UserIcon className="h-5 w-5 text-zinc-600" />
          </div>
        </div>
      </div>
    </header>
  );
}
