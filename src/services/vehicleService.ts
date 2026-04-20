import { supabase } from '../lib/supabase';
import type { Vehicle } from '../types/vehicle';
import { vehicleToRow } from '../lib/vehicleMappers';
import {
  uploadVehicleDocument,
  deleteVehicleDocument,
} from '../lib/storageHelpers';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type VehicleDocType = 'crlv' | 'sanitary-inspection' | 'gr' | 'insurance-policy' | 'maintenance-contract';

export interface VehicleFiles {
  crlv: File | null;
  sanitaryInspection: File | null;
  gr: File | null;
  insurancePolicy: File | null;
  maintenanceContract: File | null;
}

export type VehicleDocKey = keyof Omit<VehicleFiles, never>;

const DOC_FIELD_MAP: Record<VehicleDocKey, keyof Vehicle> = {
  crlv: 'crlvUpload',
  sanitaryInspection: 'sanitaryInspectionUpload',
  gr: 'grUpload',
  insurancePolicy: 'insurancePolicyUpload',
  maintenanceContract: 'maintenanceContractUpload',
};

const DB_COLUMN_MAP: Record<VehicleDocKey, string> = {
  crlv: 'crlv_upload',
  sanitaryInspection: 'sanitary_inspection_upload',
  gr: 'gr_upload',
  insurancePolicy: 'insurance_policy_upload',
  maintenanceContract: 'maintenance_contract_upload',
};

const STORAGE_TYPE_MAP: Record<VehicleDocKey, VehicleDocType> = {
  crlv: 'crlv',
  sanitaryInspection: 'sanitary-inspection',
  gr: 'gr',
  insurancePolicy: 'insurance-policy',
  maintenanceContract: 'maintenance-contract',
};

// ─── Funções de serviço ──────────────────────────────────────────────────────

/**
 * Cria ou atualiza um veículo e faz upload de documentos.
 * Centraliza a lógica que antes estava no mutationFn de Vehicles.tsx.
 */
export async function saveVehicle(
  clientId: string,
  vehicle: Partial<Vehicle>,
  files: VehicleFiles,
  editingId?: string,
): Promise<string> {
  const row = vehicleToRow(vehicle, clientId);

  let savedId = editingId;

  if (editingId) {
    const { error } = await supabase
      .from('vehicles')
      .update(row)
      .eq('id', editingId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from('vehicles')
      .insert(row)
      .select('id')
      .single();
    if (error) throw error;
    savedId = data.id;
  }

  if (savedId) {
    await uploadVehicleFiles(clientId, savedId, vehicle, files);
  }

  return savedId;
}

/**
 * Deleta um veículo e todos os seus documentos no Storage.
 */
export async function deleteVehicle(vehicle: Vehicle): Promise<void> {
  // Deleta documentos do Storage
  await deleteAllVehicleDocuments(vehicle);

  const { error } = await supabase
    .from('vehicles')
    .delete()
    .eq('id', vehicle.id);
  if (error) throw error;
}

// ─── Helpers internos ────────────────────────────────────────────────────────

async function uploadVehicleFiles(
  clientId: string,
  vehicleId: string,
  vehicle: Partial<Vehicle>,
  files: VehicleFiles,
): Promise<void> {
  const urlUpdates: Record<string, string> = {};

  for (const key of Object.keys(files) as VehicleDocKey[]) {
    const file = files[key];
    if (!file) continue;

    const existingUrl = vehicle[DOC_FIELD_MAP[key]] as string | undefined;
    if (existingUrl) {
      await deleteVehicleDocument(existingUrl);
    }

    urlUpdates[DB_COLUMN_MAP[key]] = await uploadVehicleDocument(
      clientId,
      vehicleId,
      file,
      STORAGE_TYPE_MAP[key],
    );
  }

  if (Object.keys(urlUpdates).length > 0) {
    const { error } = await supabase
      .from('vehicles')
      .update(urlUpdates)
      .eq('id', vehicleId);
    if (error) throw error;
  }
}

async function deleteAllVehicleDocuments(vehicle: Vehicle): Promise<void> {
  const deletions: (string | undefined)[] = [
    vehicle.crlvUpload,
    vehicle.sanitaryInspectionUpload,
    vehicle.grUpload,
    vehicle.insurancePolicyUpload,
    vehicle.maintenanceContractUpload,
  ];

  await Promise.all(
    deletions.filter((url): url is string => !!url).map(deleteVehicleDocument),
  );
}
