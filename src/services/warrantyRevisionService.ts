import { supabase } from '../lib/supabase';
import { buildAssignmentPayload } from '../lib/warrantyAssignmentPayload';
import { eventFromRow, planItemFromRow } from '../lib/warrantyRevisionMappers';

import type {
  WarrantyRevisionPlanItem,
  WarrantyRevisionEvent,
  AssignmentFinishReason,
} from '../types/warrantyRevision';


// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface WarrantyOverviewVehicle {
  id: string;
  licensePlate: string;
  brand: string;
  model: string;
  year: number;
  category?: string | null;
  operationalUnitId?: string | null;
  operationalUnitName?: string | null;
  shipperName?: string | null;
  acquisitionDate?: string;
  warranty: boolean;
  warrantyEndDate?: string;
  firstRevisionMaxKm?: number | null;
}

export interface WarrantyOverviewRow {
  vehicle: WarrantyOverviewVehicle;
  currentKm: number | null;
  kmInterval: number | null;
  pendingEvents: WarrantyRevisionEvent[];
  lastRevisionKm: number | null;
  activeAssignmentId: string | null;
}

export interface CreatePlanInput {
  clientId: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  modelYearFrom?: number | null;
  modelYearTo?: number | null;
  category?: string | null;
  operationalUnitId?: string | null;
  shipperId?: string | null;
  isAdhoc?: boolean;
  createdBy?: string | null;
  items: Array<{
    sequence: number;
    label: string;
    targetKm: number;
    kmTolerance?: number;
    monthsFromAcquisition?: number | null;
    daysTolerance?: number;
  }>;
}

export interface AssignOptions {
  clientId: string;
  userId: string;
  /** Threshold de KM para marcar presume_completed (fluxo por placa, veículo único). */
  presumeCompletedUpToKm?: number | null;
  /** KM atual por veículo (fluxo por modelo, lote). */
  currentKmByVehicle?: Map<string, number> | null;
  setWarrantyTrue?: boolean;
}

export interface ImportHistoryInput {
  executedKm?: number | null;
  executedDate?: string | null;
  evidenceUrl?: string | null;
}

export interface PendingEventOption {
  id: string;
  sequence: number;
  label: string;
  targetKm: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface VehicleJoinRow {
  id: string;
  license_plate: string;
  brand: string;
  model: string;
  year: number;
  category: string | null;
  acquisition_date: string | null;
  operational_unit_id: string | null;
  shipper_id: string | null;
  warranty: boolean | null;
  warranty_end_date: string | null;
  first_revision_max_km: number | null;
  operational_units?: { name: string } | null;
  shippers?: { name: string } | null;
}

function mapOverviewVehicle(row: VehicleJoinRow): WarrantyOverviewVehicle {
  return {
    id: row.id,
    licensePlate: row.license_plate,
    brand: row.brand,
    model: row.model,
    year: row.year,
    category: row.category,
    operationalUnitId: row.operational_unit_id,
    operationalUnitName: row.operational_units?.name ?? null,
    shipperName: row.shippers?.name ?? null,
    acquisitionDate: row.acquisition_date ?? undefined,
    warranty: row.warranty ?? false,
    warrantyEndDate: row.warranty_end_date ?? undefined,
    firstRevisionMaxKm: row.first_revision_max_km ?? null,
  };
}

// ─── Funções de serviço ──────────────────────────────────────────────────────

/** Mapa de KM efetivo atual (`MAX(effective_km)`) por veículo. */
export async function getVehicleCurrentKmMap(clientId: string): Promise<Map<string, number>> {
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id')
    .eq('client_id', clientId);
  const ids = (vehicles ?? []).map((v: { id: string }) => v.id);
  if (ids.length === 0) return new Map();

  return getMaxEffectiveKmForVehicles(ids);
}

async function getMaxEffectiveKmForVehicles(vehicleIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (vehicleIds.length === 0) return map;

  const rpcResult = await supabase.rpc('get_vehicle_odometer_readings_batch', {
    p_vehicle_ids: vehicleIds,
  });

  if (rpcResult.error) throw rpcResult.error;

  type KmRow = { vehicle_id: string; effective_km: number };
  for (const row of (rpcResult.data as KmRow[] | null) ?? []) {
    const current = map.get(row.vehicle_id);
    if (current == null || row.effective_km > current) {
      map.set(row.vehicle_id, row.effective_km);
    }
  }
  return map;
}

/** Visão geral de revisões de garantia por veículo do tenant. */
export async function listWarrantyOverview(clientId: string): Promise<WarrantyOverviewRow[]> {
  const { data: vehiclesData, error: vErr } = await supabase
    .from('vehicles')
    .select(
      'id, license_plate, brand, model, year, category, acquisition_date, operational_unit_id, shipper_id, warranty, warranty_end_date, first_revision_max_km, operational_units(name), shippers(name)',
    )
    .eq('client_id', clientId)
    .order('license_plate');
  if (vErr) throw vErr;

  const vehicles = (vehiclesData ?? []) as unknown as VehicleJoinRow[];
  const vehicleIds = vehicles.map((v) => v.id);

  const [kmMap, assignmentsData, intervalsData] = await Promise.all([
    getMaxEffectiveKmForVehicles(vehicleIds),
    supabase
      .from('vehicle_warranty_revision_assignments')
      .select('id, vehicle_id, plan_id')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .then(({ data, error }) => {
        if (error) throw error;
        return (data ?? []) as Array<{ id: string; vehicle_id: string; plan_id: string }>;
      }),
    supabase
      .from('vehicle_km_intervals')
      .select('vehicle_id, km_interval')
      .eq('client_id', clientId)
      .then(({ data, error }) => {
        if (error) throw error;
        return (data ?? []) as Array<{ vehicle_id: string; km_interval: number | null }>;
      }),
  ]);

  const assignmentByVehicle = new Map(assignmentsData.map((a) => [a.vehicle_id, a]));
  const assignmentIds = assignmentsData.map((a) => a.id);

  let eventsData: Array<Record<string, unknown>> = [];
  if (assignmentIds.length > 0) {
    const { data, error } = await supabase
      .from('vehicle_warranty_revision_events')
      .select('*')
      .in('assignment_id', assignmentIds);
    if (error) throw error;
    eventsData = (data ?? []) as Array<Record<string, unknown>>;
  }

  const eventsByVehicle = new Map<string, WarrantyRevisionEvent[]>();
  for (const row of eventsData) {
    const evt = eventFromRow(row as never);
    const list = eventsByVehicle.get(evt.vehicleId) ?? [];
    list.push(evt);
    eventsByVehicle.set(evt.vehicleId, list);
  }

  const intervalByVehicle = new Map<string, number | null>();
  for (const i of intervalsData) {
    intervalByVehicle.set(i.vehicle_id, i.km_interval);
  }

  return vehicles.map((row): WarrantyOverviewRow => {
    const events = eventsByVehicle.get(row.id) ?? [];
    const pendingEvents = events
      .filter((e) => e.status === 'pending')
      .sort((a, b) => a.sequence - b.sequence);
    const lastRevisionKm = events.reduce<number | null>((max, e) => {
      if (e.executedKm == null) return max;
      if (max == null || e.executedKm > max) return e.executedKm;
      return max;
    }, null);

    return {
      vehicle: mapOverviewVehicle(row),
      currentKm: kmMap.get(row.id) ?? null,
      kmInterval: intervalByVehicle.get(row.id) ?? null,
      pendingEvents,
      lastRevisionKm,
      activeAssignmentId: assignmentByVehicle.get(row.id)?.id ?? null,
    };
  });
}

export async function createPlanWithItems(input: CreatePlanInput): Promise<{ planId: string }> {
  const { data: plan, error: planErr } = await supabase
    .from('warranty_revision_plans')
    .insert({
      client_id: input.clientId,
      name: input.name,
      brand: input.brand ?? null,
      model: input.model ?? null,
      model_year_from: input.modelYearFrom ?? null,
      model_year_to: input.modelYearTo ?? null,
      category: input.category ?? null,
      operational_unit_id: input.operationalUnitId ?? null,
      shipper_id: input.shipperId ?? null,
      is_adhoc: input.isAdhoc ?? false,
      active: true,
      created_by: input.createdBy ?? null,
    })
    .select('id')
    .single();
  if (planErr) throw planErr;

  const planId = (plan as { id: string }).id;

  if (input.items.length > 0) {
    const itemRows = input.items.map((it) => ({
      plan_id: planId,
      client_id: input.clientId,
      sequence: it.sequence,
      label: it.label,
      target_km: it.targetKm,
      km_tolerance: it.kmTolerance ?? 0,
      months_from_acquisition: it.monthsFromAcquisition ?? null,
      days_tolerance: it.daysTolerance ?? 0,
    }));
    const { error: itemsErr } = await supabase
      .from('warranty_revision_plan_items')
      .insert(itemRows);
    if (itemsErr) throw itemsErr;
  }

  return { planId };
}

/** Busca os itens de um plano (usado por assignPlanToVehicles). */
async function fetchPlanItems(planId: string): Promise<WarrantyRevisionPlanItem[]> {
  const { data, error } = await supabase
    .from('warranty_revision_plan_items')
    .select('*')
    .eq('plan_id', planId)
    .order('sequence');
  if (error) throw error;
  return (data ?? []).map((row) => planItemFromRow(row as never));
}

interface VehicleAssignRow {
  id: string;
  acquisition_date: string | null;
  warranty: boolean | null;
}

/**
 * Aplica um plano a uma lista de veículos: cria assignment + materializa events
 * (snapshot de target_km e target_date). Quando há KM de referência, marca
 * presumed_completed os eventos cujo target_km <= KM atual.
 * Em caso de falha em qualquer veículo, remove o que já foi aplicado neste lote
 * e lança erro reportando os veículos não aplicados (sem estado parcial).
 */
export async function assignPlanToVehicles(
  planId: string,
  vehicleIds: string[],
  options: AssignOptions,
): Promise<void> {
  if (vehicleIds.length === 0) return;

  const items = await fetchPlanItems(planId);
  if (items.length === 0) return;

  const { data: vData, error: vErr } = await supabase
    .from('vehicles')
    .select('id, acquisition_date, warranty')
    .in('id', vehicleIds)
    .eq('client_id', options.clientId);
  if (vErr) throw vErr;
  const vehicles = (vData ?? []) as VehicleAssignRow[];

  const createdAssignments: string[] = [];

  for (const vehicle of vehicles) {
    const km =
      options.currentKmByVehicle?.get(vehicle.id) ?? options.presumeCompletedUpToKm ?? null;
    const presumeCompleted = km != null;

    const payload = buildAssignmentPayload(
      { acquisitionDate: vehicle.acquisition_date ?? undefined },
      items,
      km,
      { presumeCompleted, setWarrantyTrue: !!options.setWarrantyTrue },
    );

    const { data: assignment, error: aErr } = await supabase
      .from('vehicle_warranty_revision_assignments')
      .insert({
        client_id: options.clientId,
        vehicle_id: vehicle.id,
        plan_id: planId,
        status: 'active',
        start_km: km,
        start_date: new Date().toISOString().split('T')[0],
        created_by: options.userId,
      })
      .select('id')
      .single();
    if (aErr) {
      await rollbackAssignments(createdAssignments);
      throw new Error(`Falha ao aplicar a ${vehicleIds.length} veículos: ${aErr.message}`);
    }

    const assignmentId = (assignment as { id: string }).id;
    createdAssignments.push(assignmentId);

    const eventRows = payload.events.map((ev) => ({
      assignment_id: assignmentId,
      client_id: options.clientId,
      vehicle_id: vehicle.id,
      plan_item_id: items.find((it) => it.sequence === ev.sequence)?.id ?? null,
      sequence: ev.sequence,
      label: ev.label,
      target_km: ev.targetKm,
      target_date: ev.targetDate,
      status: ev.presumedCompleted ? 'presumed_completed' : 'pending',
    }));

    const { error: eErr } = await supabase
      .from('vehicle_warranty_revision_events')
      .insert(eventRows);
    if (eErr) {
      await rollbackAssignments(createdAssignments);
      throw new Error(`Falha ao aplicar a ${vehicleIds.length} veículos: ${eErr.message}`);
    }

    if (payload.setWarrantyTrue && vehicle.warranty !== true) {
      const { error: wErr } = await supabase
        .from('vehicles')
        .update({ warranty: true })
        .eq('id', vehicle.id);
      if (wErr) {
        await rollbackAssignments(createdAssignments);
        throw new Error(`Falha ao aplicar a ${vehicleIds.length} veículos: ${wErr.message}`);
      }
    }
  }

  const appliedIds = new Set(vehicles.map((v) => v.id));
  const notApplied = vehicleIds.filter((vid) => !appliedIds.has(vid));
  if (notApplied.length > 0) {
    await rollbackAssignments(createdAssignments);
    throw new Error(`Falha ao aplicar a ${vehicleIds.length} veículos: não encontrados (${notApplied.join(', ')}).`);
  }
}

async function rollbackAssignments(assignmentIds: string[]): Promise<void> {
  if (assignmentIds.length === 0) return;
  await supabase
    .from('vehicle_warranty_revision_assignments')
    .delete()
    .in('id', assignmentIds);
}

/** Importa o histórico de execução de uma revisão, marcando como completed. */
export async function importRevisionHistory(
  eventId: string,
  input: ImportHistoryInput,
): Promise<void> {
  const { error } = await supabase
    .from('vehicle_warranty_revision_events')
    .update({
      status: 'completed',
      executed_km: input.executedKm ?? null,
      executed_date: input.executedDate ?? null,
      evidence_url: input.evidenceUrl ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId);
  if (error) throw error;
}

/** Encerra o plano ativo de um veículo. */
export async function finishAssignment(
  assignmentId: string,
  reason: AssignmentFinishReason,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('vehicle_warranty_revision_assignments')
    .update({
      status: 'finished',
      finished_reason: reason,
      finished_by: userId,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', assignmentId);
  if (error) throw error;
}

/** Espelho não-destrutivo: só preenche/atualiza first_revision_max_km. */
export async function mirrorFirstRevisionToVehicle(
  vehicleId: string,
  firstTargetKm: number,
): Promise<void> {
  if (firstTargetKm == null || Number.isNaN(firstTargetKm)) return;
  const { error } = await supabase
    .from('vehicles')
    .update({ first_revision_max_km: firstTargetKm })
    .eq('id', vehicleId);
  if (error) throw error;
}

/** Lista os eventos pendentes de um veículo (para vínculo em OS). */
export async function listPendingEventsForVehicle(vehicleId: string): Promise<PendingEventOption[]> {
  const { data, error } = await supabase
    .from('vehicle_warranty_revision_events')
    .select('id, sequence, label, target_km')
    .eq('vehicle_id', vehicleId)
    .eq('status', 'pending')
    .order('sequence');
  if (error) throw error;
  return ((data ?? []) as Array<{ id: string; sequence: number; label: string; target_km: number }>).map(
    (r) => ({ id: r.id, sequence: r.sequence, label: r.label, targetKm: r.target_km }),
  );
}