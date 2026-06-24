import { WifiOff, RefreshCw } from 'lucide-react';

interface Props {
  isOnline: boolean;
  pendingCount: number;
}

export default function OfflineBanner({ isOnline, pendingCount }: Props) {
  if (isOnline && pendingCount === 0) return null;

  if (!isOnline) {
    return (
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <WifiOff className="h-4 w-4 flex-shrink-0 text-amber-600" />
          <p className="text-xs text-amber-800">
            {pendingCount > 0
              ? `Sem conexão — ${pendingCount} item(s) aguardando sincronização`
              : 'Sem conexão — respostas serão salvas ao reconectar'}
          </p>
        </div>
      </div>
    );
  }

  // Online com itens pendentes → sincronizando
  return (
    <div className="border-b border-blue-200 bg-blue-50 px-4 py-2">
      <div className="mx-auto flex max-w-2xl items-center gap-2">
        <RefreshCw className="h-4 w-4 flex-shrink-0 animate-spin text-blue-600" />
        <p className="text-xs text-blue-800">
          Sincronizando {pendingCount} item(s)...
        </p>
      </div>
    </div>
  );
}
