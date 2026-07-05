import { Info } from 'lucide-react';

export default function VehicleKmGuidance() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
      <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-500" />
      <div className="space-y-0.5 text-xs text-sky-800">
        <p>Preencha apenas com números, sem pontos ou vírgulas.</p>
        <p>Não confunda o Km do veículo com o Km da viagem. Observe o último Km registrado.</p>
      </div>
    </div>
  );
}
