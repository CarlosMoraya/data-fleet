import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, Trash2, Truck, User, Eye, ToggleLeft, ToggleRight } from 'lucide-react';
import React, { useState, useMemo, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import LastKmLabel from '../components/LastKmLabel';
import SelectClientNotice from '../components/SelectClientNotice';
import VehicleActiveFilterBanner from '../components/VehicleActiveFilterBanner';
import VehicleDetailModal from '../components/VehicleDetailModal';
import VehicleForm from '../components/VehicleForm';
import { useAuth } from '../context/AuthContext';
import { usePersistentUiState, useSessionUiState } from '../hooks/usePersistentUiState';
import { requiresClientSelection } from '../lib/clientScope';
import { computeOverdueChecklistVehicleIds } from '../lib/dashboardKpi';
import { fieldSettingsFromRow, defaultFieldSettings, VehicleFieldSettingsRow } from '../lib/fieldSettingsMappers';
import { clearVehicleDraftFiles } from '../lib/offline/vehicleDraftFiles';
import { filterByActive } from '../lib/registryActiveFilter';
import { supabase } from '../lib/supabase';
import { buildUiStateKey, removeUiState } from '../lib/uiStateStorage';
import {
  PENDENCY_LABELS,
  PENDENCY_VALUES,
  applyVehicleFilters,
  hasActiveStructuredFilters,
  hasLegacyVehicleParams,
  parseSearchFromParams,
  parseVehicleFiltersFromParams,
  serializeVehicleFiltersToParams,
  type VehiclePendency,
  type VehicleStructuredFilters,
} from '../lib/vehicleFilters';
import { vehicleFromRow, VehicleRow } from '../lib/vehicleMappers';
import { getVehicleLastKmMap, type VehicleLastKmInfo } from '../services/vehicleOdometerService';
import { saveVehicle, deleteVehicle, toggleVehicleActive } from '../services/vehicleService';
import { Vehicle } from '../types';

import type { VehicleFiles } from '../services/vehicleService';


const ROLES_WITH_ACCESS = ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'];
const ROLES_CAN_CREATE = ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'];
const ROLES_CAN_EDIT = ['Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'];
const ROLES_CAN_HARD_DELETE = ['Admin Master'];

export default function Vehicles() {
  const { currentClient, user, clients } = useAuth();
  const queryClient = useQueryClient();
  const blockWrite = requiresClientSelection(user?.role, currentClient?.id);
  const [searchParams, setSearchParams] = useSearchParams();
  const search = parseSearchFromParams(searchParams);
  const filters = useMemo(() => parseVehicleFiltersFromParams(searchParams), [searchParams]);
  const [isFormOpen, setIsFormOpen] = useSessionUiState<boolean>('vehicles', 'modal', 'form-open', false, { legacyKeys: ['vehicleFormOpen'] });
  const [editingVehicle, setEditingVehicle] = useSessionUiState<Vehicle | null>('vehicles', 'selection', 'editing', null, { legacyKeys: ['vehicleFormEditing'] });
  const [showInactive, setShowInactive] = usePersistentUiState<boolean>({
    module: 'vehicles',
    stateKind: 'filter',
    name: 'show-inactive',
    scope: 'preference',
    defaultValue: false,
  });
  const [restoredAfterReload] = useState(() => isFormOpen);

  const [viewingVehicle, setViewingVehicle] = useState<Vehicle | null>(null);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);

  const clearVehicleDraft = () => {
    if (user?.id) {
      const key = buildUiStateKey({ scope: 'draft', userId: user.id, clientId: currentClient?.id ?? 'no-client', module: 'vehicles', stateKind: 'draft', name: 'form' });
      removeUiState(window.sessionStorage, key);
    }
    removeUiState(window.sessionStorage, 'vehicleFormData');
  };

  const canCreate = ROLES_CAN_CREATE.includes(user?.role || '') && !blockWrite;
  const canEdit = ROLES_CAN_EDIT.includes(user?.role || '') && !blockWrite;
  const canHardDelete = user?.role === 'Admin Master' && !blockWrite;
  const canToggleActive = ROLES_CAN_EDIT.includes(user?.role || '') && !blockWrite;

  // Redirect Drivers and Yard Auditors
  if (user && !ROLES_WITH_ACCESS.includes(user.role)) {
    return <Navigate to="/checklists" replace />;
  }

  // --- QUERIES ---

  const { data: vehicles = [], isLoading: loadingVehicles, error: vehiclesError } = useQuery({
    queryKey: ['vehicles', currentClient?.id],
    queryFn: async () => {
      let query = supabase.from('vehicles').select('*, drivers(name), shippers(name), operational_units(name)');
      if (currentClient?.id) {
        query = query.eq('client_id', currentClient.id);
      }
      const { data, error } = await query.order('license_plate');
      if (error) throw error;
      return (data as VehicleRow[]).map(vehicleFromRow);
    },
    enabled: !!user,
  });

  const { data: fieldSettings } = useQuery({
    queryKey: ['vehicleFieldSettings', currentClient?.id],
    queryFn: async () => {
      if (!currentClient?.id) return defaultFieldSettings('');
      const result = await supabase
        .from('vehicle_field_settings')
        .select('*')
        .eq('client_id', currentClient.id)
        .maybeSingle();
      const data = result.data as VehicleFieldSettingsRow | null;
      return data ? fieldSettingsFromRow(data) : defaultFieldSettings(currentClient.id);
    },
    enabled: !!currentClient?.id,
  });

  const { data: logisticsData } = useQuery({
    queryKey: ['availableLogistics', currentClient?.id],
    queryFn: async () => {
      let shippersQuery = supabase.from('shippers').select('id, name').eq('active', true);
      let unitsQuery = supabase.from('operational_units').select('id, name, shipper_id').eq('active', true);

      if (currentClient?.id) {
        shippersQuery = shippersQuery.eq('client_id', currentClient.id);
        unitsQuery = unitsQuery.eq('client_id', currentClient.id);
      }

      const [{ data: shippersData }, { data: unitsData }] = await Promise.all([
        shippersQuery.order('name'),
        unitsQuery.order('name'),
      ]);

      type UnitRow = { id: string; name: string; shipper_id: string };
      return {
        shippers: (shippersData ?? []),
        units: (unitsData as UnitRow[] ?? []).map((u) => ({
          id: u.id,
          name: u.name,
          shipperId: u.shipper_id,
        }))
      };
    },
    enabled: !!currentClient?.id,
  });

  const { data: availableDrivers = [] } = useQuery({
    queryKey: ['availableDrivers', currentClient?.id, editingVehicle?.driverId],
    queryFn: async () => {
      let driversQuery = supabase.from('drivers').select('id, name, cpf');
      let vehiclesQuery = supabase.from('vehicles').select('driver_id').not('driver_id', 'is', null);

      if (currentClient?.id) {
        driversQuery = driversQuery.eq('client_id', currentClient.id);
        vehiclesQuery = vehiclesQuery.eq('client_id', currentClient.id);
      }

      const [{ data: allDrivers }, { data: usedRows }] = await Promise.all([
        driversQuery.order('name'),
        vehiclesQuery
      ]);

      const usedIds = new Set(
        (usedRows ?? [])
          .map((r: { driver_id: string }) => r.driver_id)
          .filter((id: string) => id !== editingVehicle?.driverId)
      );

      type DriverRow = { id: string; name: string; cpf: string };
      return (allDrivers as DriverRow[] ?? []).filter((d) => !usedIds.has(d.id));
    },
    enabled: isFormOpen && !!currentClient?.id,
  });

  const shipperOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const vehicle of vehicles) {
      if (vehicle.shipperId && vehicle.shipperName) {
        map.set(vehicle.shipperId, vehicle.shipperName);
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [vehicles]);

  const allUnitOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; shipperId: string }>();
    for (const vehicle of vehicles) {
      if (vehicle.operationalUnitId && vehicle.operationalUnitName && vehicle.shipperId) {
        map.set(vehicle.operationalUnitId, {
          id: vehicle.operationalUnitId,
          name: vehicle.operationalUnitName,
          shipperId: vehicle.shipperId,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [vehicles]);

  const unitOptions = useMemo(() => {
    if (!filters.shipperId) return allUnitOptions;
    return allUnitOptions.filter((unit) => unit.shipperId === filters.shipperId);
  }, [allUnitOptions, filters.shipperId]);

  const { data: checklistRows = [] } = useQuery<
    { vehicle_id: string; context: string; completed_at: string }[]
  >({
    queryKey: ['vehicles-overdue-checklists', currentClient?.id],
    queryFn: async () => {
      const rpcResult = await supabase.rpc('dashboard_last_checklist_per_vehicle', {
        p_client_id: currentClient?.id ?? null,
      });
      if (rpcResult.error) throw rpcResult.error;
      const rows = (rpcResult.data as Record<string, unknown>[] | null) ?? [];
      return rows.map((row) => ({
        vehicle_id: row.vehicle_id as string,
        context: (row.context as string) ?? '',
        completed_at: row.completed_at as string,
      }));
    },
    enabled: !!user && filters.pendency === 'checklist_overdue',
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: intervalRows = [] } = useQuery<
    { client_id: string; rotina_day_interval: number | null; seguranca_day_interval: number | null }[]
  >({
    queryKey: ['vehicles-checklist-intervals', currentClient?.id],
    queryFn: async () => {
      let query = supabase
        .from('checklist_day_intervals')
        .select('client_id, rotina_day_interval, seguranca_day_interval');
      if (currentClient?.id) {
        query = query.eq('client_id', currentClient.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []);
    },
    enabled: !!user && filters.pendency === 'checklist_overdue',
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const overdueChecklistVehicleIds = useMemo(() => {
    if (filters.pendency !== 'checklist_overdue') return new Set<string>();
    const intervalsByClient = new Map<string, { rotina_day_interval: number | null; seguranca_day_interval: number | null }>();
    for (const row of intervalRows) {
      intervalsByClient.set(row.client_id, {
        rotina_day_interval: row.rotina_day_interval,
        seguranca_day_interval: row.seguranca_day_interval,
      });
    }
    return computeOverdueChecklistVehicleIds({
      vehicles: vehicles.map((vehicle) => ({ id: vehicle.id, client_id: vehicle.clientId ?? null })),
      checklistRows,
      intervalsByClient,
      today: new Date(),
    });
  }, [checklistRows, filters.pendency, intervalRows, vehicles]);

  const pendencyCtx = useMemo(() => ({
    todayIso: new Date().toISOString().slice(0, 10),
    currentYear: String(new Date().getFullYear()),
    overdueChecklistVehicleIds,
  }), [overdueChecklistVehicleIds]);

  const setSearch = (value: string) => {
    setSearchParams(serializeVehicleFiltersToParams(filters, value), { replace: true });
  };

  const updateFilter = (patch: Partial<VehicleStructuredFilters>) => {
    const next = { ...filters, ...patch };
    if ('shipperId' in patch) {
      const selectedUnit = next.operationalUnitId
        ? allUnitOptions.find((unit) => unit.id === next.operationalUnitId)
        : undefined;
      if (selectedUnit && selectedUnit.shipperId !== next.shipperId) {
        next.operationalUnitId = null;
      }
    }
    setSearchParams(serializeVehicleFiltersToParams(next, search), { replace: false });
  };

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  useEffect(() => {
    if (hasLegacyVehicleParams(searchParams)) {
      setSearchParams(
        serializeVehicleFiltersToParams(parseVehicleFiltersFromParams(searchParams), parseSearchFromParams(searchParams)),
        { replace: true }
      );
    }
  }, [searchParams, setSearchParams]);

  const availableShippers = logisticsData?.shippers ?? [];
  const availableOperationalUnits = logisticsData?.units ?? [];

  const saveMutation = useMutation({
    mutationFn: async ({ vehicle, files }: {
      vehicle: Partial<Vehicle>;
      files: VehicleFiles;
    }) => {
      if (!currentClient?.id) throw new Error('Sessão inválida');
      return saveVehicle(currentClient.id, vehicle, files, editingVehicle?.id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vehicles', currentClient?.id] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-vehicles', currentClient?.id] });
      void queryClient.invalidateQueries({ queryKey: ['availableDrivers'] });
      setIsFormOpen(false);
      setEditingVehicle(null);
      clearVehicleDraft();
      void clearVehicleDraftFiles();
    },
  });

  const handleSave = async (
    vehicle: Partial<Vehicle>,
    files: VehicleFiles
  ): Promise<void> => {
    await saveMutation.mutateAsync({ vehicle, files });
  };

  const deleteMutation = useMutation({
    mutationFn: async (vehicle: Vehicle) => {
      await deleteVehicle(vehicle);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vehicles', currentClient?.id] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-vehicles', currentClient?.id] });
      void queryClient.invalidateQueries({ queryKey: ['availableDrivers'] });
      setVehicleToDelete(null);
    },
    onError: (err: unknown) => {
      console.error('Erro ao excluir veículo:', err);
      const pgError = err as { code?: string };
      if (pgError.code === '23503') {
        alert('Não é possível excluir: existem registros vinculados. Inative o cadastro para remover do dia a dia.');
        return;
      }
      alert('Erro ao excluir veículo. Tente novamente.');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (vehicle: Vehicle) => {
      if (!user?.id) throw new Error('Sessão inválida');
      await toggleVehicleActive(vehicle, user.id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vehicles', currentClient?.id] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-vehicles', currentClient?.id] });
      void queryClient.invalidateQueries({ queryKey: ['availableDrivers'] });
    },
    onError: (err: unknown) => {
      console.error('Erro ao alterar status do veículo:', err);
      alert('Erro ao alterar status do veículo. Tente novamente.');
    },
  });

  const { data: vehicleDeleteLinks } = useQuery({
    queryKey: ['vehicle-delete-links', vehicleToDelete?.id],
    queryFn: async () => {
      if (!vehicleToDelete?.id) return null;

      const vehicleId = vehicleToDelete.id;
      const counts = await Promise.all([
        supabase.from('maintenance_orders').select('*', { count: 'exact', head: true }).eq('vehicle_id', vehicleId),
        supabase.from('tires').select('*', { count: 'exact', head: true }).eq('vehicle_id', vehicleId),
        supabase.from('tire_inspections').select('*', { count: 'exact', head: true }).eq('vehicle_id', vehicleId),
        supabase.from('vehicle_odometer_corrections').select('*', { count: 'exact', head: true }).eq('vehicle_id', vehicleId),
        supabase.from('vehicle_km_intervals').select('*', { count: 'exact', head: true }).eq('vehicle_id', vehicleId),
        supabase.from('vehicle_warranty_revision_assignments').select('*', { count: 'exact', head: true }).eq('vehicle_id', vehicleId),
      ]);

      const total = counts.reduce((sum, result) => sum + (result.count ?? 0), 0);
      return total;
    },
    enabled: !!vehicleToDelete,
  });

  const filteredVehicles = useMemo(() => {
    const list = applyVehicleFilters(vehicles, search, filters, pendencyCtx);
    return filterByActive(list, showInactive);
  }, [vehicles, search, filters, pendencyCtx, showInactive]);

  const vehicleIds = useMemo(
    () => filteredVehicles.map((v) => v.id),
    [filteredVehicles],
  );

  const { data: lastKmMap = new Map<string, VehicleLastKmInfo>() } = useQuery({
    queryKey: ['vehicleLastKmMap', 'vehicles', vehicleIds],
    queryFn: () => getVehicleLastKmMap(vehicleIds),
    enabled: vehicleIds.length > 0,
  });

  const vehicleDeleteBlockedReason = useMemo(() => {
    if (!vehicleToDelete) return null;
    const total = vehicleDeleteLinks ?? 0;
    if (total > 0 || vehicleToDelete.active !== false) {
      return `Não é possível excluir: existem ${total} registros vinculados. Inative o cadastro para remover do dia a dia.`;
    }
    return null;
  }, [vehicleDeleteLinks, vehicleToDelete]);

  const clientNameMap = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach(c => map.set(c.id, c.name));
    return map;
  }, [clients]);

  return (
    <div className="flex h-full flex-col gap-6">
      {blockWrite && <SelectClientNotice />}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Veículos</h1>
          <p className="mt-1 text-sm text-zinc-500">Gerencie a frota de veículos do cliente.</p>
        </div>

        {canCreate && (
          <button
            onClick={() => {
              clearVehicleDraft();
              void clearVehicleDraftFiles();
              setIsFormOpen(true);
              setEditingVehicle(null);
              setIsFormOpen(true);
            }}
            className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-orange-600 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:outline-none"
          >
            <Plus className="mr-2 -ml-1 h-5 w-5" aria-hidden="true" />
            Adicionar Veículo
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-zinc-400" aria-hidden="true" />
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="block w-full rounded-xl border border-zinc-200 bg-white py-2.5 pr-3 pl-10 text-sm placeholder-zinc-500 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            placeholder="Buscar por placa, modelo ou chassi..."
          />
        </div>
        <select
          aria-label="Embarcador"
          value={filters.shipperId ?? ''}
          onChange={(e) => updateFilter({ shipperId: e.target.value || null })}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="">Todos os embarcadores</option>
          {shipperOptions.map((shipper) => (
            <option key={shipper.id} value={shipper.id}>{shipper.name}</option>
          ))}
        </select>
        <select
          aria-label="Unidade Operacional"
          value={filters.operationalUnitId ?? ''}
          onChange={(e) => updateFilter({ operationalUnitId: e.target.value || null })}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="">Todas as unidades</option>
          {unitOptions.map((unit) => (
            <option key={unit.id} value={unit.id}>{unit.name}</option>
          ))}
        </select>
        <select
          aria-label="Pendência"
          value={filters.pendency ?? ''}
          onChange={(e) => updateFilter({ pendency: (e.target.value || null) as VehiclePendency | null })}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="">Todas as pendências</option>
          {PENDENCY_VALUES.map((pendency) => (
            <option key={pendency} value={pendency}>{PENDENCY_LABELS[pendency]}</option>
          ))}
        </select>
        {(hasActiveStructuredFilters(filters) || !!search) && (
          <button
            type="button"
            aria-label="Limpar filtros"
            onClick={clearAllFilters}
            className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
          >
            Limpar filtros
          </button>
        )}
        {canToggleActive && (
          <button
            type="button"
            onClick={() => setShowInactive((previous) => !previous)}
            className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
          >
            {showInactive ? 'Ocultar inativos' : 'Mostrar inativos'}
          </button>
        )}
      </div>

      <VehicleActiveFilterBanner
        issueLabel={filters.pendency ? PENDENCY_LABELS[filters.pendency] : null}
        onClearIssue={() => updateFilter({ pendency: null })}
      />

      {vehiclesError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Erro ao carregar veículos. Tente novamente.
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {loadingVehicles ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-orange-500" />
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="sticky top-0 z-10 bg-zinc-50">
                <tr>
                  {blockWrite && (
                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">Cliente</th>
                  )}
                  <th scope="col" className="py-3.5 pr-3 pl-4 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase sm:pl-6">Veículo</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">Tipo / Energia</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">Proprietário</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">Motorista</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">Embarcador / Unid. Op.</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">Finalidade</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">Status</th>
                  <th scope="col" className="relative py-3.5 pr-4 pl-3 sm:pr-6">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {filteredVehicles.map((vehicle) => (
                  <tr
                    key={vehicle.id}
                    className={`transition-colors hover:bg-zinc-50 ${vehicle.active === false ? 'opacity-50' : ''}`}
                  >
                    {blockWrite && (
                      <td className="px-3 py-4 text-sm whitespace-nowrap text-zinc-600">
                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                          {vehicle.clientId ? (clientNameMap.get(vehicle.clientId) ?? '—') : '—'}
                        </span>
                      </td>
                    )}
                    <td className="py-4 pr-3 pl-4 whitespace-nowrap sm:pl-6">
                      <div className="flex items-center">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100">
                          <Truck className="h-5 w-5 text-zinc-500" />
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-zinc-900">{vehicle.licensePlate}</div>
                          <LastKmLabel info={lastKmMap.get(vehicle.id)} className="text-xs text-zinc-400" />
                          <div className="text-sm text-zinc-500">{vehicle.brand} {vehicle.model} ({vehicle.year})</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-sm whitespace-nowrap text-zinc-500">
                      <div className="text-zinc-900">{vehicle.type}</div>
                      <div>{vehicle.energySource}</div>
                    </td>
                    <td className="px-3 py-4 text-sm whitespace-nowrap text-zinc-500">
                      <div className="text-zinc-900">{vehicle.owner}</div>
                      <div>{vehicle.acquisition}</div>
                    </td>
                    <td className="max-w-[140px] px-3 py-4 text-sm text-zinc-500">
                      {vehicle.driverName ? (() => {
                        const parts = vehicle.driverName.split(' ');
                        const firstLine = parts.slice(0, 2).join(' ');
                        const secondLine = parts.slice(2).join(' ');
                        return (
                          <div className="flex items-start gap-1.5">
                            <User className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-orange-500" />
                            <span className="leading-snug text-zinc-900">
                              {firstLine}
                              {secondLine && <><br />{secondLine}</>}
                            </span>
                          </div>
                        );
                      })() : (
                        <span className="text-zinc-500 italic">Sem motorista</span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-sm whitespace-nowrap text-zinc-500">
                      {vehicle.shipperName ? (
                        <div className="text-zinc-900">{vehicle.shipperName}</div>
                      ) : (
                        <div className="text-zinc-400 italic">—</div>
                      )}
                      {vehicle.operationalUnitName && (
                        <div className="text-zinc-500">{vehicle.operationalUnitName}</div>
                      )}
                    </td>
                    <td className="px-3 py-4 text-sm whitespace-nowrap text-zinc-500">
                      {vehicle.vehicleUsage ? (
                        <span className="text-zinc-900">{vehicle.vehicleUsage}</span>
                      ) : (
                        <span className="text-zinc-400 italic">—</span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-sm whitespace-nowrap">
                      {vehicle.active === false ? (
                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500">
                          Inativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                          Ativo
                        </span>
                      )}
                    </td>
                    <td className="relative py-4 pr-4 pl-3 text-right text-sm font-medium whitespace-nowrap sm:pr-6">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => setViewingVehicle(vehicle)}
                          title="Visualizar"
                          className="text-zinc-400 transition-colors hover:text-zinc-700"
                        >
                          <Eye className="h-5 w-5" />
                          <span className="sr-only">Visualizar</span>
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => {
                              clearVehicleDraft();
                              void clearVehicleDraftFiles();
                              setIsFormOpen(true);
                              setEditingVehicle(vehicle);
                            }}
                            className="text-zinc-400 transition-colors hover:text-zinc-900"
                          >
                            <Edit2 className="h-5 w-5" />
                            <span className="sr-only">Edit</span>
                          </button>
                        )}
                        {canToggleActive && (
                          <button
                            onClick={() => toggleActiveMutation.mutate(vehicle)}
                            title={vehicle.active === false ? 'Reativar' : 'Inativar'}
                            className="text-zinc-400 transition-colors hover:text-zinc-900"
                          >
                            {vehicle.active === false ? <ToggleLeft className="h-5 w-5" /> : <ToggleRight className="h-5 w-5" />}
                            <span className="sr-only">{vehicle.active === false ? 'Reativar' : 'Inativar'}</span>
                          </button>
                        )}
                        {canHardDelete && (
                          <button
                            onClick={() => setVehicleToDelete(vehicle)}
                            className="text-zinc-400 transition-colors hover:text-red-600"
                          >
                            <Trash2 className="h-5 w-5" />
                            <span className="sr-only">Delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredVehicles.length === 0 && (
                  <tr>
                    <td colSpan={blockWrite ? 9 : 8} className="py-10 text-center text-sm text-zinc-500">
                      {(search || hasActiveStructuredFilters(filters)) ? 'Nenhum veículo encontrado para os filtros aplicados.' : blockWrite ? 'Nenhum veículo cadastrado em nenhum cliente.' : 'Nenhum veículo cadastrado para este cliente.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewingVehicle && (
        <VehicleDetailModal
          vehicle={viewingVehicle}
          onClose={() => setViewingVehicle(null)}
        />
      )}

      {isFormOpen && (
        <VehicleForm
          vehicle={editingVehicle}
          fieldSettings={fieldSettings}
          availableDrivers={availableDrivers}
          availableShippers={availableShippers}
          availableOperationalUnits={availableOperationalUnits}
          restoreFiles={restoredAfterReload}
          onClose={() => {
            setIsFormOpen(false);
            setEditingVehicle(null);
          }}
          onSave={handleSave}
        />
      )}

      <ConfirmDeleteModal
        open={!!vehicleToDelete}
        title="Excluir veículo definitivamente"
        description="Essa ação remove o cadastro de forma permanente."
        confirmLabel="Excluir definitivamente"
        expectedText={vehicleToDelete?.licensePlate ?? ''}
        blockedReason={vehicleDeleteBlockedReason}
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (vehicleToDelete) {
            deleteMutation.mutate(vehicleToDelete);
          }
        }}
        onClose={() => setVehicleToDelete(null)}
      />
    </div>
  );
}
