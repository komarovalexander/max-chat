/**
 * Приводит введённый номер к формату GREEN-API: только цифры, 11–12 знаков.
 * «8 999 …» превращается в «7999…». Возвращает null, если номер некорректен.
 */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('9')) digits = `7${digits}`;
  if (digits.length < 11 || digits.length > 12) return null;
  return digits;
}

/** Красивое отображение номера: +7 999 123-45-67 */
export function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('7')) {
    return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`;
  }
  if (d.length === 12 && d.startsWith('375')) {
    return `+375 ${d.slice(3, 5)} ${d.slice(5, 8)}-${d.slice(8, 10)}-${d.slice(10)}`;
  }
  return d ? `+${d}` : '';
}
