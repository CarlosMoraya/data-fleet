import { X, LayoutTemplate, Plus, Trash2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { buildAssignmentPayload } from '../../lib/warrantyAssignmentPayload';
import { filterEligibleVehicles } from '../../lib/warrantyRevisionEligibility';
import { formatKm } from '../../lib/warrantyRevisionStatusBadge';
import {
  createPlanWithItems,
  assignPlanToVehicles,
  getVehicleCurrentKmMap,
 mirrorFirstRevisionToVehicle } from '../../services/warrantyRevisionService';

import type { Vehicle } from '../../types';
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
  onClose: () => void;
  onSaved: () => void;
}

export default function WarrantyPlanByModelModal({ onClose, onSaved }: Props) {
  const { currentClient, user } = useAuth();
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [category, setCategory] = useState('');
  const [operationalUnitId, setOperationalUnitId] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([newItem(1)]);
  const [setWarrantyTrue, setSetWarrantyTrue] = useState(false);
  const [applyPresumed, setApplyPresumed] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeVehicleIds, setActiveVehicleIds] = useState<Set<string>>(new Set());
  const [kmMap, setKmMap] = useState<Map<string, number>>(new Map());
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentClient?.id) return;
    supabase
      .from('vehicles')
      .select('id, license_plate, brand, model, year, category, operational_unit_id, acquisition_date, warranty')
      .eq('client_id', currentClient.id)
      .order('license_plate')
      .then(({ data, error: e }) => {
        if (e) return;
        setVehicles((data ?? []));
      });
    supabase
      .from('vehicle_warranty_revision_assignments')
      .select('vehicle_id')
      .eq('client_id', currentClient.id)
      .eq('status', 'active')
      .then(({ data, error: e }) => {
        if (e) return;
        setActiveVehicleIds(new Set((data ?? []).map((r: { vehicle_id: string }) => r.vehicle_id)));
      });
    supabase
      .from('operational_units')
      .select('id, name')
      .eq('client_id', currentClient.id)
      .eq('active', true)
      .order('name')
      .then(({ data, error: e }) => {
        if (e) return;
        setUnits((data ?? []));
      });
    getVehicleCurrentKmMap(currentClient.id).then(setKmMap).catch(() => {});
  }, [currentClient?.id]);

  const planItemsPreview: WarrantyRevisionPlanItem[] = useMemo(
    () =>
      items.map((it) => ({
        id: '',
        planId: '',
        clientId: currentClient?.id ?? '',
        sequence: it.sequence,
        label: it.label,
        targetKm: Number(it.targetKm) || 0,
        kmTolerance: Number(it.kmTolerance) || 0,
        monthsFromAcquisition: it.monthsFromAcquisition ? Number(it.monthsFromAcquisition) : null,
        daysTolerance: Number(it.daysTolerance) || 0,
        createdAt: '',
      })),
    [items, currentClient?.id],
  );

  const eligible = useMemo(() => {
    return filterEligibleVehicles(vehicles, {
      brand: brand || undefined,
      model: model || undefined,
      yearFrom: yearFrom ? Number(yearFrom) : undefined,
      yearTo: yearTo ? Number(yearTo) : undefined,
      category: category || undefined,
      operationalUnitId: operationalUnitId || undefined,
    }, activeVehicleIds, kmMap);
  }, [vehicles, brand, model, yearFrom, yearTo, category, operationalUnitId, activeVehicleIds, kmMap]);

  const presumedCountByVehicle = useMemo(() => {
    const map = new Map<string, number>();
    if (!applyPresumed) return map;
    for (const v of eligible) {
      const km = kmMap.get(v.id) ?? null;
      if (km == null) continue;
      const payload = buildAssignmentPayload(
        { acquisitionDate: v.acquisitionDate },
        planItemsPreview,
        km,
        { presumeCompleted: true, setWarrantyTrue: false },
      );
      map.set(v.id, payload.events.filter((e) => e.presumedCompleted).length);
    }
    return map;
  }, [applyPresumed, eligible, kmMap, planItemsPreview]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === eligible.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(eligible.map((v) => v.id)));
    }
  };

  const handleApply = async () => {
    if (!currentClient?.id || !user?.id) return;
    if (selected.size === 0) {
      setError('Selecione ao menos um veículo.');
      return;
    }
    if (items.length === 0 || items.some((it) => !it.label || !it.targetKm)) {
      setError('Preencha label e KM alvo de todas as etapas.');
      return;
    }
    if (!window.confirm(`Aplicar a programação a ${selected.size} veículo(s)?`)) return;
    setSaving(true);
    setError(null);
    try {
      const { planId } = await createPlanWithItems({
        clientId: currentClient.id,
        name: name || `${brand} ${model}`.trim() || 'Plano de revisão',
        brand: brand || null,
        model: model || null,
        modelYearFrom: yearFrom ? Number(yearFrom) : null,
        modelYearTo: yearTo ? Number(yearTo) : null,
        category: category || null,
        operationalUnitId: operationalUnitId || null,
        isAdhoc: false,
        createdBy: user.id,
        items: planItemsPreview.map((it) => ({
          sequence: it.sequence,
          label: it.label,
          targetKm: it.targetKm,
          kmTolerance: it.kmTolerance,
          monthsFromAcquisition: it.monthsFromAcquisition,
          daysTolerance: it.daysTolerance,
        })),
      });

      const vehicleIds = [...selected];
      await assignPlanToVehicles(planId, vehicleIds, {
        clientId: currentClient.id,
        userId: user.id,
        currentKmByVehicle: applyPresumed ? kmMap : null,
        setWarrantyTrue,
      });

      // Espelho da 1ª etapa para cada veículo selecionado (não-destrutivo)
      const firstTargetKm = planItemsPreview
        .slice()
        .sort((a, b) => a.sequence - b.sequence)[0]?.targetKm;
      if (firstTargetKm != null && !Number.isNaN(firstTargetKm)) {
        await Promise.all(
          vehicleIds.map((vid) => mirrorFirstRevisionToVehicle(vid, firstTargetKm)),
        );
      }

      onSaved();
    } catch (err: any) {
      setError(err?.message ?? 'Falha ao aplicar a programação.');
    } finally {
      setSaving(false);
    }
  };

  const updateItem = (idx: number, patch: Partial<ItemDraft>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const addItem = () => setItems((prev) => [...prev, newItem(prev.length + 1)]);
  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sequence: i + 1 })));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
              <LayoutTemplate className="h-4 w-4 text-blue-600" />
            </div>
            <h2 className="text-base font-semibold text-zinc-900">Cadastrar revisão por modelo</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 transition-colors hover:bg-zinc-100">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* Critérios do plano */}
          <div>
            <h3 className="mb-3 text-sm font-semibold tracking-wider text-zinc-500 uppercase">Critérios do plano</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className={labelClass} htmlFor="m_name">Nome do plano</label>
                <input id="m_name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className={labelClass} htmlFor="m_brand">Marca</label>
                <input id="m_brand" className={inputClass} value={brand} onChange={(e) => setBrand(e.target.value)} />
              </div>
              <div>
                <label className={labelClass} htmlFor="m_model">Modelo</label>
                <input id="m_model" className={inputClass} value={model} onChange={(e) => setModel(e.target.value)} />
              </div>
              <div>
                <label className={labelClass} htmlFor="m_yearfrom">Ano de</label>
                <input id="m_yearfrom" type="number" className={inputClass} value={yearFrom} onChange={(e) => setYearFrom(e.target.value)} />
              </div>
              <div>
                <label className={labelClass} htmlFor="m_yearto">Ano até</label>
                <input id="m_yearto" type="number" className={inputClass} value={yearTo} onChange={(e) => setYearTo(e.target.value)} />
              </div>
              <div>
                <label className={labelClass} htmlFor="m_cat">Categoria</label>
                <select id="m_cat" className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Todas</option>
                  <option value="Leve">Leve</option>
                  <option value="Médio">Médio</option>
                  <option value="Pesado">Pesado</option>
                  <option value="Elétrico">Elétrico</option>
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className={labelClass} htmlFor="m_unit">Unidade operacional</label>
                <select id="m_unit" className={inputClass} value={operationalUnitId} onChange={(e) => setOperationalUnitId(e.target.value)}>
                  <option value="">Todas</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Etapas */}
          <div>
            <h3 className="mb-3 text-sm font-semibold tracking-wider text-zinc-500 uppercase">Etapas da revisão</h3>
            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={idx} className="rounded-xl border border-zinc-200 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-500">Etapa {it.sequence}</span>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} className="text-zinc-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className={labelClass} htmlFor={`m_lbl_${idx}`}>Rótulo *</label>
                      <input id={`m_lbl_${idx}`} className={inputClass} value={it.label} onChange={(e) => updateItem(idx, { label: e.target.value })} placeholder="1ª revisão" />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor={`m_km_${idx}`}>KM alvo *</label>
                      <input id={`m_km_${idx}`} type="number" min="0" className={inputClass} value={it.targetKm} onChange={(e) => updateItem(idx, { targetKm: e.target.value })} placeholder="10000" />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor={`m_months_${idx}`}>Meses desde aquisição</label>
                      <input id={`m_months_${idx}`} type="number" min="0" className={inputClass} value={it.monthsFromAcquisition} onChange={(e) => updateItem(idx, { monthsFromAcquisition: e.target.value })} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addItem} className="mt-3 inline-flex items-center rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              <Plus className="mr-2 h-4 w-4" /> Adicionar etapa
            </button>
          </div>

          {/* Prévia de elegibilidade */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-wider text-zinc-500 uppercase">
                Elegíveis ({eligible.length})
              </h3>
              {eligible.length > 0 && (
                <label className="flex items-center gap-2 text-sm text-zinc-600">
                  <input type="checkbox" checked={selected.size === eligible.length && eligible.length > 0} onChange={toggleAll} className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-600" />
                  Selecionar todos
                </label>
              )}
            </div>
            {eligible.length === 0 ? (
              <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                Nenhum veículo elegível para os critérios informados.
              </p>
            ) : (
              <div className="max-h-64 overflow-auto rounded-xl border border-zinc-200">
                <table className="min-w-full divide-y divide-zinc-200">
                  <thead className="sticky top-0 bg-zinc-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500"></th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500">Placa</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500">Modelo</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-zinc-500">KM atual</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500">Garantia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    {eligible.map((v) => {
                      const km = kmMap.get(v.id) ?? null;
                      const presumed = presumedCountByVehicle.get(v.id) ?? 0;
                      return (
                        <tr key={v.id} className="hover:bg-zinc-50">
                          <td className="px-3 py-2">
                            <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggle(v.id)} className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-600" />
                          </td>
                          <td className="px-3 py-2 text-sm font-medium text-zinc-900">{v.licensePlate}</td>
                          <td className="px-3 py-2 text-sm text-zinc-700">{v.brand} {v.model}</td>
                          <td className="px-3 py-2 text-right text-sm text-zinc-500">{formatKm(km)}</td>
                          <td className="px-3 py-2 text-sm">
                            {v.warranty ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">Em garantia</span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">Sem garantia (ajuste)</span>
                            )}
                            {presumed > 0 && (
                              <span className="ml-2 text-xs text-zinc-500">{presumed} etapa(s) presumivelmente concluídas</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Opções de lote */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <input type="checkbox" checked={setWarrantyTrue} onChange={(e) => setSetWarrantyTrue(e.target.checked)} className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-600" />
              <span className="text-sm text-zinc-700">Marcar como em garantia ao aplicar (somente veículos sem garantia)</span>
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <input type="checkbox" checked={applyPresumed} onChange={(e) => setApplyPresumed(e.target.checked)} className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-600" />
              <span className="text-sm text-zinc-700">Marcar etapas já vencidas pelo KM como presumivelmente concluídas</span>
            </label>
          </div>
        </div>

        <div className="flex-shrink-0 rounded-b-2xl border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          {error && (
            <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              Cancelar
            </button>
            <button type="button" onClick={handleApply} disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Aplicando...' : `Aplicar a ${selected.size} veículo(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}