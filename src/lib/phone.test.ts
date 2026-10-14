import { describe, expect, it } from 'vitest';
import { formatPhone, normalizePhone } from './phone';

describe('normalizePhone', () => {
  it.each([
    ['+7 (999) 123-45-67', '79991234567'],
    ['8 999 123 45 67', '79991234567'],
    ['9991234567', '79991234567'],
    ['+375 29 123-45-67', '375291234567'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it('отклоняет слишком короткие и длинные номера', () => {
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('1234567890123')).toBeNull();
  });
});

describe('formatPhone', () => {
  it('форматирует российский и белорусский номер', () => {
    expect(formatPhone('79991234567')).toBe('+7 999 123-45-67');
    expect(formatPhone('375291234567')).toBe('+375 29 123-45-67');
  });
});
