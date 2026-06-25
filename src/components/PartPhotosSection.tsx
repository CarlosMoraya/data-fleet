import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Loader2, Trash2, Upload } from 'lucide-react';
import React from 'react';

import { canAddMorePartPhotos, PART_PHOTO_LIMIT, remainingPartPhotoSlots } from '../lib/maintenanceWorkshop';
import { stampTimestampOnImage } from '../lib/stampTimestampOnImage';
import {
  addPartPhoto,
  deletePartPhoto,
  listPartPhotos,
  type PartPhotoDraft,
} from '../services/maintenancePartPhotoService';

import CameraCapture from './CameraCapture';

import type { MaintenancePartPhoto, PartPhotoType } from '../types/maintenance';

interface PartPhotosSectionProps {
  orderId: string;
  clientId: string;
  uploadedBy: string;
  mode: 'staged' | 'immediate';
  canManage: boolean;
  drafts?: PartPhotoDraft[];
  onDraftsChange?: (drafts: PartPhotoDraft[]) => void;
}

interface PhotoThumbProps {
  caption?: string;
  onCaptionChange?: (caption: string) => void;
  onRemove?: () => void;
  removable?: boolean;
  src: string;
}

interface PhotoTypeGroupProps {
  canAdd: boolean;
  canManage: boolean;
  captionValue: string;
  count: number;
  isUploading: boolean;
  mode: 'staged' | 'immediate';
  onAdd: () => void;
  onCaptionInputChange: (value: string) => void;
  photos: React.ReactNode[];
  showCaptionInput: boolean;
  title: string;
  type: PartPhotoType;
}

function PhotoThumb({ caption, onCaptionChange, onRemove, removable, src }: PhotoThumbProps) {
  return (
    <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-2">
      <div className="relative">
        <img src={src} alt="Foto da peça" className="h-32 w-full rounded-lg object-cover" />
        {removable && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-2 right-2 rounded-full bg-white/90 p-1.5 text-zinc-600 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      {onCaptionChange ? (
        <input
          type="text"
          value={caption ?? ''}
          onChange={(event) => onCaptionChange(event.target.value)}
          placeholder="Legenda opcional"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
        />
      ) : (
        <p className="min-h-5 text-sm text-zinc-600">{caption?.trim() || 'Sem legenda'}</p>
      )}
    </div>
  );
}

function PhotoTypeGroup({
  canAdd,
  canManage,
  captionValue,
  count,
  isUploading,
  mode,
  onAdd,
  onCaptionInputChange,
  photos,
  showCaptionInput,
  title,
}: PhotoTypeGroupProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-zinc-900">{title}</h4>
          <p className="text-xs text-zinc-500">{count}/{PART_PHOTO_LIMIT} fotos</p>
        </div>
        {canManage && (
          <div className="flex flex-col gap-2 sm:items-end">
            {showCaptionInput && (
              <input
                type="text"
                value={captionValue}
                onChange={(event) => onCaptionInputChange(event.target.value)}
                placeholder="Legenda opcional"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none sm:w-56"
              />
            )}
            <button
              type="button"
              onClick={onAdd}
              disabled={!canAdd || isUploading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'immediate' ? <Upload className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              Adicionar foto
            </button>
          </div>
        )}
      </div>
      {photos.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{photos}</div>
      ) : (
        <p className="text-sm text-zinc-500">Nenhuma foto cadastrada.</p>
      )}
    </div>
  );
}

export default function PartPhotosSection({
  orderId,
  clientId,
  uploadedBy,
  mode,
  canManage,
  drafts = [],
  onDraftsChange,
}: PartPhotosSectionProps) {
  const queryClient = useQueryClient();
  const [cameraType, setCameraType] = React.useState<PartPhotoType | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [uploadingType, setUploadingType] = React.useState<PartPhotoType | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [pickType, setPickType] = React.useState<PartPhotoType | null>(null);
  const [captionInputs, setCaptionInputs] = React.useState<Record<PartPhotoType, string>>({
    broken: '',
    new: '',
  });
  const [draftPreviewUrls, setDraftPreviewUrls] = React.useState<Record<string, string>>({});

  const { data: persistedPhotos = [] } = useQuery({
    queryKey: ['partPhotos', orderId],
    queryFn: () => listPartPhotos(orderId),
  });

  React.useEffect(() => {
    if (mode !== 'staged') return;

    setDraftPreviewUrls((current) => {
      const next: Record<string, string> = {};

      drafts.forEach((draft, index) => {
        const key = `${draft.type}-${draft.takenAt}-${index}`;
        next[key] = current[key] ?? URL.createObjectURL(draft.file);
      });

      Object.entries(current).forEach(([key, url]) => {
        if (!next[key]) URL.revokeObjectURL(url as string);
      });

      return next;
    });
  }, [drafts, mode]);

  React.useEffect(() => {
    return () => {
      setDraftPreviewUrls((current) => {
        Object.values(current).forEach((url) => URL.revokeObjectURL(url as string));
        return {};
      });
    };
  }, []);

  const setCaptionInput = React.useCallback((type: PartPhotoType, value: string) => {
    setCaptionInputs((current) => ({ ...current, [type]: value }));
  }, []);

  const openFilePicker = React.useCallback((type: PartPhotoType) => {
    setPickType(type);
    fileInputRef.current?.click();
  }, []);

  const updateDraftCaption = React.useCallback((targetIndex: number, caption: string) => {
    if (!onDraftsChange) return;
    onDraftsChange(drafts.map((draft, index) => (index === targetIndex ? { ...draft, caption } : draft)));
  }, [drafts, onDraftsChange]);

  const removeDraft = React.useCallback((targetIndex: number) => {
    if (!onDraftsChange) return;
    onDraftsChange(drafts.filter((_, index) => index !== targetIndex));
  }, [drafts, onDraftsChange]);

  const removePersisted = React.useCallback(async (photo: MaintenancePartPhoto) => {
    if (!window.confirm('Remover esta foto da peça?')) return;
    setError(null);
    try {
      await deletePartPhoto({ id: photo.id, url: photo.url });
      await queryClient.invalidateQueries({ queryKey: ['partPhotos', orderId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sem permissão para esta ação nesta OS');
    }
  }, [orderId, queryClient]);

  const handleCapture = React.useCallback(async (file: File) => {
    if (!cameraType) return;

    setError(null);

    try {
      const stamped = await stampTimestampOnImage(file, file.name);
      const takenAt = new Date().toISOString();

      if (mode === 'staged') {
        if (!onDraftsChange) return;
        onDraftsChange([
          ...drafts,
          { type: cameraType, file: stamped, caption: '', takenAt },
        ]);
      } else {
        setUploadingType(cameraType);
        await addPartPhoto({
          orderId,
          clientId,
          type: cameraType,
          file: stamped,
          caption: captionInputs[cameraType],
          takenAt,
          uploadedBy,
        });
        setCaptionInputs((current) => ({ ...current, [cameraType]: '' }));
        await queryClient.invalidateQueries({ queryKey: ['partPhotos', orderId] });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sem permissão para esta ação nesta OS');
    } finally {
      setUploadingType(null);
      setCameraType(null);
    }
  }, [cameraType, captionInputs, clientId, drafts, mode, onDraftsChange, orderId, queryClient, uploadedBy]);

  const handleFilesSelected = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const type = pickType;
    const input = event.target;
    const files: File[] = input.files ? Array.from(input.files) : [];
    input.value = '';
    setPickType(null);
    if (!type || files.length === 0) return;

    const currentCount = persistedPhotos.filter((photo) => photo.type === type).length;
    const slots = remainingPartPhotoSlots(currentCount);
    if (slots === 0) {
      setError(`Limite de ${PART_PHOTO_LIMIT} fotos atingido para este tipo.`);
      return;
    }

    const toUpload = files.slice(0, slots);
    const ignored = files.length - toUpload.length;
    setError(null);
    setUploadingType(type);
    const caption = captionInputs[type];

    try {
      for (const file of toUpload) {
        await addPartPhoto({
          orderId,
          clientId,
          type,
          file,
          caption,
          takenAt: new Date().toISOString(),
          uploadedBy,
        });
      }
      setCaptionInputs((current) => ({ ...current, [type]: '' }));
      await queryClient.invalidateQueries({ queryKey: ['partPhotos', orderId] });
      if (ignored > 0) {
        setError(`Limite de ${PART_PHOTO_LIMIT} fotos atingido; ${ignored} foto(s) ignorada(s).`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sem permissão para esta ação nesta OS');
    } finally {
      setUploadingType(null);
    }
  }, [captionInputs, clientId, orderId, persistedPhotos, pickType, queryClient, uploadedBy]);

  const renderTypeGroup = React.useCallback((type: PartPhotoType, title: string) => {
    const persisted = persistedPhotos.filter((photo) => photo.type === type);
    const stagedDrafts = drafts
      .map((draft, index) => ({ draft, index }))
      .filter(({ draft }) => draft.type === type);
    const totalCount = persisted.length + stagedDrafts.length;
    const canAdd = canAddMorePartPhotos(totalCount);
    const photoNodes: React.ReactNode[] = [
      ...persisted.map((photo) => (
        <React.Fragment key={photo.id}>
          <PhotoThumb
            src={photo.url}
            caption={photo.caption}
            removable={mode === 'immediate' && canManage}
            onRemove={mode === 'immediate' && canManage ? () => void removePersisted(photo) : undefined}
          />
        </React.Fragment>
      )),
      ...stagedDrafts.map(({ draft, index }) => {
        const key = `${draft.type}-${draft.takenAt}-${index}`;
        return (
          <React.Fragment key={key}>
            <PhotoThumb
              src={draftPreviewUrls[key] ?? ''}
              caption={draft.caption}
              removable={canManage}
              onRemove={canManage ? () => removeDraft(index) : undefined}
              onCaptionChange={canManage ? (caption) => updateDraftCaption(index, caption) : undefined}
            />
          </React.Fragment>
        );
      }),
    ];

    return (
      <PhotoTypeGroup
        title={title}
        type={type}
        count={totalCount}
        photos={photoNodes}
        canManage={canManage}
        canAdd={canAdd}
        captionValue={captionInputs[type]}
        mode={mode}
        showCaptionInput={mode === 'immediate'}
        onCaptionInputChange={(value) => setCaptionInput(type, value)}
        onAdd={() => (mode === 'staged' ? setCameraType(type) : openFilePicker(type))}
        isUploading={uploadingType === type}
      />
    );
  }, [canManage, captionInputs, draftPreviewUrls, drafts, mode, openFilePicker, persistedPhotos, removeDraft, removePersisted, setCaptionInput, updateDraftCaption, uploadingType]);

  if (cameraType) {
    return <CameraCapture onCapture={handleCapture} onClose={() => setCameraType(null)} />;
  }

  return (
    <section className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => void handleFilesSelected(event)}
      />
      <div>
        <h3 className="text-sm font-semibold tracking-wide text-zinc-600 uppercase">Fotos das Peças</h3>
        <p className="mt-1 text-sm text-zinc-500">Separe as evidências entre peças quebradas e peças novas.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {renderTypeGroup('broken', 'Peças Substituidas')}
        {renderTypeGroup('new', 'Peças Novas')}
      </div>
    </section>
  );
}
