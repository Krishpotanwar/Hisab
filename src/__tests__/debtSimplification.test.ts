import { describe, it, expect } from 'vitest';
import { simplifyDebts, settlementSuggestionsForUser } from '@/utils/debtSimplification';

describe('simplifyDebts', () => {
  it('returns empty for all-zero balances', () => {
    const result = simplifyDebts([
      { userId: 'a', name: 'Alice', balance: 0 },
      { userId: 'b', name: 'Bob', balance: 0 },
    ]);
    expect(result).toEqual([]);
  });

  it('handles single debtor and single creditor', () => {
    const result = simplifyDebts([
      { userId: 'a', name: 'Alice', balance: 100 },
      { userId: 'b', name: 'Bob', balance: -100 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      from: 'b',
      fromName: 'Bob',
      to: 'a',
      toName: 'Alice',
      amount: 100,
    });
  });

  it('handles circular debts (A owes B, B owes C, C owes A)', () => {
    // Net balances after circular: A = -50, B = +50, C = 0 (example)
    const result = simplifyDebts([
      { userId: 'a', name: 'Alice', balance: -50 },
      { userId: 'b', name: 'Bob', balance: 50 },
      { userId: 'c', name: 'Charlie', balance: 0 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].from).toBe('a');
    expect(result[0].to).toBe('b');
    expect(result[0].amount).toBe(50);
  });

  it('handles multiple debtors and creditors', () => {
    const result = simplifyDebts([
      { userId: 'a', name: 'Alice', balance: 200 },
      { userId: 'b', name: 'Bob', balance: -120 },
      { userId: 'c', name: 'Charlie', balance: 100 },
      { userId: 'd', name: 'Dave', balance: -180 },
    ]);
    // Total debts = 300, total credits = 300
    const totalPaid = result.reduce((s, p) => s + p.amount, 0);
    expect(totalPaid).toBeCloseTo(300, 2);
    // Should minimize transactions — at most 3 (n-1 where n=4, minus zeros)
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('handles equal opposite balances', () => {
    const result = simplifyDebts([
      { userId: 'a', name: 'A', balance: 50 },
      { userId: 'b', name: 'B', balance: -50 },
      { userId: 'c', name: 'C', balance: 50 },
      { userId: 'd', name: 'D', balance: -50 },
    ]);
    expect(result).toHaveLength(2);
    const totalPaid = result.reduce((s, p) => s + p.amount, 0);
    expect(totalPaid).toBeCloseTo(100, 2);
  });

  it('handles tiny fractional balances', () => {
    const result = simplifyDebts([
      { userId: 'a', name: 'A', balance: 0.005 },
      { userId: 'b', name: 'B', balance: -0.005 },
    ]);
    // Both below 0.01 threshold, should be treated as zero
    expect(result).toEqual([]);
  });
});

describe('settlementSuggestionsForUser', () => {
  it('returns empty when user has positive balance', () => {
    const result = settlementSuggestionsForUser('a', [
      { userId: 'a', name: 'Alice', balance: 100 },
      { userId: 'b', name: 'Bob', balance: -100 },
    ]);
    expect(result).toEqual([]);
  });

  it('returns empty when user has zero balance', () => {
    const result = settlementSuggestionsForUser('a', [
      { userId: 'a', name: 'Alice', balance: 0 },
      { userId: 'b', name: 'Bob', balance: 0 },
    ]);
    expect(result).toEqual([]);
  });

  it('suggests payments to creditors when user is debtor', () => {
    const result = settlementSuggestionsForUser('b', [
      { userId: 'a', name: 'Alice', balance: 80 },
      { userId: 'b', name: 'Bob', balance: -100 },
      { userId: 'c', name: 'Charlie', balance: 20 },
    ]);
    expect(result.length).toBeGreaterThan(0);
    const totalSuggested = result.reduce((s, p) => s + p.amount, 0);
    expect(totalSuggested).toBeCloseTo(100, 2);
  });

  it('distributes across multiple creditors', () => {
    const result = settlementSuggestionsForUser('d', [
      { userId: 'a', name: 'Alice', balance: 100 },
      { userId: 'b', name: 'Bob', balance: 50 },
      { userId: 'c', name: 'Charlie', balance: 30 },
      { userId: 'd', name: 'Dave', balance: -180 },
    ]);
    expect(result).toHaveLength(3);
    expect(result[0].to).toBe('a'); // largest creditor first
    expect(result[0].amount).toBe(100);
    expect(result[1].to).toBe('b');
    expect(result[1].amount).toBe(50);
    expect(result[2].to).toBe('c');
    expect(result[2].amount).toBe(30);
  });
});
