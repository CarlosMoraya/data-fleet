import { Camera, PenLine, User, AlertCircle } from 'lucide-react';
import React, { useState } from 'react';

import CameraCapture from './CameraCapture';
import SignaturePad from './SignaturePad';
import { stampTimestampOnImage } from '../lib/stampTimestampOnImage';
import { uploadChecklistPhoto } from '../lib/checklistStorageHelpers';

interface Props {
  clientId: string;
  checklistId: string;
  driverName?: string;
  cnhPhotoUrl?: string;
  signatureUrl?: string;
  onCnhPhotoUploaded: (url: string) => void;
  onSignatureUploaded: (url: string) => void;
}

export default function HandoverEvidenceSection({
  clientId,
  checklistId,
  driverName,
  cnhPhotoUrl,
  signatureUrl,
  onCnhPhotoUploaded,
  onSignatureUploaded,
}: Props) {
  const [cnhCameraOpen, setCnhCameraOpen] = useState(false);
  const [signaturePadOpen, setSignaturePadOpen] = useState(false);
  const [cnhUploading, setCnhUploading] = useState(false);
  const [signatureUploading, setSignatureUploading] = useState(false);
  const [cnhError, setCnhError] = useState<string | null>(null);
  const [signatureError, setSignatureError] = useState<string | null>(null);

  const handleCnhCapture = async (file: File, latitude?: number, longitude?: number) => {
    setCnhCameraOpen(false);
    setCnhError(null);
    setCnhUploading(true);
    try {
      const stamped = await stampTimestampOnImage(
        file,
        file.name,
        latitude != null && longitude != null ? { latitude, longitude } : undefined,
      );
      const url = await uploadChecklistPhoto(clientId, checklistId, 'cnh', stamped);
      onCnhPhotoUploaded(url);
    } catch (err) {
      console.error('CNH photo upload error:', err);
      setCnhError('Não foi possível enviar a foto. Verifique a conexão e tente novamente.');
    } finally {
      setCnhUploading(false);
    }
  };

  const handleSignatureConfirm = async (file: File) => {
    setSignaturePadOpen(false);
    setSignatureError(null);
    setSignatureUploading(true);
    try {
      const url = await uploadChecklistPhoto(clientId, checklistId, 'signature', file);
      onSignatureUploaded(url);
    } catch (err) {
      console.error('Signature upload error:', err);
      setSignatureError('Não foi possível enviar a assinatura. Tente novamente.');
    } finally {
      setSignatureUploading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-zinc-700">Evidências de Entrega/Devolução</h3>

      {/* Motorista */}
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 flex-shrink-0 text-zinc-400" />
        {driverName ? (
          <span className="text-sm text-zinc-700">
            Motorista: <strong>{driverName}</strong>
          </span>
        ) : (
          <span className="text-sm font-medium text-red-600">Motorista não informado</span>
        )}
      </div>

      {/* Foto da CNH */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-zinc-500">Foto do motorista com a CNH</p>
        {cnhPhotoUrl ? (
          <img src={cnhPhotoUrl} alt="foto da CNH" className="h-16 w-16 rounded-lg object-cover" />
        ) : (
          <>
            <button
              type="button"
              onClick={() => setCnhCameraOpen(true)}
              disabled={cnhUploading}
              className="flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
              {cnhUploading ? 'Enviando...' : 'Tirar foto'}
            </button>
            <p className="text-xs text-zinc-500">
              Obrigatório. A foto deve ser tirada agora pela câmera — envio de arquivo não é permitido.
            </p>
          </>
        )}
        {cnhError && (
          <p className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3 w-3 flex-shrink-0" />
            {cnhError}
          </p>
        )}
      </div>

      {/* Assinatura */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-zinc-500">Assinatura do motorista</p>
        {signatureUrl ? (
          <img src={signatureUrl} alt="assinatura do motorista" className="h-16 w-16 rounded-lg border border-zinc-200 object-cover" />
        ) : (
          <button
            type="button"
            onClick={() => setSignaturePadOpen(true)}
            disabled={signatureUploading}
            className="flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
          >
            <PenLine className="h-4 w-4" />
            {signatureUploading ? 'Enviando...' : 'Coletar assinatura'}
          </button>
        )}
        {signatureError && (
          <p className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3 w-3 flex-shrink-0" />
            {signatureError}
          </p>
        )}
      </div>

      {cnhCameraOpen && (
        <CameraCapture
          requireLiveCapture
          onClose={() => setCnhCameraOpen(false)}
          onCapture={(file, lat, lng) => { void handleCnhCapture(file, lat, lng); }}
        />
      )}

      {signaturePadOpen && (
        <SignaturePad
          onClose={() => setSignaturePadOpen(false)}
          onConfirm={(file) => { void handleSignatureConfirm(file); }}
        />
      )}
    </div>
  );
}
