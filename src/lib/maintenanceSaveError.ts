/**
 * Tradução das recusas de banco no salvamento de Ordem de Serviço para
 * mensagens acionáveis em português.
 *
 * Existe porque o supabase-js devolve o erro do PostgREST como **objeto
 * simples**, não como `Error`: um `err instanceof Error ? err.message : ...`
 * descarta a mensagem real e deixa o usuário sem saber o que fazer. A extração
 * abaixo lê as duas formas, no mesmo padrão de `describeReopenError`.
 *
 * As chaves são os textos sem acento levantados pelos gatilhos em
 * `supabase/migrations/`. Ao acrescentar um `RAISE EXCEPTION` novo naquela
 * tabela, acrescente a tradução aqui.
 */

import { BUDGET_OVERRIDE_REASON_INVALID_MESSAGE } from './maintenanceBudgetOverride';
import {
  APPROVED_BUDGET_DOES_NOT_RETURN_MESSAGE,
  BUDGET_APPROVED_STATUS_IS_AUTOMATIC_MESSAGE,
} from './maintenanceStatusCoherence';

export const MAINTENANCE_SAVE_FALLBACK_MESSAGE = 'Erro ao salvar. Tente novamente.';

function readErrorParts(err: unknown): { code: string; message: string } {
  const code = (err as { code?: string } | null)?.code ?? '';
  const message = err instanceof Error
    ? err.message
    : (err as { message?: string } | null)?.message ?? '';
  return { code, message };
}

export function describeMaintenanceSaveError(err: unknown): string {
  const { code, message } = readErrorParts(err);

  if (code === '42501') return 'Você não tem permissão para alterar esta OS.';
  if (code === 'PGRST204') {
    return 'Recurso indisponível: a atualização do banco ainda não foi aplicada. Fale com o administrador.';
  }

  if (message.includes('Orcamento ja aprovado')) {
    return APPROVED_BUDGET_DOES_NOT_RETURN_MESSAGE;
  }
  if (message.includes('Orcamento aguardando decisao')) {
    return 'O orçamento ainda está aguardando decisão no Financeiro. Aprove ou reprove o orçamento antes de avançar o status da OS.';
  }
  if (message.includes('Status Orcamento aprovado exige aprovacao')) {
    return BUDGET_APPROVED_STATUS_IS_AUTOMATIC_MESSAGE;
  }
  if (message.includes('Motivo obrigatorio') || message.includes('Motivo da excecao de orcamento excede')) {
    return BUDGET_OVERRIDE_REASON_INVALID_MESSAGE;
  }
  if (message.includes('Orcamento aprovado: a oficina nao pode alterar')) {
    return 'Orçamento aprovado: a oficina não pode alterar orçamento, desconto ou PDF.';
  }
  if (message.includes('Orcamento aprovado: orcamento, desconto')) {
    return 'Orçamento aprovado: itens, descontos, custos e PDF não podem mais ser alterados.';
  }
  if (message.includes('Workshop nao pode alterar campos protegidos')) {
    return 'A oficina não pode alterar os campos de identificação da OS.';
  }
  if (message.includes('Workshop so pode enviar para aprovacao')) {
    return 'A oficina só pode enviar a OS para aprovação ou iniciar o serviço de um orçamento já aprovado.';
  }
  if (message.includes('Workshop nao pode aprovar/reprovar')) {
    return 'A oficina não pode aprovar nem reprovar orçamentos.';
  }

  return message || MAINTENANCE_SAVE_FALLBACK_MESSAGE;
}
