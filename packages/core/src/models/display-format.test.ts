import { describe, expect, it } from 'vitest';

import { formatDate, formatMoney } from './display-format';

describe('formatMoney', () => {
  it('formats an amount with or without a currency', () => {
    expect(formatMoney(12.5, 'USD', 'en-US')).toBe('$12.50');
    expect(formatMoney(1234.5, null, 'en-US')).toBe('1,234.5');
  });
});

describe('formatDate', () => {
  it('writes a date the way the locale does', () => {
    expect(formatDate('2024-05-01', 'en-US')).toBe('May 1, 2024');
  });
});
