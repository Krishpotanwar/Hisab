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
  food:          { label: 'Food & Drinks',   icon: '🍔' },
  transport:     { label: 'Transport',        icon: '🚗' },
  entertainment: { label: 'Entertainment',    icon: '🎬' },
  shopping:      { label: 'Shopping',         icon: '🛍️' },
  utilities:     { label: 'Utilities',        icon: '💡' },
  healthcare:    { label: 'Healthcare',       icon: '🏥' },
  other:         { label: 'Other',            icon: '📦' },
};

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

    // ── 2. Monthly spending (last 6 months) ──────────────────
    const months: MonthlyData[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const from = startOfMonth(d).toISOString().slice(0, 10);
      const to   = endOfMonth(d).toISOString().slice(0, 10);

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
        const split = (e.expense_splits ?? []).find((s: any) => s.user_id === user.id);
        if (split) myShare += Number(split.amount);
      });

      months.push({ month: format(d, 'MMM'), total, myShare });
    }

    setMonthlyData(months);
    setTotalThisMonth(months[months.length - 1]?.myShare ?? 0);

    // ── 3. Per-group balances ─────────────────────────────────
    const allBalances: BalanceSummary[] = [];

    for (const gid of groupIds) {
      const { data: members } = await supabase
        .from('group_members')
        .select('user_id, profiles(full_name)')
        .eq('group_id', gid);

      const { data: exps } = await supabase
        .from('expenses')
        .select('id, amount, paid_by')
        .eq('group_id', gid);

      const expIds = (exps ?? []).map((e: any) => e.id);
      let splits: any[] = [];
      if (expIds.length > 0) {
        const { data } = await supabase
          .from('expense_splits')
          .select('expense_id, user_id, amount')
          .in('expense_id', expIds);
        splits = data ?? [];
      }

      const { data: settlements } = await supabase
        .from('settlements')
        .select('from_user, to_user, amount')
        .eq('group_id', gid);

      const bal: Record<string, number> = {};
      (members ?? []).forEach((m: any) => { bal[m.user_id] = 0; });
      (exps ?? []).forEach((e: any) => { if (bal[e.paid_by] !== undefined) bal[e.paid_by] += Number(e.amount); });
      splits.forEach((s: any) => { if (bal[s.user_id] !== undefined) bal[s.user_id] -= Number(s.amount); });
      (settlements ?? []).forEach((s: any) => {
        if (bal[s.from_user] !== undefined) bal[s.from_user] -= Number(s.amount);
        if (bal[s.to_user]   !== undefined) bal[s.to_user]   += Number(s.amount);
      });

      const myBal = bal[user.id] ?? 0;

      (members ?? []).forEach((m: any) => {
        if (m.user_id === user.id) return;
        const theirBal = bal[m.user_id] ?? 0;
        // If I have positive balance and they negative → they owe me
        // Simplified: net between me and them
        const net = -(theirBal); // positive = they owe me
        if (Math.abs(net) > 0.01) {
          allBalances.push({
            userId: m.user_id,
            name: m.profiles?.full_name ?? 'Unknown',
            groupName: groupNames[gid],
            amount: myBal > 0 && theirBal < 0 ? Math.min(myBal, -theirBal) : myBal < 0 && theirBal > 0 ? -Math.min(-myBal, theirBal) : 0,
          });
        }
      });
    }

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
