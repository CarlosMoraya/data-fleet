import { offlineDb, type VehicleDraftFileEntry } from './offlineDb';

export type VehicleDraftFileKey =
  | 'crlv' | 'sanitaryInspection' | 'gr' | 'insurancePolicy' | 'maintenanceContract';

type StoredDraftFile = {
  buffer: ArrayBuffer;
  name: string;
  type: string;
  lastModified: number;
};

export async function saveVehicleDraftFile(key: VehicleDraftFileKey, file: File): Promise<void> {
  const storedFile: StoredDraftFile = {
    buffer: await file.arrayBuffer(),
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
  };
  await offlineDb.vehicleDraftFiles.put({ key, file: storedFile as unknown as File, savedAt: Date.now() } as VehicleDraftFileEntry);
}

export async function removeVehicleDraftFile(key: VehicleDraftFileKey): Promise<void> {
  await offlineDb.vehicleDraftFiles.delete(key);
}

export async function loadVehicleDraftFiles(): Promise<Partial<Record<VehicleDraftFileKey, File>>> {
  const rows = await offlineDb.vehicleDraftFiles.toArray();
  const out: Partial<Record<VehicleDraftFileKey, File>> = {};
  for (const row of rows) {
    const file = row.file;
    if (file instanceof File) {
      out[row.key as VehicleDraftFileKey] = file;
      continue;
    }
    const storedFile = file as unknown as StoredDraftFile | undefined;
    if (!storedFile?.buffer || !storedFile.name) continue;
    out[row.key as VehicleDraftFileKey] = new File(
      [storedFile.buffer],
      storedFile.name,
      {
        type: storedFile.type,
        lastModified: storedFile.lastModified,
      }
    );
  }
  return out;
}

export async function clearVehicleDraftFiles(): Promise<void> {
  await offlineDb.vehicleDraftFiles.clear();
}
