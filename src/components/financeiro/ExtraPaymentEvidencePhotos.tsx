import { Plus, Trash2 } from 'lucide-react';
import React from 'react';

import {
  canAddMoreEvidencePhotos,
  EVIDENCE_PHOTO_LIMIT,
  remainingEvidenceSlots,
  validateEvidencePhoto,
} from '../../lib/extraPaymentEvidence';

interface ExtraPaymentEvidencePhotosProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

export default function ExtraPaymentEvidencePhotos({
  files,
  onChange,
  disabled = false,
}: ExtraPaymentEvidencePhotosProps): React.ReactElement {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = React.useState<string[]>([]);

  React.useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const selected: File[] = input.files ? Array.from(input.files) : [];
    input.value = '';
    if (selected.length === 0) return;

    setError(null);

    const valid: File[] = [];
    for (const file of selected) {
      try {
        validateEvidencePhoto(file);
        valid.push(file);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Arquivo inválido.');
      }
    }

    const slots = remainingEvidenceSlots(files.length);
    const toAdd = valid.slice(0, slots);
    const ignored = valid.length - toAdd.length;

    if (toAdd.length > 0) onChange([...files, ...toAdd]);
    if (ignored > 0) {
      setError(`Limite de ${EVIDENCE_PHOTO_LIMIT} fotos atingido; ${ignored} foto(s) ignorada(s).`);
    }
  };

  const removePhoto = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  const canAdd = canAddMoreEvidencePhotos(files.length) && !disabled;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-zinc-700">Fotos de evidência (opcional)</h4>
          <p className="text-xs text-zinc-500">{files.length}/{EVIDENCE_PHOTO_LIMIT} fotos</p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!canAdd}
          className="inline-flex items-center gap-1 rounded-lg border border-orange-300 bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Adicionar foto
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFilesSelected}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {files.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="relative rounded-xl border border-zinc-200 bg-white p-2">
              <img
                src={previewUrls[index]}
                alt={`Evidência ${index + 1}`}
                className="h-24 w-full rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(index)}
                disabled={disabled}
                className="absolute top-2 right-2 rounded-full bg-white/90 p-1.5 text-zinc-600 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
