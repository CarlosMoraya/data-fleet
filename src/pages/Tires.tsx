import React from 'react';
import { Circle, Search, Plus, Eye, Pencil, ToggleLeft, ToggleRight, History, Loader2, Trash2, AlertTriangle, Ban } from 'lucide-react';
import { cn } from '../lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Tire, VehicleTireConfig, AxleConfigEntry } from '../types';
import { TireRow, tireFromRow, vehicleTireConfigFromRow, VehicleTireConfigRow } from '../lib/tireMappers';
import { generatePositions, generatePositionsFromConfig } from '../lib/tirePositions';
import TireForm from '../components/TireForm';
import TireBatchForm from '../components/TireBatchForm';
import TireHistoryModal from '../components/TireHistoryModal';
import { saveTire, toggleTireActive, deleteTire } from '../services/tireService';

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
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h2 className="text-lg font-semibold text-zinc-900 mb-1">Adicionar Pneus</h2>
        <p className="text-sm text-zinc-500 mb-6">Escolha o modo de cadastro</p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onSelectPlate}
            className="flex flex-col items-start p-4 border border-zinc-200 rounded-xl hover:border-orange-400 hover:bg-orange-50 transition-colors text-left"
          >
            <span className="font-medium text-zinc-900">Por Placa (Individual)</span>
            <span className="text-sm text-zinc-500 mt-0.5">Cadastre pneus em um veículo específico</span>
          </button>
          <button
            onClick={onSelectBatch}
            className="flex flex-col items-start p-4 border border-zinc-200 rounded-xl hover:border-orange-400 hover:bg-orange-50 transition-colors text-left"
          >
            <span className="font-medium text-zinc-900">Por Modelo (Lote)</span>
            <span className="text-sm text-zinc-500 mt-0.5">Cadastre pneus para todos os veículos de um modelo</span>
          </button>
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full text-sm text-zinc-500 hover:text-zinc-700 py-2"
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
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h2 className="text-lg font-semibold text-zinc-900 mb-2">
          {tire.active ? 'Desativar Pneu' : 'Reativar Pneu'}
        </h2>
        <p className="text-sm text-zinc-600 mb-6">
          {tire.active
            ? `Desativar o pneu na posição ${tire.currentPosition}? Ele continuará no histórico mas não bloqueará posições.`
            : `Reativar o pneu na posição ${tire.currentPosition}? Ele voltará a ocupar essa posição.`}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium text-white',
              tire.active ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-600 hover:bg-emerald-700',
              isLoading && 'opacity-60 cursor-not-allowed',
            )}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : (tire.active ? 'Desativar' : 'Reativar')}
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
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h2 className="text-lg font-semibold text-zinc-900 mb-2">Excluir Pneu</h2>
        <p className="text-sm text-zinc-600 mb-6">
          Excluir o pneu na posição <span className="font-semibold">{tire.currentPosition}</span> ({tire.vehicleLicensePlate ?? tire.vehicleModel ?? 'veículo desconhecido'})? Esta ação é irreversível e também excluirá todo o histórico de movimentação.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-sm font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Excluir'}
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
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <h2 className="text-lg font-semibold text-zinc-900">Todas as posições ocupadas</h2>
        </div>
        <p className="text-sm text-zinc-600 mb-6">
          O veículo <span className="font-semibold">{licensePlate}</span> já possui pneus ativos em todas as posições. Desative um ou mais pneus para liberar posições antes de cadastrar novos.
        </p>
        <button
          onClick={onClose}
          className="w-full py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-sm font-medium text-white"
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
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <h2 className="text-lg font-semibold text-zinc-900">Posição já ocupada</h2>
        </div>
        <p className="text-sm text-zinc-600 mb-6">
          A posição <span className="font-semibold font-mono">{tire.currentPosition}</span> do veículo{' '}
          <span className="font-semibold">{tire.vehicleLicensePlate ?? tire.vehicleModel ?? 'desconhecido'}</span>{' '}
          já está ocupada por outro pneu ativo. Desative o pneu atual nessa posição antes de reativar este.
        </p>
        <button
          onClick={onClose}
          className="w-full py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-sm font-medium text-white"
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
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 flex flex-col max-h-[80vh]">
        <h2 className="text-lg font-semibold text-zinc-900 mb-3">Selecionar Veículo</h2>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por placa ou modelo..."
            className="w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
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
                  'w-full flex items-center justify-between px-2 py-3 hover:bg-zinc-50 text-left',
                  isFull && 'opacity-50',
                )}
              >
                <div className="flex items-center gap-2">
                  {isFull && <Ban className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                  <span className="font-medium text-zinc-900">{v.licensePlate}</span>
                  <span className="text-zinc-500 text-sm">{v.model}</span>
                </div>
                <span className="text-xs text-zinc-400">{v.type}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={onClose}
          className="mt-4 text-sm text-zinc-500 hover:text-zinc-700 py-2"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function Tires() {
  const { currentClient, user: profile } = useAuth();
  const queryClient = useQueryClient();

  const canRegister = ROLES_CAN_REGISTER_TIRES.includes(profile?.role ?? '');
  const canView = ROLES_CAN_VIEW_TIRES.includes(profile?.role ?? '');
  const canDelete = ROLES_CAN_DELETE_TIRES.includes(profile?.role ?? '');

  const [search, setSearch] = React.useState('');

  // Modais
  const [addModeOpen, setAddModeOpen] = React.useState(false);
  const [vehiclePickerOpen, setVehiclePickerOpen] = React.useState(false);
  const [selectedVehicle, setSelectedVehicle] = React.useState<{
    id: string; licensePlate: string; model: string; type: string; eixos?: number;
    axleConfig?: AxleConfigEntry[]; stepsCount?: number;
  } | null>(() => {
    const saved = sessionStorage.getItem('tireFormVehicle');
    return saved ? JSON.parse(saved) : null;
  });
  const [tireFormOpen, setTireFormOpen] = React.useState<boolean>(() =>
    sessionStorage.getItem('tireFormOpen') === 'true'
  );
  const [editingTire, setEditingTire] = React.useState<Tire | null>(() => {
    const saved = sessionStorage.getItem('tireFormEditing');
    return saved ? JSON.parse(saved) : null;
  });
  const [batchFormOpen, setBatchFormOpen] = React.useState(false);
  const [historyTire, setHistoryTire] = React.useState<Tire | null>(null);
  const [toggleTire, setToggleTire] = React.useState<Tire | null>(null);
  const [tireToDelete, setTireToDelete] = React.useState<Tire | null>(null);
  const [fullVehicleAlert, setFullVehicleAlert] = React.useState<string | null>(null);
  const [reactivateBlockedTire, setReactivateBlockedTire] = React.useState<Tire | null>(null);

  // Sincronizar estado do formulário de pneu com sessionStorage
  React.useEffect(() => {
    sessionStorage.setItem('tireFormOpen', String(tireFormOpen));
    sessionStorage.setItem('tireFormEditing', JSON.stringify(editingTire));
    sessionStorage.setItem('tireFormVehicle', JSON.stringify(selectedVehicle));
  }, [tireFormOpen, editingTire, selectedVehicle]);

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
    enabled: canView && !!currentClient?.id,
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
      return (data ?? []).map((v: any) => ({
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
      queryClient.invalidateQueries({ queryKey: ['tires', currentClient?.id] });
      setToggleTire(null);
    },
  });

  // ── Excluir pneu ──────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (tire: Tire) => {
      await deleteTire(tire.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tires', currentClient?.id] });
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
      queryClient.invalidateQueries({ queryKey: ['tires', currentClient?.id] });
      setTireFormOpen(false);
      setEditingTire(null);
      setSelectedVehicle(null);
      sessionStorage.removeItem('tireFormOpen');
      sessionStorage.removeItem('tireFormEditing');
      sessionStorage.removeItem('tireFormVehicle');
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
      <div className="flex items-center justify-center h-64">
        <p className="text-zinc-500 text-sm">Você não tem acesso a esta página.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4 p-4 md:p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Circle className="h-6 w-6 text-orange-500" />
          <h1 className="text-xl font-semibold text-zinc-900">Gestão de Pneus</h1>
        </div>
        {canRegister && (
          <button
            onClick={() => setAddModeOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Adicionar Pneus
          </button>
        )}
      </div>

      {/* Barra de busca */}
      <div className="relative shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por especificação ou placa..."
          className="w-full pl-9 pr-4 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      {/* Tabela */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-zinc-200 flex flex-col overflow-hidden">
        <div className="overflow-auto flex-1">
          {tiresLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-zinc-400">
              <Circle className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">
                {tires.length === 0 ? 'Nenhum pneu cadastrado.' : 'Nenhum pneu encontrado com os filtros aplicados.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-100 sticky top-0 bg-zinc-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500 uppercase tracking-wide text-xs">Especificação</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500 uppercase tracking-wide text-xs">Veículo</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500 uppercase tracking-wide text-xs">Posição</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500 uppercase tracking-wide text-xs">Classificação</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500 uppercase tracking-wide text-xs">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-zinc-500 uppercase tracking-wide text-xs">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.map(tire => (
                  <tr key={tire.id} className={cn('hover:bg-zinc-50/50', !tire.active && 'opacity-50')}>
                    <td className="px-4 py-3 text-zinc-600">
                      <div>{tire.specification}</div>
                      {tire.dot && (
                        <div className="text-xs text-zinc-400 mt-0.5">DOT {tire.dot}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      <span className="font-medium">{tire.vehicleLicensePlate ?? '—'}</span>
                      {tire.vehicleModel && (
                        <span className="ml-1 text-zinc-400 text-xs">{tire.vehicleModel}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded text-xs">
                        {tire.currentPosition}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', classificationBadge(tire.visualClassification))}>
                        {tire.visualClassification}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {tire.active ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">Ativo</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-400">Inativo</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setHistoryTire(tire)}
                          title="Histórico"
                          className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600"
                        >
                          <History className="h-4 w-4" />
                        </button>
                        {canRegister && (
                          <>
                            <button
                              onClick={() => handleEditTire(tire)}
                              title="Editar"
                              className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-blue-600"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleToggleTire(tire)}
                              title={tire.active ? 'Desativar' : 'Reativar'}
                              className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-orange-500"
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
                            className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-red-600"
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
          <div className="px-4 py-2 border-t border-zinc-100 text-xs text-zinc-400 shrink-0">
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
            sessionStorage.removeItem('tireFormOpen');
            sessionStorage.removeItem('tireFormEditing');
            sessionStorage.removeItem('tireFormVehicle');
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
            queryClient.invalidateQueries({ queryKey: ['tires', currentClient?.id] });
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
          onConfirm={() => toggleMutation.mutate(toggleTire)}
          onClose={() => setToggleTire(null)}
          isLoading={toggleMutation.isPending}
        />
      )}

      {tireToDelete && (
        <DeleteConfirmModal
          tire={tireToDelete}
          onConfirm={() => deleteMutation.mutate(tireToDelete)}
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
