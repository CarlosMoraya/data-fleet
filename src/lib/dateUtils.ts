/**
 * Formata uma data ISO ou string para exibição legível em português.
 * Ex: "2025-04-11" → "11/04/2025"
 *     "2025-04-11T14:30:00" → "11/04/2025 14:30"
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '—';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    // Se tem hora, inclui no formato
    if (hours !== '00' || minutes !== '00') {
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    }
    return `${day}/${month}/${year}`;
  } catch {
    return '—';
  }
}

/**
 * Formata um número de telefone para exibição: (XX) XXXXX-XXXX
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}
