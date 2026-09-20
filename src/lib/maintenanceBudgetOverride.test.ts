import { describe, expect, it } from 'vitest';

import {
  describeBudgetOverrideWarning,
  formatBudgetOverrideAuthor,
  formatBudgetOverrideReason,
  normalizeBudgetOverrideReason,
} from './maintenanceBudgetOverride';

describe('normalizeBudgetOverrideReason', () => {
  it('apara o texto e recusa vazio ou acima do teto', () => {
    expect(normalizeBudgetOverrideReason('  peça de segurança  ')).toBe('peça de segurança');
    expect(normalizeBudgetOverrideReason('   ')).toBeNull();
    expect(normalizeBudgetOverrideReason('a'.repeat(501))).toBeNull();
    expect(normalizeBudgetOverrideReason('a'.repeat(500))).toBe('a'.repeat(500));
  });
});

describe('formatBudgetOverrideReason', () => {
  it('usa o rótulo padrão quando não há motivo', () => {
    expect(formatBudgetOverrideReason(undefined)).toBe('Não informado');
    expect(formatBudgetOverrideReason('  ')).toBe('Não informado');
  });

  it('apara o motivo informado', () => {
    expect(formatBudgetOverrideReason('  urgência  ')).toBe('urgência');
  });
});

describe('formatBudgetOverrideAuthor', () => {
  it('usa o rótulo padrão quando não há autor', () => {
    expect(formatBudgetOverrideAuthor(undefined)).toBe('Não identificado');
    expect(formatBudgetOverrideAuthor('')).toBe('Não identificado');
  });

  it('apara o nome do autor', () => {
    expect(formatBudgetOverrideAuthor('  Mariana  ')).toBe('Mariana');
  });
});

describe('describeBudgetOverrideWarning', () => {
  it('diferencia orçamento inexistente de orçamento reprovado', () => {
    expect(describeBudgetOverrideWarning('Serviço em execução', 'sem_orcamento')).toBe(
      'Esta OS não tem orçamento aprovado. Mudar para "Serviço em execução" é uma exceção e ficará registrada com o seu nome, a data e o motivo informado.',
    );
    expect(describeBudgetOverrideWarning('Concluído', 'reprovado')).toBe(
      'O orçamento desta OS foi reprovado. Mudar para "Concluído" é uma exceção e ficará registrada com o seu nome, a data e o motivo informado.',
    );
    expect(describeBudgetOverrideWarning('Veículo retirado', undefined)).toBe(
      'Esta OS não tem orçamento aprovado. Mudar para "Veículo retirado" é uma exceção e ficará registrada com o seu nome, a data e o motivo informado.',
    );
  });
});
