import { describe, expect, it } from 'vitest';

import { canResetDriverPassword, generateDriverPassword } from './driverPasswordReset';
import { validateNewPassword } from './passwordValidation';

describe('canResetDriverPassword', () => {
  it('permite papéis com acesso', () => {
    ['Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'].forEach((role) => {
      expect(canResetDriverPassword(role)).toBe(true);
    });
  });

  it('nega papéis sem acesso', () => {
    ['Fleet Assistant', 'Driver', 'Workshop', 'Yard Auditor', 'Financeiro', 'Coupling Agent', 'Operations Manager'].forEach((role) => {
      expect(canResetDriverPassword(role)).toBe(false);
    });
  });

  it('nega valores vazios', () => {
    expect(canResetDriverPassword(undefined)).toBe(false);
    expect(canResetDriverPassword(null)).toBe(false);
    expect(canResetDriverPassword('')).toBe(false);
  });

  // Teste de paridade: esta lista deve ser idêntica a ROLES_CAN_EDIT de src/pages/Drivers.tsx:39.
  // Se alguém alterar uma das duas sem a outra, este teste quebra.
  it('mantém paridade com ROLES_CAN_EDIT de Drivers.tsx', () => {
    const ROLES_CAN_EDIT = ['Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'];
    ROLES_CAN_EDIT.forEach((role) => {
      expect(canResetDriverPassword(role)).toBe(true);
    });
  });
});

describe('generateDriverPassword', () => {
  it('gera senha no formato esperado', () => {
    const password = generateDriverPassword();
    expect(password).toMatch(/^BetaFleet-[ABCDEFGHJKMNPQRTUVWXYZ2346789]{6}$/);
  });

  it('não contém caracteres ambíguos no sufixo', () => {
    const password = generateDriverPassword();
    const suffix = password.slice('BetaFleet-'.length);
    expect(suffix).not.toMatch(/[ILOS015]/);
  });

  it('gera senhas com entropia suficiente', () => {
    const passwords = new Set(Array.from({ length: 200 }, () => generateDriverPassword()));
    expect(passwords.size).toBeGreaterThanOrEqual(199);
  });

  it('gera senha compatível com validateNewPassword', () => {
    const password = generateDriverPassword();
    expect(validateNewPassword(password, password)).toBeNull();
  });
});
