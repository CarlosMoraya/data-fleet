import { describe, expect, it } from 'vitest';

import {
  formatMaintenanceCancellationAuthor,
  formatMaintenanceCancellationReason,
  normalizeMaintenanceCancellationReason,
} from './maintenanceCancellation';

describe('normalizeMaintenanceCancellationReason', () => {
  it('1 — trim remove espaços extras ao redor do motivo', () => {
    expect(
      normalizeMaintenanceCancellationReason('  Peça sem disponibilidade no fornecedor  '),
    ).toBe('Peça sem disponibilidade no fornecedor');
  });

  it('2 — string vazia retorna null', () => {
    expect(normalizeMaintenanceCancellationReason('')).toBeNull();
  });

  it('3 — string com apenas espaços retorna null', () => {
    expect(normalizeMaintenanceCancellationReason('   ')).toBeNull();
  });

  it('4 — string com espaços e quebras de linha retorna null', () => {
    expect(normalizeMaintenanceCancellationReason('\n\t ')).toBeNull();
  });

  it('5 — motivo com 500 caracteres é aceito', () => {
    expect(normalizeMaintenanceCancellationReason('a'.repeat(500))).toBe('a'.repeat(500));
  });

  it('6 — motivo com 501 caracteres é rejeitado', () => {
    expect(normalizeMaintenanceCancellationReason('a'.repeat(501))).toBeNull();
  });

  it('7 — trim antes da checagem de comprimento aceita 500 caracteres cercados por espaços', () => {
    expect(normalizeMaintenanceCancellationReason('  ' + 'a'.repeat(500) + '  ')).toBe(
      'a'.repeat(500),
    );
  });

  it('8 — motivo simples é devolvido como está', () => {
    expect(normalizeMaintenanceCancellationReason('x')).toBe('x');
  });
});

describe('formatMaintenanceCancellationReason', () => {
  it('9 — motivo informado é devolvido aparado', () => {
    expect(formatMaintenanceCancellationReason('Veículo vendido')).toBe('Veículo vendido');
  });

  it('10 — motivo undefined vira "Não informado"', () => {
    expect(formatMaintenanceCancellationReason(undefined)).toBe('Não informado');
  });

  it('11 — motivo em branco vira "Não informado"', () => {
    expect(formatMaintenanceCancellationReason('   ')).toBe('Não informado');
  });
});

describe('formatMaintenanceCancellationAuthor', () => {
  it('12 — autor undefined vira "Não identificado"', () => {
    expect(formatMaintenanceCancellationAuthor(undefined)).toBe('Não identificado');
  });

  it('13 — autor informado é devolvido aparado', () => {
    expect(formatMaintenanceCancellationAuthor('Ana Souza')).toBe('Ana Souza');
  });

  it('14 — autor em branco vira "Não identificado"', () => {
    expect(formatMaintenanceCancellationAuthor('  ')).toBe('Não identificado');
  });
});