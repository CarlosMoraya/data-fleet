import { describe, it, expect } from 'vitest';

import {
  hasVehicleLinkDivergence,
  buildVehicleLinkDivergenceMessage,
  buildVehicleLinkBlockedMessage,
  resolveDefaultVehicleId,
  describeDivergenceReason,
  type SelectableVehicle,
} from './vehicleLinkDivergence';

describe('hasVehicleLinkDivergence', () => {
  it('retorna false para null', () => {
    expect(hasVehicleLinkDivergence(null)).toBe(false);
  });

  it('retorna false para reasons vazio', () => {
    expect(hasVehicleLinkDivergence({ reasons: [] })).toBe(false);
  });

  it('retorna true quando há ao menos um motivo', () => {
    expect(hasVehicleLinkDivergence({ reasons: ['other_driver_assigned'] })).toBe(true);
  });
});

describe('buildVehicleLinkDivergenceMessage', () => {
  it('só other_driver_assigned', () => {
    const msg = buildVehicleLinkDivergenceMessage({ reasons: ['other_driver_assigned'] });
    expect(msg).toBe('Existe outro motorista vinculado a esse veículo. Deseja prosseguir assim mesmo?');
  });

  it('só executor_has_other_vehicle', () => {
    const msg = buildVehicleLinkDivergenceMessage({
      reasons: ['executor_has_other_vehicle'],
      executorVehiclePlate: 'ABC1D23',
    });
    expect(msg).toBe('Você já está vinculado ao veículo placa ABC1D23. Deseja prosseguir assim mesmo?');
  });

  it('ambos os motivos', () => {
    const msg = buildVehicleLinkDivergenceMessage({
      reasons: ['other_driver_assigned', 'executor_has_other_vehicle'],
      executorVehiclePlate: 'ABC1D23',
    });
    expect(msg).toBe(
      'Você já está vinculado ao veículo placa ABC1D23 e existe outro motorista vinculado ao veículo selecionado. Deseja prosseguir assim mesmo?',
    );
  });

  it('executor_has_other_vehicle sem placa cai no texto genérico, sem {placa} nem undefined', () => {
    const msg = buildVehicleLinkDivergenceMessage({ reasons: ['executor_has_other_vehicle'] });
    expect(msg).not.toContain('{placa}');
    expect(msg).not.toContain('undefined');
    expect(msg).toBe('Existe outro motorista vinculado a esse veículo. Deseja prosseguir assim mesmo?');
  });
});

describe('buildVehicleLinkBlockedMessage', () => {
  it('termina com a frase de bloqueio e não contém "Deseja prosseguir"', () => {
    const msg = buildVehicleLinkBlockedMessage({ reasons: ['other_driver_assigned'] });
    expect(msg.endsWith('A sua empresa exige que o checklist seja feito no veículo vinculado a você. Selecione outro veículo.')).toBe(true);
    expect(msg).not.toContain('Deseja prosseguir');
  });
});

describe('resolveDefaultVehicleId', () => {
  const base: SelectableVehicle = {
    id: 'v1',
    licensePlate: 'ABC1D23',
    category: 'Pesado',
    status: 'Available',
    isAssignedToMe: false,
    hasOtherDriver: false,
  };

  it('retorna o id do veículo com isAssignedToMe', () => {
    const vehicles = [base, { ...base, id: 'v2', isAssignedToMe: true }];
    expect(resolveDefaultVehicleId(vehicles)).toBe('v2');
  });

  it('retorna string vazia quando nenhum é isAssignedToMe', () => {
    expect(resolveDefaultVehicleId([base])).toBe('');
  });

  it('retorna string vazia para lista vazia', () => {
    expect(resolveDefaultVehicleId([])).toBe('');
  });
});

describe('describeDivergenceReason', () => {
  it('other_driver_assigned', () => {
    expect(describeDivergenceReason('other_driver_assigned')).toBe('Veículo vinculado a outro motorista');
  });

  it('executor_has_other_vehicle', () => {
    expect(describeDivergenceReason('executor_has_other_vehicle')).toBe('Executor vinculado a outro veículo');
  });
});
