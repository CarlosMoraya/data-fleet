import { supabase } from '../lib/supabase';
import type { Tire } from '../types/tire';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface SaveTirePayload {
  tireData: Partial<Tire> | Partial<Tire>[];
  profileId: string;
  currentClientId: string;
  previousPosition?: string;
  odometerKm?: number;
}

export interface ToggleTirePayload {
  tire: Tire;
  profileId: string;
}

// ─── Funções de serviço ──────────────────────────────────────────────────────

/**
 * Cria ou atualiza um pneu (individual ou em lote).
 * Centraliza a lógica que estava no mutationFn de Tires.tsx.
 */
export async function saveTire(payload: SaveTirePayload): Promise<void> {
  const { tireData, profileId, currentClientId, previousPosition, odometerKm } = payload;

  if (Array.isArray(tireData)) {
    await saveTireBatch(tireData, profileId, currentClientId, odometerKm);
    return;
  }

  await saveTireIndividual(tireData, profileId, currentClientId, previousPosition, odometerKm);
}

/**
 * Alterna o estado ativo/inativo de um pneu.
 */
export async function toggleTireActive(payload: ToggleTirePayload): Promise<void> {
  const { tire, profileId } = payload;
  const { error } = await supabase
    .from('tires')
    .update({ active: !tire.active, updated_by: profileId })
    .eq('id', tire.id);
  if (error) throw error;
}

/**
 * Deleta um pneu (o histórico é removido por CASCADE).
 */
export async function deleteTire(id: string): Promise<void> {
  const { error } = await supabase
    .from('tires')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ─── Helpers internos ────────────────────────────────────────────────────────

async function saveTireBatch(
  tireData: Partial<Tire>[],
  profileId: string,
  currentClientId: string,
  odometerKm?: number,
): Promise<void> {
  const rows = tireData.map(t => ({
    client_id: currentClientId,
    vehicle_id: t.vehicleId,
    tire_code: t.tireCode,
    specification: t.specification,
    dot: t.dot ?? null,
    fire_marking: t.fireMarking ?? null,
    manufacturer: t.manufacturer ?? null,
    brand: t.brand ?? null,
    rotation_interval_km: t.rotationIntervalKm ?? null,
    useful_life_km: t.usefulLifeKm ?? null,
    retread_interval_km: t.retreadIntervalKm ?? null,
    visual_classification: t.visualClassification,
    current_position: t.currentPosition,
    last_position: null,
    position_type: t.positionType,
    active: true,
    created_by: profileId,
  }));

  const { data: inserted, error } = await supabase
    .from('tires')
    .insert(rows)
    .select('id, vehicle_id, current_position');
  if (error) throw error;

  if (inserted && inserted.length > 0) {
    const historyRows = (inserted as any[]).map(t => ({
      client_id: currentClientId,
      tire_id: t.id,
      vehicle_id: t.vehicle_id,
      previous_position: null,
      new_position: t.current_position,
      moved_by: profileId,
      moved_at: new Date().toISOString(),
      odometer_km: odometerKm ?? null,
    }));

    for (let i = 0; i < historyRows.length; i += 100) {
      const { error: histErr } = await supabase
        .from('tire_position_history')
        .insert(historyRows.slice(i, i + 100));
      if (histErr) throw histErr;
    }
  }
}

async function saveTireIndividual(
  tireData: Partial<Tire>,
  profileId: string,
  currentClientId: string,
  previousPosition?: string,
  odometerKm?: number,
): Promise<void> {
  const payload: Record<string, unknown> = {
    client_id: currentClientId,
    vehicle_id: tireData.vehicleId,
    tire_code: tireData.tireCode,
    specification: tireData.specification,
    dot: tireData.dot ?? null,
    fire_marking: tireData.fireMarking ?? null,
    manufacturer: tireData.manufacturer ?? null,
    brand: tireData.brand ?? null,
    rotation_interval_km: tireData.rotationIntervalKm ?? null,
    useful_life_km: tireData.usefulLifeKm ?? null,
    retread_interval_km: tireData.retreadIntervalKm ?? null,
    visual_classification: tireData.visualClassification,
    current_position: tireData.currentPosition,
    last_position: tireData.lastPosition ?? null,
    position_type: tireData.positionType,
    active: tireData.active ?? true,
  };

  let tireId = tireData.id;

  if (tireId) {
    payload.updated_by = profileId;
    const { error } = await supabase
      .from('tires')
      .update(payload)
      .eq('id', tireId);
    if (error) throw error;
  } else {
    payload.created_by = profileId;
    const { data, error } = await supabase
      .from('tires')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw error;
    tireId = data.id;
  }

  // Registrar histórico se a posição mudou
  const positionChanged = !tireData.id || previousPosition !== tireData.currentPosition;
  if (positionChanged && tireId && tireData.currentPosition) {
    const { error } = await supabase
      .from('tire_position_history')
      .insert({
        client_id: currentClientId,
        tire_id: tireId,
        vehicle_id: tireData.vehicleId,
        previous_position: previousPosition ?? null,
        new_position: tireData.currentPosition,
        moved_by: profileId,
        moved_at: new Date().toISOString(),
        odometer_km: odometerKm ?? null,
      });
    if (error) throw error;
  }
}
