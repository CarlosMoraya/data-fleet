import { RefreshCw } from 'lucide-react';

interface Props {
  visible: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
}

export default function UpdateAvailableBanner({ visible, onUpdate, onDismiss }: Props) {
  if (!visible) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 shadow-lg"
      role="status"
    >
      <div className="flex items-start gap-3">
        <RefreshCw className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" aria-hidden="true" />
        <div>
          <p className="text-sm text-blue-900">Uma nova versão do BetaFleet está disponível.</p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={onUpdate}
              aria-label="Atualizar agora"
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
            >
              Atualizar agora
            </button>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Agora não"
              className="rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
