import React, { useEffect, useMemo, useState } from 'react';
import { X, ShieldCheck, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  createPlanWithItems,
  assignPlanToVehicles,
  getVehicleCurrentKmMap,
} from '../../services/warrantyRevisionService';
import { mirrorFirstRevisionToVehicle } from '../../services/warrantyRevisionService';
import type { WarrantyRevisionPlanItem } from '../../types/warrantyRevision';

const inputClass =
  'mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 text-sm shadow-sm ' +
  'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

const labelClass = 'block text-sm font-medium text-zinc-700';

interface ItemDraft {
  sequence: number;
  label: string;
  targetKm: string;
  kmTolerance: string;
  monthsFromAcquisition: string;
  daysTolerance: string;
}

function newItem(seq: number): ItemDraft {
  return { sequence: seq, label: '', targetKm: '', kmTolerance: '0', monthsFromAcquisition: '', daysTolerance: '0' };
}

interface Props {
  prefillVehicleId?: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function WarrantyPlanByPlateModal({ prefillVehicleId, onClose, onSaved }: Props) {
  const { currentClient, user } = useAuth();
  const [vehicles, setVehicles] = useState<{ id: string; license_plate: string; brand: string; model: string; acquisition_date: string | null; warranty: boolean }[]>([]);
  const [kmMap, setKmMap] = useState<Map<string, number>>(new Map());
  const [vehicleId, setVehicleId] = useState(prefillVehicleId ?? '');
  const [name, setName] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([newItem(1)]);
  const [setWarrantyTrue, setSetWarrantyTrue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedVehicle = useMemo(() => vehicles.find((v) => v.id === vehicleId), [vehicles, vehicleId]);
  const showWarrantyCheckbox = selectedVehicle?.warranty === false;

  useEffect(() => {
    setVehicleId(prefillVehicleId ?? '');
  }, [prefillVehicleId]);

  useEffect(() => {
    if (!currentClient?.id) return;
    supabase
      .from('vehicles')
      .select('id, license_plate, brand, model, acquisition_date, warranty')
      .eq('client_id', currentClient.id)
      .order('license_plate')
      .then(({ data, error }) => {
        if (error) return;
        setVehicles((data ?? []) as typeof vehicles);
      });
    getVehicleCurrentKmMap(currentClient.id).then(setKmMap).catch(() => {});
  }, [currentClient?.id]);

  const updateItem = (idx: number, patch: Partial<ItemDraft>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const addItem = () => {
    setItems((prev) => [...prev, newItem(prev.length + 1)]);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sequence: i + 1 })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClient?.id || !user?.id) return;
    if (!vehicleId) {
      setError('Selecione um veículo.');
      return;
    }
    if (items.length === 0 || items.some((it) => !it.label || !it.targetKm)) {
      setError('Preencha label e KM alvo de todas as etapas.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const planItems: WarrantyRevisionPlanItem[] = items.map((it) => ({
        id: '',
        planId: '',
        clientId: currentClient.id,
        sequence: it.sequence,
        label: it.label,
        targetKm: Number(it.targetKm),
        kmTolerance: Number(it.kmTolerance) || 0,
        monthsFromAcquisition: it.monthsFromAcquisition ? Number(it.monthsFromAcquisition) : null,
        daysTolerance: Number(it.daysTolerance) || 0,
        createdAt: '',
      }));

      const { planId } = await createPlanWithItems({
        clientId: currentClient.id,
        name: name || `Revisão ${selectedVehicle?.license_plate ?? ''}`,
        brand: selectedVehicle?.brand,
        model: selectedVehicle?.model,
        isAdhoc: true,
        createdBy: user.id,
        items: planItems.map((it) => ({
          sequence: it.sequence,
          label: it.label,
          targetKm: it.targetKm,
          kmTolerance: it.kmTolerance,
          monthsFromAcquisition: it.monthsFromAcquisition,
          daysTolerance: it.daysTolerance,
        })),
      });

      const currentKm = kmMap.get(vehicleId) ?? null;

      await assignPlanToVehicles(planId, [vehicleId], {
        clientId: currentClient.id,
        userId: user.id,
        presumeCompletedUpToKm: currentKm,
        setWarrantyTrue,
      });

      const firstTargetKm = planItems
        .slice()
        .sort((a, b) => a.sequence - b.sequence)[0]?.targetKm;
      if (firstTargetKm != null && !Number.isNaN(firstTargetKm)) {
        await mirrorFirstRevisionToVehicle(vehicleId, firstTargetKm);
      }

      onSaved();
    } catch (err: any) {
      setError(err?.message ?? 'Falha ao salvar a programação.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
      <div className="relative flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
            </div>
            <h2 className="text-base font-semibold text-zinc-900">Cadastrar revisão por placa</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-zinc-100 transition-colors">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          <form id="warranty-plate-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="wr_vehicle">Veículo (Placa) *</label>
                <select
                  id="wr_vehicle"
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">Selecione...</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.license_plate} — {v.brand} {v.model}
                    </option>
                  ))}
                </select>
                {selectedVehicle && (
                  <p className="mt-1 text-xs text-zinc-500">
                    KM atual: {kmMap.get(selectedVehicle.id)?.toLocaleString('pt-BR') ?? 'sem leitura'}
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass} htmlFor="wr_name">Nome do plano</label>
                <input
                  id="wr_name"
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`Revisão ${selectedVehicle?.license_plate ?? ''}`}
                />
              </div>
            </div>

            {/* Etapas */}
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Etapas da revisão</h3>
              <div className="space-y-3">
                {items.map((it, idx) => {
                  const currentKm = vehicleId ? kmMap.get(vehicleId) : null;
                  const presumablyDone = currentKm != null && it.targetKm !== '' && Number(it.targetKm) <= currentKm;
                  return (
                    <div key={idx} className="rounded-xl border border-zinc-200 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-500">Etapa {it.sequence}</span>
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(idx)} className="text-zinc-400 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className={labelClass} htmlFor={`it_label_${idx}`}>Rótulo *</label>
                          <input id={`it_label_${idx}`} className={inputClass} value={it.label}
                            onChange={(e) => updateItem(idx, { label: e.target.value })} placeholder="1ª revisão" />
                        </div>
                        <div>
                          <label className={labelClass} htmlFor={`it_km_${idx}`}>KM alvo *</label>
                          <input id={`it_km_${idx}`} type="number" min="0" className={inputClass} value={it.targetKm}
                            onChange={(e) => updateItem(idx, { targetKm: e.target.value })} placeholder="10000" />
                          {presumablyDone && (
                            <p className="mt-1 text-xs text-amber-600">
                              KM atual já ultrapassa este alvo — sugerido presumed_completed.
                            </p>
                          )}
                        </div>
                        <div>
                          <label className={labelClass} htmlFor={`it_kmtol_${idx}`}>Tolerância KM</label>
                          <input id={`it_kmtol_${idx}`} type="number" min="0" className={inputClass} value={it.kmTolerance}
                            onChange={(e) => updateItem(idx, { kmTolerance: e.target.value })} />
                        </div>
                        <div>
                          <label className={labelClass} htmlFor={`it_months_${idx}`}>Meses desde a aquisição</label>
                          <input id={`it_months_${idx}`} type="number" min="0" className={inputClass} value={it.monthsFromAcquisition}
                            onChange={(e) => updateItem(idx, { monthsFromAcquisition: e.target.value })} />
                        </div>
                        <div>
                          <label className={labelClass} htmlFor={`it_daystol_${idx}`}>Tolerância dias</label>
                          <input id={`it_daystol_${idx}`} type="number" min="0" className={inputClass} value={it.daysTolerance}
                            onChange={(e) => updateItem(idx, { daysTolerance: e.target.value })} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button type="button" onClick={addItem}
                className="mt-3 inline-flex items-center rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                <Plus className="mr-2 h-4 w-4" /> Adicionar etapa
              </button>
            </div>

            {showWarrantyCheckbox && (
              <label className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <input type="checkbox" checked={setWarrantyTrue}
                  onChange={(e) => setSetWarrantyTrue(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-600" />
                <span className="text-sm text-zinc-700">Marcar veículo como em garantia</span>
              </label>
            )}
          </form>
        </div>

        <div className="flex-shrink-0 border-t border-zinc-200 px-6 py-4 bg-zinc-50 rounded-b-2xl">
          {error && (
            <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              Cancelar
            </button>
            <button type="submit" form="warranty-plate-form" disabled={saving}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Salvando...' : 'Salvar programação'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}