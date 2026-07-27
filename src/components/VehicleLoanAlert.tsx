import { AlertTriangle } from 'lucide-react';
import React from 'react';

import { cn } from '../lib/utils';

interface Props {
  variant: 'will_create' | 'active';
  tempDriverName?: string;
  titularName?: string;
  startedAt?: string;
}

/**
 * Alerta âmbar exibido na visão do Auditor antes de iniciar uma Entrega que
 * criará um empréstimo (variant="will_create") ou quando há um empréstimo
 * ativo para o veículo selecionado (variant="active").
 */
export default function VehicleLoanAlert({ variant, tempDriverName, titularName, startedAt }: Props) {
  const message = variant === 'will_create'
    ? `Motorista diferente do vinculado${titularName ? ` (${titularName})` : ''} — será criado um empréstimo temporário deste veículo${tempDriverName ? ` para ${tempDriverName}` : ''}.`
    : `Este veículo está emprestado${tempDriverName ? ` a ${tempDriverName}` : ''}${startedAt ? ` desde ${new Date(startedAt).toLocaleString('pt-BR')}` : ''}. Concluir a Devolução vai finalizar o empréstimo.`;

  return (
    <div className={cn('flex items-start gap-2 rounded-xl border px-3 py-2 text-xs', 'border-amber-200 bg-amber-50 text-amber-800')}>
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
      <span className="leading-snug">{message}</span>
    </div>
  );
}