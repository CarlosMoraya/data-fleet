import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
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
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { WorkshopSchedule } from '../types';
import {
  WorkshopScheduleRow,
  scheduleFromRow,
  scheduleToRow,
  buildGoogleMapsUrl,
  formatWorkshopAddress,
} from '../lib/workshopScheduleMappers';
import ScheduleForm from '../components/ScheduleForm';

// ─── Roles ────────────────────────────────────────────────────────────────────

const ROLES_WITH_ACCESS = [
  'Driver',
  'Fleet Assistant',
  'Fleet Analyst',
  'Supervisor',
  'Manager',
  'Coordinator',
  'Director',
  'Admin Master',
];

const ROLES_ASSISTANT_PLUS = [
  'Fleet Assistant',
  'Fleet Analyst',
  'Supervisor',
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

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function WorkshopSchedules() {
  const { user, currentClient } = useAuth();

  const isDriver = user?.role === 'Driver';
  const isAssistantPlus = ROLES_ASSISTANT_PLUS.includes(user?.role ?? '');
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
  const queryClient = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);

  // Guard: se não tem currentClient, não pode proceder
  if (!currentClient?.id) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Agendamentos</h1>
          <p className="text-sm text-zinc-500 mt-1">Seus próximos agendamentos de oficina.</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 py-16 text-center">
          <CalendarClock className="h-10 w-10 text-zinc-300 mb-3" />
          <p className="text-sm font-medium text-zinc-500">Dados de cliente não carregados</p>
          <p className="text-xs text-zinc-400 mt-1">Seu perfil de motorista não está associado a nenhum cliente. Contate o administrador.</p>
        </div>
      </div>
    );
  }

  const { data: driverVehicle, isLoading: loadingVehicle } = useQuery({
    queryKey: ['driverVehicle', user?.id, currentClient?.id],
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
        return vehicleData.id;
      } catch (err) {
        setDiagnosticError('Erro inesperado ao carregar dados.');
        return null;
      }
    },
    enabled: !!user?.id && !!currentClient?.id
  });

  const { data: schedules = [], isLoading: loadingSchedules } = useQuery({
    queryKey: ['workshopSchedules', driverVehicle],
    queryFn: async () => {
      const { data } = await supabase
        .from('workshop_schedules')
        .select(
          '*, vehicles(license_plate), workshops(name, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address_zip), profiles!created_by(name)'
        )
        .eq('vehicle_id', driverVehicle)
        .order('scheduled_date', { ascending: true });

      return (data ?? []).map((r) => scheduleFromRow(r as WorkshopScheduleRow));
    },
    enabled: !!driverVehicle
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
          <p className="text-sm text-zinc-500 mt-1">Seus próximos agendamentos de oficina.</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-amber-300 bg-amber-50 py-16 text-center">
          <CalendarClock className="h-10 w-10 text-amber-300 mb-3" />
          <p className="text-sm font-medium text-amber-900">{diagnosticError}</p>
          <p className="text-xs text-amber-700 mt-1">Recarregue a página ou contate o administrador se o problema persistir.</p>
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
        <p className="text-sm text-zinc-500 mt-1">Seus próximos agendamentos de oficina.</p>
      </div>

      {/* Agendamentos pendentes */}
      {pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 py-16 text-center">
          <CalendarClock className="h-10 w-10 text-zinc-300 mb-3" />
          <p className="text-sm font-medium text-zinc-500">Nenhum agendamento pendente</p>
          <p className="text-xs text-zinc-400 mt-1">Quando houver um agendamento para seu veículo, ele aparecerá aqui.</p>
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
            className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-700 transition-colors"
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
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[schedule.status]}`}>
              {STATUS_LABELS[schedule.status]}
            </span>
            <span className="text-xs text-zinc-400">{formatDate(schedule.scheduledDate)}</span>
          </div>
          <h3 className="mt-2 text-base font-semibold text-zinc-900 truncate">{schedule.workshopName ?? 'Oficina'}</h3>

          {hasAddress && (
            <div className="mt-2 flex items-start gap-1.5">
              <MapPin className="h-4 w-4 text-zinc-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-zinc-500 whitespace-pre-line">{address}</p>
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
            className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
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
  const { user, currentClient } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleGenerateMaintenance = (schedule: WorkshopSchedule) => {
    navigate('/manutencao', {
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
  const [isFormOpen, setIsFormOpen] = useState(() => sessionStorage.getItem('scheduleFormOpen') === 'true');
  const [editingSchedule, setEditingSchedule] = useState<WorkshopSchedule | null>(() => {
    try {
      const saved = sessionStorage.getItem('scheduleFormEditing');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const { data: schedules = [], isLoading, error } = useQuery({
    queryKey: ['workshopSchedules', currentClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workshop_schedules')
        .select(
          '*, vehicles(license_plate), workshops(name, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address_zip), profiles!created_by(name)'
        )
        .eq('client_id', currentClient!.id)
        .order('scheduled_date', { ascending: false });

      if (error) throw error;
      return (data ?? []).map((r) => scheduleFromRow(r as WorkshopScheduleRow));
    },
    enabled: !!currentClient?.id
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
      queryClient.invalidateQueries({ queryKey: ['workshopSchedules'] });
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
      queryClient.invalidateQueries({ queryKey: ['workshopSchedules'] });
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
      queryClient.invalidateQueries({ queryKey: ['workshopSchedules'] });
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Agendamentos</h1>
        <p className="text-sm text-zinc-500 mt-1">Gerencie os agendamentos de visita às oficinas.</p>
      </div>

      {/* Barra de ações */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por placa ou oficina..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-zinc-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        {isAssistantPlus && (
          <button
            onClick={() => {
              sessionStorage.removeItem('scheduleFormData');
              sessionStorage.setItem('scheduleFormOpen', 'true');
              sessionStorage.removeItem('scheduleFormEditing');
              setEditingSchedule(null);
              setIsFormOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
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
                className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-sm transition-colors ${
                  isActive
                    ? 'border-orange-500 text-orange-600 font-medium'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
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
          <CalendarClock className="h-10 w-10 text-zinc-300 mb-3" />
          <p className="text-sm font-medium text-zinc-500">
            {search || statusFilter !== 'all' ? 'Nenhum agendamento encontrado' : 'Nenhum agendamento cadastrado'}
          </p>
          {!search && statusFilter === 'all' && isAssistantPlus && (
            <p className="text-xs text-zinc-400 mt-1">Clique em "Novo Agendamento" para começar.</p>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Veículo</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Oficina</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 hidden sm:table-cell">Data</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 hidden md:table-cell">Criado por</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((s) => (
                <ScheduleRow
                  key={s.id}
                  schedule={s}
                  canDelete={canDelete}
                  isAssistantPlus={isAssistantPlus}
                  onEdit={() => {
                    sessionStorage.setItem('scheduleFormEditing', JSON.stringify(s));
                    sessionStorage.setItem('scheduleFormOpen', 'true');
                    sessionStorage.setItem('scheduleFormData', JSON.stringify(s));
                    setEditingSchedule(s);
                    setIsFormOpen(true);
                  }}
                  onComplete={() => updateStatusMutation.mutate({ id: s.id, status: 'completed', completedAt: new Date().toISOString() })}
                  onCancel={() => updateStatusMutation.mutate({ id: s.id, status: 'cancelled' })}
                  onDelete={() => deleteMutation.mutate(s.id)}
                  onGenerateMaintenance={() => handleGenerateMaintenance(s)}
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
  isAssistantPlus: boolean;
  onEdit: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onGenerateMaintenance: () => void;
}> = ({ schedule, canDelete, isAssistantPlus, onEdit, onComplete, onCancel, onDelete, onGenerateMaintenance }) => {
  const isScheduled = schedule.status === 'scheduled';
  const address = formatWorkshopAddress(schedule);
  const mapsUrl = buildGoogleMapsUrl(schedule);
  const hasAddress = address.trim().length > 0;

  return (
    <tr className="hover:bg-zinc-50 transition-colors">
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
            className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-0.5"
            title="Ver no Google Maps"
          >
            <MapPin className="h-3 w-3" />
            Ver endereço
          </a>
        )}
      </td>
      <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">{formatDate(schedule.scheduledDate)}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[schedule.status]}`}>
          {STATUS_LABELS[schedule.status]}
        </span>
        {schedule.completedAt && (
          <div className="text-xs text-zinc-400 mt-0.5">{formatDate(schedule.completedAt.split('T')[0])}</div>
        )}
      </td>
      <td className="px-4 py-3 text-zinc-500 text-xs hidden md:table-cell">{schedule.createdByName ?? '-'}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {isAssistantPlus && isScheduled && (
            <>
              <button
                onClick={onEdit}
                title="Editar"
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={onComplete}
                title="Concluir manualmente"
                className="rounded-lg p-1.5 text-green-500 hover:bg-green-50 hover:text-green-700 transition-colors"
              >
                <CheckCircle className="h-4 w-4" />
              </button>
              <button
                onClick={onCancel}
                title="Cancelar agendamento"
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-500 transition-colors"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </>
          )}
          {isAssistantPlus && schedule.status !== 'cancelled' && (
            <button
              onClick={onGenerateMaintenance}
              title="Gerar OS de Manutenção"
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
            >
              <ClipboardList className="h-4 w-4" />
            </button>
          )}
          {canDelete && !isScheduled && (
            <button
              onClick={onDelete}
              title="Excluir"
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};
