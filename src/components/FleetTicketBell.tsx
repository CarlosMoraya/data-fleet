import { useQuery } from '@tanstack/react-query';
import { Bell, ClipboardList } from 'lucide-react';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { isUrgentFleetTicket } from '../lib/fleetTicketRules';
import { listFleetTickets } from '../services/fleetTicketService';

import type { Role } from '../types';

const BELL_ROLES: Role[] = [
  'Yard Auditor',
  'Fleet Assistant',
  'Fleet Analyst',
  'Supervisor',
  'Operations Manager',
  'Manager',
  'Coordinator',
  'Director',
  'Admin Master',
];

export default function FleetTicketBell() {
  const { currentClient, user } = useAuth();
  const [open, setOpen] = useState(false);
  const enabled = !!user?.role && BELL_ROLES.includes(user.role);

  const ticketsQuery = useQuery({
    queryKey: ['fleetTickets', currentClient?.id ?? 'all-clients', 'urgentBell'],
    queryFn: () => listFleetTickets(currentClient?.id),
    enabled,
    refetchInterval: 60_000,
  });

  if (!enabled) return null;

  const urgentTickets = (ticketsQuery.data ?? []).filter(isUrgentFleetTicket);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Chamados urgentes"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
      >
        <Bell className="h-5 w-5" />
        {urgentTickets.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white">
            {urgentTickets.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-red-500" />
              <span className="text-sm font-semibold text-zinc-900">Chamados urgentes</span>
            </div>
            <span className="text-xs text-zinc-400">{urgentTickets.length}</span>
          </div>

          {urgentTickets.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">Nenhum chamado urgente.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100">
              {urgentTickets.slice(0, 5).map((ticket) => (
                <Link
                  key={ticket.id}
                  to={`/chamados?ticket=${ticket.id}`}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-3 transition-colors hover:bg-zinc-50"
                >
                  <div className="flex items-center gap-2">
                    <span className={ticket.source === 'sos' ? 'rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700' : 'rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700'}>
                      {ticket.source === 'sos' ? 'S.O.S.' : 'Crítico'}
                    </span>
                    <span className="text-xs font-medium text-zinc-700">{ticket.vehicleLicensePlateSnapshot}</span>
                  </div>
                  <p className="mt-1 truncate text-sm text-zinc-900">{ticket.title}</p>
                </Link>
              ))}
            </div>
          )}

          <Link
            to="/chamados"
            onClick={() => setOpen(false)}
            className="block border-t border-zinc-100 px-4 py-3 text-center text-sm font-medium text-orange-600 hover:bg-orange-50"
          >
            Ver todos os chamados
          </Link>
        </div>
      )}
    </div>
  );
}
