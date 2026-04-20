import { supabase } from '../lib/supabase';
import type { Driver } from '../types/driver';
import { driverToRow } from '../lib/driverMappers';
import { invokeEdgeFunction } from '../lib/invokeEdgeFn';
import {
  uploadDriverDocument,
  deleteDriverDocument,
} from '../lib/storageHelpers';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type DriverDocType = 'cnh' | 'gr' | 'certificate-1' | 'certificate-2' | 'certificate-3';

export interface DriverFiles {
  cnh: File | null;
  gr: File | null;
  certificate1: File | null;
  certificate2: File | null;
  certificate3: File | null;
}

type DriverDocKey = keyof Omit<DriverFiles, never>;

const DOC_FIELD_MAP: Record<DriverDocKey, keyof Driver> = {
  cnh: 'cnhUpload',
  gr: 'grUpload',
  certificate1: 'certificate1Upload',
  certificate2: 'certificate2Upload',
  certificate3: 'certificate3Upload',
};

const DB_COLUMN_MAP: Record<DriverDocKey, string> = {
  cnh: 'cnh_upload',
  gr: 'gr_upload',
  certificate1: 'certificate1_upload',
  certificate2: 'certificate2_upload',
  certificate3: 'certificate3_upload',
};

const STORAGE_TYPE_MAP: Record<DriverDocKey, DriverDocType> = {
  cnh: 'cnh',
  gr: 'gr',
  certificate1: 'certificate-1',
  certificate2: 'certificate-2',
  certificate3: 'certificate-3',
};

// ─── Funções de serviço ──────────────────────────────────────────────────────

/**
 * Cria ou atualiza um motorista e faz upload de documentos.
 * Centraliza a lógica que antes estava em handleSave de Drivers.tsx.
 */
export async function saveDriver(
  clientId: string,
  driver: Partial<Driver>,
  files: DriverFiles,
  editingId?: string,
): Promise<string> {
  const row = driverToRow(driver, clientId);

  let savedId = editingId;

  if (editingId) {
    const { error } = await supabase
      .from('drivers')
      .update(row)
      .eq('id', editingId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from('drivers')
      .insert(row)
      .select('id')
      .single();
    if (error) throw error;
    savedId = data.id;
  }

  if (savedId) {
    await uploadDriverFiles(clientId, savedId, driver, files);
  }

  return savedId;
}

/**
 * Deleta um motorista, seus documentos e sua conta de usuário (se existir).
 */
export async function deleteDriver(
  driver: Driver,
): Promise<void> {
  // Deleta documentos do Storage
  await deleteAllDriverDocuments(driver);

  // Deleta registro na tabela drivers
  const { error } = await supabase
    .from('drivers')
    .delete()
    .eq('id', driver.id);
  if (error) throw error;

  // Deleta conta de usuário associada (profile + auth.users)
  if (driver.profileId) {
    await invokeEdgeFunction('create-user', { action: 'delete', user_id: driver.profileId });
  }
}

// ─── Helpers internos ────────────────────────────────────────────────────────

async function uploadDriverFiles(
  clientId: string,
  driverId: string,
  driver: Partial<Driver>,
  files: DriverFiles,
): Promise<void> {
  const urlUpdates: Record<string, string> = {};

  for (const key of Object.keys(files) as DriverDocKey[]) {
    const file = files[key];
    if (!file) continue;

    const existingUrl = driver[DOC_FIELD_MAP[key]] as string | undefined;
    if (existingUrl) {
      await deleteDriverDocument(existingUrl);
    }

    urlUpdates[DB_COLUMN_MAP[key]] = await uploadDriverDocument(
      clientId,
      driverId,
      file,
      STORAGE_TYPE_MAP[key],
    );
  }

  if (Object.keys(urlUpdates).length > 0) {
    const { error } = await supabase
      .from('drivers')
      .update(urlUpdates)
      .eq('id', driverId);
    if (error) throw error;
  }
}

async function deleteAllDriverDocuments(driver: Driver): Promise<void> {
  const deletions: (string | undefined)[] = [
    driver.cnhUpload,
    driver.grUpload,
    driver.certificate1Upload,
    driver.certificate2Upload,
    driver.certificate3Upload,
  ];

  await Promise.all(
    deletions.filter((url): url is string => !!url).map(deleteDriverDocument),
  );
}
