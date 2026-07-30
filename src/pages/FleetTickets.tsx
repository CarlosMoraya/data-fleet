import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Loader2, Plus, Search } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import CreateFleetTicketModal from '../components/CreateFleetTicketModal';
import FleetTicketCriticalityCards from '../components/FleetTicketCriticalityCards';
import FleetTicketModal from '../components/FleetTicketModal';
import LastKmLabel from '../components/LastKmLabel';
import SelectClientNotice from '../components/SelectClientNotice';
import { useAuth } from '../context/AuthContext';
import { usePersistentFilterState } from '../hooks/usePersistentUiState';
import { canOpenFleetTicketReport, fleetTicketCriticalityColor, fleetTicketCriticalityLabel, fleetTicketSourceLabel, fleetTicketStatusColor, fleetTicketStatusLabel, filterFleetTicketsByCard, getFleetTicketCounts, sortFleetTicketsByUrgency } from '../lib/fleetTicketRules';
import { requiresClientSelection, showsAggregatedData } from '../lib/clientScope';
import { cn } from '../lib/utils';
import { getVehicleLastKmMap, type VehicleLastKmInfo } from '../services/vehicleOdometerService';
import { listFleetTickets } from '../services/fleetTicketService';

import type { FleetTicket, FleetTicketCardFilter } from '../types/fleetTicket';

function isFleetTicketCardFilter(value: unknown): value is FleetTicketCardFilter {
  return value === 'sos' || value === 'unclassified' || value === 'critical' || value === 'high' || value === 'medium' || value === 'low' || value === 'all';
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function FleetTickets() {
  const { currentClient, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const blockWrite = requiresClientSelection(user?.role, currentClient?.id);
  const [activeFilter, setActiveFilter] = usePersistentFilterState<FleetTicketCardFilter>('fleet-tickets', 'card', 'all', { validator: isFleetTicketCardFilter });
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const ticketsQuery = useQuery({
    queryKey: ['fleetTickets', currentClient?.id ?? 'all-clients'],
    queryFn: () => listFleetTickets(currentClient?.id),
    enabled: showsAggregatedData(user?.role, currentClient?.id),
  });
  const tickets = ticketsQuery.data ?? [];
  const counts = useMemo(() => getFleetTicketCounts(tickets), [tickets]);
  const vehicleIds = useMemo(() => Array.from(new Set(tickets.map((ticket) => ticket.vehicleId))), [tickets]);
  const lastKmQuery = useQuery<Map<string, VehicleLastKmInfo>>({
    queryKey: ['vehicleLastKmMap', 'fleetTickets', vehicleIds],
    queryFn: () => getVehicleLastKmMap(vehicleIds),
    enabled: vehicleIds.length > 0,
  });

  const filteredTickets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const byCard = filterFleetTicketsByCard(tickets, activeFilter);
    const searched = normalizedSearch
      ? byCard.filter((ticket) => [ticket.vehicleLicensePlateSnapshot, ticket.title, ticket.description, ticket.openedByNameSnapshot, ticket.driverNameSnapshot]
          .some((value) => value?.toLowerCase().includes(normalizedSearch)))
      : byCard;
    return sortFleetTicketsByUrgency(searched);
  }, [tickets, activeFilter, search]);

  const selectedTicket = selectedTicketId ? tickets.find((ticket) => ticket.id === selectedTicketId) ?? null : null;

  useEffect(() => {
    const ticketId = searchParams.get('ticket');
    if (!ticketId || ticketsQuery.isLoading) return;
    if (tickets.some((ticket) => ticket.id === ticketId)) setSelectedTicketId(ticketId);
  }, [searchParams, tickets, ticketsQuery.isLoading]);

  const closeTicket = () => {
    setSelectedTicketId(null);
    const next = new URLSearchParams(searchParams);
    next.delete('ticket');
    setSearchParams(next, { replace: true });
  };

  const handleCreated = (ticketId: string) => {
    setCreateOpen(false);
    void queryClient.invalidateQueries({ queryKey: ['fleetTickets'] });
    const next = new URLSearchParams(searchParams);
    next.set('ticket', ticketId);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="flex h-full flex-col gap-6">
      {blockWrite && <SelectClientNotice />}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900"><ClipboardList className="h-6 w-6 text-orange-500" /> Chamados</h1>
          <p className="mt-1 text-sm text-zinc-500">Comunique, classifique e acompanhe problemas operacionais da frota.</p>
        </div>
        {canOpenFleetTicketReport(user?.role) && currentClient?.id && (
          <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-orange-600"><Plus className="h-4 w-4" /> Novo chamado</button>
        )}
      </div>

      <FleetTicketCriticalityCards counts={counts} activeFilter={activeFilter} onChange={setActiveFilter} />

      <div className="relative w-full sm:ml-auto sm:w-80">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por placa, título ou autor..." className="w-full rounded-xl border border-zinc-300 bg-white py-2.5 pr-3 pl-9 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {ticketsQuery.isLoading ? (
          <div className="flex items-center justify-center py-16 text-zinc-400"><Loader2 className="mr-2 h-6 w-6 animate-spin" /> Carregando chamados...</div>
        ) : ticketsQuery.isError ? (
          <div className="p-6 text-sm text-red-700">Não foi possível carregar os chamados: {ticketsQuery.error instanceof Error ? ticketsQuery.error.message : 'erro desconhecido'}</div>
        ) : filteredTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-400"><ClipboardList className="mb-3 h-12 w-12 opacity-30" /><p className="text-sm">Nenhum chamado encontrado.</p></div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="min-w-full divide-y divide-zinc-100">
              <thead className="sticky top-0 z-10 bg-zinc-50">
                <tr>
                  {['Tipo', 'Veículo', 'Criticidade', 'Status', 'Aberto por', 'Responsável', 'Criado em', 'Ação'].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">{heading}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredTickets.map((ticket: FleetTicket) => (
                  <tr key={ticket.id} onClick={() => { setSelectedTicketId(ticket.id); const next = new URLSearchParams(searchParams); next.set('ticket', ticket.id); setSearchParams(next, { replace: true }); }} className="cursor-pointer transition-colors hover:bg-zinc-50">
                    <td className="px-4 py-3">{ticket.source === 'sos' ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">S.O.S.</span> : <span className="text-sm text-zinc-600">{fleetTicketSourceLabel(ticket.source)}</span>}</td>
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900"><div>{ticket.vehicleLicensePlateSnapshot}</div><LastKmLabel info={lastKmQuery.data?.get(ticket.vehicleId)} /></td>
                    <td className="px-4 py-3"><span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', fleetTicketCriticalityColor(ticket.criticality))}>{fleetTicketCriticalityLabel(ticket.criticality)}</span></td>
                    <td className="px-4 py-3"><span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', fleetTicketStatusColor(ticket.status))}>{fleetTicketStatusLabel(ticket.status)}</span></td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{ticket.openedByNameSnapshot}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{ticket.assignedToNameSnapshot ?? <span className="text-zinc-400">—</span>}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-400">{formatDate(ticket.createdAt)}</td>
                    <td className="px-4 py-3 text-xs font-medium text-orange-600">Abrir</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateFleetTicketModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
      {selectedTicket && <FleetTicketModal ticket={selectedTicket} onClose={closeTicket} onSaved={() => { void queryClient.invalidateQueries({ queryKey: ['fleetTickets'] }); }} />}
    </div>
  );
}
