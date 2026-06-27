import { Camera, X, RotateCcw, Check } from 'lucide-react';
import React, { useRef, useState, useEffect, useCallback } from 'react';

interface Props {
  onCapture: (file: File, latitude?: number, longitude?: number) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [error] = useState('');
  const [useFileInput, setUseFileInput] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);

  // Try to get GPS (fail silently)
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGps(null),
      { timeout: 5000 },
    );
  }, []);

  const startCamera = useCallback(async () => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setUseFileInput(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play();
      }
    } catch {
      setUseFileInput(true);
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    void startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const MAX = 1280;
    let w = video.videoWidth;
    let h = video.videoHeight;
    if (w > MAX || h > MAX) {
      if (w > h) { h = Math.round((h * MAX) / w); w = MAX; }
      else { w = Math.round((w * MAX) / h); h = MAX; }
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    canvas.toBlob(
      blob => {
        if (!blob) return;
        const timestamp = Date.now();
        const file = new File([blob], `foto-${timestamp}.jpg`, { type: 'image/jpeg' });
        setCapturedFile(file);
        setPreview(canvas.toDataURL('image/jpeg', 0.82));
        stopCamera();
      },
      'image/jpeg',
      0.82,
    );
  };

  const retake = () => {
    setPreview(null);
    setCapturedFile(null);
    void startCamera();
  };

  const confirm = () => {
    if (capturedFile) {
      onCapture(capturedFile, gps?.lat, gps?.lng);
      setPreview(null);
      setCapturedFile(null);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCapturedFile(file);
    setPreview(URL.createObjectURL(file));
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      {/* Header */}
      <div className="pt-safe-top flex items-center justify-between px-4 pt-4 pb-2 text-white">
        <span className="text-sm font-medium">Tirar foto</span>
        <button onClick={onClose} className="p-2">
          <X className="h-6 w-6" />
        </button>
      </div>

      {error && (
        <div className="mx-4 rounded-lg bg-red-900/60 px-4 py-2 text-sm text-red-200">{error}</div>
      )}

      {/* Camera / Preview area */}
      <div className="flex flex-1 items-center justify-center overflow-hidden">
        {useFileInput ? (
          <div className="space-y-4 px-8 text-center">
            {preview ? (
              <img src={preview} alt="preview" className="mx-auto max-h-96 rounded-lg" />
            ) : (
              <>
                <Camera className="mx-auto h-16 w-16 text-zinc-400" />
                <p className="text-sm text-zinc-300">
                  Câmera ao vivo indisponível neste endereço (requer HTTPS). Use o botão abaixo para fotografar com a câmera do dispositivo.
                </p>
                <label className="block cursor-pointer">
                  <span className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-medium text-white">
                    Tirar foto
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileInput}
                  />
                </label>
              </>
            )}
          </div>
        ) : preview ? (
          <img src={preview} alt="preview" className="max-h-full w-full object-contain" />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        )}
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* GPS indicator */}
      {gps && (
        <div className="pb-1 text-center text-xs text-zinc-400">
          GPS: {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
        </div>
      )}

      {/* Controls */}
      <div className="pb-safe-bottom flex items-center justify-center gap-8 pt-4 pb-8">
        {preview ? (
          <>
            <button
              onClick={retake}
              className="flex flex-col items-center gap-1 text-white"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white">
                <RotateCcw className="h-5 w-5" />
              </div>
              <span className="text-xs">Refazer</span>
            </button>

            <button
              onClick={confirm}
              className="flex flex-col items-center gap-1 text-white"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
                <Check className="h-7 w-7" />
              </div>
              <span className="text-xs">Usar foto</span>
            </button>
          </>
        ) : !useFileInput ? (
          <button
            onClick={capturePhoto}
            className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/20"
          >
            <div className="h-14 w-14 rounded-full bg-white" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
