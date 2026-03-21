import { WifiOff, RefreshCw } from 'lucide-react';

interface Props {
  isOnline: boolean;
  pendingCount: number;
}

export default function OfflineBanner({ isOnline, pendingCount }: Props) {
  if (isOnline && pendingCount === 0) return null;

  if (!isOnline) {
    return (
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <WifiOff className="h-4 w-4 text-amber-600 flex-shrink-0" />
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
    <div className="bg-blue-50 border-b border-blue-200 px-4 py-2">
      <div className="max-w-2xl mx-auto flex items-center gap-2">
        <RefreshCw className="h-4 w-4 text-blue-600 flex-shrink-0 animate-spin" />
        <p className="text-xs text-blue-800">
          Sincronizando {pendingCount} item(s)...
        </p>
      </div>
    </div>
  );
}
