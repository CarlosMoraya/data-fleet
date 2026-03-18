import React, { useState, useEffect, useCallback } from 'react';
import { X, Wrench, Loader2 } from 'lucide-react';
import { MaintenanceOrder, MaintenanceStatus, MaintenanceType } from '../pages/Maintenance';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const inputClass =
  'mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 text-sm shadow-sm ' +
  'focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500';

const labelClass = 'block text-sm font-medium text-zinc-700';

function Label({ htmlFor, required, children }: { htmlFor?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className={labelClass}>
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );
}

interface MaintenanceFormProps {
  order: MaintenanceOrder | null;
  onClose: () => void;
  onSave: (order: Partial<MaintenanceOrder>) => Promise<void>;
}

interface VehicleOption { id: string; licensePlate: string; }
interface WorkshopOption { id: string; name: string; }

export default function MaintenanceForm({ order, onClose, onSave }: MaintenanceFormProps) {
  const { currentClient } = useAuth();

  const [formData, setFormData] = useState<Partial<MaintenanceOrder>>(() => {
    try {
      const saved = sessionStorage.getItem('maintenanceFormData');
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

  // Inicializa dados
  useEffect(() => {
    const initial = order ? { ...order } : {
      type: 'Preventiva' as MaintenanceType,
      status: 'Aguardando orçamento' as MaintenanceStatus,
      estimatedCost: 0,
    };
    setFormData(initial);
    sessionStorage.setItem('maintenanceFormData', JSON.stringify(initial));
  }, [order]);

  // Carrega opções
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
    const { name, value, type } = e.target;
    
    // Tratamento para inputs numéricos reais
    let parsedValue: string | number | undefined = value;
    if (type === 'number') {
      parsedValue = value ? Number(value) : undefined;
    }

    setFormData((prev) => {
      const next = { ...prev, [name]: parsedValue };
      sessionStorage.setItem('maintenanceFormData', JSON.stringify(next));
      return next;
    });
  };

  const handleClose = () => {
    sessionStorage.removeItem('maintenanceFormOpen');
    sessionStorage.removeItem('maintenanceFormEditing');
    sessionStorage.removeItem('maintenanceFormData');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicleId || !formData.workshopId || !formData.entryDate || !formData.type || !formData.status) {
      setError('Preencha os campos obrigatórios.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(formData);
      handleClose();
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao salvar. Tente novamente.');
      setSaving(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
              <Wrench className="h-4 w-4 text-orange-600" />
            </div>
            <h2 className="text-base font-semibold text-zinc-900">
              {order ? 'Editar OS / Orçamento' : 'Nova Manutenção'}
            </h2>
          </div>
          <button onClick={handleClose} className="rounded-lg p-1 hover:bg-zinc-100 transition-colors">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6">
          {loadingOptions ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          ) : (
            <form id="maintenance-form" onSubmit={handleSubmit} className="space-y-6">

              {/* Grid 2 colunas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Linha 1 */}
                <div>
                  <Label htmlFor="vehicleId" required>Veículo (Placa)</Label>
                  <select
                    id="vehicleId"
                    name="vehicleId"
                    required
                    value={formData.vehicleId ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                    disabled={!!order} // Desabilitar se for edição para não quebrar referências facilmente
                  >
                    <option value="">Selecione...</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>{v.licensePlate}</option>
                    ))}
                  </select>
                </div>
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
                    <option value="">Selecione...</option>
                    {workshops.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                {/* Linha 2 */}
                <div>
                  <Label htmlFor="type" required>Tipo de Manutenção</Label>
                  <select
                    id="type"
                    name="type"
                    required
                    value={formData.type ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="">Selecione...</option>
                    <option value="Preventiva">Preventiva</option>
                    <option value="Preditiva">Preditiva</option>
                    <option value="Corretiva">Corretiva</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="status" required>Status Atual</Label>
                  <select
                    id="status"
                    name="status"
                    required
                    value={formData.status ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="Aguardando orçamento">Aguardando orçamento</option>
                    <option value="Orçamento aprovado">Orçamento aprovado</option>
                    <option value="Serviço em execução">Serviço em execução</option>
                    <option value="Concluído">Concluído</option>
                  </select>
                </div>

                {/* Linha 3 */}
                <div>
                  <Label htmlFor="entryDate" required>Data de Entrada</Label>
                  <input
                    id="entryDate"
                    name="entryDate"
                    type="date"
                    required
                    value={formData.entryDate ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <Label htmlFor="expectedExitDate">Previsão de Saída</Label>
                  <input
                    id="expectedExitDate"
                    name="expectedExitDate"
                    type="date"
                    min={formData.entryDate || today}
                    value={formData.expectedExitDate ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>

                {/* Linha 6 */}
                <div>
                  <Label htmlFor="estimatedCost" required>Custo Estimado (R$)</Label>
                  <input
                    id="estimatedCost"
                    name="estimatedCost"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.estimatedCost ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <Label htmlFor="approvedCost">Custo Aprovado (R$)</Label>
                  <input
                    id="approvedCost"
                    name="approvedCost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.approvedCost ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* O.S. e Mecânico Responsável */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="os">Número da OS (Opcional gerado auto.)</Label>
                  <input
                    id="os"
                    name="os"
                    type="text"
                    placeholder="Deixe em branco p/ gerar automático"
                    value={formData.os ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <Label htmlFor="mechanicName">Mecânico / Técnico (Opcional)</Label>
                  <input
                    id="mechanicName"
                    name="mechanicName"
                    type="text"
                    value={formData.mechanicName ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Nome do responsável"
                  />
                </div>
              </div>

              {/* Problema / Descrição */}
              <div>
                <Label htmlFor="description">Descrição / Problema Relatado</Label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description ?? ''}
                  onChange={handleChange}
                  rows={2}
                  className={`${inputClass} resize-none`}
                  placeholder="Descreva o motivo da manutenção..."
                />
              </div>

              {/* Observações Internas */}
              <div>
                <Label htmlFor="notes">Notas / Observações Internas</Label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes ?? ''}
                  onChange={handleChange}
                  rows={2}
                  className={`${inputClass} resize-none`}
                  placeholder="Comentários internos visíveis para a gestão..."
                />
              </div>

            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-zinc-200 px-6 py-4 bg-zinc-50 rounded-b-2xl">
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
              form="maintenance-form"
              disabled={saving || loadingOptions}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : (order ? 'Salvar Edição' : 'Criar Manutenção')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
