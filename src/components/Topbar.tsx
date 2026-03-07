import React from 'react';
import { useAuth } from '../context/AuthContext';
import { MOCK_CLIENTS } from '../constants';
import { Building, ChevronDown, User as UserIcon } from 'lucide-react';

export default function Topbar() {
  const { user, currentClient, switchClient, canSwitchClient } = useAuth();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6">
      <div className="flex flex-1 items-center">
        {canSwitchClient && (
          <div className="flex items-center gap-2">
            <Building className="h-5 w-5 text-zinc-400" />
            <div className="relative">
              <select
                value={currentClient?.id}
                onChange={(e) => switchClient(e.target.value)}
                className="appearance-none bg-transparent py-1.5 pl-3 pr-8 text-sm font-medium text-zinc-900 focus:outline-none focus:ring-0 border border-zinc-200 rounded-lg hover:bg-zinc-50 cursor-pointer"
              >
                {MOCK_CLIENTS.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            </div>
          </div>
        )}
        {!canSwitchClient && (
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
            <Building className="h-5 w-5 text-zinc-400" />
            {currentClient?.name}
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
