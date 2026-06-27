import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Circle, Search, Plus, Pencil, ToggleLeft, ToggleRight, History, Loader2, Trash2, AlertTriangle, Ban } from 'lucide-react';
import React from 'react';

import SelectClientNotice from '../components/SelectClientNotice';
import TireBatchForm from '../components/TireBatchForm';
import TireForm from '../components/TireForm';
import TireHistoryModal from '../components/TireHistoryModal';
import { useAuth } from '../context/AuthContext';
import { useSessionUiState, usePersistentFilterState } from '../hooks/usePersistentUiState';
import { requiresClientSelection, showsAggregatedData } from '../lib/clientScope';
import { supabase } from '../lib/supabase';
import { TireRow, tireFromRow, vehicleTireConfigFromRow, VehicleTireConfigRow } from '../lib/tireMappers';
import { generatePositions, generatePositionsFromConfig } from '../lib/tirePositions';
import { buildUiStateKey, removeUiState } from '../lib/uiStateStorage';
import { cn } from '../lib/utils';
import { saveTire, toggleTireActive, deleteTire } from '../services/tireService';
import { Tire, VehicleTireConfig, AxleConfigEntry } from '../types';

const ROLES_CAN_VIEW_TIRES = [
  'Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager',
  'Coordinator', 'Director', 'Admin Master',
];
const ROLES_CAN_REGISTER_TIRES = ['Manager', 'Coordinator', 'Director', 'Admin Master'];
const ROLES_CAN_DELETE_TIRES = ['Admin Master'];

function classificationBadge(classification: Tire['visualClassification']) {
  switch (classification) {
    case 'Novo': return 'bg-emerald-100 text-emerald-800';
    case 'Meia vida': return 'bg-yellow-100 text-yellow-800';
    case 'Troca': return 'bg-red-100 text-red-800';
  }
}

// ─── Modal de seleção do modo de cadastro ─────────────────────────────────────

function AddModeModal({
  onSelectPlate,
  onSelectBatch,
  onClose,
}: {
  onSelectPlate: () => void;
  onSelectBatch: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">Adicionar Pneus</h2>
        <p className="mb-6 text-sm text-zinc-500">Escolha o modo de cadastro</p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onSelectPlate}
            className="flex flex-col items-start rounded-xl border border-zinc-200 p-4 text-left transition-colors hover:border-orange-400 hover:bg-orange-50"
          >
            <span className="font-medium text-zinc-900">Por Placa (Individual)</span>
            <span className="mt-0.5 text-sm text-zinc-500">Cadastre pneus em um veículo específico</span>
          </button>
          <button
            onClick={onSelectBatch}
            className="flex flex-col items-start rounded-xl border border-zinc-200 p-4 text-left transition-colors hover:border-orange-400 hover:bg-orange-50"
          >
            <span className="font-medium text-zinc-900">Por Modelo (Lote)</span>
            <span className="mt-0.5 text-sm text-zinc-500">Cadastre pneus para todos os veículos de um modelo</span>
          </button>
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 text-sm text-zinc-500 hover:text-zinc-700"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Modal confirmação toggle ativo ──────────────────────────────────────────

function ToggleConfirmModal({
  tire,
  onConfirm,
  onClose,
  isLoading,
}: {
  tire: Tire;
  onConfirm: () => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-lg font-semibold text-zinc-900">
          {tire.active ? 'Desativar Pneu' : 'Reativar Pneu'}
        </h2>
        <p className="mb-6 text-sm text-zinc-600">
          {tire.active
            ? `Desativar o pneu na posição ${tire.currentPosition}? Ele continuará no histórico mas não bloqueará posições.`
            : `Reativar o pneu na posição ${tire.currentPosition}? Ele voltará a ocupar essa posição.`}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-zinc-200 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-medium text-white',
              tire.active ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-600 hover:bg-emerald-700',
              isLoading && 'cursor-not-allowed opacity-60',
            )}
          >
            {isLoading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : (tire.active ? 'Desativar' : 'Reativar')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de exclusão de pneu ────────────────────────────────────────────────

function DeleteConfirmModal({
  tire,
  onConfirm,
  onClose,
  isLoading,
}: {
  tire: Tire;
  onConfirm: () => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-lg font-semibold text-zinc-900">Excluir Pneu</h2>
        <p className="mb-6 text-sm text-zinc-600">
          Excluir o pneu na posição <span className="font-semibold">{tire.currentPosition}</span> ({tire.vehicleLicensePlate ?? tire.vehicleModel ?? 'veículo desconhecido'})? Esta ação é irreversível e também excluirá todo o histórico de movimentação.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-zinc-200 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de alerta — veículo com todas as posições ocupadas ─────────────────

function FullVehicleAlertModal({
  licensePlate,
  onClose,
}: {
  licensePlate: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-3 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
          <h2 className="text-lg font-semibold text-zinc-900">Todas as posições ocupadas</h2>
        </div>
        <p className="mb-6 text-sm text-zinc-600">
          O veículo <span className="font-semibold">{licensePlate}</span> já possui pneus ativos em todas as posições. Desative um ou mais pneus para liberar posições antes de cadastrar novos.
        </p>
        <button
          onClick={onClose}
          className="w-full rounded-lg bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-600"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

// ─── Modal de bloqueio — posição já ocupada ao tentar reativar ───────────────

function ReactivateBlockedModal({
  tire,
  onClose,
}: {
  tire: Tire;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-3 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
          <h2 className="text-lg font-semibold text-zinc-900">Posição já ocupada</h2>
        </div>
        <p className="mb-6 text-sm text-zinc-600">
          A posição <span className="font-mono font-semibold">{tire.currentPosition}</span> do veículo{' '}
          <span className="font-semibold">{tire.vehicleLicensePlate ?? tire.vehicleModel ?? 'desconhecido'}</span>{' '}
          já está ocupada por outro pneu ativo. Desative o pneu atual nessa posição antes de reativar este.
        </p>
        <button
          onClick={onClose}
          className="w-full rounded-lg bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-600"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

// ─── Modal de seleção de veículo para cadastro individual ─────────────────────

type VehicleSimpleForPicker = {
  id: string; licensePlate: string; model: string; type: string;
  eixos?: number; axleConfig?: AxleConfigEntry[]; stepsCount?: number;
};

type VehicleSimpleRow = {
  id: string;
  license_plate: string;
  model: string;
  type: string;
  eixos: number | null;
  axle_config: AxleConfigEntry[] | null;
  steps_count: number | null;
};

function VehiclePickerModal({
  vehicles,
  onSelect,
  onClose,
  fullVehicleIds,
}: {
  vehicles: VehicleSimpleForPicker[];
  onSelect: (v: VehicleSimpleForPicker) => void;
  onClose: () => void;
  fullVehicleIds: Set<string>;
}) {
  const [search, setSearch] = React.useState('');
  const filtered = vehicles.filter(
    v =>
      v.licensePlate.toLowerCase().includes(search.toLowerCase()) ||
      v.model.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-3 text-lg font-semibold text-zinc-900">Selecionar Veículo</h2>
        <div className="relative mb-3">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por placa ou modelo..."
            className="w-full rounded-lg border border-zinc-200 py-2 pr-3 pl-9 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
          />
        </div>
        <div className="flex-1 divide-y divide-zinc-100 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-zinc-400">Nenhum veículo encontrado</p>
          )}
          {filtered.map(v => {
            const isFull = fullVehicleIds.has(v.id);
            return (
              <button
                key={v.id}
                onClick={() => onSelect(v)}
                className={cn(
                  'flex w-full items-center justify-between px-2 py-3 text-left hover:bg-zinc-50',
                  isFull && 'opacity-50',
                )}
              >
                <div className="flex items-center gap-2">
                  {isFull && <Ban className="h-3.5 w-3.5 shrink-0 text-red-400" />}
                  <span className="font-medium text-zinc-900">{v.licensePlate}</span>
                  <span className="text-sm text-zinc-500">{v.model}</span>
                </div>
                <span className="text-xs text-zinc-400">{v.type}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={onClose}
          className="mt-4 py-2 text-sm text-zinc-500 hover:text-zinc-700"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function Tires() {
  const { currentClient, user: profile, clients } = useAuth();
  const queryClient = useQueryClient();
  const blockWrite = requiresClientSelection(profile?.role, currentClient?.id);

  const canRegister = ROLES_CAN_REGISTER_TIRES.includes(profile?.role ?? '') && !blockWrite;
  const canView = ROLES_CAN_VIEW_TIRES.includes(profile?.role ?? '');
  const canDelete = ROLES_CAN_DELETE_TIRES.includes(profile?.role ?? '') && !blockWrite;

  const [search, setSearch] = usePersistentFilterState<string>('tires', 'search', '');

  // Modais
  const [addModeOpen, setAddModeOpen] = React.useState(false);
  const [vehiclePickerOpen, setVehiclePickerOpen] = React.useState(false);
  const [selectedVehicle, setSelectedVehicle] = useSessionUiState<VehicleSimpleForPicker | null>('tires', 'selection', 'vehicle', null, { legacyKeys: ['tireFormVehicle'] });
  const [tireFormOpen, setTireFormOpen] = useSessionUiState<boolean>('tires', 'modal', 'form-open', false, { legacyKeys: ['tireFormOpen'] });
  const [editingTire, setEditingTire] = useSessionUiState<Tire | null>('tires', 'selection', 'editing', null, { legacyKeys: ['tireFormEditing'] });
  const [batchFormOpen, setBatchFormOpen] = React.useState(false);
  const [historyTire, setHistoryTire] = React.useState<Tire | null>(null);
  const [toggleTire, setToggleTire] = React.useState<Tire | null>(null);
  const [tireToDelete, setTireToDelete] = React.useState<Tire | null>(null);
  const [fullVehicleAlert, setFullVehicleAlert] = React.useState<string | null>(null);
  const [reactivateBlockedTire, setReactivateBlockedTire] = React.useState<Tire | null>(null);

  const clearTireDraft = React.useCallback(() => {
    const userId = profile?.id ?? 'anonymous';
    const clientId = profile?.role === 'Admin Master' && !currentClient?.id
      ? 'all-clients'
      : (currentClient?.id ?? 'no-client');
    const storage = window.sessionStorage;
    removeUiState(storage, buildUiStateKey({ scope: 'session', userId, clientId, module: 'tires', stateKind: 'modal', name: 'form-open' }));
    removeUiState(storage, buildUiStateKey({ scope: 'session', userId, clientId, module: 'tires', stateKind: 'selection', name: 'editing' }));
    removeUiState(storage, buildUiStateKey({ scope: 'session', userId, clientId, module: 'tires', stateKind: 'selection', name: 'vehicle' }));
    storage.removeItem('tireFormOpen');
    storage.removeItem('tireFormEditing');
    storage.removeItem('tireFormVehicle');
  }, [profile?.id, profile?.role, currentClient?.id]);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: tires = [], isLoading: tiresLoading } = useQuery({
    queryKey: ['tires', currentClient?.id],
    queryFn: async () => {
      let query = supabase
        .from('tires')
        .select('*, vehicles(license_plate, model, type)')
        .order('created_at', { ascending: false });
      if (currentClient?.id) query = query.eq('client_id', currentClient.id);
      const { data, error } = await query;
      if (error) throw error;
      return (data as TireRow[]).map(tireFromRow);
    },
    enabled: canView && showsAggregatedData(profile?.role, currentClient?.id),
  });

  const { data: tireConfigs = [] } = useQuery({
    queryKey: ['vehicleTireConfigs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicle_tire_configs').select('*');
      if (error) throw error;
      return (data as VehicleTireConfigRow[]).map(vehicleTireConfigFromRow);
    },
  });

  const { data: vehiclesList = [] } = useQuery({
    queryKey: ['vehiclesSimple', currentClient?.id],
    queryFn: async () => {
      let query = supabase
        .from('vehicles')
        .select('id, license_plate, model, type, eixos, axle_config, steps_count')
        .order('license_plate');
      if (currentClient?.id) query = query.eq('client_id', currentClient.id);
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as VehicleSimpleRow[];
      return rows.map((v) => ({
        id: v.id,
        licensePlate: v.license_plate,
        model: v.model,
        type: v.type,
        eixos: v.eixos ?? undefined,
        axleConfig: v.axle_config ?? undefined,
        stepsCount: v.steps_count ?? undefined,
      }));
    },
    enabled: canRegister && !!currentClient?.id,
  });

  // ── Toggle ativo ──────────────────────────────────────────────────────────
  const toggleMutation = useMutation({
    mutationFn: async (tire: Tire) => {
      if (!profile) throw new Error('Sessão inválida');
      await toggleTireActive({ tire, profileId: profile.id });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tires', currentClient?.id] });
      setToggleTire(null);
    },
  });

  // ── Excluir pneu ──────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (tire: Tire) => {
      await deleteTire(tire.id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tires', currentClient?.id] });
      setTireToDelete(null);
    },
  });

  // ── Save tire (individual ou lote) ───────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async ({
      tireData,
      previousPosition,
      odometerKm,
    }: {
      tireData: Partial<Tire> | Partial<Tire>[];
      previousPosition?: string;
      odometerKm?: number;
    }) => {
      if (!currentClient || !profile) throw new Error('Sessão inválida');
      return saveTire({
        tireData,
        profileId: profile.id,
        currentClientId: currentClient.id,
        previousPosition,
        odometerKm,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tires', currentClient?.id] });
      setTireFormOpen(false);
      setEditingTire(null);
      setSelectedVehicle(null);
      clearTireDraft();
    },
  });

  // ── Veículos com todas as posições ocupadas ───────────────────────────────
  const fullVehicleIds = React.useMemo(() => {
    const full = new Set<string>();
    for (const v of vehiclesList) {
      const config = tireConfigs.find(c => c.vehicleType === v.type);
      const allPositions = (v.axleConfig && v.axleConfig.length > 0)
        ? generatePositionsFromConfig(v.axleConfig, v.stepsCount ?? 0, v.type)
        : generatePositions(v.eixos ?? config?.defaultAxles ?? 2, config?.dualAxles ?? [], config?.defaultSpareCount ?? 1, v.type);
      if (allPositions.length === 0) continue;
      const occupiedCodes = new Set(tires.filter(t => t.active && t.vehicleId === v.id).map(t => t.currentPosition));
      if (allPositions.every(p => occupiedCodes.has(p.code))) full.add(v.id);
    }
    return full;
  }, [vehiclesList, tires, tireConfigs]);

  const clientNameMap = React.useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach(c => map.set(c.id, c.name));
    return map;
  }, [clients]);

  // ── Filtros ───────────────────────────────────────────────────────────────
  const filtered = React.useMemo(() => {
    return tires.filter(t => {
      const q = search.toLowerCase();
      if (!q) return true;
      return (
        t.tireCode.toLowerCase().includes(q) ||
        t.specification.toLowerCase().includes(q) ||
        (t.vehicleLicensePlate ?? '').toLowerCase().includes(q)
      );
    });
  }, [tires, search]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getConfigForType(vehicleType: string): VehicleTireConfig | undefined {
    return tireConfigs.find(c => c.vehicleType === vehicleType);
  }

  function getVehicleTires(vehicleId: string): Tire[] {
    return tires.filter(t => t.vehicleId === vehicleId && t.active);
  }

  function handleOpenPlateForm(v: VehicleSimpleForPicker) {
    const config = getConfigForType(v.type);
    const allPositions = (v.axleConfig && v.axleConfig.length > 0)
      ? generatePositionsFromConfig(v.axleConfig, v.stepsCount ?? 0, v.type)
      : generatePositions(v.eixos ?? config?.defaultAxles ?? 2, config?.dualAxles ?? [], config?.defaultSpareCount ?? 1, v.type);

    const occupiedCodes = new Set(getVehicleTires(v.id).map(t => t.currentPosition));
    const freeCount = allPositions.filter(p => !occupiedCodes.has(p.code)).length;

    if (freeCount === 0) {
      setVehiclePickerOpen(false);
      setFullVehicleAlert(v.licensePlate);
      return;
    }

    setSelectedVehicle(v);
    setEditingTire(null);
    setVehiclePickerOpen(false);
    setTireFormOpen(true);
  }

  function handleToggleTire(tire: Tire) {
    if (!tire.active) {
      const positionOccupied = tires.some(
        t => t.active && t.vehicleId === tire.vehicleId && t.currentPosition === tire.currentPosition,
      );
      if (positionOccupied) {
        setReactivateBlockedTire(tire);
        return;
      }
    }
    setToggleTire(tire);
  }

  function handleEditTire(tire: Tire) {
    const vehicle = vehiclesList.find(v => v.id === tire.vehicleId);
    setSelectedVehicle(vehicle
      ? { id: vehicle.id, licensePlate: vehicle.licensePlate, model: vehicle.model, type: vehicle.type, eixos: vehicle.eixos, axleConfig: vehicle.axleConfig, stepsCount: vehicle.stepsCount }
      : { id: tire.vehicleId, licensePlate: tire.vehicleLicensePlate ?? '', model: tire.vehicleModel ?? '', type: tire.vehicleType ?? '', eixos: undefined });
    setEditingTire(tire);
    setTireFormOpen(true);
  }

  if (!canView) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-zinc-500">Você não tem acesso a esta página.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4 md:p-6">
      {blockWrite && <SelectClientNotice />}
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <Circle className="h-6 w-6 text-orange-500" />
          <h1 className="text-xl font-semibold text-zinc-900">Gestão de Pneus</h1>
        </div>
        {canRegister && (
          <button
            onClick={() => setAddModeOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" />
            Adicionar Pneus
          </button>
        )}
      </div>

      {/* Barra de busca */}
      <div className="relative shrink-0">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por especificação ou placa..."
          className="w-full rounded-lg border border-zinc-200 py-2 pr-4 pl-9 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
        />
      </div>

      {/* Tabela */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="flex-1 overflow-auto">
          {tiresLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-zinc-400">
              <Circle className="mb-2 h-8 w-8 opacity-30" />
              <p className="text-sm">
                {tires.length === 0 ? (blockWrite ? 'Nenhum pneu cadastrado em nenhum cliente.' : 'Nenhum pneu cadastrado.') : 'Nenhum pneu encontrado com os filtros aplicados.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b border-zinc-100 bg-zinc-50">
                <tr>
                  {blockWrite && (
                    <th className="px-4 py-3 text-left text-xs font-medium tracking-wide text-zinc-500 uppercase">Cliente</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wide text-zinc-500 uppercase">Especificação</th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wide text-zinc-500 uppercase">Veículo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wide text-zinc-500 uppercase">Posição</th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wide text-zinc-500 uppercase">Classificação</th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wide text-zinc-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium tracking-wide text-zinc-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.map(tire => (
                  <tr key={tire.id} className={cn('hover:bg-zinc-50/50', !tire.active && 'opacity-50')}>
                    {blockWrite && (
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                          {tire.clientId ? (clientNameMap.get(tire.clientId) ?? '—') : '—'}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-zinc-600">
                      <div>{tire.specification}</div>
                      {tire.dot && (
                        <div className="mt-0.5 text-xs text-zinc-400">DOT {tire.dot}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      <span className="font-medium">{tire.vehicleLicensePlate ?? '—'}</span>
                      {tire.vehicleModel && (
                        <span className="ml-1 text-xs text-zinc-400">{tire.vehicleModel}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-700">
                        {tire.currentPosition}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', classificationBadge(tire.visualClassification))}>
                        {tire.visualClassification}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {tire.active ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Ativo</span>
                      ) : (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-400">Inativo</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setHistoryTire(tire)}
                          title="Histórico"
                          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                        >
                          <History className="h-4 w-4" />
                        </button>
                        {canRegister && (
                          <>
                            <button
                              onClick={() => handleEditTire(tire)}
                              title="Editar"
                              className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-blue-600"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleToggleTire(tire)}
                              title={tire.active ? 'Desativar' : 'Reativar'}
                              className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-orange-500"
                            >
                              {tire.active
                                ? <ToggleRight className="h-4 w-4 text-emerald-500" />
                                : <ToggleLeft className="h-4 w-4 text-zinc-400" />}
                            </button>
                          </>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => setTireToDelete(tire)}
                            title="Excluir"
                            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {filtered.length > 0 && (
          <div className="shrink-0 border-t border-zinc-100 px-4 py-2 text-xs text-zinc-400">
            {filtered.length} pneu{filtered.length !== 1 ? 's' : ''} exibido{filtered.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Modais */}
      {addModeOpen && (
        <AddModeModal
          onSelectPlate={() => { setAddModeOpen(false); setVehiclePickerOpen(true); }}
          onSelectBatch={() => { setAddModeOpen(false); setBatchFormOpen(true); }}
          onClose={() => setAddModeOpen(false)}
        />
      )}

      {vehiclePickerOpen && (
        <VehiclePickerModal
          vehicles={vehiclesList}
          onSelect={handleOpenPlateForm}
          onClose={() => setVehiclePickerOpen(false)}
          fullVehicleIds={fullVehicleIds}
        />
      )}

      {tireFormOpen && selectedVehicle && (
        <TireForm
          vehicleId={selectedVehicle.id}
          vehiclePlate={selectedVehicle.licensePlate}
          vehicleType={selectedVehicle.type}
          vehicleAxles={selectedVehicle.eixos}
          vehicleAxleConfig={selectedVehicle.axleConfig}
          vehicleStepsCount={selectedVehicle.stepsCount}
          existingTires={getVehicleTires(selectedVehicle.id)}
          tireConfig={getConfigForType(selectedVehicle.type)}
          editingTire={editingTire}
          onSave={async (tireData: Partial<Tire> | Partial<Tire>[], previousPosition?: string, odometerKm?: number) => {
            await saveMutation.mutateAsync({ tireData, previousPosition, odometerKm });
          }}
          onClose={() => {
            setTireFormOpen(false);
            setEditingTire(null);
            setSelectedVehicle(null);
            clearTireDraft();
          }}
          isSaving={saveMutation.isPending}
          saveError={saveMutation.error instanceof Error ? saveMutation.error.message : undefined}
        />
      )}

      {batchFormOpen && (
        <TireBatchForm
          clientId={currentClient?.id ?? ''}
          userId={profile?.id ?? ''}
          tireConfigs={tireConfigs}
          onClose={() => setBatchFormOpen(false)}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ['tires', currentClient?.id] });
            setBatchFormOpen(false);
          }}
        />
      )}

      {historyTire && (
        <TireHistoryModal
          tire={historyTire}
          onClose={() => setHistoryTire(null)}
        />
      )}

      {toggleTire && (
        <ToggleConfirmModal
          tire={toggleTire}
          onConfirm={() => { toggleMutation.mutate(toggleTire); }}
          onClose={() => setToggleTire(null)}
          isLoading={toggleMutation.isPending}
        />
      )}

      {tireToDelete && (
        <DeleteConfirmModal
          tire={tireToDelete}
          onConfirm={() => { deleteMutation.mutate(tireToDelete); }}
          onClose={() => setTireToDelete(null)}
          isLoading={deleteMutation.isPending}
        />
      )}

      {fullVehicleAlert && (
        <FullVehicleAlertModal
          licensePlate={fullVehicleAlert}
          onClose={() => setFullVehicleAlert(null)}
        />
      )}

      {reactivateBlockedTire && (
        <ReactivateBlockedModal
          tire={reactivateBlockedTire}
          onClose={() => setReactivateBlockedTire(null)}
        />
      )}
    </div>
  );
}
