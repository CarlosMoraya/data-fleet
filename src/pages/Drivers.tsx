import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, Trash2, UserCircle, Truck, Eye, ToggleLeft, ToggleRight } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import DriverActiveFilterBanner from '../components/DriverActiveFilterBanner';
import DriverDetailModal from '../components/DriverDetailModal';
import DriverForm from '../components/DriverForm';
import SelectClientNotice from '../components/SelectClientNotice';
import { useAuth } from '../context/AuthContext';
import { usePersistentUiState, useSessionUiState } from '../hooks/usePersistentUiState';
import { requiresClientSelection, showsAggregatedData } from '../lib/clientScope';
import { driverFieldSettingsFromRow, defaultDriverFieldSettings, DriverFieldSettingsRow } from '../lib/driverFieldSettingsMappers';
import {
  DRIVER_PENDENCY_LABELS,
  DRIVER_PENDENCY_VALUES,
  applyDriverFilters,
  hasActiveDriverFilters,
  hasLegacyDriverParams,
  parseDriverFiltersFromParams,
  parseSearchFromParams,
  serializeDriverFiltersToParams,
  type DriverPendency,
  type DriverStructuredFilters,
  type DriverVehicleLink,
} from '../lib/driverFilters';
import { driverFromRow, DriverRow } from '../lib/driverMappers';
import { filterByActive } from '../lib/registryActiveFilter';
import { supabase } from '../lib/supabase';
import { buildUiStateKey, removeUiState } from '../lib/uiStateStorage';
import { saveDriver, deleteDriver, toggleDriverActive } from '../services/driverService';
import { Driver } from '../types';

import type { DriverFiles } from '../services/driverService';

const ROLES_WITH_ACCESS = ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'];
const ROLES_CAN_CREATE = ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'];
const ROLES_CAN_EDIT = ['Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'];
const ROLES_CAN_HARD_DELETE = ['Admin Master'];

function formatCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export default function Drivers() {
  const { currentClient, user, clients } = useAuth();
  const queryClient = useQueryClient();
  const blockWrite = requiresClientSelection(user?.role, currentClient?.id);
  const [searchParams, setSearchParams] = useSearchParams();
  const search = parseSearchFromParams(searchParams);
  const filters = useMemo(() => parseDriverFiltersFromParams(searchParams), [searchParams]);
  const [isFormOpen, setIsFormOpen] = useSessionUiState<boolean>('drivers', 'modal', 'form-open', false, { legacyKeys: ['driverFormOpen'] });
  const [editingDriver, setEditingDriver] = useSessionUiState<Driver | null>('drivers', 'selection', 'editing', null, { legacyKeys: ['driverFormEditing'] });
  const [showInactive, setShowInactive] = usePersistentUiState<boolean>({
    module: 'drivers',
    stateKind: 'filter',
    name: 'show-inactive',
    scope: 'preference',
    defaultValue: false,
  });
  const [viewingDriver, setViewingDriver] = useState<Driver | null>(null);
  const [driverToDelete, setDriverToDelete] = useState<Driver | null>(null);

  const clearDriverDraft = () => {
    if (user?.id) {
      const key = buildUiStateKey({ scope: 'draft', userId: user.id, clientId: currentClient?.id ?? 'no-client', module: 'drivers', stateKind: 'draft', name: 'form' });
      removeUiState(window.sessionStorage, key);
    }
    removeUiState(window.sessionStorage, 'driverFormData');
    removeUiState(window.sessionStorage, 'driverFormEmail');
    removeUiState(window.sessionStorage, 'driverFormPassword');
  };

  const canCreate = ROLES_CAN_CREATE.includes(user?.role || '') && !blockWrite;
  const canEdit = ROLES_CAN_EDIT.includes(user?.role || '') && !blockWrite;
  const canHardDelete = user?.role === 'Admin Master' && !blockWrite;
  const canToggleActive = ROLES_CAN_EDIT.includes(user?.role || '') && !blockWrite;

  // Queries
  const { data: drivers = [], isLoading: loadingDrivers, isError: driversError } = useQuery({
    queryKey: ['drivers', currentClient?.id ?? 'all-clients'],
    queryFn: async () => {
      let query = supabase.from('drivers').select('*');
      if (currentClient?.id) {
        query = query.eq('client_id', currentClient.id);
      }
      const { data, error } = await query.order('name');
      if (error) throw error;
      return (data as DriverRow[]).map(driverFromRow);
    },
    enabled: !!user && showsAggregatedData(user?.role, currentClient?.id)
  });

  const { data: fieldSettings } = useQuery({
    queryKey: ['driverFieldSettings', currentClient?.id],
    queryFn: async () => {
      if (!currentClient?.id) return null;
      const result = await supabase
        .from('driver_field_settings')
        .select('*')
        .eq('client_id', currentClient.id)
        .maybeSingle();
      const data = result.data as DriverFieldSettingsRow | null;
      return data ? driverFieldSettingsFromRow(data) : defaultDriverFieldSettings(currentClient.id);
    },
    enabled: !!currentClient?.id
  });

  const { data: driverVehicleInfo = {} } = useQuery({
    queryKey: ['driverVehicleInfo', currentClient?.id ?? 'all-clients'],
    queryFn: async () => {
      let query = supabase
        .from('vehicles')
        .select('driver_id, license_plate, shipper_id, operational_unit_id, shippers(name), operational_units(name)')
        .not('driver_id', 'is', null);
      if (currentClient?.id) {
        query = query.eq('client_id', currentClient.id);
      }
      const { data } = await query;
      const map: Record<string, {
        plate: string;
        shipperId: string | null;
        shipperName: string | null;
        operationalUnitId: string | null;
        unitName: string | null;
      }> = {};
      (data ?? []).forEach((row: {
        driver_id: string;
        license_plate: string;
        shipper_id: string | null;
        operational_unit_id: string | null;
        shippers?: { name?: string | null } | Array<{ name?: string | null }> | null;
        operational_units?: { name?: string | null } | Array<{ name?: string | null }> | null;
      }) => {
        const shipper = Array.isArray(row.shippers) ? row.shippers[0] : row.shippers;
        const operationalUnit = Array.isArray(row.operational_units) ? row.operational_units[0] : row.operational_units;
        map[row.driver_id] = {
          plate: row.license_plate,
          shipperId: row.shipper_id,
          shipperName: shipper?.name ?? null,
          operationalUnitId: row.operational_unit_id,
          unitName: operationalUnit?.name ?? null,
        };
      });
      return map;
    },
    enabled: !!user && showsAggregatedData(user?.role, currentClient?.id)
  });

  const vehicleByDriverId = useMemo<Record<string, DriverVehicleLink>>(() => {
    const map: Record<string, DriverVehicleLink> = {};
    Object.entries(driverVehicleInfo).forEach(([driverId, info]) => {
      map[driverId] = {
        shipperId: info.shipperId,
        operationalUnitId: info.operationalUnitId,
      };
    });
    return map;
  }, [driverVehicleInfo]);

  const filterCtx = useMemo(() => ({
    todayIso: new Date().toISOString().slice(0, 10),
    vehicleByDriverId,
  }), [vehicleByDriverId]);

  const shipperOptions = useMemo(() => {
    const map = new Map<string, string>();
    Object.values(driverVehicleInfo).forEach((info) => {
      if (info.shipperId && info.shipperName) {
        map.set(info.shipperId, info.shipperName);
      }
    });
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [driverVehicleInfo]);

  const allUnitOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; shipperId: string }>();
    Object.values(driverVehicleInfo).forEach((info) => {
      if (info.operationalUnitId && info.unitName && info.shipperId) {
        map.set(info.operationalUnitId, {
          id: info.operationalUnitId,
          name: info.unitName,
          shipperId: info.shipperId,
        });
      }
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [driverVehicleInfo]);

  const unitOptions = useMemo(() => {
    if (!filters.shipperId) return allUnitOptions;
    return allUnitOptions.filter((unit) => unit.shipperId === filters.shipperId);
  }, [allUnitOptions, filters.shipperId]);

  const updateFilter = (patch: Partial<DriverStructuredFilters>) => {
    const next = { ...filters, ...patch };
    if ('shipperId' in patch) {
      const selectedUnit = next.operationalUnitId
        ? allUnitOptions.find((unit) => unit.id === next.operationalUnitId)
        : undefined;
      if (selectedUnit && selectedUnit.shipperId !== next.shipperId) {
        next.operationalUnitId = null;
      }
    }
    setSearchParams(serializeDriverFiltersToParams(next, search), { replace: false });
  };

  const setSearch = (value: string) => {
    setSearchParams(serializeDriverFiltersToParams(filters, value), { replace: true });
  };

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  useEffect(() => {
    if (hasLegacyDriverParams(searchParams)) {
      setSearchParams(
        serializeDriverFiltersToParams(parseDriverFiltersFromParams(searchParams), parseSearchFromParams(searchParams)),
        { replace: true }
      );
    }
  }, [searchParams, setSearchParams]);

  // Redirect Drivers and Yard Auditors
  if (user && !ROLES_WITH_ACCESS.includes(user.role)) {
    return <Navigate to="/checklists" replace />;
  }

  const saveMutation = useMutation({
    mutationFn: async ({ driver, files }: { driver: Partial<Driver>; files: DriverFiles }) => {
      if (!currentClient?.id) {
        throw new Error('Selecione um cliente ativo antes de salvar motoristas.');
      }
      await saveDriver(currentClient.id, driver, files, editingDriver?.id);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['drivers', currentClient?.id] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-drivers', currentClient?.id] }),
        queryClient.invalidateQueries({ queryKey: ['driverVehicleInfo', currentClient?.id ?? 'all-clients'] }),
      ]);
      setIsFormOpen(false);
      setEditingDriver(null);
      clearDriverDraft();
    },
  });

  const handleSave = async (
    driver: Partial<Driver>,
    files: DriverFiles
  ): Promise<void> => {
    await saveMutation.mutateAsync({ driver, files });
  };

  const deleteMutation = useMutation({
    mutationFn: async (driver: Driver) => {
      await deleteDriver(driver);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['drivers', currentClient?.id] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-drivers', currentClient?.id] });
      void queryClient.invalidateQueries({ queryKey: ['driverVehicleInfo', currentClient?.id ?? 'all-clients'] });
      setDriverToDelete(null);
    },
    onError: (err: unknown) => {
      console.error('Erro ao excluir motorista:', err);
      alert('Erro ao excluir motorista. Tente novamente.');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (driver: Driver) => {
      if (!user?.id) throw new Error('Sessão inválida');
      await toggleDriverActive(driver, user.id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['drivers', currentClient?.id] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-drivers', currentClient?.id] });
      void queryClient.invalidateQueries({ queryKey: ['driverVehicleInfo', currentClient?.id ?? 'all-clients'] });
    },
    onError: (err: unknown) => {
      console.error('Erro ao alterar status do motorista:', err);
      alert('Erro ao alterar status do motorista. Tente novamente.');
    },
  });

  const { data: driverDeleteLinks } = useQuery({
    queryKey: ['driver-delete-links', driverToDelete?.id, driverToDelete?.profileId],
    queryFn: async () => {
      if (!driverToDelete) return null;

      const vehicleQuery = supabase
        .from('vehicles')
        .select('*', { count: 'exact', head: true })
        .eq('driver_id', driverToDelete.id);
      const checklistQuery = driverToDelete.profileId
        ? supabase
            .from('checklists')
            .select('*', { count: 'exact', head: true })
            .eq('filled_by', driverToDelete.profileId)
            .not('completed_at', 'is', null)
        : Promise.resolve({ count: 0 });

      const [vehicleResult, checklistResult] = await Promise.all([vehicleQuery, checklistQuery]);
      return (vehicleResult.count ?? 0) + (checklistResult.count ?? 0);
    },
    enabled: !!driverToDelete,
  });

  const filteredDrivers = useMemo(() => {
    const list = applyDriverFilters(drivers, search, filters, filterCtx);
    return filterByActive(list, showInactive);
  }, [drivers, search, filters, filterCtx, showInactive]);

  const driverDeleteBlockedReason = useMemo(() => {
    if (!driverToDelete) return null;
    const total = driverDeleteLinks ?? 0;
    if (total > 0 || driverToDelete.active !== false) {
      return `Não é possível excluir: existem ${total} registros vinculados. Inative o cadastro para remover do dia a dia.`;
    }
    return null;
  }, [driverDeleteLinks, driverToDelete]);

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
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Motoristas</h1>
          <p className="mt-1 text-sm text-zinc-500">Gerencie os motoristas da sua frota.</p>
        </div>

        {canCreate && (
          <button
            onClick={() => {
              clearDriverDraft();
              setEditingDriver(null);
              setIsFormOpen(true);
            }}
            className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-orange-600 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:outline-none"
          >
            <Plus className="mr-2 -ml-1 h-5 w-5" aria-hidden="true" />
            Adicionar Motorista
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
            placeholder="Buscar por nome ou CPF..."
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
          aria-label="Base / Unidade Operacional"
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
          aria-label="Situação"
          value={filters.pendency ?? ''}
          onChange={(e) => updateFilter({ pendency: (e.target.value || null) as DriverPendency | null })}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="">Todas as situações</option>
          {DRIVER_PENDENCY_VALUES.map((pendency) => (
            <option key={pendency} value={pendency}>{DRIVER_PENDENCY_LABELS[pendency]}</option>
          ))}
        </select>
        {(hasActiveDriverFilters(filters) || !!search) && (
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

      <DriverActiveFilterBanner
        issueLabel={filters.pendency ? DRIVER_PENDENCY_LABELS[filters.pendency] : null}
        onClearIssue={() => updateFilter({ pendency: null })}
      />

      {driversError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Erro ao carregar motoristas. Tente novamente.
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {loadingDrivers ? (
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
                  <th scope="col" className="py-3.5 pr-3 pl-4 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase sm:pl-6">Motorista</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">CPF</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">Categoria CNH</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">Validade CNH</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">Veículo</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">Status</th>
                  <th scope="col" className="relative py-3.5 pr-4 pl-3 sm:pr-6">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {filteredDrivers.map((driver) => (
                  <tr
                    key={driver.id}
                    className={`transition-colors hover:bg-zinc-50 ${driver.active === false ? 'opacity-50' : ''}`}
                  >
                    {blockWrite && (
                      <td className="px-3 py-4 text-sm whitespace-nowrap text-zinc-600">
                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                          {driver.clientId ? (clientNameMap.get(driver.clientId) ?? '—') : '—'}
                        </span>
                      </td>
                    )}
                    <td className="py-4 pr-3 pl-4 whitespace-nowrap sm:pl-6">
                      <div className="flex items-center">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100">
                          <UserCircle className="h-5 w-5 text-zinc-500" />
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-zinc-900">{driver.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-sm whitespace-nowrap text-zinc-500">
                      {formatCPF(driver.cpf)}
                    </td>
                    <td className="px-3 py-4 text-sm whitespace-nowrap text-zinc-500">
                      {driver.category || <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-3 py-4 text-sm whitespace-nowrap text-zinc-500">
                      {driver.expirationDate
                        ? new Date(driver.expirationDate + 'T00:00:00').toLocaleDateString('pt-BR')
                        : <span className="text-zinc-300">—</span>
                      }
                    </td>
                    <td className="px-3 py-4 text-sm whitespace-nowrap text-zinc-500">
                      {driverVehicleInfo[driver.id]?.plate ? (
                        <div className="flex items-center gap-1.5">
                          <Truck className="h-3.5 w-3.5 flex-shrink-0 text-orange-500" />
                          <span className="font-medium text-zinc-900">{driverVehicleInfo[driver.id]?.plate}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-400 italic">Sem veículo</span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-sm whitespace-nowrap">
                      {driver.active === false ? (
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
                          onClick={() => setViewingDriver(driver)}
                          title="Visualizar"
                          className="text-zinc-400 transition-colors hover:text-zinc-700"
                        >
                          <Eye className="h-5 w-5" />
                          <span className="sr-only">Visualizar</span>
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => {
                              clearDriverDraft();
                              setEditingDriver(driver);
                              setIsFormOpen(true);
                            }}
                            className="text-zinc-400 transition-colors hover:text-zinc-900"
                          >
                            <Edit2 className="h-5 w-5" />
                            <span className="sr-only">Editar</span>
                          </button>
                        )}
                        {canToggleActive && (
                          <button
                            onClick={() => toggleActiveMutation.mutate(driver)}
                            title={driver.active === false ? 'Reativar' : 'Inativar'}
                            className="text-zinc-400 transition-colors hover:text-zinc-900"
                          >
                            {driver.active === false ? <ToggleLeft className="h-5 w-5" /> : <ToggleRight className="h-5 w-5" />}
                            <span className="sr-only">{driver.active === false ? 'Reativar' : 'Inativar'}</span>
                          </button>
                        )}
                        {canHardDelete && (
                          <button
                            onClick={() => setDriverToDelete(driver)}
                            className="text-zinc-400 transition-colors hover:text-red-600"
                          >
                            <Trash2 className="h-5 w-5" />
                            <span className="sr-only">Excluir</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredDrivers.length === 0 && (
                  <tr>
                    <td colSpan={blockWrite ? 8 : 7} className="py-10 text-center text-sm text-zinc-500">
                      {search || hasActiveDriverFilters(filters) ? 'Nenhum motorista encontrado para os filtros aplicados.' : blockWrite ? 'Nenhum motorista cadastrado em nenhum cliente.' : 'Nenhum motorista cadastrado para este cliente.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewingDriver && (
        <DriverDetailModal
          driver={viewingDriver}
          vehiclePlate={driverVehicleInfo[viewingDriver.id]?.plate}
          onClose={() => setViewingDriver(null)}
        />
      )}

      {isFormOpen && (
        <DriverForm
          driver={editingDriver}
          fieldSettings={fieldSettings || null}
          clientId={currentClient?.id ?? ''}
          onClose={() => {
            setIsFormOpen(false);
            setEditingDriver(null);
          }}
          onSave={handleSave}
        />
      )}

      <ConfirmDeleteModal
        open={!!driverToDelete}
        title="Excluir motorista definitivamente"
        description="Essa ação remove o cadastro de forma permanente."
        confirmLabel="Excluir definitivamente"
        expectedText={driverToDelete?.name ?? ''}
        blockedReason={driverDeleteBlockedReason}
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (driverToDelete) {
            deleteMutation.mutate(driverToDelete);
          }
        }}
        onClose={() => setDriverToDelete(null)}
      />
    </div>
  );
}
