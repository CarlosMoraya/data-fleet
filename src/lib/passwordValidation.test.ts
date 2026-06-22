import { describe, expect, it } from 'vitest';
import { validateNewPassword } from './passwordValidation';

describe('validateNewPassword', () => {
  it('returns null for a valid password and confirmation', () => {
    expect(validateNewPassword('senha1234', 'senha1234')).toBeNull();
  });

  it('returns an error for a short password', () => {
    expect(validateNewPassword('123', '123')).toBe('A senha deve ter pelo menos 8 caracteres.');
  });

  it('returns an error for a mismatched confirmation', () => {
    expect(validateNewPassword('senha1234', 'outra1234')).toBe('As senhas não coincidem.');
  });

  it('accepts a password with exactly eight characters', () => {
    expect(validateNewPassword('senha123', 'senha123')).toBeNull();
  });
});
