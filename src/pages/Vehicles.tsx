import React, { useState, useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Vehicle, VehicleFieldSettings } from '../types';
import { Plus, Search, Edit2, Trash2, Truck, User, Eye } from 'lucide-react';
import VehicleForm from '../components/VehicleForm';
import VehicleDetailModal from '../components/VehicleDetailModal';
import { supabase } from '../lib/supabase';
import { vehicleFromRow, VehicleRow } from '../lib/vehicleMappers';
import { fieldSettingsFromRow, defaultFieldSettings, VehicleFieldSettingsRow } from '../lib/fieldSettingsMappers';
import { saveVehicle, deleteVehicle } from '../services/vehicleService';
import type { VehicleFiles } from '../services/vehicleService';
import { requiresClientSelection } from '../lib/clientScope';
import SelectClientNotice from '../components/SelectClientNotice';
import { clearVehicleDraftFiles } from '../lib/offline/vehicleDraftFiles';
import { useSessionUiState, usePersistentFilterState } from '../hooks/usePersistentUiState';
import { buildUiStateKey, removeUiState } from '../lib/uiStateStorage';
import { computeOverdueChecklistVehicleIds } from '../lib/dashboardKpi';
import {
  PENDENCY_LABELS,
  PENDENCY_VALUES,
  applyVehicleFilters,
  hasActiveStructuredFilters,
  parseVehicleFiltersFromParams,
  serializeVehicleFiltersToParams,
  type VehiclePendency,
  type VehicleStructuredFilters,
} from '../lib/vehicleFilters';

interface AvailableDriver {
  id: string;
  name: string;
  cpf: string;
}

interface AvailableShipper {
  id: string;
  name: string;
}

interface AvailableOperationalUnit {
  id: string;
  name: string;
  shipperId: string;
}

const ROLES_WITH_ACCESS = ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'];
const ROLES_CAN_CREATE = ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'];
const ROLES_CAN_EDIT = ['Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'];
const ROLES_CAN_ALWAYS_DELETE = ['Manager', 'Coordinator', 'Director', 'Admin Master'];

export default function Vehicles() {
  const { currentClient, user, clients } = useAuth();
  const queryClient = useQueryClient();
  const blockWrite = requiresClientSelection(user?.role, currentClient?.id);
  const [search, setSearch] = usePersistentFilterState<string>('vehicles', 'search', '');
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseVehicleFiltersFromParams(searchParams), [searchParams]);
  const [isFormOpen, setIsFormOpen, , formOpenKey] = useSessionUiState<boolean>('vehicles', 'modal', 'form-open', false, { legacyKeys: ['vehicleFormOpen'] });
  const [editingVehicle, setEditingVehicle, , editingKey] = useSessionUiState<Vehicle | null>('vehicles', 'selection', 'editing', null, { legacyKeys: ['vehicleFormEditing'] });
  const [restoredAfterReload] = useState(() => isFormOpen);

  const [viewingVehicle, setViewingVehicle] = useState<Vehicle | null>(null);

  const clearVehicleDraft = () => {
    if (user?.id) {
      const key = buildUiStateKey({ scope: 'draft', userId: user.id, clientId: currentClient?.id ?? 'no-client', module: 'vehicles', stateKind: 'draft', name: 'form' });
      removeUiState(window.sessionStorage, key);
    }
    removeUiState(window.sessionStorage, 'vehicleFormData');
  };

  const canCreate = ROLES_CAN_CREATE.includes(user?.role || '') && !blockWrite;
  const canEdit = ROLES_CAN_EDIT.includes(user?.role || '') && !blockWrite;
  const canDelete = (ROLES_CAN_ALWAYS_DELETE.includes(user?.role || '') || (user?.canDeleteVehicles === true)) && !blockWrite;

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
      const { data } = await supabase
        .from('vehicle_field_settings')
        .select('*')
        .eq('client_id', currentClient.id)
        .maybeSingle();
      return data ? fieldSettingsFromRow(data as VehicleFieldSettingsRow) : defaultFieldSettings(currentClient.id);
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

      return {
        shippers: (shippersData ?? []) as AvailableShipper[],
        units: (unitsData ?? []).map((u: any) => ({
          id: u.id,
          name: u.name,
          shipperId: u.shipper_id,
        })) as AvailableOperationalUnit[]
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

      return (allDrivers ?? []).filter((d: any) => !usedIds.has(d.id)) as AvailableDriver[];
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
      const { data, error } = await supabase.rpc('dashboard_last_checklist_per_vehicle', {
        p_client_id: currentClient?.id ?? null,
      });
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        vehicle_id: row.vehicle_id as string,
        context: (row.context as string) ?? '',
        completed_at: row.completed_at as string,
      }));
    },
    enabled: !!user && filters.pendency === 'checklist_vencido',
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
      return (data ?? []) as { client_id: string; rotina_day_interval: number | null; seguranca_day_interval: number | null }[];
    },
    enabled: !!user && filters.pendency === 'checklist_vencido',
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const overdueChecklistVehicleIds = useMemo(() => {
    if (filters.pendency !== 'checklist_vencido') return new Set<string>();
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
    setSearchParams(serializeVehicleFiltersToParams(next), { replace: false });
  };

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams());
    setSearch('');
  };

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
      queryClient.invalidateQueries({ queryKey: ['vehicles', currentClient?.id] });
      queryClient.invalidateQueries({ queryKey: ['availableDrivers'] });
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
      queryClient.invalidateQueries({ queryKey: ['vehicles', currentClient?.id] });
      queryClient.invalidateQueries({ queryKey: ['availableDrivers'] });
    },
    onError: (err) => {
      console.error('Erro ao excluir veículo:', err);
      alert('Erro ao excluir veículo. Tente novamente.');
    },
  });

  const handleDelete = async (vehicle: Vehicle) => {
    if (!window.confirm(`Excluir o veículo ${vehicle.licensePlate}? Esta ação não pode ser desfeita.`)) return;
    deleteMutation.mutate(vehicle);
  };

  const filteredVehicles = useMemo(
    () => applyVehicleFilters(vehicles, search, filters, pendencyCtx),
    [vehicles, search, filters, pendencyCtx]
  );

  const clientNameMap = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach(c => map.set(c.id, c.name));
    return map;
  }, [clients]);

  return (
    <div className="flex flex-col gap-6 h-full">
      {blockWrite && <SelectClientNotice />}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Veículos</h1>
          <p className="text-sm text-zinc-500 mt-1">Gerencie a frota de veículos do cliente.</p>
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
            className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Adicionar Veículo
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-zinc-400" aria-hidden="true" />
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="block w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-3 text-sm placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
            placeholder="Buscar por placa, modelo ou chassi..."
          />
        </div>
        <select
          aria-label="Embarcador"
          value={filters.shipperId ?? ''}
          onChange={(e) => updateFilter({ shipperId: e.target.value || null })}
          className="rounded-xl border border-zinc-200 bg-white py-2.5 px-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          className="rounded-xl border border-zinc-200 bg-white py-2.5 px-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          className="rounded-xl border border-zinc-200 bg-white py-2.5 px-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {vehiclesError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Erro ao carregar veículos. Tente novamente.
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm flex-1 min-h-0 flex flex-col">
        {loadingVehicles ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-orange-500" />
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="bg-zinc-50 sticky top-0 z-10">
                <tr>
                  {blockWrite && (
                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Cliente</th>
                  )}
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider sm:pl-6">Veículo</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tipo / Energia</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Proprietário</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Motorista</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Embarcador / Unid. Op.</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Finalidade</th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-zinc-50 transition-colors">
                    {blockWrite && (
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-600">
                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                          {vehicle.clientId ? (clientNameMap.get(vehicle.clientId) ?? '—') : '—'}
                        </span>
                      </td>
                    )}
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 sm:pl-6">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-zinc-100 flex items-center justify-center border border-zinc-200">
                          <Truck className="h-5 w-5 text-zinc-500" />
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-zinc-900">{vehicle.licensePlate}</div>
                          <div className="text-sm text-zinc-500">{vehicle.brand} {vehicle.model} ({vehicle.year})</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                      <div className="text-zinc-900">{vehicle.type}</div>
                      <div>{vehicle.energySource}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                      <div className="text-zinc-900">{vehicle.owner}</div>
                      <div>{vehicle.acquisition}</div>
                    </td>
                    <td className="px-3 py-4 text-sm text-zinc-500 max-w-[140px]">
                      {vehicle.driverName ? (() => {
                        const parts = vehicle.driverName.split(' ');
                        const firstLine = parts.slice(0, 2).join(' ');
                        const secondLine = parts.slice(2).join(' ');
                        return (
                          <div className="flex items-start gap-1.5">
                            <User className="h-3.5 w-3.5 text-orange-500 flex-shrink-0 mt-0.5" />
                            <span className="text-zinc-900 leading-snug">
                              {firstLine}
                              {secondLine && <><br />{secondLine}</>}
                            </span>
                          </div>
                        );
                      })() : (
                        <span className="text-zinc-400 italic">Sem motorista</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                      {vehicle.shipperName ? (
                        <div className="text-zinc-900">{vehicle.shipperName}</div>
                      ) : (
                        <div className="text-zinc-400 italic">—</div>
                      )}
                      {vehicle.operationalUnitName && (
                        <div className="text-zinc-500">{vehicle.operationalUnitName}</div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                      {vehicle.vehicleUsage ? (
                        <span className="text-zinc-900">{vehicle.vehicleUsage}</span>
                      ) : (
                        <span className="text-zinc-400 italic">—</span>
                      )}
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => setViewingVehicle(vehicle)}
                          title="Visualizar"
                          className="text-zinc-400 hover:text-zinc-700 transition-colors"
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
                            className="text-zinc-400 hover:text-zinc-900 transition-colors"
                          >
                            <Edit2 className="h-5 w-5" />
                            <span className="sr-only">Edit</span>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(vehicle)}
                            className="text-zinc-400 hover:text-red-600 transition-colors"
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
                    <td colSpan={blockWrite ? 8 : 7} className="py-10 text-center text-sm text-zinc-500">
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
    </div>
  );
}
