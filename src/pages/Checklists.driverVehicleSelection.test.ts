import { describe, it, expect } from 'vitest';

import {
  hasVehicleLinkDivergence,
  buildVehicleLinkDivergenceMessage,
  resolveDefaultVehicleId,
  type SelectableVehicle,
  type VehicleLinkDivergenceReason,
} from '../lib/vehicleLinkDivergence';

const myVehicle: SelectableVehicle = {
  id: 'vehicle-mine',
  licensePlate: 'ABC1D23',
  category: 'Pesado',
  status: 'Available',
  isAssignedToMe: true,
  hasOtherDriver: false,
};

const otherDriverVehicle: SelectableVehicle = {
  id: 'vehicle-other',
  licensePlate: 'XYZ9A87',
  category: 'Pesado',
  status: 'Available',
  isAssignedToMe: false,
  hasOtherDriver: true,
};

describe('seleção de veículo do Driver — resolveDefaultVehicleId', () => {
  it('motorista com veículo vinculado: retorna o id dele como pré-seleção', () => {
    const vehicles = [otherDriverVehicle, myVehicle];
    expect(resolveDefaultVehicleId(vehicles)).toBe('vehicle-mine');
  });

  it('motorista sem vínculo: nenhuma pré-seleção', () => {
    const vehicles = [otherDriverVehicle];
    expect(resolveDefaultVehicleId(vehicles)).toBe('');
  });
});

describe('seleção de veículo do Driver — gate de divergência', () => {
  it('escolha do próprio veículo: nenhuma divergência, nenhum modal', () => {
    const divergence = { reasons: [] as VehicleLinkDivergenceReason[] };
    expect(hasVehicleLinkDivergence(divergence)).toBe(false);
  });

  it('escolha de veículo de outro motorista: divergência com o texto exato', () => {
    const divergence = { reasons: ['other_driver_assigned'] as VehicleLinkDivergenceReason[] };
    expect(hasVehicleLinkDivergence(divergence)).toBe(true);
    expect(buildVehicleLinkDivergenceMessage(divergence)).toBe(
      'Existe outro motorista vinculado a esse veículo. Deseja prosseguir assim mesmo?',
    );
  });
});
