import { useState, useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Driver, DriverFieldSettings } from '../types';
import { Plus, Search, Edit2, Trash2, UserCircle, Truck, Eye } from 'lucide-react';
import DriverForm from '../components/DriverForm';
import DriverDetailModal from '../components/DriverDetailModal';
import DriverActiveFilterBanner from '../components/DriverActiveFilterBanner';
import { supabase } from '../lib/supabase';
import { driverFromRow, DriverRow } from '../lib/driverMappers';
import { driverFieldSettingsFromRow, defaultDriverFieldSettings, DriverFieldSettingsRow } from '../lib/driverFieldSettingsMappers';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { saveDriver, deleteDriver } from '../services/driverService';
import type { DriverFiles } from '../services/driverService';
import { requiresClientSelection, showsAggregatedData } from '../lib/clientScope';
import SelectClientNotice from '../components/SelectClientNotice';
import { useSessionUiState, usePersistentFilterState } from '../hooks/usePersistentUiState';
import { buildUiStateKey, removeUiState } from '../lib/uiStateStorage';
import {
  DRIVER_PENDENCY_LABELS,
  DRIVER_PENDENCY_VALUES,
  applyDriverFilters,
  hasActiveDriverFilters,
  parseDriverFiltersFromParams,
  serializeDriverFiltersToParams,
  type DriverPendency,
  type DriverStructuredFilters,
  type DriverVehicleLink,
} from '../lib/driverFilters';

const ROLES_WITH_ACCESS = ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'];
const ROLES_CAN_CREATE = ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'];
const ROLES_CAN_EDIT = ['Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'];
const ROLES_CAN_ALWAYS_DELETE = ['Manager', 'Coordinator', 'Director', 'Admin Master'];

function formatCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export default function Drivers() {
  const { currentClient, user, clients } = useAuth();
  const queryClient = useQueryClient();
  const blockWrite = requiresClientSelection(user?.role, currentClient?.id);
  const [search, setSearch] = usePersistentFilterState<string>('drivers', 'search', '');
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseDriverFiltersFromParams(searchParams), [searchParams]);
  const [isFormOpen, setIsFormOpen] = useSessionUiState<boolean>('drivers', 'modal', 'form-open', false, { legacyKeys: ['driverFormOpen'] });
  const [editingDriver, setEditingDriver] = useSessionUiState<Driver | null>('drivers', 'selection', 'editing', null, { legacyKeys: ['driverFormEditing'] });
  const [viewingDriver, setViewingDriver] = useState<Driver | null>(null);

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
  const canDelete = (ROLES_CAN_ALWAYS_DELETE.includes(user?.role || '') || ((user?.role === 'Fleet Analyst' || user?.role === 'Supervisor') && user?.canDeleteDrivers === true)) && !blockWrite;

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
      const { data } = await supabase
        .from('driver_field_settings')
        .select('*')
        .eq('client_id', currentClient.id)
        .maybeSingle();
      return data ? driverFieldSettingsFromRow(data as DriverFieldSettingsRow) : defaultDriverFieldSettings(currentClient.id);
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
    setSearchParams(serializeDriverFiltersToParams(next), { replace: false });
  };

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams());
    setSearch('');
  };

  // Redirect Drivers and Yard Auditors
  if (user && !ROLES_WITH_ACCESS.includes(user.role)) {
    return <Navigate to="/checklists" replace />;
  }

  const handleSave = async (
    driver: Partial<Driver>,
    files: DriverFiles
  ): Promise<void> => {
    if (!currentClient?.id) {
      throw new Error('Selecione um cliente ativo antes de salvar motoristas.');
    }
    await saveDriver(currentClient.id, driver, files, editingDriver?.id);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['drivers', currentClient?.id] }),
      queryClient.invalidateQueries({ queryKey: ['driverVehicleInfo', currentClient?.id ?? 'all-clients'] }),
    ]);
    setIsFormOpen(false);
    setEditingDriver(null);
    clearDriverDraft();
  };

  const handleDelete = async (driver: Driver) => {
    if (!window.confirm(`Excluir o motorista ${driver.name}? Esta ação não pode ser desfeita.`)) return;

    try {
      await deleteDriver(driver);
      queryClient.invalidateQueries({ queryKey: ['drivers', currentClient?.id] });
      queryClient.invalidateQueries({ queryKey: ['driverVehicleInfo', currentClient?.id ?? 'all-clients'] });
    } catch (err) {
      console.error('Erro ao excluir motorista:', err);
      alert('Erro ao excluir motorista. Tente novamente.');
    }
  };

  const filteredDrivers = useMemo(
    () => applyDriverFilters(drivers, search, filters, filterCtx),
    [drivers, search, filters, filterCtx]
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
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Motoristas</h1>
          <p className="text-sm text-zinc-500 mt-1">Gerencie os motoristas da sua frota.</p>
        </div>

        {canCreate && (
          <button
            onClick={() => {
              clearDriverDraft();
              setEditingDriver(null);
              setIsFormOpen(true);
            }}
            className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Adicionar Motorista
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
            placeholder="Buscar por nome ou CPF..."
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
          aria-label="Base / Unidade Operacional"
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
          aria-label="Situação"
          value={filters.pendency ?? ''}
          onChange={(e) => updateFilter({ pendency: (e.target.value || null) as DriverPendency | null })}
          className="rounded-xl border border-zinc-200 bg-white py-2.5 px-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <DriverActiveFilterBanner
        situationLabel={filters.pendency ? DRIVER_PENDENCY_LABELS[filters.pendency] : null}
        onClearSituation={() => updateFilter({ pendency: null })}
      />

      {driversError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Erro ao carregar motoristas. Tente novamente.
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm flex-1 min-h-0 flex flex-col">
        {loadingDrivers ? (
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
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider sm:pl-6">Motorista</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">CPF</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Categoria CNH</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Validade CNH</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Veículo</th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {filteredDrivers.map((driver) => (
                  <tr key={driver.id} className="hover:bg-zinc-50 transition-colors">
                    {blockWrite && (
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-600">
                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                          {driver.clientId ? (clientNameMap.get(driver.clientId) ?? '—') : '—'}
                        </span>
                      </td>
                    )}
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 sm:pl-6">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-zinc-100 flex items-center justify-center border border-zinc-200">
                          <UserCircle className="h-5 w-5 text-zinc-500" />
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-zinc-900">{driver.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                      {formatCPF(driver.cpf)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                      {driver.category || <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                      {driver.expirationDate
                        ? new Date(driver.expirationDate + 'T00:00:00').toLocaleDateString('pt-BR')
                        : <span className="text-zinc-300">—</span>
                      }
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                      {driverVehicleInfo[driver.id]?.plate ? (
                        <div className="flex items-center gap-1.5">
                          <Truck className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                          <span className="text-zinc-900 font-medium">{driverVehicleInfo[driver.id]?.plate}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-400 italic">Sem veículo</span>
                      )}
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => setViewingDriver(driver)}
                          title="Visualizar"
                          className="text-zinc-400 hover:text-zinc-700 transition-colors"
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
                            className="text-zinc-400 hover:text-zinc-900 transition-colors"
                          >
                            <Edit2 className="h-5 w-5" />
                            <span className="sr-only">Editar</span>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(driver)}
                            className="text-zinc-400 hover:text-red-600 transition-colors"
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
                    <td colSpan={blockWrite ? 7 : 6} className="py-10 text-center text-sm text-zinc-500">
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
    </div>
  );
}
