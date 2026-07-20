import { X, RotateCcw, Check } from 'lucide-react';
import React, { useRef, useState, useCallback } from 'react';

interface Props {
  onConfirm: (file: File) => void;
  onClose: () => void;
}

export default function SignaturePad({ onConfirm, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const [hasDrawn, setHasDrawn] = useState(false);

  const getCanvasContext = useCallback((): CanvasRenderingContext2D | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  }, []);

  const setupCanvas = useCallback((canvas: HTMLCanvasElement) => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  const canvasRefCallback = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      canvasRef.current = canvas;
      if (canvas) setupCanvas(canvas);
    },
    [setupCanvas],
  );

  const getPoint = (canvas: HTMLCanvasElement, e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPointRef.current = getPoint(canvas, e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = getCanvasContext();
    if (!canvas || !ctx) return;

    const point = getPoint(canvas, e);
    const last = lastPointRef.current;
    if (last) {
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
    lastPointRef.current = point;
    if (!hasDrawn) setHasDrawn(true);
  };

  const endStroke = () => {
    drawingRef.current = false;
    lastPointRef.current = null;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = getCanvasContext();
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onConfirm(new File([blob], 'assinatura.jpg', { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.82,
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      <div className="pt-safe-top flex items-center justify-between px-4 pt-4 pb-2 text-white">
        <span className="text-sm font-medium">Assinatura do motorista</span>
        <button onClick={onClose} className="p-2">
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden px-4">
        <canvas
          ref={canvasRefCallback}
          className="h-full max-h-96 w-full rounded-lg bg-white"
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
        />
      </div>

      <div className="pb-safe-bottom flex items-center justify-center gap-8 pt-4 pb-8">
        <button onClick={handleClear} className="flex flex-col items-center gap-1 text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white">
            <RotateCcw className="h-5 w-5" />
          </div>
          <span className="text-xs">Limpar</span>
        </button>

        <button
          onClick={handleConfirm}
          disabled={!hasDrawn}
          className="flex flex-col items-center gap-1 text-white disabled:opacity-40"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
            <Check className="h-7 w-7" />
          </div>
          <span className="text-xs">Confirmar</span>
        </button>
      </div>
    </div>
  );
}
