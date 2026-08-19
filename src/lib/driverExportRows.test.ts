import { describe, expect, it } from 'vitest';

import { buildDriverExportCells, DRIVER_EXPORT_HEADERS, type DriverExportRow } from './driverExportRows';

function baseDriver(overrides: Partial<DriverExportRow> = {}): DriverExportRow {
  return {
    id: 'd1',
    clientId: 'c1',
    active: true,
    name: 'João da Silva',
    cpf: '12345678901',
    phone: '11987654321',
    employmentRegime: 'CLT',
    issueDate: '2026-01-05',
    expirationDate: '2028-03-15',
    registrationNumber: '123456789',
    category: 'E',
    renach: 'SP123456789',
    grExpirationDate: '2027-07-20',
    vehiclePlate: 'ABC1D23',
    shipperName: 'Embarcador X',
    operationalUnitName: 'Unidade SP',
    ...overrides,
  };
}

describe('driverExportRows', () => {
  it('tem exatamente 14 cabeçalhos na ordem exata', () => {
    expect(DRIVER_EXPORT_HEADERS.length).toBe(14);
    expect(DRIVER_EXPORT_HEADERS).toEqual([
      'Nome',
      'CPF',
      'Telefone',
      'Regime',
      'Categoria CNH',
      'Nº Registro CNH',
      'Renach',
      'Emissão CNH',
      'Validade CNH',
      'Validade GR',
      'Veículo',
      'Embarcador',
      'Unidade Operacional',
      'Status',
    ]);
  });

  it('mapeia um motorista completo para todas as células corretas', () => {
    expect(buildDriverExportCells(baseDriver())).toEqual([
      'João da Silva',
      '123.456.789-01',
      '11987654321',
      'CLT',
      'E',
      '123456789',
      'SP123456789',
      '05/01/2026',
      '15/03/2028',
      '20/07/2027',
      'ABC1D23',
      'Embarcador X',
      'Unidade SP',
      'Ativo',
    ]);
  });

  it('formata o CPF com máscara quando tem 11 dígitos', () => {
    expect(buildDriverExportCells(baseDriver({ cpf: '12345678901' }))[1]).toBe('123.456.789-01');
  });

  it('preserva zeros à esquerda do CPF', () => {
    expect(buildDriverExportCells(baseDriver({ cpf: '01234567890' }))[1]).toBe('012.345.678-90');
  });

  it('devolve o CPF original quando não tem 11 dígitos', () => {
    expect(buildDriverExportCells(baseDriver({ cpf: '123' }))[1]).toBe('123');
    expect(buildDriverExportCells(baseDriver({ cpf: '' }))[1]).toBe('');
  });

  it('aceita CPF já formatado sem duplicar a máscara', () => {
    expect(buildDriverExportCells(baseDriver({ cpf: '123.456.789-01' }))[1]).toBe('123.456.789-01');
  });

  it('renderiza strings vazias para campos opcionais ausentes', () => {
    const cells = buildDriverExportCells(baseDriver({
      phone: undefined,
      employmentRegime: undefined,
      category: undefined,
      registrationNumber: undefined,
      renach: undefined,
    }));

    expect(cells[2]).toBe('');
    expect(cells[3]).toBe('');
    expect(cells[4]).toBe('');
    expect(cells[5]).toBe('');
    expect(cells[6]).toBe('');
  });

  it('formata as três datas no padrão brasileiro', () => {
    const cells = buildDriverExportCells(baseDriver({
      issueDate: '2026-01-05',
      expirationDate: '2028-03-15',
      grExpirationDate: '2027-07-20',
    }));

    expect(cells[7]).toBe('05/01/2026');
    expect(cells[8]).toBe('15/03/2028');
    expect(cells[9]).toBe('20/07/2027');
  });

  it('retorna strings vazias quando as datas não estão preenchidas', () => {
    const cells = buildDriverExportCells(baseDriver({
      issueDate: undefined,
      expirationDate: undefined,
      grExpirationDate: undefined,
    }));

    expect(cells[7]).toBe('');
    expect(cells[8]).toBe('');
    expect(cells[9]).toBe('');
  });

  it('mapeia active=false para Status=Inativo', () => {
    expect(buildDriverExportCells(baseDriver({ active: false }))[13]).toBe('Inativo');
  });

  it('mapeia active=true para Status=Ativo', () => {
    expect(buildDriverExportCells(baseDriver({ active: true }))[13]).toBe('Ativo');
  });

  it('renderiza strings vazias quando o motorista não tem veículo vinculado', () => {
    const cells = buildDriverExportCells(baseDriver({
      vehiclePlate: '',
      shipperName: '',
      operationalUnitName: '',
    }));

    expect(cells[10]).toBe('');
    expect(cells[11]).toBe('');
    expect(cells[12]).toBe('');
  });

  it('mapeia o regime de contratação PJ e CLT', () => {
    expect(buildDriverExportCells(baseDriver({ employmentRegime: 'PJ' }))[3]).toBe('PJ');
    expect(buildDriverExportCells(baseDriver({ employmentRegime: 'CLT' }))[3]).toBe('CLT');
  });
});
