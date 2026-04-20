import React, { useState, useEffect } from 'react';
import { X, Camera, CheckCircle, XCircle } from 'lucide-react';
import CameraCapture from './CameraCapture';
import { stampTimestampOnImage } from '../lib/stampTimestampOnImage';
import type { TireInspectionResponse, TireInspectionResponseStatus } from '../types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TireInspectionFormProps {
  positionCode: string;
  positionLabel: string;
  tireId?: string;
  tireCode?: string;
  manufacturers: string[];
  brands: string[];
  existing?: TireInspectionResponse;
  onSave: (data: Omit<TireInspectionResponse, 'id'>, photoBlob?: Blob) => Promise<void>;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TireInspectionForm({
  positionCode,
  positionLabel,
  tireId,
  tireCode,
  manufacturers,
  brands,
  existing,
  onSave,
  onClose,
}: TireInspectionFormProps) {
  const [dot, setDot] = useState(existing?.dot ?? '');
  const [fireMarking, setFireMarking] = useState(existing?.fireMarking ?? '');
  const [manufacturer, setManufacturer] = useState(existing?.manufacturer ?? '');
  const [brand, setBrand] = useState(existing?.brand ?? '');
  const [status, setStatus] = useState<TireInspectionResponseStatus>(existing?.status ?? 'conforme');
  const [observation, setObservation] = useState(existing?.observation ?? '');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>(existing?.photoUrl ?? '');
  const [showCamera, setShowCamera] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const hasPhoto = !!photoPreview;
  const canSave = manufacturer && brand && hasPhoto;

  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  async function handleCapture(file: File) {
    const stamped = await stampTimestampOnImage(file, file.name);
    const url = URL.createObjectURL(stamped);
    setPhotoFile(stamped);
    setPhotoBlob(stamped);
    setPhotoPreview(url);
    setShowCamera(false);
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      const data: Omit<TireInspectionResponse, 'id'> = {
        inspectionId: '',  // preenchido pelo chamador
        tireId,
        positionCode,
        positionLabel,
        dot: dot || undefined,
        fireMarking: fireMarking || undefined,
        manufacturer,
        brand,
        photoUrl: existing?.photoUrl ?? '',
        photoTimestamp: new Date().toISOString(),
        status,
        observation: observation || undefined,
        respondedAt: new Date().toISOString(),
      };
      await onSave(data, photoBlob ?? undefined);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  if (showCamera) {
    return (
      <CameraCapture
        onCapture={handleCapture}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-xl max-h-[90vh] overflow-y-auto">
        <Header positionCode={positionCode} positionLabel={positionLabel} tireCode={tireCode} onClose={onClose} />

        <div className="p-4 space-y-4">
          {/* Campos opcionais */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="DOT (opcional)">
              <input
                type="text"
                value={dot}
                onChange={e => setDot(e.target.value)}
                className="input-field"
                placeholder="ex: 1524"
              />
            </Field>
            <Field label="Marcação de Fogo (opcional)">
              <input
                type="text"
                value={fireMarking}
                onChange={e => setFireMarking(e.target.value)}
                className="input-field"
                placeholder="ex: MF001"
              />
            </Field>
          </div>

          {/* Fabricante */}
          <Field label="Fabricante *">
            <select
              value={manufacturer}
              onChange={e => setManufacturer(e.target.value)}
              className="input-field"
            >
              <option value="">Selecione...</option>
              {manufacturers.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </Field>

          {/* Marca */}
          <Field label="Marca *">
            <select
              value={brand}
              onChange={e => setBrand(e.target.value)}
              className="input-field"
            >
              <option value="">Selecione...</option>
              {brands.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </Field>

          {/* Foto */}
          <Field label="Foto *">
            {photoPreview ? (
              <div className="relative">
                <img src={photoPreview} alt="Foto do pneu" className="w-full rounded-lg object-cover max-h-48" />
                <button
                  type="button"
                  onClick={() => setShowCamera(true)}
                  className="absolute bottom-2 right-2 bg-white rounded-full p-1 shadow text-sm"
                >
                  Refazer
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="flex items-center gap-2 w-full justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
              >
                <Camera size={20} />
                <span>Tirar foto</span>
              </button>
            )}
          </Field>

          {/* Status */}
          <Field label="Status *">
            <div className="flex gap-3">
              <StatusButton
                active={status === 'conforme'}
                onClick={() => setStatus('conforme')}
                icon={<CheckCircle size={18} />}
                label="Conforme"
                color="green"
              />
              <StatusButton
                active={status === 'nao_conforme'}
                onClick={() => setStatus('nao_conforme')}
                icon={<XCircle size={18} />}
                label="Não Conforme"
                color="red"
              />
            </div>
          </Field>

          {/* Observação */}
          <Field label="Observação (opcional)">
            <textarea
              value={observation}
              onChange={e => setObservation(e.target.value)}
              rows={3}
              className="input-field resize-none"
              placeholder="Descreva anomalias ou observações..."
            />
          </Field>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Salvar */}
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className="w-full py-3 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Header({ positionCode, positionLabel, tireCode, onClose }: {
  positionCode: string;
  positionLabel: string;
  tireCode?: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 border-b">
      <div>
        <p className="font-semibold text-gray-900">{positionLabel}</p>
        <p className="text-sm text-gray-500">
          {positionCode}{tireCode ? ` — ${tireCode}` : ''}
        </p>
      </div>
      <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
        <X size={20} />
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function StatusButton({ active, onClick, icon, label, color }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  color: 'green' | 'red';
}) {
  const colorMap = {
    green: active ? 'bg-green-100 border-green-500 text-green-700' : 'border-gray-200 text-gray-500',
    red: active ? 'bg-red-100 border-red-500 text-red-700' : 'border-gray-200 text-gray-500',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-2 border-2 rounded-lg font-medium transition-colors ${colorMap[color]}`}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  );
}
