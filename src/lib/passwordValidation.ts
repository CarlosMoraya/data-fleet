export const MIN_PASSWORD_LENGTH = 8;

export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return 'A senha deve ter pelo menos 8 caracteres.';
  }

  if (password !== confirmation) {
    return 'As senhas não coincidem.';
  }

  return null;
}
