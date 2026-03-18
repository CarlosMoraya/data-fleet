import React, { useState, useEffect, useCallback } from 'react';
import { X, CalendarClock, Loader2 } from 'lucide-react';
import { WorkshopSchedule } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// ─── Estilos ─────────────────────────────────────────────────────────────────

const inputClass =
  'mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 text-sm shadow-sm ' +
  'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

const labelClass = 'block text-sm font-medium text-zinc-700';

function Label({ htmlFor, required, children }: { htmlFor?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className={labelClass}>
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ScheduleFormProps {
  schedule: WorkshopSchedule | null;
  onClose: () => void;
  onSave: (schedule: Partial<WorkshopSchedule>) => Promise<void>;
}

interface VehicleOption { id: string; licensePlate: string; }
interface WorkshopOption { id: string; name: string; }

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function ScheduleForm({ schedule, onClose, onSave }: ScheduleFormProps) {
  const { currentClient } = useAuth();

  const [formData, setFormData] = useState<Partial<WorkshopSchedule>>(() => {
    try {
      const saved = sessionStorage.getItem('scheduleFormData');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [workshops, setWorkshops] = useState<WorkshopOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Inicializa com dados do agendamento ao editar
  useEffect(() => {
    const initial = schedule ? { ...schedule } : {};
    setFormData(initial);
    sessionStorage.setItem('scheduleFormData', JSON.stringify(initial));
  }, [schedule]);

  // Carrega veículos e oficinas do tenant
  const fetchOptions = useCallback(async () => {
    if (!currentClient?.id) return;
    setLoadingOptions(true);
    const [{ data: vehiclesData }, { data: workshopsData }] = await Promise.all([
      supabase
        .from('vehicles')
        .select('id, license_plate')
        .eq('client_id', currentClient.id)
        .order('license_plate'),
      supabase
        .from('workshops')
        .select('id, name')
        .eq('client_id', currentClient.id)
        .eq('active', true)
        .order('name'),
    ]);
    setVehicles((vehiclesData ?? []).map((v: { id: string; license_plate: string }) => ({ id: v.id, licensePlate: v.license_plate })));
    setWorkshops((workshopsData ?? []) as WorkshopOption[]);
    setLoadingOptions(false);
  }, [currentClient?.id]);

  useEffect(() => { fetchOptions(); }, [fetchOptions]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      sessionStorage.setItem('scheduleFormData', JSON.stringify(next));
      return next;
    });
  };

  const handleClose = () => {
    sessionStorage.removeItem('scheduleFormOpen');
    sessionStorage.removeItem('scheduleFormEditing');
    sessionStorage.removeItem('scheduleFormData');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicleId || !formData.workshopId || !formData.scheduledDate) {
      setError('Selecione o veículo, a oficina e a data do agendamento.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(formData);
    } catch (err: unknown) {
      const pgErr = err as { code?: string; message?: string };
      setError(pgErr?.message ?? 'Erro ao salvar agendamento. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  // Data mínima: hoje
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
              <CalendarClock className="h-4 w-4 text-orange-600" />
            </div>
            <h2 className="text-base font-semibold text-zinc-900">
              {schedule ? 'Editar Agendamento' : 'Novo Agendamento'}
            </h2>
          </div>
          <button onClick={handleClose} className="rounded-lg p-1 hover:bg-zinc-100 transition-colors">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          {loadingOptions ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
            </div>
          ) : (
            <form id="schedule-form" onSubmit={handleSubmit} className="space-y-6 p-6">

              {/* Veículo */}
              <div>
                <Label htmlFor="vehicleId" required>Veículo (Placa)</Label>
                <select
                  id="vehicleId"
                  name="vehicleId"
                  required
                  value={formData.vehicleId ?? ''}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="">Selecione um veículo...</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.licensePlate}</option>
                  ))}
                </select>
                {vehicles.length === 0 && (
                  <p className="mt-1 text-xs text-zinc-400">Nenhum veículo cadastrado.</p>
                )}
              </div>

              {/* Oficina */}
              <div>
                <Label htmlFor="workshopId" required>Oficina</Label>
                <select
                  id="workshopId"
                  name="workshopId"
                  required
                  value={formData.workshopId ?? ''}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="">Selecione uma oficina...</option>
                  {workshops.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
                {workshops.length === 0 && (
                  <p className="mt-1 text-xs text-zinc-400">Nenhuma oficina ativa cadastrada.</p>
                )}
              </div>

              {/* Data */}
              <div>
                <Label htmlFor="scheduledDate" required>Data do Agendamento</Label>
                <input
                  id="scheduledDate"
                  name="scheduledDate"
                  type="date"
                  required
                  min={schedule ? undefined : today}
                  value={formData.scheduledDate ?? ''}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              {/* Observações */}
              <div>
                <Label htmlFor="notes">Observações</Label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes ?? ''}
                  onChange={handleChange}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Informações adicionais sobre o agendamento..."
                />
              </div>

            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-zinc-200 px-6 py-4">
          {error && (
            <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="schedule-form"
              disabled={saving || loadingOptions}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors disabled:opacity-60"
            >
              {saving ? 'Salvando...' : schedule ? 'Salvar Alterações' : 'Agendar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
