import { AlertCircle } from 'lucide-react';

export default function SelectClientNotice() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
      <span>Selecione um cliente específico no menu superior para cadastrar ou configurar.</span>
    </div>
  );
}