import { partPhotoFromRow } from '../lib/maintenanceMappers';
import { uploadMaintenancePartPhoto } from '../lib/storageHelpers';
import { supabase } from '../lib/supabase';

import type { MaintenancePartPhoto, MaintenancePartPhotoRow, PartPhotoType } from '../types/maintenance';

export interface PartPhotoDraft {
  type: PartPhotoType;
  file: File;
  caption?: string;
  takenAt: string;
}

export async function listPartPhotos(orderId: string): Promise<MaintenancePartPhoto[]> {
  const { data, error } = await supabase
    .from('maintenance_part_photos')
    .select('*')
    .eq('maintenance_order_id', orderId)
    .order('created_at');
  if (error) throw error;
  return ((data ?? []) as MaintenancePartPhotoRow[]).map(partPhotoFromRow);
}

export async function addPartPhoto(params: {
  orderId: string;
  clientId: string;
  type: PartPhotoType;
  file: File;
  caption?: string;
  takenAt: string;
  uploadedBy: string;
}): Promise<MaintenancePartPhoto> {
  const url = await uploadMaintenancePartPhoto(params.clientId, params.orderId, params.file);
  const insertResult = await supabase
    .from('maintenance_part_photos')
    .insert({
      maintenance_order_id: params.orderId,
      client_id: params.clientId,
      type: params.type,
      url,
      caption: params.caption ?? null,
      taken_at: params.takenAt,
      uploaded_by: params.uploadedBy,
    })
    .select()
    .single();
  if (insertResult.error) throw insertResult.error;
  return partPhotoFromRow(insertResult.data as MaintenancePartPhotoRow);
}

export async function deletePartPhoto(photo: { id: string; url: string }): Promise<void> {
  const marker = '/vehicle-documents/';
  const idx = photo.url.indexOf(marker);

  if (idx !== -1) {
    const path = photo.url.slice(idx + marker.length);
    const { error: storageError } = await supabase.storage.from('vehicle-documents').remove([path]);
    if (storageError) {
      console.warn('Aviso: não foi possível deletar a foto da peça do Storage.', storageError.message);
    }
  }

  const { error } = await supabase.from('maintenance_part_photos').delete().eq('id', photo.id);
  if (error) throw error;
}

export async function savePendingPartPhotos(params: {
  orderId: string;
  clientId: string;
  uploadedBy: string;
  drafts: PartPhotoDraft[];
}): Promise<void> {
  if (params.drafts.length === 0) return;

  for (const draft of params.drafts) {
    await addPartPhoto({
      orderId: params.orderId,
      clientId: params.clientId,
      type: draft.type,
      file: draft.file,
      caption: draft.caption,
      takenAt: draft.takenAt,
      uploadedBy: params.uploadedBy,
    });
  }
}
