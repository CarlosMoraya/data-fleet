import { Loader2, X, ChevronRight, ChevronLeft, AlertTriangle, CheckCircle2 } from 'lucide-react';
import React from 'react';

import { supabase } from '../lib/supabase';
import { generatePositions, generatePositionsFromConfig } from '../lib/tirePositions';
import { cn } from '../lib/utils';
import { safeRandomUUID } from '../lib/uuid';
import { TireVisualClassification, VehicleTireConfig, AxleConfigEntry } from '../types';

import type { TirePosition } from '../lib/tirePositions';

interface TireBatchFormProps {
  clientId: string;
  userId: string;
  tireConfigs: VehicleTireConfig[];
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 1 | 2 | 3 | 4;

interface VehicleSimple {
  id: string;
  licensePlate: string;
  brand: string;
  model: string;
  type: string;
  eixos?: number;
  axleConfig?: AxleConfigEntry[];
  stepsCount?: number;
}

interface TireTemplate {
  specification: string;
  dot: string;
  fireMarking: string;
  manufacturer: string;
  brand: string;
  rotationIntervalKm: string;
  usefulLifeKm: string;
  retreadIntervalKm: string;
  visualClassification: TireVisualClassification;
}

const VISUAL_CLASSIFICATIONS: TireVisualClassification[] = ['Novo', 'Meia vida', 'Troca'];

const EMPTY_TEMPLATE: TireTemplate = {
  specification: '',
  dot: '',
  fireMarking: '',
  manufacturer: '',
  brand: '',
  rotationIntervalKm: '',
  usefulLifeKm: '',
  retreadIntervalKm: '',
  visualClassification: 'Novo',
};

export default function TireBatchForm({
  clientId,
  userId,
  tireConfigs,
  onClose,
  onSuccess,
}: TireBatchFormProps) {
  const [step, setStep] = React.useState<Step>(1);
  const [selectedModel, setSelectedModel] = React.useState('');
  const [models, setModels] = React.useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = React.useState(false);
  const [eligibleVehicles, setEligibleVehicles] = React.useState<VehicleSimple[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = React.useState(false);
  const [template, setTemplate] = React.useState<TireTemplate>(EMPTY_TEMPLATE);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [axleDivergenceError, setAxleDivergenceError] = React.useState(false);

  // Step 1: carregar modelos distintos
  React.useEffect(() => {
    if (!clientId) return;
    setModelsLoading(true);
    supabase
      .from('vehicles')
      .select('model')
      .eq('client_id', clientId)
      .order('model')
      .then(({ data }) => {
        const unique = [...new Set((data as Array<{ model: string }> ?? []).map((v) => v.model))].sort();
        setModels(unique);
        setModelsLoading(false);
      });
  }, [clientId]);

  const getConfigForType = React.useCallback(
    (vehicleType: string): VehicleTireConfig | undefined => tireConfigs.find(c => c.vehicleType === vehicleType),
    [tireConfigs],
  );

  const getPositionSignature = React.useCallback((v: VehicleSimple): string => {
    if (v.axleConfig && v.axleConfig.length > 0) {
      return JSON.stringify(generatePositionsFromConfig(v.axleConfig, v.stepsCount ?? 0, v.type).map(p => p.code));
    }
    const config = getConfigForType(v.type);
    if (!config) return '[]';
    return JSON.stringify(generatePositions(v.eixos ?? config.defaultAxles, config.dualAxles, config.defaultSpareCount, v.type).map(p => p.code));
  }, [getConfigForType]);

  const countTiresForVehicle = React.useCallback((v: VehicleSimple): number => {
    if (v.axleConfig && v.axleConfig.length > 0) {
      return generatePositionsFromConfig(v.axleConfig, v.stepsCount ?? 0, v.type).length;
    }
    const config = getConfigForType(v.type);
    if (!config) return 0;
    const axleCount = v.eixos ?? config.defaultAxles;
    const positions = generatePositions(axleCount, config.dualAxles, config.defaultSpareCount, v.type);
    return positions.length;
  }, [getConfigForType]);

  // Step 2: carregar veículos elegíveis do modelo selecionado
  React.useEffect(() => {
    if (step !== 2 || !selectedModel) return;
    setVehiclesLoading(true);
    supabase
      .from('vehicles')
      .select('id, license_plate, brand, model, type, eixos, axle_config, steps_count')
      .eq('client_id', clientId)
      .eq('model', selectedModel)
      .order('license_plate')
      .then(async ({ data: vehicles }) => {
        if (!vehicles || vehicles.length === 0) {
          setEligibleVehicles([]);
          setVehiclesLoading(false);
          return;
        }

        // Veículos que já têm qualquer pneu cadastrado (ativo ou inativo)
        type VehicleQueryRow = { id: string; license_plate: string; brand: string | null; model: string; type: string; eixos: number | null; axle_config: AxleConfigEntry[] | null; steps_count: number | null };
        const typedVehicles = (vehicles as VehicleQueryRow[]);
        const vIds = typedVehicles.map((v) => v.id);
        const { data: existingTires } = await supabase
          .from('tires')
          .select('vehicle_id')
          .eq('client_id', clientId)
          .in('vehicle_id', vIds);

        const vehiclesWithTires = new Set((existingTires as Array<{ vehicle_id: string }> ?? []).map((t) => t.vehicle_id));
        const eligible = typedVehicles
          .filter(v => !vehiclesWithTires.has(v.id))
          .map(v => ({
            id: v.id,
            licensePlate: v.license_plate,
            brand: v.brand ?? '',
            model: v.model,
            type: v.type,
            eixos: v.eixos ?? undefined,
            axleConfig: v.axle_config ?? undefined,
            stepsCount: v.steps_count ?? undefined,
          }));

        // Verifica divergência de configuração de eixos entre veículos elegíveis
        const signatures = new Set(eligible.map(getPositionSignature));
        setAxleDivergenceError(eligible.length > 1 && signatures.size > 1);

        setEligibleVehicles(eligible);
        setVehiclesLoading(false);
      });
  }, [step, selectedModel, clientId, getPositionSignature]);

  const totalTires = React.useMemo(
    () => eligibleVehicles.reduce((acc, v) => acc + countTiresForVehicle(v), 0),
    [eligibleVehicles, countTiresForVehicle],
  );

  async function handleConfirm() {
    if (!template.specification.trim()) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      const rows: Record<string, unknown>[] = [];

      for (const vehicle of eligibleVehicles) {
        let positions: TirePosition[];
        if (vehicle.axleConfig && vehicle.axleConfig.length > 0) {
          positions = generatePositionsFromConfig(vehicle.axleConfig, vehicle.stepsCount ?? 0, vehicle.type);
        } else {
          const config = getConfigForType(vehicle.type);
          if (!config) continue;
          const axleCount = vehicle.eixos ?? config.defaultAxles;
          positions = generatePositions(axleCount, config.dualAxles, config.defaultSpareCount, vehicle.type);
        }

        for (const pos of positions) {
          rows.push({
            client_id: clientId,
            vehicle_id: vehicle.id,
            tire_code: safeRandomUUID(),
            specification: template.specification.trim(),
            dot: template.dot.trim() || null,
            fire_marking: template.fireMarking.trim() || null,
            manufacturer: template.manufacturer.trim() || null,
            brand: template.brand.trim() || null,
            rotation_interval_km: template.rotationIntervalKm ? parseInt(template.rotationIntervalKm) : null,
            useful_life_km: template.usefulLifeKm ? parseInt(template.usefulLifeKm) : null,
            retread_interval_km: template.retreadIntervalKm ? parseInt(template.retreadIntervalKm) : null,
            visual_classification: template.visualClassification,
            current_position: pos.code,
            position_type: pos.type,
            active: true,
            created_by: userId,
          });
        }
      }

      if (rows.length === 0) throw new Error('Nenhum pneu para inserir.');

      // Inserir em lotes de 100
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await supabase.from('tires').insert(rows.slice(i, i + 100));
        if (error) throw error;
      }

      // Registrar histórico inicial
      const { data: inserted } = await supabase
        .from('tires')
        .select('id, vehicle_id, current_position')
        .eq('client_id', clientId)
        .in('vehicle_id', eligibleVehicles.map(v => v.id))
        .eq('active', true);

      if (inserted && inserted.length > 0) {
        type InsertedTire = { id: string; vehicle_id: string; current_position: string | null };
        const historyRows = (inserted as InsertedTire[]).map(t => ({
          client_id: clientId,
          tire_id: t.id,
          vehicle_id: t.vehicle_id,
          previous_position: null,
          new_position: t.current_position,
          moved_by: userId,
          moved_at: new Date().toISOString(),
        }));
        // Inserir em lotes
        for (let i = 0; i < historyRows.length; i += 100) {
          await supabase.from('tire_position_history').insert(historyRows.slice(i, i + 100));
        }
      }

      setSaveSuccess(true);
      setTimeout(() => onSuccess(), 1500);
    } catch (err: unknown) {
      setSaveError((err as { message?: string })?.message ?? 'Erro ao cadastrar pneus em lote.');
    } finally {
      setIsSaving(false);
    }
  }

  function updateTemplate(field: keyof TireTemplate, value: string) {
    setTemplate(prev => ({ ...prev, [field]: value }));
  }

  // ── Render steps ──────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Cadastro em Lote</h2>
            <p className="text-sm text-zinc-400">Passo {step} de 4</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {/* Step 1: Selecionar modelo */}
          {step === 1 && (
            <div>
              <h3 className="mb-1 font-medium text-zinc-900">Selecionar Modelo</h3>
              <p className="mb-4 text-sm text-zinc-500">Escolha o modelo de veículo para cadastro em lote.</p>
              {modelsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
                </div>
              ) : models.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-400">Nenhum veículo cadastrado.</p>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {models.map(m => (
                    <button
                      key={m}
                      onClick={() => setSelectedModel(m)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors',
                        selectedModel === m
                          ? 'border-orange-400 bg-orange-50 font-medium text-orange-700'
                          : 'border-zinc-200 hover:border-zinc-300',
                      )}
                    >
                      <span>{m}</span>
                      {selectedModel === m && <CheckCircle2 className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Veículos elegíveis */}
          {step === 2 && (
            <div>
              <h3 className="mb-1 font-medium text-zinc-900">Veículos Elegíveis — {selectedModel}</h3>
              <p className="mb-4 text-sm text-zinc-500">
                Veículos do modelo selecionado que ainda não possuem nenhum pneu cadastrado.
              </p>
              {vehiclesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
                </div>
              ) : axleDivergenceError ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <AlertTriangle className="h-8 w-8 text-amber-400" />
                  <p className="text-sm font-medium text-zinc-600">Configuração de eixos divergente</p>
                  <p className="max-w-xs text-xs text-zinc-500">
                    Este modelo de veículo possui uma ou mais unidades com divergência na configuração dos eixos. Verifique qual está divergente e edite para que todos os veículos do mesmo modelo tenham a mesma configuração.
                  </p>
                </div>
              ) : eligibleVehicles.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <AlertTriangle className="h-8 w-8 text-yellow-400" />
                  <p className="text-sm font-medium text-zinc-600">Nenhum veículo elegível</p>
                  <p className="text-xs text-zinc-400">
                    Todos os veículos do modelo <strong>{selectedModel}</strong> já possuem pneus cadastrados.
                  </p>
                </div>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {eligibleVehicles.map(v => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3"
                    >
                      <div>
                        <span className="font-medium text-zinc-900">{v.licensePlate}</span>
                        <span className="ml-2 text-sm text-zinc-500">{v.brand}</span>
                      </div>
                      <span className="text-xs text-zinc-400">{countTiresForVehicle(v)} pneus</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Template de pneu */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="mb-1 font-medium text-zinc-900">Template do Pneu</h3>
                <p className="text-sm text-zinc-500">
                  Esses dados serão aplicados a todos os pneus gerados. Cada pneu receberá um código único gerado automaticamente.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Especificação *</label>
                <input
                  value={template.specification}
                  onChange={e => updateTemplate('specification', e.target.value)}
                  placeholder="ex: 295/80R22.5"
                  required
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">DOT</label>
                  <input
                    value={template.dot}
                    onChange={e => updateTemplate('dot', e.target.value)}
                    placeholder="ex: 2524"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Marcação de Fogo</label>
                  <input
                    value={template.fireMarking}
                    onChange={e => updateTemplate('fireMarking', e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Fabricante</label>
                  <input
                    value={template.manufacturer}
                    onChange={e => updateTemplate('manufacturer', e.target.value)}
                    placeholder="ex: Bridgestone"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Marca</label>
                  <input
                    value={template.brand}
                    onChange={e => updateTemplate('brand', e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Rodízio (km)</label>
                  <input
                    type="number"
                    min="0"
                    value={template.rotationIntervalKm}
                    onChange={e => updateTemplate('rotationIntervalKm', e.target.value)}
                    placeholder="20000"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Vida Útil (km)</label>
                  <input
                    type="number"
                    min="0"
                    value={template.usefulLifeKm}
                    onChange={e => updateTemplate('usefulLifeKm', e.target.value)}
                    placeholder="120000"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Recapagem (km)</label>
                  <input
                    type="number"
                    min="0"
                    value={template.retreadIntervalKm}
                    onChange={e => updateTemplate('retreadIntervalKm', e.target.value)}
                    placeholder="60000"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Classificação Visual</label>
                <select
                  value={template.visualClassification}
                  onChange={e => updateTemplate('visualClassification', e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                >
                  {VISUAL_CLASSIFICATIONS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Step 4: Confirmação */}
          {step === 4 && (
            <div>
              <h3 className="mb-1 font-medium text-zinc-900">Confirmar Cadastro em Lote</h3>
              <p className="mb-4 text-sm text-zinc-500">
                Revise o resumo antes de confirmar.
              </p>

              {saveSuccess ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                  <p className="font-medium text-zinc-900">Cadastro concluído!</p>
                  <p className="text-sm text-zinc-500">
                    {totalTires} pneus cadastrados para {eligibleVehicles.length} veículos.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Resumo */}
                  <div className="space-y-2 rounded-xl bg-zinc-50 p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Modelo</span>
                      <span className="font-medium text-zinc-900">{selectedModel}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Veículos elegíveis</span>
                      <span className="font-medium text-zinc-900">{eligibleVehicles.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Total de pneus</span>
                      <span className="font-semibold text-orange-600">{totalTires}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Especificação</span>
                      <span className="font-mono font-medium text-zinc-900">{template.specification}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Classificação</span>
                      <span className="font-medium text-zinc-900">{template.visualClassification}</span>
                    </div>
                  </div>

                  {/* Lista de veículos */}
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {eligibleVehicles.map(v => (
                      <div key={v.id} className="flex items-center justify-between border-b border-zinc-50 py-1.5 text-sm last:border-0">
                        <span className="font-mono text-zinc-700">{v.licensePlate}</span>
                        <span className="text-zinc-400">{countTiresForVehicle(v)} pneus</span>
                      </div>
                    ))}
                  </div>

                  {saveError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {saveError}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!saveSuccess && (
          <div className="flex shrink-0 items-center justify-between border-t border-zinc-100 px-6 py-4">
            <button
              onClick={() => step === 1 ? onClose() : setStep(s => (s - 1) as Step)}
              className="flex items-center gap-1 rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800"
            >
              {step === 1 ? 'Cancelar' : <><ChevronLeft className="h-4 w-4" /> Voltar</>}
            </button>

            {step < 4 ? (
              <button
                onClick={() => setStep(s => (s + 1) as Step)}
                disabled={
                  (step === 1 && !selectedModel) ||
                  (step === 2 && (eligibleVehicles.length === 0 || axleDivergenceError)) ||
                  (step === 3 && !template.specification.trim())
                }
                className="flex items-center gap-1 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Próximo <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => { void handleConfirm(); }}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar Cadastro em Lote
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
