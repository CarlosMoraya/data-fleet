import { describe, expect, it } from 'vitest';

import { isOperationStartBeforeAcquisition } from './vehicleOperationStartDate';

describe('isOperationStartBeforeAcquisition', () => {
  it('avisa quando o início na operação é anterior à aquisição', () => {
    expect(isOperationStartBeforeAcquisition('2026-03-10', '2026-01-05')).toBe(true);
  });

  it('não avisa quando o início na operação é posterior à aquisição', () => {
    expect(isOperationStartBeforeAcquisition('2026-01-05', '2026-03-10')).toBe(false);
  });

  it('não avisa quando as datas são iguais', () => {
    expect(isOperationStartBeforeAcquisition('2026-03-10', '2026-03-10')).toBe(false);
  });

  it('não avisa quando algum campo está vazio', () => {
    expect(isOperationStartBeforeAcquisition('2026-03-10', undefined)).toBe(false);
    expect(isOperationStartBeforeAcquisition(undefined, '2026-03-10')).toBe(false);
    expect(isOperationStartBeforeAcquisition('', '')).toBe(false);
  });

  it('não avisa com formato inválido', () => {
    expect(isOperationStartBeforeAcquisition('10/03/2026', '2026-01-05')).toBe(false);
  });

  it('avisa na virada de ano', () => {
    expect(isOperationStartBeforeAcquisition('2026-01-01', '2025-12-31')).toBe(true);
  });
});
