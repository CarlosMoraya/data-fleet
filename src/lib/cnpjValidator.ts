/**
 * Validação algorítmica de CNPJ (dígitos verificadores).
 *
 * CNPJs válidos para uso em testes:
 *   11.222.333/0001-81
 *   00.623.904/0001-73
 */
export function isValidCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');

  if (digits.length !== 14) return false;

  // Rejeita sequências repetidas (ex: 00000000000000)
  if (/^(\d)\1+$/.test(digits)) return false;

  const calc = (weights: number[]) => {
    const sum = weights.reduce((acc, w, i) => acc + parseInt(digits[i]) * w, 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };

  const first  = calc([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calc([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return parseInt(digits[12]) === first && parseInt(digits[13]) === second;
}

/** Formata CNPJ para exibição: XX.XXX.XXX/XXXX-XX */
export function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}
