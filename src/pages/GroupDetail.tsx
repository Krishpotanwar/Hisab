import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Users, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useParams, useNavigate } from 'react-router-dom';
import { useExpenses, Balance } from '@/hooks/useExpenses';
import { useGroups, GroupMember } from '@/hooks/useGroups';
import { usePayments } from '@/hooks/usePayments';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { BalanceCard } from '@/components/BalanceCard';
import { ExpenseCard } from '@/components/ExpenseCard';
import { MemberAvatar } from '@/components/MemberAvatar';
import { AddExpenseDialog } from '@/components/AddExpenseDialog';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Skeleton } from '@/components/ui/skeleton';
import { GroupDetailSkeleton } from '@/components/GroupDetailSkeleton';

type GroupRecord = Tables<'groups'>;
interface SettlementSuggestion {
  toUserId: string;
  fullName: string;
  amount: number;
}

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { expenses, loading, getBalances } = useExpenses(id || null);
  const { getGroupMembers, addMemberByEmail } = useGroups();
  const { processingPayment, startSettlementPayment } = usePayments();

  const [group, setGroup] = useState<GroupRecord | null>(null);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [groupLoading, setGroupLoading] = useState(true);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [balancesLoading, setBalancesLoading] = useState(true);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [settlingUserId, setSettlingUserId] = useState<string | null>(null);

  const refreshMembers = useCallback(async (groupId: string) => {
    setMembersLoading(true);
    const loadedMembers = await getGroupMembers(groupId);
    setMembers(loadedMembers);
    setMembersLoading(false);
  }, [getGroupMembers]);

  const refreshBalances = useCallback(async () => {
    setBalancesLoading(true);
    const loadedBalances = await getBalances();
    setBalances(loadedBalances);
    setBalancesLoading(false);
  }, [getBalances]);

  useEffect(() => {
    if (!id) return;

    setGroupLoading(true);
    setMembersLoading(true);
    setBalancesLoading(true);
    setMembers([]);
    setBalances([]);

    supabase
      .from('groups')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setGroup(null);
          setGroupError(error?.message || 'Group not found');
        } else {
          setGroup(data);
          setGroupError(null);
        }
        setGroupLoading(false);
      });

    refreshMembers(id);
    refreshBalances();
  }, [id, refreshMembers, refreshBalances]);

  const myBalance = balances.find((balance) => balance.user_id === user?.id)?.balance || 0;

  const settlementSuggestions = useMemo<SettlementSuggestion[]>(() => {
    if (!user || myBalance >= 0) return [];

    let remaining = Number(Math.abs(myBalance).toFixed(2));
    const creditors = balances
      .filter((balance) => balance.user_id !== user.id && balance.balance > 0)
      .sort((a, b) => b.balance - a.balance);
    const suggestions: SettlementSuggestion[] = [];

    for (const creditor of creditors) {
      if (remaining <= 0.01) break;
      const amount = Number(Math.min(remaining, creditor.balance).toFixed(2));
      if (amount <= 0) continue;
      suggestions.push({
        toUserId: creditor.user_id,
        fullName: creditor.full_name,
        amount,
      });
      remaining = Number((remaining - amount).toFixed(2));
    }

    return suggestions;
  }, [balances, myBalance, user]);

  const handleSettleUp = async (toUserId: string, amount: number) => {
    if (!id || !group) return;

    setSettlingUserId(toUserId);
    const { error } = await startSettlementPayment({
      groupId: id,
      payeeUserId: toUserId,
      amount,
      notes: `Settlement for ${group.name}`,
      onVerified: refreshBalances,
    });

    if (error) {
      toast.error(error.message || 'Failed to process payment');
    } else {
      toast.success('Settlement completed');
    }
    setSettlingUserId(null);
  };

  if (groupLoading) {
    return <GroupDetailSkeleton />;
  }

  if (!group) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h2 className="text-xl font-semibold mb-2">Group unavailable</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {groupError || 'We could not load this group. It may have been removed or you no longer have access.'}
          </p>
          <Button onClick={() => navigate('/')}>Back to groups</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-primary/5 via-background to-background">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container max-w-2xl mx-auto px-4 pb-4 pt-[calc(1rem+var(--safe-area-top))] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">{group.icon}</span>
                <h1 className="font-bold text-lg">{group.name}</h1>
              </div>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6 pb-[calc(7rem+var(--safe-area-bottom))] space-y-6">
        {balancesLoading ? (
          <Skeleton className="h-28 w-full rounded-2xl" />
        ) : (
          <BalanceCard balance={myBalance} />
        )}

        {settlementSuggestions.length > 0 && (
          <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">Settle up instantly</h3>
              <span className="text-xs text-muted-foreground">UPI / cards via Razorpay</span>
            </div>
            <div className="space-y-2">
              {settlementSuggestions.map((suggestion) => (
                <div
                  key={suggestion.toUserId}
                  className="flex items-center justify-between rounded-xl border border-border/60 p-3"
                >
                  <div className="text-sm">
                    <p className="font-medium">Pay {suggestion.fullName}</p>
                    <p className="text-muted-foreground">Suggested settlement</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSettleUp(suggestion.toUserId, suggestion.amount)}
                    disabled={processingPayment || settlingUserId === suggestion.toUserId}
                  >
                    <IndianRupee className="w-3.5 h-3.5 mr-1" />
                    {suggestion.amount.toFixed(2)}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <h3 className="font-semibold">{membersLoading ? 'Members' : `Members (${members.length})`}</h3>
            </div>
            <Button variant="outline" size="sm" onClick={() => setAddingMember((prev) => !prev)}>
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>

          {addingMember && (
            <form
              className="mb-3 flex gap-2"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!id || !memberQuery.trim()) return;
                const { error } = await addMemberByEmail(id, memberQuery.trim());
                if (error) {
                  toast.error(error.message || 'Failed to add member');
                } else {
                  toast.success('Member added');
                  setMemberQuery('');
                  await refreshMembers(id);
                }
              }}
            >
              <Input
                value={memberQuery}
                onChange={(event) => setMemberQuery(event.target.value)}
                placeholder="Enter member email"
              />
              <Button type="submit" disabled={!memberQuery.trim()}>
                Add
              </Button>
            </form>
          )}

          <div className="flex gap-2 overflow-x-auto pb-2" aria-busy={membersLoading}>
            {membersLoading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <div key={`member-loading-${index}`} className="flex flex-col items-center gap-1 min-w-[60px]">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                ))
              : members.map((member) => (
                  <div key={member.user_id} className="flex flex-col items-center gap-1 min-w-[60px]">
                    <MemberAvatar name={member.full_name} size="lg" />
                    <span className="text-xs text-muted-foreground truncate max-w-[60px]">
                      {member.full_name.split(' ')[0]}
                    </span>
                  </div>
                ))}
          </div>
        </div>

        {balancesLoading ? (
          <div>
            <Skeleton className="h-4 w-24 mb-3" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={`balance-loading-${index}`} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          </div>
        ) : balances.length > 0 ? (
          <div>
            <h3 className="font-semibold mb-3">Balances</h3>
            <div className="space-y-2">
              {balances.map((balance) => (
                <div
                  key={balance.user_id}
                  className="flex items-center justify-between p-3 bg-card rounded-xl border border-border/50"
                >
                  <div className="flex items-center gap-3">
                    <MemberAvatar name={balance.full_name} size="sm" />
                    <span className="font-medium">{balance.full_name}</span>
                  </div>
                  <span className={balance.balance >= 0 ? 'text-success font-semibold' : 'text-destructive font-semibold'}>
                    {balance.balance >= 0 ? '+' : ''}₹{balance.balance.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Balances will appear once expenses are added.</div>
        )}

        <div>
          <h3 className="font-semibold mb-3">Recent Expenses</h3>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={`expense-loading-${index}`} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No expenses yet. Add your first one!</div>
          ) : (
            <div className="space-y-2">
              {expenses.map((expense, index) => (
                <ExpenseCard key={expense.id} expense={expense} index={index} />
              ))}
            </div>
          )}
        </div>
      </main>

      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="fixed bottom-[calc(1.5rem+var(--safe-area-bottom))] right-[calc(1.5rem+var(--safe-area-right))]"
      >
        <Button size="lg" className="rounded-full w-14 h-14 shadow-float" aria-label="Add expense" onClick={() => setShowAddExpense(true)}>
          <Plus className="w-6 h-6" />
        </Button>
      </motion.div>

      <AddExpenseDialog
        open={showAddExpense}
        onClose={async () => {
          setShowAddExpense(false);
          await refreshBalances();
        }}
        groupId={id || ''}
      />
    </div>
  );
}
