import { X, Upload, Loader2 } from 'lucide-react';
import React, { useState } from 'react';

import { supabase } from '../../lib/supabase';
import { importRevisionHistory } from '../../services/warrantyRevisionService';

const inputClass =
  'mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 text-sm shadow-sm ' +
  'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

const labelClass = 'block text-sm font-medium text-zinc-700';

const BUCKET = 'vehicle-documents';
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

interface Props {
  eventId: string;
  vehicleId: string;
  clientId: string;
  label?: string;
  onClose: () => void;
  onSaved: () => void;
}

/** Comprime imagem para 1920px / 82% JPEG (regra existente do projeto). */
async function prepareImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1920;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) {
          height = Math.round((height * MAX) / width);
          width = MAX;
        } else {
          width = Math.round((width * MAX) / height);
          height = MAX;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(file);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(new File([blob], file.name, { type: 'image/jpeg' })) : resolve(file)),
        'image/jpeg',
        0.82,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível processar a imagem.'));
    };
    img.src = url;
  });
}

function validateEvidence(file: File): void {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Formato não suportado. Envie um PDF, JPG ou PNG.');
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('Arquivo muito grande. O limite é 10MB.');
  }
}

async function uploadEvidence(clientId: string, vehicleId: string, eventId: string, file: File): Promise<string> {
  const prepared = file.type.startsWith('image/') ? await prepareImage(file) : file;
  validateEvidence(file); // valida o tipo REAL do arquivo recebido (não só a extensão)
  const ext = prepared.type === 'application/pdf' ? 'pdf' : 'jpg';
  const path = `${clientId}/warranty-revisions/${vehicleId}/${eventId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, prepared, { upsert: true, contentType: prepared.type });
  if (error) throw new Error(`Erro ao enviar comprovante: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export default function WarrantyImportHistoryModal({ eventId, vehicleId, clientId, label, onClose, onSaved }: Props) {
  const [executedKm, setExecutedKm] = useState('');
  const [executedDate, setExecutedDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    let evidenceUrl: string | null = null;
    try {
      if (file) {
        validateEvidence(file);
        evidenceUrl = await uploadEvidence(clientId, vehicleId, eventId, file);
      }
      await importRevisionHistory(eventId, {
        executedKm: executedKm ? Number(executedKm) : null,
        executedDate: executedDate || null,
        evidenceUrl,
      });
      onSaved();
    } catch (err: unknown) {
      // Em falha de Storage, o evento permanece pending/presumed (não marcamos completed)
      setError(err instanceof Error ? err.message : 'Falha ao importar histórico.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-900">
            Importar histórico de revisão
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 transition-colors hover:bg-zinc-100">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        {label && (
          <p className="px-6 pt-4 text-sm text-zinc-500">{label}</p>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          <form id="warranty-import-form" onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="imp_km">KM executado</label>
                <input id="imp_km" type="number" min="0" className={inputClass} value={executedKm}
                  onChange={(e) => setExecutedKm(e.target.value)} placeholder="Ex: 10200" />
              </div>
              <div>
                <label className={labelClass} htmlFor="imp_date">Data de execução</label>
                <input id="imp_date" type="date" className={inputClass} value={executedDate}
                  onChange={(e) => setExecutedDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="imp_file">Comprovante (PDF, JPG ou PNG)</label>
              <input id="imp_file" type="file" accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-sm text-zinc-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-600 hover:file:bg-blue-100" />
              {file && <p className="mt-1 text-xs text-zinc-500">{file.name}</p>}
            </div>
          </form>
        </div>

        <div className="flex-shrink-0 rounded-b-2xl border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          {error && (
            <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              Cancelar
            </button>
            <button type="submit" form="warranty-import-form" disabled={saving}
              className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {saving ? 'Importando...' : 'Importar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
