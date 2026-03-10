/**
 * Split calculation utilities for expense splitting.
 *
 * Extracted from AddExpenseDialog so the math is independently testable.
 */

export interface SplitResult {
  userId: string;
  amount: number;
}

/**
 * Equal split: divides `totalAmount` evenly among `userIds`.
 * Any rounding remainder (caused by cents that don't divide evenly)
 * is assigned to the first user so the amounts always sum to totalAmount.
 *
 * Amounts are rounded to 2 decimal places.
 */
export function equalSplit(totalAmount: number, userIds: string[]): SplitResult[] {
  if (userIds.length === 0) return [];

  const count = userIds.length;
  const baseSplit = Math.floor((totalAmount / count) * 100) / 100;
  const remainder = Math.round((totalAmount - baseSplit * count) * 100) / 100;

  return userIds.map((userId, index) => ({
    userId,
    amount: index === 0 ? Math.round((baseSplit + remainder) * 100) / 100 : baseSplit,
  }));
}

/**
 * Percent split: each user is assigned a percentage. Percentages must sum to 100.
 * Rounding remainder is assigned to the first user.
 */
export function percentSplit(
  totalAmount: number,
  userPercents: { userId: string; percent: number }[],
): SplitResult[] {
  if (userPercents.length === 0) return [];

  const splits: SplitResult[] = userPercents.map(({ userId, percent }) => ({
    userId,
    amount: Math.round((percent / 100) * totalAmount * 100) / 100,
  }));

  // Fix rounding: assign remainder to first member
  const splitSum = splits.reduce((sum, s) => sum + s.amount, 0);
  const diff = Math.round((totalAmount - splitSum) * 100) / 100;
  if (diff !== 0 && splits.length > 0) {
    splits[0].amount = Math.round((splits[0].amount + diff) * 100) / 100;
  }

  return splits;
}

/**
 * Custom (exact-amount) split: each user has a manually-assigned amount.
 * Returns null if amounts do not sum to totalAmount (within 0.01 tolerance).
 */
export function customSplit(
  totalAmount: number,
  userAmounts: { userId: string; amount: number }[],
): SplitResult[] | null {
  const total = userAmounts.reduce((sum, u) => sum + u.amount, 0);
  if (Math.abs(totalAmount - total) >= 0.01) return null;

  return userAmounts.map(({ userId, amount }) => ({ userId, amount }));
}

/**
 * Shares-based split: each user has a number of shares. The total is divided
 * proportionally. Rounding remainder goes to the first user.
 */
export function sharesSplit(
  totalAmount: number,
  userShares: { userId: string; shares: number }[],
): SplitResult[] {
  const totalShares = userShares.reduce((sum, u) => sum + u.shares, 0);
  if (totalShares === 0) return [];

  const splits: SplitResult[] = userShares.map(({ userId, shares }) => ({
    userId,
    amount: Math.round((shares / totalShares) * totalAmount * 100) / 100,
  }));

  const splitSum = splits.reduce((sum, s) => sum + s.amount, 0);
  const diff = Math.round((totalAmount - splitSum) * 100) / 100;
  if (diff !== 0 && splits.length > 0) {
    splits[0].amount = Math.round((splits[0].amount + diff) * 100) / 100;
  }

  return splits;
}

/**
 * Itemized split: each user has specific items with prices.
 * Returns the per-user totals.
 */
export function itemizedSplit(
  userItems: { userId: string; items: { name: string; price: number }[] }[],
): SplitResult[] {
  return userItems.map(({ userId, items }) => ({
    userId,
    amount: Math.round(items.reduce((sum, item) => sum + item.price, 0) * 100) / 100,
  }));
}

/**
 * Multiple payers split: when more than one person paid, compute each person's
 * net owed amount.  payers[i].paid is what they contributed; splits[i].amount
 * is what they owe. Net = owed - paid (positive means they still owe money).
 */
export function multiplePayers(
  payers: { userId: string; paid: number }[],
  splits: SplitResult[],
): { userId: string; net: number }[] {
  const paidMap = new Map<string, number>();
  for (const p of payers) {
    paidMap.set(p.userId, (paidMap.get(p.userId) || 0) + p.paid);
  }

  return splits.map((s) => ({
    userId: s.userId,
    net: Math.round((s.amount - (paidMap.get(s.userId) || 0)) * 100) / 100,
  }));
}
