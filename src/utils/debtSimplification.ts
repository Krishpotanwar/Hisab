/**
 * Debt simplification / netting algorithm.
 *
 * Given a list of balances (positive = creditor, negative = debtor),
 * produces the minimum set of settlement transactions to zero everyone out.
 *
 * Extracted from the settlement-suggestion logic in GroupDetail.tsx and
 * generalised so it works for the whole group, not just one user.
 */

export interface Balance {
  userId: string;
  name: string;
  balance: number; // positive = owed money, negative = owes money
}

export interface Settlement {
  from: string;     // userId of debtor
  fromName: string;
  to: string;       // userId of creditor
  toName: string;
  amount: number;
}

/**
 * Given per-user balances, return a minimal list of settlements that
 * bring everyone to zero.
 *
 * Algorithm: greedy matching — pair the largest debtor with the largest
 * creditor, settle the smaller of the two amounts, repeat.
 */
export function simplifyDebts(balances: Balance[]): Settlement[] {
  // Round and filter out zero balances
  const debtors: { userId: string; name: string; amount: number }[] = [];
  const creditors: { userId: string; name: string; amount: number }[] = [];

  for (const b of balances) {
    const rounded = Math.round(b.balance * 100) / 100;
    if (rounded < -0.01) {
      debtors.push({ userId: b.userId, name: b.name, amount: Math.abs(rounded) });
    } else if (rounded > 0.01) {
      creditors.push({ userId: b.userId, name: b.name, amount: rounded });
    }
    // Zero balances are ignored
  }

  // Sort both descending by amount
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];

  let di = 0;
  let ci = 0;

  while (di < debtors.length && ci < creditors.length) {
    const debtor = debtors[di];
    const creditor = creditors[ci];
    const amount = Math.round(Math.min(debtor.amount, creditor.amount) * 100) / 100;

    if (amount > 0) {
      settlements.push({
        from: debtor.userId,
        fromName: debtor.name,
        to: creditor.userId,
        toName: creditor.name,
        amount,
      });
    }

    debtor.amount = Math.round((debtor.amount - amount) * 100) / 100;
    creditor.amount = Math.round((creditor.amount - amount) * 100) / 100;

    if (debtor.amount < 0.01) di++;
    if (creditor.amount < 0.01) ci++;
  }

  return settlements;
}

/**
 * Compute settlement suggestions for a single user (mirrors the original
 * GroupDetail.tsx logic).
 */
export function settlementSuggestionsForUser(
  currentUserId: string,
  balances: Balance[],
): Settlement[] {
  const myBalance = balances.find((b) => b.userId === currentUserId)?.balance || 0;
  if (myBalance >= 0) return []; // user is not a debtor

  let remaining = Math.round(Math.abs(myBalance) * 100) / 100;

  const creditors = balances
    .filter((b) => b.userId !== currentUserId && b.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  const suggestions: Settlement[] = [];
  const myName = balances.find((b) => b.userId === currentUserId)?.name ?? "You";

  for (const creditor of creditors) {
    if (remaining <= 0.01) break;
    const amount = Math.round(Math.min(remaining, creditor.balance) * 100) / 100;
    if (amount <= 0) continue;
    suggestions.push({
      from: currentUserId,
      fromName: myName,
      to: creditor.userId,
      toName: creditor.name,
      amount,
    });
    remaining = Math.round((remaining - amount) * 100) / 100;
  }

  return suggestions;
}
