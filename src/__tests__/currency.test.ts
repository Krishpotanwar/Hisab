import { describe, it, expect } from 'vitest';
import { getCurrencySymbol, formatCurrency, CURRENCIES } from '@/utils/currency';

describe('getCurrencySymbol', () => {
  it('returns correct symbols for known currencies', () => {
    expect(getCurrencySymbol('INR')).toBe('₹');
    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencySymbol('GBP')).toBe('£');
    expect(getCurrencySymbol('JPY')).toBe('¥');
  });

  it('returns the code itself for unknown currencies', () => {
    expect(getCurrencySymbol('XYZ')).toBe('XYZ');
  });
});

describe('formatCurrency', () => {
  it('formats INR with Indian locale', () => {
    const result = formatCurrency(1234.56, 'INR');
    expect(result).toContain('₹');
    expect(result).toContain('1,234.56');
  });

  it('formats USD with US locale', () => {
    const result = formatCurrency(1234.56, 'USD');
    expect(result).toContain('$');
    expect(result).toContain('1,234.56');
  });

  it('defaults to INR', () => {
    const result = formatCurrency(100);
    expect(result).toContain('₹');
  });

  it('handles zero', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0.00');
  });

  it('handles negative amounts (uses absolute value)', () => {
    const result = formatCurrency(-500, 'EUR');
    expect(result).toContain('€');
    expect(result).toContain('500.00');
  });
});

describe('CURRENCIES', () => {
  it('has at least 5 currencies', () => {
    expect(CURRENCIES.length).toBeGreaterThanOrEqual(5);
  });

  it('each currency has code, symbol, and name', () => {
    for (const c of CURRENCIES) {
      expect(c.code).toBeTruthy();
      expect(c.symbol).toBeTruthy();
      expect(c.name).toBeTruthy();
    }
  });
});
