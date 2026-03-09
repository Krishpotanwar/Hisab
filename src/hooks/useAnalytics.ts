import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

export interface MonthlyData {
  month: string;       // "Jan", "Feb" …
  total: number;
  myShare: number;
}

export interface BalanceSummary {
  userId: string;
  name: string;
  groupName: string;
  amount: number;       // positive = they owe me, negative = I owe them
}

export interface CategoryData {
  category: string;
  label: string;
  icon: string;
  total: number;
}

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  food: { label: 'Food & Drinks', icon: '🍔' },
  transport: { label: 'Transport', icon: '🚗' },
  entertainment: { label: 'Entertainment', icon: '🎬' },
  shopping: { label: 'Shopping', icon: '🛍️' },
  utilities: { label: 'Utilities', icon: '💡' },
  healthcare: { label: 'Healthcare', icon: '🏥' },
  other: { label: 'Other', icon: '📦' },
};

// Fix #4: Helper to fetch single group balance
async function fetchGroupBalance(gid: string, userId: string) {
  const [membersRes, expsRes, settlementsRes] = await Promise.all([
    supabase.from('group_members').select('user_id, profiles(full_name)').eq('group_id', gid),
    supabase.from('expenses').select('id, amount, paid_by').eq('group_id', gid),
    supabase.from('settlements').select('from_user, to_user, amount').eq('group_id', gid),
  ]);

  const members = membersRes.data ?? [];
  const exps = expsRes.data ?? [];
  const settlements = settlementsRes.data ?? [];

  const expIds = exps.map((e: any) => e.id);
  let splits: any[] = [];
  if (expIds.length > 0) {
    const { data } = await supabase
      .from('expense_splits')
      .select('expense_id, user_id, amount')
      .in('expense_id', expIds);
    splits = data ?? [];
  }

  // Calculate per-member balances
  const bal: Record<string, number> = {};
  members.forEach((m: any) => { bal[m.user_id] = 0; });
  exps.forEach((e: any) => { if (bal[e.paid_by] !== undefined) bal[e.paid_by] += Number(e.amount); });
  splits.forEach((s: any) => { if (bal[s.user_id] !== undefined) bal[s.user_id] -= Number(s.amount); });
  settlements.forEach((s: any) => {
    if (bal[s.from_user] !== undefined) bal[s.from_user] -= Number(s.amount);
    if (bal[s.to_user] !== undefined) bal[s.to_user] += Number(s.amount);
  });

  return { members, bal };
}

// Fix #4: Helper to fetch monthly expenses
async function fetchMonthlyExpenses(from: string, to: string, groupIds: string[], userId: string) {
  const { data: expRows } = await supabase
    .from('expenses')
    .select('amount, paid_by, expense_splits(user_id, amount)')
    .in('group_id', groupIds)
    .gte('date', from)
    .lte('date', to);

  let total = 0;
  let myShare = 0;
  (expRows ?? []).forEach((e: any) => {
    total += Number(e.amount);
    const split = (e.expense_splits ?? []).find((s: any) => s.user_id === userId);
    if (split) myShare += Number(split.amount);
  });

  return { total, myShare };
}

export function useAnalytics() {
  const { user } = useAuth();
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [balances, setBalances] = useState<BalanceSummary[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [totalThisMonth, setTotalThisMonth] = useState(0);
  const [totalOwedToMe, setTotalOwedToMe] = useState(0);
  const [totalIOwe, setTotalIOwe] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // ── 1. Get all groups user belongs to ────────────────────
    const { data: memberRows } = await supabase
      .from('group_members')
      .select('group_id, groups(id, name)')
      .eq('user_id', user.id);

    const groupIds: string[] = (memberRows ?? []).map((r: any) => r.group_id);
    const groupNames: Record<string, string> = {};
    (memberRows ?? []).forEach((r: any) => {
      groupNames[r.group_id] = r.groups?.name ?? 'Unknown';
    });

    if (groupIds.length === 0) {
      setLoading(false);
      return;
    }

    // ── 2. Monthly spending (last 6 months) — Fix #4: parallelize ──
    const now = new Date();
    const monthRanges = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i);
      return {
        d,
        from: startOfMonth(d).toISOString().slice(0, 10),
        to: endOfMonth(d).toISOString().slice(0, 10),
      };
    });

    const monthlyResults = await Promise.all(
      monthRanges.map(({ from, to }) => fetchMonthlyExpenses(from, to, groupIds, user.id))
    );

    const months: MonthlyData[] = monthlyResults.map((result, i) => ({
      month: format(monthRanges[i].d, 'MMM'),
      total: result.total,
      myShare: result.myShare,
    }));

    setMonthlyData(months);
    setTotalThisMonth(months[months.length - 1]?.myShare ?? 0);

    // ── 3. Per-group balances — Fix #4: parallelize + Fix #5: correct calculation ──
    const groupResults = await Promise.all(
      groupIds.map(gid => fetchGroupBalance(gid, user.id))
    );

    const allBalances: BalanceSummary[] = [];

    groupResults.forEach(({ members, bal }, idx) => {
      const gid = groupIds[idx];
      const myBal = bal[user.id] ?? 0;

      // Fix #5: Simply report MY balance in this group
      // A positive balance means the group owes me, negative means I owe the group
      if (Math.abs(myBal) > 0.01) {
        allBalances.push({
          userId: gid, // use group as key
          name: groupNames[gid],
          groupName: groupNames[gid],
          amount: myBal,
        });
      }
    });

    const meaningful = allBalances.filter((b) => Math.abs(b.amount) > 0.01);
    setBalances(meaningful);
    setTotalOwedToMe(meaningful.filter((b) => b.amount > 0).reduce((s, b) => s + b.amount, 0));
    setTotalIOwe(meaningful.filter((b) => b.amount < 0).reduce((s, b) => s + Math.abs(b.amount), 0));

    // ── 4. Category breakdown (all time) ─────────────────────
    const { data: catRows } = await supabase
      .from('expenses')
      .select('category, amount')
      .in('group_id', groupIds);

    const catMap: Record<string, number> = {};
    (catRows ?? []).forEach((e: any) => {
      catMap[e.category] = (catMap[e.category] ?? 0) + Number(e.amount);
    });

    const cats = Object.entries(catMap)
      .map(([cat, total]) => ({
        category: cat,
        label: CATEGORY_META[cat]?.label ?? cat,
        icon: CATEGORY_META[cat]?.icon ?? '📦',
        total,
      }))
      .sort((a, b) => b.total - a.total);

    setCategoryData(cats);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  return { monthlyData, balances, categoryData, totalThisMonth, totalOwedToMe, totalIOwe, loading };
}
