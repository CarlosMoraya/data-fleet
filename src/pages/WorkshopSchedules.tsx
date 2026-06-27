import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  MapPin,
  CheckCircle,
  XCircle,
  Pencil,
  Trash2,
  Plus,
  Search,
  Loader2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
} from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import ScheduleForm from '../components/ScheduleForm';
import SelectClientNotice from '../components/SelectClientNotice';
import { useAuth } from '../context/AuthContext';
import { requiresClientSelection, showsAggregatedData } from '../lib/clientScope';
import { isOperationsManager } from '../lib/rolePermissions';
import { supabase } from '../lib/supabase';
import {
  WorkshopScheduleRow,
  scheduleFromRow,
  scheduleToRow,
  buildGoogleMapsUrl,
  formatWorkshopAddress,
} from '../lib/workshopScheduleMappers';
import { WorkshopSchedule } from '../types';

// ─── Roles ────────────────────────────────────────────────────────────────────

const ROLES_WITH_ACCESS = [
  'Driver',
  'Fleet Assistant',
  'Fleet Analyst',
  'Supervisor',
  'Operations Manager',
  'Manager',
  'Coordinator',
  'Director',
  'Admin Master',
];

const ROLES_ASSISTANT_PLUS = [
  'Fleet Assistant',
  'Fleet Analyst',
  'Supervisor',
  'Operations Manager',
  'Manager',
  'Coordinator',
  'Director',
  'Admin Master',
];

const ROLES_CAN_DELETE = ['Manager', 'Coordinator', 'Director', 'Admin Master'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

type StatusFilter = 'all' | 'scheduled' | 'completed' | 'cancelled';

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

const STATUS_BADGE: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-zinc-100 text-zinc-500',
};

async function hydrateWorkshopScheduleRows(rows: WorkshopScheduleRow[]): Promise<WorkshopScheduleRow[]> {
  if (rows.length === 0) return rows;

  const vehicleIds = Array.from(new Set(rows.map((row) => row.vehicle_id).filter(Boolean)));
  const workshopIds = Array.from(new Set(rows.map((row) => row.workshop_id).filter(Boolean)));
  const profileIds = Array.from(new Set(rows.map((row) => row.created_by).filter(Boolean)));

  const [vehiclesResult, workshopsResult, profilesResult] = await Promise.all([
    vehicleIds.length > 0
      ? supabase
          .from('vehicles')
          .select('id, license_plate')
          .in('id', vehicleIds)
      : Promise.resolve({ data: [], error: null }),
    workshopIds.length > 0
      ? supabase
          .from('workshops')
          .select('id, name, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address_zip')
          .in('id', workshopIds)
      : Promise.resolve({ data: [], error: null }),
    profileIds.length > 0
      ? supabase
          .from('profiles')
          .select('id, name')
          .in('id', profileIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  type VehicleRow = { id: string; license_plate: string };
  type WorkshopRow = { id: string; name: string; address_street: string; address_number: string; address_complement: string; address_neighborhood: string; address_city: string; address_state: string; address_zip: string };
  type ProfileRow = { id: string; name: string };

  const vehicleMap = new Map<string, VehicleRow>(
    ((vehiclesResult.data as VehicleRow[]) ?? []).map((v) => [v.id, v])
  );
  const workshopMap = new Map<string, WorkshopRow>(
    ((workshopsResult.data as WorkshopRow[]) ?? []).map((w) => [w.id, w])
  );
  const profileMap = new Map<string, ProfileRow>(
    ((profilesResult.data as ProfileRow[]) ?? []).map((p) => [p.id, p])
  );

  return rows.map((row) => {
    const vehicle = vehicleMap.get(row.vehicle_id);
    const workshop = workshopMap.get(row.workshop_id);
    const prof = profileMap.get(row.created_by);
    return {
      ...row,
      vehicles: vehicle ? { license_plate: vehicle.license_plate } : null,
      workshops: workshop
        ? {
            name: workshop.name,
            address_street: workshop.address_street,
            address_number: workshop.address_number,
            address_complement: workshop.address_complement,
            address_neighborhood: workshop.address_neighborhood,
            address_city: workshop.address_city,
            address_state: workshop.address_state,
            address_zip: workshop.address_zip,
          }
        : null,
      profiles: prof ? { name: prof.name } : null,
    };
  });
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function WorkshopSchedules() {
  const { user } = useAuth();

  const isDriver = user?.role === 'Driver';
  const operationsManager = isOperationsManager(user?.role);
  const isAssistantPlus = ROLES_ASSISTANT_PLUS.includes(user?.role ?? '') && !operationsManager;
  const canDelete = ROLES_CAN_DELETE.includes(user?.role ?? '');

  if (user && !ROLES_WITH_ACCESS.includes(user.role)) {
    return <Navigate to="/checklists" replace />;
  }

  return isDriver
    ? <DriverView />
    : <AssistantView canDelete={canDelete} isAssistantPlus={isAssistantPlus} />;
}

// ─── View Motorista ───────────────────────────────────────────────────────────

function DriverView() {
  const { user, currentClient } = useAuth();
  const [showHistory, setShowHistory] = useState(false);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);

  // Guard: se não tem currentClient, não pode proceder
  if (!currentClient?.id) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Agendamentos</h1>
          <p className="mt-1 text-sm text-zinc-500">Seus próximos agendamentos de oficina.</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 py-16 text-center">
          <CalendarClock className="mb-3 h-10 w-10 text-zinc-300" />
          <p className="text-sm font-medium text-zinc-500">Dados de cliente não carregados</p>
          <p className="mt-1 text-xs text-zinc-400">Seu perfil de motorista não está associado a nenhum cliente. Contate o administrador.</p>
        </div>
      </div>
    );
  }

  const { data: driverVehicle, isLoading: loadingVehicle } = useQuery({
    queryKey: ['driverScheduleVehicleId', user?.id, currentClient?.id],
    queryFn: async () => {
      try {
        // Resolve veículo do motorista via profile_id → driver → vehicle
        const { data: driverRec, error: driverError } = await supabase
          .from('drivers')
          .select('id, client_id')
          .eq('profile_id', user!.id)
          .eq('client_id', currentClient!.id)
          .maybeSingle();

        if (driverError) {
          setDiagnosticError(`Erro ao buscar motorista: ${driverError.message}`);
          return null;
        }

        if (!driverRec) {
          setDiagnosticError('Você não está cadastrado como motorista no sistema.');
          return null;
        }

        const { data: vehicleData, error: vehicleError } = await supabase
          .from('vehicles')
          .select('id')
          .eq('driver_id', driverRec.id)
          .eq('client_id', driverRec.client_id)
          .maybeSingle();

        if (vehicleError) {
          setDiagnosticError(`Erro ao buscar veículo: ${vehicleError.message}`);
          return null;
        }

        if (!vehicleData) {
          setDiagnosticError('Nenhum veículo está associado ao seu perfil de motorista.');
          return null;
        }

        setDiagnosticError(null);
        return (vehicleData as { id: string }).id;
      } catch {
        setDiagnosticError('Erro inesperado ao carregar dados.');
        return null;
      }
    },
    enabled: !!user?.id && !!currentClient?.id
  });

  const { data: schedules = [], isLoading: loadingSchedules } = useQuery({
    queryKey: ['workshopSchedules', driverVehicle],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workshop_schedules')
        .select('*')
        .eq('vehicle_id', driverVehicle)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;

      const hydratedRows = await hydrateWorkshopScheduleRows((data ?? []) as WorkshopScheduleRow[]);
      return hydratedRows.map((row) => scheduleFromRow(row));
    },
    enabled: typeof driverVehicle === 'string' && driverVehicle.length > 0
  });

  const isLoading = loadingVehicle || loadingSchedules;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-7 w-7 animate-spin text-orange-500" />
      </div>
    );
  }

  // Se há erro diagnóstico, mostra mensagem
  if (diagnosticError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Agendamentos</h1>
          <p className="mt-1 text-sm text-zinc-500">Seus próximos agendamentos de oficina.</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-amber-300 bg-amber-50 py-16 text-center">
          <CalendarClock className="mb-3 h-10 w-10 text-amber-300" />
          <p className="text-sm font-medium text-amber-900">{diagnosticError}</p>
          <p className="mt-1 text-xs text-amber-700">Recarregue a página ou contate o administrador se o problema persistir.</p>
        </div>
      </div>
    );
  }

  const pending = schedules.filter((s) => s.status === 'scheduled');
  const history = schedules.filter((s) => s.status !== 'scheduled');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Agendamentos</h1>
        <p className="mt-1 text-sm text-zinc-500">Seus próximos agendamentos de oficina.</p>
      </div>

      {/* Agendamentos pendentes */}
      {pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 py-16 text-center">
          <CalendarClock className="mb-3 h-10 w-10 text-zinc-300" />
          <p className="text-sm font-medium text-zinc-500">Nenhum agendamento pendente</p>
          <p className="mt-1 text-xs text-zinc-400">Quando houver um agendamento para seu veículo, ele aparecerá aqui.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map((s) => (
            <DriverScheduleCard key={s.id} schedule={s} />
          ))}
        </div>
      )}

      {/* Histórico */}
      {history.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-700"
          >
            {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Histórico ({history.length})
          </button>
          {showHistory && (
            <div className="mt-3 space-y-3 opacity-70">
              {history.map((s) => (
                <DriverScheduleCard key={s.id} schedule={s} dimmed />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const DriverScheduleCard: React.FC<{ schedule: WorkshopSchedule; dimmed?: boolean }> = ({ schedule, dimmed }) => {
  const address = formatWorkshopAddress(schedule);
  const mapsUrl = buildGoogleMapsUrl(schedule);
  const hasAddress = address.trim().length > 0;

  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm ${dimmed ? 'border-zinc-200' : 'border-orange-200 shadow-orange-50'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[schedule.status]}`}>
              {STATUS_LABELS[schedule.status]}
            </span>
            <span className="text-xs text-zinc-400">{formatDate(schedule.scheduledDate)}</span>
          </div>
          <h3 className="mt-2 truncate text-base font-semibold text-zinc-900">{schedule.workshopName ?? 'Oficina'}</h3>

          {hasAddress && (
            <div className="mt-2 flex items-start gap-1.5">
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-400" />
              <p className="text-sm whitespace-pre-line text-zinc-500">{address}</p>
            </div>
          )}

          {schedule.notes && (
            <p className="mt-2 text-sm text-zinc-400 italic">{schedule.notes}</p>
          )}
        </div>

        {hasAddress && !dimmed && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir no Google Maps"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
          >
            <MapPin className="h-5 w-5" />
          </a>
        )}
      </div>
    </div>
  );
};

// ─── View Fleet Assistant+ ────────────────────────────────────────────────────

function AssistantView({ canDelete, isAssistantPlus }: { canDelete: boolean; isAssistantPlus: boolean }) {
  const { user, currentClient, clients } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const operationsManager = isOperationsManager(user?.role);
  const canWriteSchedules = !operationsManager && isAssistantPlus && !requiresClientSelection(user?.role, currentClient?.id);

  const handleGenerateMaintenance = (schedule: WorkshopSchedule) => {
    if (!canWriteSchedules) return;
    void navigate('/manutencao', {
      state: {
        prefillMaintenance: {
          vehicleId: schedule.vehicleId,
          workshopId: schedule.workshopId,
          entryDate: schedule.scheduledDate,
          type: 'Preventiva',
          status: 'Aguardando orçamento',
          estimatedCost: 0,
        },
      },
    });
  };

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isFormOpen, setIsFormOpen] = useState(() => !operationsManager && sessionStorage.getItem('scheduleFormOpen') === 'true');
  const [editingSchedule, setEditingSchedule] = useState<WorkshopSchedule | null>(() => {
    if (operationsManager) return null;
    try {
      const saved = sessionStorage.getItem('scheduleFormEditing');
      return saved ? JSON.parse(saved) as WorkshopSchedule : null;
    } catch { return null; }
  });

  const { data: schedules = [], isLoading, error } = useQuery({
    queryKey: ['workshopSchedules', currentClient?.id ?? 'all-clients'],
    queryFn: async () => {
      let query = supabase
        .from('workshop_schedules')
        .select('*')
        .order('scheduled_date', { ascending: false });

      if (currentClient?.id) {
        query = query.eq('client_id', currentClient.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      const hydratedRows = await hydrateWorkshopScheduleRows((data ?? []) as WorkshopScheduleRow[]);
      return hydratedRows.map((row) => scheduleFromRow(row));
    },
    enabled: showsAggregatedData(user?.role, currentClient?.id)
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<WorkshopSchedule>) => {
      if (!currentClient?.id || !user?.id) return;

      if (editingSchedule) {
        const { error: err } = await supabase
          .from('workshop_schedules')
          .update({
            vehicle_id: data.vehicleId,
            workshop_id: data.workshopId,
            scheduled_date: data.scheduledDate,
            notes: data.notes?.trim() || null,
          })
          .eq('id', editingSchedule.id);
        if (err) throw err;
      } else {
        const row = scheduleToRow(data, currentClient.id, user.id);
        const { error: err } = await supabase.from('workshop_schedules').insert(row);
        if (err) throw err;
      }
    },
    onSuccess: () => {
      sessionStorage.removeItem('scheduleFormOpen');
      sessionStorage.removeItem('scheduleFormEditing');
      sessionStorage.removeItem('scheduleFormData');
      setIsFormOpen(false);
      setEditingSchedule(null);
      void queryClient.invalidateQueries({ queryKey: ['workshopSchedules'] });
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, completedAt }: { id: string, status: 'completed' | 'cancelled', completedAt?: string }) => {
      const { error: err } = await supabase
        .from('workshop_schedules')
        .update({ status, completed_at: completedAt })
        .eq('id', id);
      if (err) throw err;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workshopSchedules'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: err } = await supabase
        .from('workshop_schedules')
        .delete()
        .eq('id', id);
      if (err) throw err;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workshopSchedules'] });
    }
  });

  const filtered = useMemo(() => {
    return schedules.filter((s) => {
      const matchesSearch =
        (s.vehicleLicensePlate ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (s.workshopName ?? '').toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [schedules, search, statusFilter]);

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'scheduled', label: 'Agendados' },
    { key: 'completed', label: 'Concluídos' },
    { key: 'cancelled', label: 'Cancelados' },
  ];

  const clientNameMap = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach(c => map.set(c.id, c.name));
    return map;
  }, [clients]);

  const blockWrite = requiresClientSelection(user?.role, currentClient?.id);

  return (
    <div className="space-y-6">
      {blockWrite && <SelectClientNotice />}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Agendamentos</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {operationsManager ? 'Visualize os agendamentos dentro do seu escopo.' : 'Gerencie os agendamentos de visita às oficinas.'}
        </p>
      </div>

      {/* Barra de ações */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por placa ou oficina..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-zinc-300 py-2 pr-3 pl-9 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        {canWriteSchedules && (
          <button
            onClick={() => {
              sessionStorage.removeItem('scheduleFormData');
              sessionStorage.setItem('scheduleFormOpen', 'true');
              sessionStorage.removeItem('scheduleFormEditing');
              setEditingSchedule(null);
              setIsFormOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" />
            Novo Agendamento
          </button>
        )}
      </div>

      {/* Tabs de status */}
      <div className="border-b border-zinc-200">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {statusTabs.map((tab) => {
            const count = tab.key === 'all' ? schedules.length : schedules.filter((s) => s.status === tab.key).length;
            const isActive = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-orange-500 font-medium text-orange-600'
                    : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'
                }`}
              >
                {tab.label}
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${isActive ? 'bg-orange-100 text-orange-600' : 'bg-zinc-100 text-zinc-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-orange-500" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">Erro ao carregar agendamentos.</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 py-16 text-center">
          <CalendarClock className="mb-3 h-10 w-10 text-zinc-300" />
          <p className="text-sm font-medium text-zinc-500">
            {search || statusFilter !== 'all' ? 'Nenhum agendamento encontrado' : 'Nenhum agendamento cadastrado'}
          </p>
          {!search && statusFilter === 'all' && canWriteSchedules && (
            <p className="mt-1 text-xs text-zinc-400">Clique em &quot;Novo Agendamento&quot; para começar.</p>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                {blockWrite && (
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-zinc-500 uppercase">Cliente</th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-zinc-500 uppercase">Veículo</th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-zinc-500 uppercase">Oficina</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium tracking-wider text-zinc-500 uppercase sm:table-cell">Data</th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-zinc-500 uppercase">Status</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium tracking-wider text-zinc-500 uppercase md:table-cell">Criado por</th>
                <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-zinc-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((s) => (
                <ScheduleRow
                  key={s.id}
                  schedule={s}
                  canDelete={canDelete}
                  canWriteSchedules={canWriteSchedules}
                  blockWrite={blockWrite}
                  clientName={s.clientId ? (clientNameMap.get(s.clientId) ?? undefined) : undefined}
                  onEdit={canWriteSchedules ? () => {
                    sessionStorage.setItem('scheduleFormEditing', JSON.stringify(s));
                    sessionStorage.setItem('scheduleFormOpen', 'true');
                    sessionStorage.setItem('scheduleFormData', JSON.stringify(s));
                    setEditingSchedule(s);
                    setIsFormOpen(true);
                  } : undefined}
                  onComplete={canWriteSchedules ? () => updateStatusMutation.mutate({ id: s.id, status: 'completed', completedAt: new Date().toISOString() }) : undefined}
                  onCancel={canWriteSchedules ? () => updateStatusMutation.mutate({ id: s.id, status: 'cancelled' }) : undefined}
                  onDelete={canWriteSchedules && canDelete ? () => deleteMutation.mutate(s.id) : undefined}
                  onGenerateMaintenance={canWriteSchedules ? () => handleGenerateMaintenance(s) : undefined}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form modal */}
      {isFormOpen && (
        <ScheduleForm
          schedule={editingSchedule}
          onClose={() => {
            sessionStorage.removeItem('scheduleFormOpen');
            sessionStorage.removeItem('scheduleFormEditing');
            sessionStorage.removeItem('scheduleFormData');
            setIsFormOpen(false);
            setEditingSchedule(null);
          }}
          onSave={(data) => saveMutation.mutateAsync(data)}
        />
      )}
    </div>
  );
}

// ─── Linha da tabela ──────────────────────────────────────────────────────────

const ScheduleRow: React.FC<{
  schedule: WorkshopSchedule;
  canDelete: boolean;
  canWriteSchedules: boolean;
  blockWrite?: boolean;
  clientName?: string;
  onEdit?: () => void;
  onComplete?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  onGenerateMaintenance?: () => void;
}> = ({ schedule, canDelete, canWriteSchedules, blockWrite, clientName, onEdit, onComplete, onCancel, onDelete, onGenerateMaintenance }) => {
  const isScheduled = schedule.status === 'scheduled';
  const address = formatWorkshopAddress(schedule);
  const mapsUrl = buildGoogleMapsUrl(schedule);
  const hasAddress = address.trim().length > 0;

  return (
    <tr className="transition-colors hover:bg-zinc-50">
      {blockWrite && (
        <td className="px-4 py-3 text-sm text-zinc-600">
          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
            {clientName ?? '—'}
          </span>
        </td>
      )}
      <td className="px-4 py-3 font-mono text-xs font-medium text-zinc-700">
        {schedule.vehicleLicensePlate ?? '-'}
      </td>
      <td className="px-4 py-3">
        <div className="text-sm text-zinc-800">{schedule.workshopName ?? '-'}</div>
        {hasAddress && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
            title="Ver no Google Maps"
          >
            <MapPin className="h-3 w-3" />
            Ver endereço
          </a>
        )}
      </td>
      <td className="hidden px-4 py-3 text-zinc-600 sm:table-cell">{formatDate(schedule.scheduledDate)}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[schedule.status]}`}>
          {STATUS_LABELS[schedule.status]}
        </span>
        {schedule.completedAt && (
          <div className="mt-0.5 text-xs text-zinc-400">{formatDate(schedule.completedAt.split('T')[0])}</div>
        )}
      </td>
      <td className="hidden px-4 py-3 text-xs text-zinc-500 md:table-cell">{schedule.createdByName ?? '-'}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {canWriteSchedules && isScheduled && onEdit && onComplete && onCancel && (
            <>
              <button
                onClick={onEdit}
                title="Editar"
                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={onComplete}
                title="Concluir manualmente"
                className="rounded-lg p-1.5 text-green-500 transition-colors hover:bg-green-50 hover:text-green-700"
              >
                <CheckCircle className="h-4 w-4" />
              </button>
              <button
                onClick={onCancel}
                title="Cancelar agendamento"
                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-500"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </>
          )}
          {canWriteSchedules && schedule.status !== 'cancelled' && onGenerateMaintenance && (
            <button
              onClick={onGenerateMaintenance}
              title="Gerar OS de Manutenção"
              className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
            >
              <ClipboardList className="h-4 w-4" />
            </button>
          )}
          {canDelete && canWriteSchedules && !isScheduled && onDelete && (
            <button
              onClick={onDelete}
              title="Excluir"
              className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};
