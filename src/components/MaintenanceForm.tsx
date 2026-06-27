import { X, Wrench, Loader2, FileText, ExternalLink, AlertTriangle } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo } from 'react';

import { useAuth } from '../context/AuthContext';
import { extractBudgetData } from '../lib/budgetOcr';
import { isKnownBudgetSystem } from '../lib/budgetSystems';
import { validateMaintenanceCurrentKm } from '../lib/maintenanceKmValidation';
import { budgetItemFromRow, type MaintenanceBudgetItemRow, BudgetItem } from '../lib/maintenanceMappers';
import { validateFile } from '../lib/storageHelpers';
import { supabase } from '../lib/supabase';
import { buildUiStateKey, readUiState, writeUiState, removeUiState, sanitizeDraft } from '../lib/uiStateStorage';
import { listPendingEventsForVehicle } from '../services/warrantyRevisionService';

import BudgetItemsTable from './BudgetItemsTable';
import PartPhotosSection from './PartPhotosSection';

import type { PartPhotoDraft } from '../services/maintenancePartPhotoService';
import type { MaintenanceOrder, MaintenanceStatus, MaintenanceType } from '../types/maintenance';

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
  prefill?: Partial<MaintenanceOrder>;
  mode?: 'default' | 'workshop';
  onClose: () => void;
  onSave: (order: Partial<MaintenanceOrder>, budgetItems: BudgetItem[], budgetFile: File | null, pendingPartPhotos: PartPhotoDraft[]) => Promise<void>;
}

interface VehicleOption { id: string; licensePlate: string; initialKm: number | null; }
interface WorkshopOption { id: string; name: string; }
interface WarrantyEventOption { id: string; sequence: number; label: string; targetKm: number; }
type VehicleMaxKmRpcResult = number | null;

export default function MaintenanceForm({ order, prefill, mode = 'default', onClose, onSave }: MaintenanceFormProps) {
  const { user, currentClient } = useAuth();
  const isWorkshopMode = mode === 'workshop';

  const draftKey = user?.id
    ? buildUiStateKey({ scope: 'draft', userId: user.id, clientId: currentClient?.id ?? 'no-client', module: 'maintenance', stateKind: 'draft', name: 'form' })
    : '';

  const defaultFormData = useMemo<Partial<MaintenanceOrder>>(
    () => (order
      ? { ...order }
      : {
        type: 'Preventiva',
        status: 'Aguardando orçamento',
        estimatedCost: 0,
        ...prefill,
      }),
    [order, prefill],
  );

  const [formData, setFormData] = useState<Partial<MaintenanceOrder>>(() => {
    if (!draftKey) return defaultFormData;
    return readUiState<Partial<MaintenanceOrder>>(window.sessionStorage, draftKey, defaultFormData, {
      legacyKeys: ['maintenanceFormData'],
    });
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [workshops, setWorkshops] = useState<WorkshopOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [warrantyEvents, setWarrantyEvents] = useState<WarrantyEventOption[]>([]);
  const [referenceKm, setReferenceKm] = useState<number | null>(null);

  // Budget states
  const [budgetFile, setBudgetFile] = useState<File | null>(null);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractionWarning, setExtractionWarning] = useState<string | null>(null);
  const [existingBudgetPdfUrl, setExistingBudgetPdfUrl] = useState<string | undefined>();
  const [partPhotoDrafts, setPartPhotoDrafts] = useState<PartPhotoDraft[]>([]);

  // Inicializa dados
  useEffect(() => {
    const initial = order
      ? { ...order }
      : {
        type: 'Preventiva' as MaintenanceType,
        status: 'Aguardando orçamento' as MaintenanceStatus,
        estimatedCost: 0,
        ...prefill,
      };
    setFormData(initial);
  }, [order, prefill]);

  useEffect(() => {
    if (!draftKey) return;
    const sanitized = sanitizeDraft('maintenance', formData as Record<string, unknown>);
    writeUiState(window.sessionStorage, draftKey, sanitized as Partial<MaintenanceOrder>, defaultFormData, { removeLegacyKeys: ['maintenanceFormData'] });
  }, [formData, draftKey, defaultFormData]);

  // Carrega itens de orçamento existentes (modo edição)
  useEffect(() => {
    if (!order?.id) return;
    setExistingBudgetPdfUrl(order.budgetPdfUrl);
    void supabase
      .from('maintenance_budget_items')
      .select('*')
      .eq('maintenance_order_id', order.id)
      .order('sort_order')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setBudgetItems((data as MaintenanceBudgetItemRow[]).map(budgetItemFromRow));
        }
      });
  }, [order?.id, order?.budgetPdfUrl]);

  // Carrega opções (apenas no modo padrão — Workshop não precisa)
  const fetchOptions = useCallback(async () => {
    if (isWorkshopMode) { setLoadingOptions(false); return; }
    if (!currentClient?.id) return;
    setLoadingOptions(true);
    const [{ data: vehiclesData }, { data: workshopsData }] = await Promise.all([
      supabase
        .from('vehicles')
        .select('id, license_plate, initial_km')
        .eq('client_id', currentClient.id)
        .order('license_plate'),
      supabase
        .from('workshops')
        .select('id, name')
        .eq('client_id', currentClient.id)
        .eq('active', true)
        .order('name'),
    ]);
    setVehicles((vehiclesData ?? []).map((v: { id: string; license_plate: string; initial_km: number | null }) => ({ id: v.id, licensePlate: v.license_plate, initialKm: v.initial_km ?? null })));
    setWorkshops((workshopsData ?? []));
    setLoadingOptions(false);
  }, [currentClient?.id, isWorkshopMode]);

  useEffect(() => { void fetchOptions(); }, [fetchOptions]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let parsedValue: string | number | undefined = value;
    if (type === 'number') {
      parsedValue = value ? Number(value) : undefined;
    }
    setFormData((prev) => {
      const next = { ...prev, [name]: parsedValue };
      return next;
    });
  };

  // Carrega eventos pendentes de revisão em garantia do veículo selecionado
  useEffect(() => {
    if (isWorkshopMode || !formData.vehicleId) { setWarrantyEvents([]); return; }
    let active = true;
    listPendingEventsForVehicle(formData.vehicleId)
      .then((events) => {
        if (!active) return;
        setWarrantyEvents(events);
        // Limpa vínculo se o evento selecionado não pertence mais a este veículo
        setFormData((prev) => (
          prev.warrantyRevisionEventId && !events.some((e) => e.id === prev.warrantyRevisionEventId)
            ? { ...prev, warrantyRevisionEventId: undefined }
            : prev
        ));
      })
      .catch(() => { if (active) setWarrantyEvents([]); });
    return () => { active = false; };
  }, [formData.vehicleId, isWorkshopMode]);

  // Resolve o KM de referencia (piso) do veiculo selecionado no modo padrao
  useEffect(() => {
    if (isWorkshopMode || !formData.vehicleId) { setReferenceKm(null); return; }
    let active = true;
    const fallbackInitialKm = vehicles.find((v) => v.id === formData.vehicleId)?.initialKm ?? null;
    supabase
      .rpc('get_vehicle_max_effective_km', { p_vehicle_id: formData.vehicleId })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) { setReferenceKm(fallbackInitialKm); return; }
        const maxKm = (data as VehicleMaxKmRpcResult) ?? null;
        setReferenceKm(maxKm ?? fallbackInitialKm);
      });
    return () => { active = false; };
  }, [formData.vehicleId, isWorkshopMode, vehicles]);

  const handleBudgetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtractionWarning(null);
    try {
      validateFile(file);
    } catch (err: unknown) {
      setExtractionWarning(err instanceof Error ? err.message : 'Arquivo inválido.');
      return;
    }
    setBudgetFile(file);
    setExtracting(true);
    try {
      const result = await extractBudgetData(file);
      if (result.items.length > 0) setBudgetItems(result.items);
      if (result.workshopOs) {
        setFormData(prev => ({ ...prev, workshopOs: result.workshopOs }));
      }
      if (result.currentKm) {
        setFormData(prev => ({ ...prev, currentKm: result.currentKm }));
      }
      if (result.warnings.length > 0) {
        setExtractionWarning(result.warnings.join(' '));
      }
    } catch {
      setExtractionWarning('Falha na extração automática. Preencha os itens manualmente.');
    } finally {
      setExtracting(false);
    }
  };

  const handleClose = () => {
    if (draftKey) {
      removeUiState(window.sessionStorage, draftKey);
    }
    removeUiState(window.sessionStorage, 'maintenanceFormData');
    onClose();
  };

  const hasBudgetItemWithoutSystem = (items: BudgetItem[]): boolean => {
    return items.some(item => item.itemName.trim().length > 0 && !isKnownBudgetSystem(item.system));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasBudgetItemWithoutSystem(budgetItems)) {
      setError('Selecione o sistema dos itens do orçamento ou use Outros.');
      return;
    }
    if (isWorkshopMode) {
      // Modo Workshop: validar apenas os 5 campos obrigatórios
      if (!formData.expectedExitDate || !formData.workshopOs || !formData.mechanicName || !formData.currentKm) {
        setError('Preencha todos os campos obrigatórios: Previsão de Saída, OS da Oficina, Mecânico Responsável e Km do Veículo.');
        return;
      }
      if (!budgetFile && !existingBudgetPdfUrl) {
        setError('O upload do orçamento em PDF é obrigatório.');
        return;
      }
    } else if (!formData.vehicleId || !formData.workshopId || !formData.entryDate || !formData.type || !formData.status) {
      setError('Preencha os campos obrigatórios.');
      return;
    }
    if (!isWorkshopMode) {
      const kmValidation = validateMaintenanceCurrentKm({
        currentKm: formData.currentKm,
        referenceKm,
      });
      if (!kmValidation.ok) {
        setError(kmValidation.message);
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(formData, budgetItems, budgetFile, partPhotoDrafts);
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.');
      setSaving(false);
    }
  };

  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD em horário local

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
              <Wrench className="h-4 w-4 text-orange-600" />
            </div>
            <h2 className="text-base font-semibold text-zinc-900">
              {isWorkshopMode ? 'Preencher OS da Oficina' : order ? 'Editar OS / Orçamento' : 'Nova Manutenção'}
            </h2>
          </div>
          <button onClick={handleClose} className="rounded-lg p-1 transition-colors hover:bg-zinc-100">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loadingOptions ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          ) : (
            <form id="maintenance-form" onSubmit={(e) => { void handleSubmit(e); }} className="space-y-6">

              {isWorkshopMode ? (
                /* ── MODO WORKSHOP: apenas 5 campos obrigatórios ── */
                <>
                  {/* Info da OS (read-only) */}
                  {order && (
                    <div className="space-y-1 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                      <div><span className="font-medium">Veículo:</span> {order.licensePlate}</div>
                      <div><span className="font-medium">OS Interna:</span> <span className="font-mono">{order.os}</span></div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="expectedExitDate" required>Previsão de Saída</Label>
                      <input
                        id="expectedExitDate"
                        name="expectedExitDate"
                        type="date"
                        required
                        value={formData.expectedExitDate ?? ''}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <Label htmlFor="workshopOs" required>OS da Oficina</Label>
                      <input
                        id="workshopOs"
                        name="workshopOs"
                        type="text"
                        required
                        placeholder="Número da OS gerado pela oficina"
                        value={formData.workshopOs ?? ''}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <Label htmlFor="mechanicName" required>Mecânico Responsável</Label>
                      <input
                        id="mechanicName"
                        name="mechanicName"
                        type="text"
                        required
                        value={formData.mechanicName ?? ''}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="Nome do mecânico"
                      />
                    </div>
                    <div>
                      <Label htmlFor="currentKm" required>Km do Veículo</Label>
                      <input
                        id="currentKm"
                        name="currentKm"
                        type="number"
                        required
                        min="0"
                        step="1"
                        placeholder="Ex: 85000"
                        value={formData.currentKm ?? ''}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {/* Upload do orçamento (obrigatório para Workshop) */}
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="budgetPdf" required>PDF do Orçamento</Label>
                      <input
                        id="budgetPdf"
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(e) => { void handleBudgetUpload(e); }}
                        className="mt-1 block w-full cursor-pointer text-sm text-zinc-500 transition-colors file:mr-3 file:rounded-lg file:border-0 file:bg-orange-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-orange-600 hover:file:bg-orange-100"
                      />
                      {existingBudgetPdfUrl && !budgetFile && (
                        <a
                          href={existingBudgetPdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          <FileText className="h-3 w-3" />
                          Ver PDF atual
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {budgetFile && (
                        <p className="mt-1 text-xs text-zinc-500">
                          Arquivo selecionado: {budgetFile.name}
                        </p>
                      )}
                    </div>

                    {extractionWarning && (
                      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{extractionWarning}</span>
                      </div>
                    )}

                    <BudgetItemsTable
                      items={budgetItems}
                      onChange={setBudgetItems}
                      extracting={extracting}
                    />

                    {order?.id && user?.id && order.clientId && (
                      <PartPhotosSection
                        mode="staged"
                        canManage
                        orderId={order.id}
                        clientId={order.clientId}
                        uploadedBy={user.id}
                        drafts={partPhotoDrafts}
                        onDraftsChange={setPartPhotoDrafts}
                      />
                    )}
                  </div>
                </>
              ) : (
                /* ── MODO PADRÃO: formulário completo ── */
                <>
                  {/* Grid 2 colunas */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                        disabled={!!order}
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
                        <option value="Aguardando aprovação">Aguardando aprovação</option>
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
                        max={today}
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

                    {/* Km atual */}
                    <div>
                      <Label htmlFor="currentKm">Km Atual do Veículo</Label>
                      <input
                        id="currentKm"
                        name="currentKm"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Ex: 85000"
                        value={formData.currentKm ?? ''}
                        onChange={handleChange}
                        className={inputClass}
                      />
                      {referenceKm !== null && (
                        <p className="mt-1 text-xs text-zinc-500">
                          Último Km registrado: {referenceKm.toLocaleString('pt-BR')} km
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Vínculo: Revisão em garantia (opcional) */}
                  {warrantyEvents.length > 0 && (
                    <div>
                      <Label htmlFor="warrantyRevisionEventId">Vínculo: Revisão em garantia (opcional)</Label>
                      <select
                        id="warrantyRevisionEventId"
                        name="warrantyRevisionEventId"
                        value={formData.warrantyRevisionEventId ?? ''}
                        onChange={handleChange}
                        className={inputClass}
                      >
                        <option value="">Sem vínculo</option>
                        {warrantyEvents.map((ev) => (
                          <option key={ev.id} value={ev.id}>
                            {ev.label} — {ev.targetKm.toLocaleString('pt-BR')} km
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* OS Interna (read-only) e OS da Oficina */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label>OS Interna</Label>
                      <div className="mt-1 flex h-9 cursor-default items-center rounded-xl border border-zinc-200 bg-zinc-50 px-3 font-mono text-sm text-zinc-500 select-all">
                        {order?.os ?? 'Será gerada automaticamente'}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="workshopOs">OS da Oficina (Opcional)</Label>
                      <input
                        id="workshopOs"
                        name="workshopOs"
                        type="text"
                        placeholder="Número da OS fornecido pela oficina"
                        value={formData.workshopOs ?? ''}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {/* Upload de orçamento + tabela de itens */}
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="budgetPdf">PDF do Orçamento (Opcional)</Label>
                      <input
                        id="budgetPdf"
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(e) => { void handleBudgetUpload(e); }}
                        className="mt-1 block w-full cursor-pointer text-sm text-zinc-500 transition-colors file:mr-3 file:rounded-lg file:border-0 file:bg-orange-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-orange-600 hover:file:bg-orange-100"
                      />
                      {existingBudgetPdfUrl && !budgetFile && (
                        <a
                          href={existingBudgetPdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          <FileText className="h-3 w-3" />
                          Ver PDF atual
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {budgetFile && (
                        <p className="mt-1 text-xs text-zinc-500">
                          Arquivo selecionado: {budgetFile.name}
                        </p>
                      )}
                    </div>

                    {extractionWarning && (
                      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{extractionWarning}</span>
                      </div>
                    )}

                    <BudgetItemsTable
                      items={budgetItems}
                      onChange={setBudgetItems}
                      extracting={extracting}
                    />
                  </div>

                  {/* Mecânico Responsável */}
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
                </>
              )}

            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 rounded-b-2xl border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          {error && (
            <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="maintenance-form"
              disabled={saving || loadingOptions || extracting}
              className="flex min-w-[120px] items-center justify-center rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : isWorkshopMode ? 'Enviar Orçamento' : order ? 'Salvar Edição' : 'Criar Manutenção'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
