export const PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRTUVWXYZ2346789';
export const GENERATED_PASSWORD_PREFIX = 'BetaFleet-';

// Espelha ROLES_CAN_EDIT de src/pages/Drivers.tsx:39 — módulo puro não pode importar de src/pages/
const ROLES_CAN_RESET_DRIVER_PASSWORD = ['Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'] as const;

export function canResetDriverPassword(role: string | null | undefined): boolean {
  return !!role && (ROLES_CAN_RESET_DRIVER_PASSWORD as readonly string[]).includes(role);
}

export function generateDriverPassword(): string {
  const randomValues = crypto.getRandomValues(new Uint32Array(6));
  let suffix = '';
  for (const value of randomValues) {
    suffix += PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length];
  }
  return `${GENERATED_PASSWORD_PREFIX}${suffix}`;
}
