import type { TrailerKmMode, VehicleKmSourceSettings } from '../types/coupling';

export interface VehicleKmSourceSettingsRow {
  id: string;
  client_id: string;
  trailer_km_mode: TrailerKmMode;
  updated_at: string | null;
  updated_by: string | null;
}

export function trailerKmSettingsFromRow(row: VehicleKmSourceSettingsRow): VehicleKmSourceSettings {
  return {
    id: row.id,
    clientId: row.client_id,
    trailerKmMode: row.trailer_km_mode,
    updatedAt: row.updated_at ?? undefined,
    updatedBy: row.updated_by,
  };
}

export function trailerKmSettingsToRow(
  clientId: string,
  trailerKmMode: TrailerKmMode,
  updatedBy: string,
): Pick<VehicleKmSourceSettingsRow, 'client_id' | 'trailer_km_mode' | 'updated_by'> {
  return {
    client_id: clientId,
    trailer_km_mode: trailerKmMode,
    updated_by: updatedBy,
  };
}
