import { describe, expect, it } from 'vitest';

import { canAccessRoute } from './rolePermissions';

describe('permissões das rotas de Chamados/S.O.S.', () => {
  it('permite que Driver acesse /sos', () => {
    expect(canAccessRoute('Driver', '/sos')).toBe(true);
  });

  it('permite /chamados para Yard Auditor e Operations Manager', () => {
    expect(canAccessRoute('Yard Auditor', '/chamados')).toBe(true);
    expect(canAccessRoute('Operations Manager', '/chamados')).toBe(true);
  });

  it('mantém Financeiro sem acesso a /chamados', () => {
    expect(canAccessRoute('Financeiro', '/chamados')).toBe(false);
  });
});
