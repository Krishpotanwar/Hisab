import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/lib/auth';

type ExpenseRow = Tables<'expenses'>;
type GroupMemberRow = {
  user_id: string;
  profiles: {
    full_name: string;
  } | null;
};
type ExpenseWithProfile = ExpenseRow & {
  profiles: {
    full_name: string;
  } | null;
};
type SplitRow = Pick<Tables<'expense_splits'>, 'expense_id' | 'user_id' | 'amount'>;
type SettlementRow = Pick<Tables<'settlements'>, 'from_user' | 'to_user' | 'amount'>;

export interface Expense {
  id: string;
  group_id: string;
  description: string;
  amount: number;
  category: string;
  paid_by: string;
  paid_by_name?: string;
  date: string;
  notes: string | null;
  created_at: string;
}

export interface ExpenseSplit {
  user_id: string;
  amount: number;
}

export interface Balance {
  user_id: string;
  full_name: string;
  balance: number;
}

const CATEGORIES = {
  food: { icon: '🍔', label: 'Food & Drinks', color: 'food' },
  transport: { icon: '🚗', label: 'Transport', color: 'transport' },
  entertainment: { icon: '🎬', label: 'Entertainment', color: 'entertainment' },
  shopping: { icon: '🛍️', label: 'Shopping', color: 'shopping' },
  utilities: { icon: '💡', label: 'Utilities', color: 'utilities' },
  healthcare: { icon: '🏥', label: 'Healthcare', color: 'healthcare' },
  other: { icon: '📦', label: 'Other', color: 'other' },
};

export const getCategoryInfo = (category: string) => {
  return CATEGORIES[category as keyof typeof CATEGORIES] || CATEGORIES.other;
};

export function useExpenses(groupId: string | null) {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExpenses = useCallback(async () => {
    if (!groupId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('expenses')
      .select(
        `
        *,
        profiles!expenses_paid_by_profiles_fkey(full_name)
      `,
      )
      .eq('group_id', groupId)
      .order('date', { ascending: false });

    if (!error && data) {
      const formattedExpenses = (data as ExpenseWithProfile[]).map((expense) => ({
        ...expense,
        paid_by_name: expense.profiles?.full_name ?? 'Unknown',
      }));
      setExpenses(formattedExpenses);
    }

    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const createExpense = async (
    description: string,
    amount: number,
    category: string,
    splits: ExpenseSplit[],
    date?: string,
    notes?: string,
    paidBy?: string,
  ) => {
    if (!user || !groupId) return { error: new Error('Not authenticated or no group selected') };

    const { data: expenseData, error: expenseError } = await supabase
      .from('expenses')
      .insert({
        group_id: groupId,
        description,
        amount,
        category,
        paid_by: paidBy || user.id,
        date: date || new Date().toISOString().slice(0, 10),
        notes: notes || null,
      })
      .select()
      .single();

    if (expenseError) return { error: expenseError };

    const splitsToInsert = splits.map((split) => ({
      expense_id: expenseData.id,
      user_id: split.user_id,
      amount: split.amount,
    }));

    const { error: splitsError } = await supabase.from('expense_splits').insert(splitsToInsert);

    if (splitsError) return { error: splitsError };

    await fetchExpenses();

    // Fire notifications to all group members (except payer)
    supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId)
      .then(({ data: members }) => {
        const recipients = (members ?? [])
          .map((m: any) => m.user_id)
          .filter((id: string) => id !== (paidBy || user.id));
        if (recipients.length === 0) return;

        supabase
          .from('groups')
          .select('name')
          .eq('id', groupId)
          .single()
          .then(({ data: grp }) => {
            supabase.functions.invoke('notify', {
              body: {
                type: 'expense_added',
                recipientUserIds: recipients,
                title: `New expense: ${description}`,
                body: `₹${amount} was added by ${user.user_metadata?.full_name ?? 'someone'} in "${(grp as any)?.name ?? 'your group'}"`,
                groupId,
                groupName: (grp as any)?.name,
                expenseId: expenseData.id,
              },
            });
          });
      });

    return { data: expenseData, error: null };
  };

  const getBalances = useCallback(async (): Promise<Balance[]> => {
    if (!groupId) return [];

    const { data: membersData, error: membersError } = await supabase
      .from('group_members')
      .select(
        `
        user_id,
        profiles!inner(full_name)
      `,
      )
      .eq('group_id', groupId);

    if (membersError || !membersData) return [];
    const members = membersData as GroupMemberRow[];

    const { data: expensesData, error: expensesError } = await supabase
      .from('expenses')
      .select('id, amount, paid_by')
      .eq('group_id', groupId);

    if (expensesError) return [];

    const expenseIds = (expensesData ?? []).map((expense) => expense.id);
    let splitsData: SplitRow[] = [];

    if (expenseIds.length > 0) {
      const { data: splitRows, error: splitsError } = await supabase
        .from('expense_splits')
        .select('expense_id, user_id, amount')
        .in('expense_id', expenseIds);

      if (splitsError) return [];
      splitsData = (splitRows ?? []) as SplitRow[];
    }

    const { data: settlementsData, error: settlementsError } = await supabase
      .from('settlements')
      .select('from_user, to_user, amount')
      .eq('group_id', groupId);

    if (settlementsError) return [];
    const settlements = (settlementsData ?? []) as SettlementRow[];

    const balances: Record<string, number> = {};

    members.forEach((member) => {
      balances[member.user_id] = 0;
    });

    expensesData?.forEach((expense) => {
      if (balances[expense.paid_by] !== undefined) {
        balances[expense.paid_by] += Number(expense.amount);
      }
    });

    splitsData.forEach((split) => {
      if (balances[split.user_id] !== undefined) {
        balances[split.user_id] -= Number(split.amount);
      }
    });

    settlements.forEach((settlement) => {
      if (balances[settlement.from_user] !== undefined) {
        balances[settlement.from_user] -= Number(settlement.amount);
      }
      if (balances[settlement.to_user] !== undefined) {
        balances[settlement.to_user] += Number(settlement.amount);
      }
    });

    return members.map((member) => ({
      user_id: member.user_id,
      full_name: member.profiles?.full_name ?? 'Unknown',
      balance: balances[member.user_id] || 0,
    }));
  }, [groupId]);

  const createSettlement = async (toUser: string, amount: number, notes?: string) => {
    if (!user || !groupId) return { error: new Error('Not authenticated') };

    const { error } = await supabase.from('settlements').insert({
      group_id: groupId,
      from_user: user.id,
      to_user: toUser,
      amount,
      notes: notes || null,
    });

    if (!error) {
      // Notify both parties
      supabase
        .from('groups')
        .select('name')
        .eq('id', groupId)
        .single()
        .then(({ data: grp }) => {
          const myName = user.user_metadata?.full_name ?? 'Someone';
          supabase.functions.invoke('notify', {
            body: {
              type: 'settlement',
              recipientUserIds: [toUser],
              title: `${myName} settled up!`,
              body: `${myName} paid you ₹${amount} in "${(grp as any)?.name ?? 'your group'}"`,
              groupId,
              groupName: (grp as any)?.name,
            },
          });
        });
    }

    return { error };
  };

  return {
    expenses,
    loading,
    createExpense,
    getBalances,
    createSettlement,
    refetch: fetchExpenses,
    categories: CATEGORIES,
  };
}
