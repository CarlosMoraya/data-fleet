import { describe, expect, it } from 'vitest';

import {
  describeMaintenanceSaveError,
  MAINTENANCE_SAVE_FALLBACK_MESSAGE,
} from './maintenanceSaveError';

/** O supabase-js devolve o erro do PostgREST como objeto simples, não como Error. */
function postgrestError(message: string, code = 'P0001') {
  return { message, details: '', hint: '', code };
}

describe('describeMaintenanceSaveError — extração da mensagem', () => {
  it('lê a mensagem de objeto simples, que não é instanceof Error', () => {
    const err = postgrestError('Orcamento ja aprovado: a OS nao volta para Aguardando aprovacao');
    expect(err).not.toBeInstanceOf(Error);
    expect(describeMaintenanceSaveError(err)).not.toBe(MAINTENANCE_SAVE_FALLBACK_MESSAGE);
  });

  it('lê a mensagem de Error de verdade, como as guardas de frontend', () => {
    expect(describeMaintenanceSaveError(new Error('Preencha os campos obrigatórios.')))
      .toBe('Preencha os campos obrigatórios.');
  });

  it('cai no texto genérico só quando não há mensagem alguma', () => {
    expect(describeMaintenanceSaveError(null)).toBe(MAINTENANCE_SAVE_FALLBACK_MESSAGE);
    expect(describeMaintenanceSaveError(undefined)).toBe(MAINTENANCE_SAVE_FALLBACK_MESSAGE);
    expect(describeMaintenanceSaveError({})).toBe(MAINTENANCE_SAVE_FALLBACK_MESSAGE);
  });
});

describe('describeMaintenanceSaveError — tradução por código', () => {
  it('traduz negativa de permissão', () => {
    expect(describeMaintenanceSaveError(postgrestError('permission denied', '42501')))
      .toBe('Você não tem permissão para alterar esta OS.');
  });

  it('traduz coluna inexistente como migration pendente', () => {
    expect(describeMaintenanceSaveError(postgrestError("column ... does not exist", 'PGRST204')))
      .toBe('Recurso indisponível: a atualização do banco ainda não foi aplicada. Fale com o administrador.');
  });
});

describe('describeMaintenanceSaveError — tradução das regras de orçamento', () => {
  it('explica que o orçamento aprovado não volta para Aguardando aprovação', () => {
    expect(describeMaintenanceSaveError(postgrestError('Orcamento ja aprovado: a OS nao volta para Aguardando aprovacao')))
      .toBe('Este orçamento já foi aprovado no Financeiro, então a OS não volta para "Aguardando aprovação". Para revisá-lo, use "Reabrir orçamento".');
  });

  it('explica o bloqueio de orçamento aguardando decisão', () => {
    expect(describeMaintenanceSaveError(postgrestError('Orcamento aguardando decisao: a OS nao pode avancar para Concluído')))
      .toBe('O orçamento ainda está aguardando decisão no Financeiro. Aprove ou reprove o orçamento antes de avançar o status da OS.');
  });

  it('traduz a Regra A com o mesmo texto da guarda de frontend', () => {
    expect(describeMaintenanceSaveError(postgrestError('Status Orcamento aprovado exige aprovacao do orcamento no Financeiro')))
      .toBe('Não é possível mudar para "Orçamento aprovado": este status é definido automaticamente quando o orçamento é aprovado em Financeiro → Aprovação de Orçamentos.');
  });

  it('traduz as duas recusas da Regra C para a mesma mensagem da guarda de frontend', () => {
    expect(describeMaintenanceSaveError(postgrestError('Motivo obrigatorio: a OS entra em execucao sem orcamento aprovado')))
      .toBe('Informe o motivo da exceção (até 500 caracteres).');
    expect(describeMaintenanceSaveError(postgrestError('Motivo da excecao de orcamento excede 500 caracteres')))
      .toBe('Informe o motivo da exceção (até 500 caracteres).');
  });

  it('traduz a trava de colunas do orçamento aprovado', () => {
    expect(describeMaintenanceSaveError(postgrestError('Orcamento aprovado: orcamento, desconto, custos e PDF nao podem mais ser alterados')))
      .toBe('Orçamento aprovado: itens, descontos, custos e PDF não podem mais ser alterados.');
  });
});

describe('describeMaintenanceSaveError — tradução das travas da oficina', () => {
  it('traduz as quatro recusas do papel Workshop', () => {
    expect(describeMaintenanceSaveError(postgrestError('Workshop nao pode alterar campos protegidos da OS')))
      .toBe('A oficina não pode alterar os campos de identificação da OS.');
    expect(describeMaintenanceSaveError(postgrestError('Workshop so pode enviar para aprovacao ou iniciar servico de orcamento aprovado')))
      .toBe('A oficina só pode enviar a OS para aprovação ou iniciar o serviço de um orçamento já aprovado.');
    expect(describeMaintenanceSaveError(postgrestError('Workshop nao pode aprovar/reprovar orcamento')))
      .toBe('A oficina não pode aprovar nem reprovar orçamentos.');
    expect(describeMaintenanceSaveError(postgrestError('Orcamento aprovado: a oficina nao pode alterar orcamento, desconto ou PDF')))
      .toBe('Orçamento aprovado: a oficina não pode alterar orçamento, desconto ou PDF.');
  });
});

describe('describeMaintenanceSaveError — mensagem não mapeada', () => {
  it('devolve a mensagem crua em vez de escondê-la', () => {
    expect(describeMaintenanceSaveError(postgrestError('Alguma regra nova ainda sem traducao')))
      .toBe('Alguma regra nova ainda sem traducao');
  });
});
