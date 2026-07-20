import { AlertTriangle } from 'lucide-react';
import React from 'react';

interface Props {
  message: string;
  blocked: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function VehicleLinkDivergenceModal({ message, blocked, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-50">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <h3 className="text-lg font-semibold text-amber-700">Divergência de vínculo</h3>
        </div>
        <p className="text-sm text-zinc-600">{message}</p>
        <div className="flex justify-end gap-3">
          {blocked ? (
            <button
              onClick={onCancel}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
            >
              Entendi
            </button>
          ) : (
            <>
              <button onClick={onCancel} className="px-4 py-2 text-sm text-zinc-600">
                Não
              </button>
              <button
                onClick={onConfirm}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
              >
                Sim, prosseguir
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
