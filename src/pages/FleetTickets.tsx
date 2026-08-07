import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Eye, Loader2, Pencil, Plus, Search } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import CreateFleetTicketModal from '../components/CreateFleetTicketModal';
import FleetTicketAgeBadge from '../components/FleetTicketAgeBadge';
import FleetTicketCriticalityCards from '../components/FleetTicketCriticalityCards';
import FleetTicketModal from '../components/FleetTicketModal';
import LastKmLabel from '../components/LastKmLabel';
import SelectClientNotice from '../components/SelectClientNotice';
import { useAuth } from '../context/AuthContext';
import { usePersistentFilterState } from '../hooks/usePersistentUiState';
import { requiresClientSelection, showsAggregatedData } from '../lib/clientScope';
import { fleetTicketActionPlanLabel, hasActionPlan } from '../lib/fleetTicketActionPlanLink';
import {
  FLEET_TICKET_STATUS_FILTER_OPTIONS,
  buildFleetTicketFilterOptions,
  canOpenFleetTicketReport,
  filterFleetTicketsByCard,
  filterFleetTicketsByStatus,
  filterFleetTicketsByVehicleAttributes,
  fleetTicketCriticalityColor,
  fleetTicketCriticalityLabel,
  fleetTicketSourceLabel,
  fleetTicketStatusColor,
  fleetTicketStatusLabel,
  getFleetTicketCounts,
  isFleetTicketReadOnly,
  isFleetTicketStatusFilter,
  sortFleetTicketsByUrgency,
} from '../lib/fleetTicketRules';
import {
  FLEET_TICKET_SLA_DEFAULTS,
  evaluateFleetTicketSla,
  filterFleetTicketsBySla,
  isFleetTicketSlaFilter,
} from '../lib/fleetTicketSla';
import { cn } from '../lib/utils';
import { listFleetTicketIdsWithActionPlan, listFleetTickets } from '../services/fleetTicketService';
import { getFleetTicketSlaSettings } from '../services/fleetTicketSlaSettingsService';
import { getVehicleLastKmMap, type VehicleLastKmInfo } from '../services/vehicleOdometerService';

import type { FleetTicket, FleetTicketCardFilter, FleetTicketSlaFilter, FleetTicketStatusFilter } from '../types/fleetTicket';

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
  const [modelFilter, setModelFilter] = usePersistentFilterState('fleet-tickets', 'model', '');
  const [ownerFilter, setOwnerFilter] = usePersistentFilterState('fleet-tickets', 'owner', '');
  const [shipperFilter, setShipperFilter] = usePersistentFilterState('fleet-tickets', 'shipper', '');
  const [unitFilter, setUnitFilter] = usePersistentFilterState('fleet-tickets', 'unit', '');
  const [statusFilter, setStatusFilter] = usePersistentFilterState<FleetTicketStatusFilter>('fleet-tickets', 'status', '', { validator: isFleetTicketStatusFilter });
  const [slaFilter, setSlaFilter] = usePersistentFilterState<FleetTicketSlaFilter>('fleet-tickets', 'sla', '', { validator: isFleetTicketSlaFilter });
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
  const ticketIds = useMemo(() => (ticketsQuery.data ?? []).map((ticket) => ticket.id), [ticketsQuery.data]);
  const ticketIdsWithActionPlanQuery = useQuery({
    queryKey: ['fleetTicketIdsWithActionPlan', ticketIds],
    queryFn: () => listFleetTicketIdsWithActionPlan(ticketIds),
    enabled: ticketIds.length > 0,
  });
  const ticketIdsWithActionPlan = ticketIdsWithActionPlanQuery.data ?? new Set<string>();
  const lastKmQuery = useQuery<Map<string, VehicleLastKmInfo>>({
    queryKey: ['vehicleLastKmMap', 'fleetTickets', vehicleIds],
    queryFn: () => getVehicleLastKmMap(vehicleIds),
    enabled: vehicleIds.length > 0,
  });
  const slaSettingsQuery = useQuery({
    queryKey: ['fleetTicketSlaSettings', currentClient?.id],
    queryFn: () => getFleetTicketSlaSettings(currentClient!.id),
    enabled: !!currentClient?.id,
  });
  const slaSettings = slaSettingsQuery.data ?? { clientId: currentClient?.id ?? '', ...FLEET_TICKET_SLA_DEFAULTS };

  const modelOptions = useMemo(() => buildFleetTicketFilterOptions(tickets, 'vehicleModelSnapshot'), [tickets]);
  const ownerOptions = useMemo(() => buildFleetTicketFilterOptions(tickets, 'vehicleOwnerSnapshot'), [tickets]);
  const shipperOptions = useMemo(() => buildFleetTicketFilterOptions(tickets, 'shipperNameSnapshot'), [tickets]);
  const unitOptions = useMemo(() => buildFleetTicketFilterOptions(tickets, 'operationalUnitNameSnapshot'), [tickets]);

  const filteredTickets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const byCard = filterFleetTicketsByCard(tickets, activeFilter);
    const byStatus = filterFleetTicketsByStatus(byCard, statusFilter);
    const bySla = slaSettingsQuery.isLoading ? byStatus : filterFleetTicketsBySla(byStatus, slaFilter, slaSettings);
    const searched = normalizedSearch
      ? bySla.filter((ticket) => [ticket.vehicleLicensePlateSnapshot, ticket.title, ticket.description, ticket.openedByNameSnapshot, ticket.driverNameSnapshot, ticket.ticketNumber]
          .some((value) => value?.toLowerCase().includes(normalizedSearch)))
      : bySla;
    const byVehicleAttributes = filterFleetTicketsByVehicleAttributes(searched, {
      model: modelFilter,
      owner: ownerFilter,
      shipper: shipperFilter,
      unit: unitFilter,
    });
    return sortFleetTicketsByUrgency(byVehicleAttributes);
  }, [tickets, activeFilter, statusFilter, slaFilter, slaSettings, slaSettingsQuery.isLoading, search, modelFilter, ownerFilter, shipperFilter, unitFilter]);

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

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <select
          aria-label="Filtrar chamados por status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as FleetTicketStatusFilter)}
          className="rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none"
        >
          <option value="">Status: Todos</option>
          {FLEET_TICKET_STATUS_FILTER_OPTIONS.map((status) => (
            <option key={status} value={status}>{fleetTicketStatusLabel(status)}</option>
          ))}
        </select>
        <select
          aria-label="Filtrar chamados por SLA"
          value={slaFilter}
          onChange={(event) => setSlaFilter(event.target.value as FleetTicketSlaFilter)}
          className="rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none"
        >
          <option value="">SLA: Todos</option>
          <option value="breached">SLA estourado</option>
        </select>
        <select value={modelFilter} onChange={(event) => setModelFilter(event.target.value)} className="rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none">
          <option value="">Modelo: Todos</option>
          {modelOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)} className="rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none">
          <option value="">Proprietário: Todos</option>
          {ownerOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <select value={shipperFilter} onChange={(event) => setShipperFilter(event.target.value)} className="rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none">
          <option value="">Embarcador: Todos</option>
          {shipperOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <select value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)} className="rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none">
          <option value="">Base: Todas</option>
          {unitOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <div className="relative w-full sm:w-80">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por placa, número, título ou autor..." className="w-full rounded-xl border border-zinc-300 bg-white py-2.5 pr-3 pl-9 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none" />
        </div>
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
                  {['Tipo', 'Veículo', 'Criticidade', 'Status', 'Aberto por', 'Responsável', 'Ação'].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">{heading}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredTickets.map((ticket: FleetTicket) => {
                  const readOnly = isFleetTicketReadOnly(ticket.status);
                  const openTicket = () => { setSelectedTicketId(ticket.id); const next = new URLSearchParams(searchParams); next.set('ticket', ticket.id); setSearchParams(next, { replace: true }); };
                  const vehicleMeta = [ticket.vehicleModelSnapshot, ticket.vehicleOwnerSnapshot].filter(Boolean).join(' · ');
                  return (
                    <tr key={ticket.id} onClick={openTicket} className="cursor-pointer transition-colors hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        {ticket.source === 'sos' ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">S.O.S.</span> : <span className="text-sm text-zinc-600">{fleetTicketSourceLabel(ticket.source)}</span>}
                        <div className="text-xs text-zinc-400">{ticket.ticketNumber ?? '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                        <div>{ticket.vehicleLicensePlateSnapshot}</div>
                        <LastKmLabel info={lastKmQuery.data?.get(ticket.vehicleId)} />
                        {vehicleMeta && <div className="text-xs text-zinc-400">{vehicleMeta}</div>}
                      </td>
                      <td className="px-4 py-3"><span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', fleetTicketCriticalityColor(ticket.criticality))}>{fleetTicketCriticalityLabel(ticket.criticality)}</span></td>
                      <td className="px-4 py-3">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', fleetTicketStatusColor(ticket.status))}>{fleetTicketStatusLabel(ticket.status)}</span>
                        <FleetTicketAgeBadge evaluation={evaluateFleetTicketSla(ticket, slaSettings)} />
                        {(() => {
                          const planLabel = fleetTicketActionPlanLabel(ticket.status, hasActionPlan(ticket.id, ticketIdsWithActionPlan));
                          return planLabel ? (
                            <div className="mt-1"><span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">{planLabel}</span></div>
                          ) : null;
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        <div>{ticket.openedByNameSnapshot}</div>
                        <div className="text-xs text-zinc-400">{formatDate(ticket.createdAt)}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{ticket.assignedToNameSnapshot ?? <span className="text-zinc-400">—</span>}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); openTicket(); }}
                          aria-label={readOnly ? 'Visualizar chamado' : 'Editar chamado'}
                          className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-orange-600"
                        >
                          {readOnly ? <Eye className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
