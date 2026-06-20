import { ShieldCheck } from 'lucide-react';

export default function ConformityPanel() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="rounded-full bg-orange-50 p-4">
          <ShieldCheck className="h-10 w-10 text-orange-500" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-zinc-900">Conformidade</h3>
          <p className="text-sm text-zinc-500 max-w-xs">
            Em breve: indicadores de documentos (CRLV, CNH, GR) e conformidade de checklist da frota.
          </p>
        </div>
      </div>
    </div>
  );
}