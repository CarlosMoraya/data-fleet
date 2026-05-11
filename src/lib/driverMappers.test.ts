import { driverToRow, driverFromRow, type DriverRow } from './driverMappers';
import type { Driver } from '../types/driver';

describe('driverToRow', () => {
  it('converte camelCase → snake_case', () => {
    const driver: Partial<Driver> = {
      id: 'd1',
      name: 'João Silva',
      cpf: '12345678901',
      category: 'AB',
      expirationDate: '2030-12-31',
    };

    const row = driverToRow(driver, 'client-1');
    // driverToRow aplica normalizeUpper no name
    expect(row.name).toMatch(/Jo[AÃ]O Silva|João Silva/);
    expect(row.cpf).toBe('12345678901');
    expect(row.category).toBe('AB');
    expect(row.expiration_date).toBe('2030-12-31');
    expect(row.client_id).toBe('client-1');
  });

  it('handle campos opcionais', () => {
    const row = driverToRow({ name: 'João', cpf: '12345678901' }, 'c1');
    expect(row.cnh_upload).toBeNull();
    expect(row.gr_upload).toBeNull();
  });

  it('inclui phone quando fornecido', () => {
    const row = driverToRow({ name: 'João', cpf: '12345678901', phone: '11999999999' }, 'c1');
    expect(row.phone).toBe('11999999999');
  });

  it('define phone como null quando ausente', () => {
    const row = driverToRow({ name: 'João', cpf: '12345678901' }, 'c1');
    expect(row.phone).toBeNull();
  });
});

describe('driverFromRow', () => {
  it('converte snake_case → camelCase', () => {
    const row = {
      id: 'd1',
      client_id: 'c1',
      name: 'João Silva',
      cpf: '12345678901',
      category: 'AB',
      expiration_date: '2030-12-31',
      cnh_upload: null,
      gr_upload: null,
    } as unknown as DriverRow;

    const driver = driverFromRow(row);
    expect(driver.name).toBe('João Silva');
    expect(driver.cpf).toBe('12345678901');
    expect(driver.category).toBe('AB');
    expect(driver.expirationDate).toBe('2030-12-31');
  });

  it('mapeia phone corretamente', () => {
    const row = {
      id: 'd1',
      client_id: 'c1',
      name: 'João Silva',
      cpf: '12345678901',
      phone: '11999999999',
    } as unknown as DriverRow;

    const driver = driverFromRow(row);
    expect(driver.phone).toBe('11999999999');
  });
});
