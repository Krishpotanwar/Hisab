import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Users, IndianRupee, UserPlus, Link2, Download, Bell, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useParams, useNavigate } from 'react-router-dom';
import { useExpenses, Balance } from '@/hooks/useExpenses';
import { useGroups, GroupMember, PendingMember } from '@/hooks/useGroups';
import { usePayments } from '@/hooks/usePayments';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { BalanceCard } from '@/components/BalanceCard';
import { ExpenseCard } from '@/components/ExpenseCard';
import { MemberAvatar } from '@/components/MemberAvatar';
import { AddExpenseDialog } from '@/components/AddExpenseDialog';
import { AddMemberDialog } from '@/components/AddMemberDialog';
import { InviteLinkDialog } from '@/components/InviteLinkDialog';
import { GroupChat } from '@/components/GroupChat';
import { BottomNav } from '@/components/BottomNav';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/ThemeToggle';
import { GroupDetailSkeleton } from '@/components/GroupDetailSkeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { exportExpensesToCSV, exportExpensesToPDF } from '@/utils/exportData';
import { getCurrencySymbol } from '@/utils/currency';
import { SendReminderButton } from '@/components/SendReminderButton';

type GroupRecord = Tables<'groups'>;
interface SettlementSuggestion {
  toUserId: string;
  fullName: string;
  amount: number;
  upiId?: string | null;
  phone?: string | null;
}

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    expenses,
    loading,
    getBalances,
    createExpense,
    createSettlement,
    pendingSettlements,
    requestManualSettle,
    confirmPendingSettle,
    rejectPendingSettle,
  } = useExpenses(id || null);
  const { getGroupMembers, getPendingMembers, sendSettleReminder } = useGroups();
  const { processingPayment, startSettlementPayment } = usePayments();

  const [group, setGroup] = useState<GroupRecord | null>(null);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [groupLoading, setGroupLoading] = useState(true);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [balancesLoading, setBalancesLoading] = useState(true);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showInviteLink, setShowInviteLink] = useState(false);
  const [settlingUserId, setSettlingUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'expenses' | 'chat'>('expenses');
  const [reminderLoading, setReminderLoading] = useState(false);

  const refreshMembers = useCallback(async (groupId: string) => {
    setMembersLoading(true);
    const loadedMembers = await getGroupMembers(groupId);
    const loadedPending = await getPendingMembers(groupId);
    setMembers(loadedMembers);
    setPendingMembers(loadedPending);
    setMembersLoading(false);
  }, [getGroupMembers, getPendingMembers]);

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

  const groupCurrency = group?.currency || 'INR';
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
        upiId: creditor.upi_id,
        phone: creditor.phone,
      });
      remaining = Number((remaining - amount).toFixed(2));
    }

    return suggestions;
  }, [balances, myBalance, user]);

  const handleSendGroupReminder = async () => {
    if (!id) return;
    setReminderLoading(true);
    const { error } = await sendSettleReminder(id);
    if (error) {
      toast.error(error);
    } else {
      toast.success('Reminder sent to all group members! 🔔');
    }
    setReminderLoading(false);
  };

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

  const handleRequestManualSettle = async (toUserId: string, amount: number) => {
    if (!id) return;
    setSettlingUserId(toUserId);
    const { error } = await requestManualSettle(toUserId, amount, 'Marked as settled manually');
    if (error) {
      toast.error('Failed to send settlement request');
    } else {
      toast.success('Settlement request sent! Waiting for confirmation from the other person.');
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
          <BalanceCard balance={myBalance} currency={groupCurrency} />
        )}

        {/* Tab switcher */}
        <div className="flex bg-muted rounded-xl p-1">
          <button
            type="button"
            onClick={() => setActiveTab('expenses')}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === 'expenses' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
            )}
          >
            Expenses
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === 'chat' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
            )}
          >
            Chat
          </button>
        </div>

        {activeTab === 'chat' ? (
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            <GroupChat groupId={id || ''} />
          </div>
        ) : (
          <>
            {/* Pending confirmations — shown to the payee (creditor) */}
            {pendingSettlements.filter((ps) => ps.to_user === user?.id).length > 0 && (
              <div className="rounded-2xl border border-amber-500/40 bg-amber-50/5 p-4 space-y-3">
                <h3 className="font-semibold text-amber-600 dark:text-amber-400">
                  💰 Confirm Payments Received
                </h3>
                <div className="space-y-2">
                  {pendingSettlements
                    .filter((ps) => ps.to_user === user?.id)
                    .map((ps) => (
                      <div key={ps.id} className="rounded-xl border border-border/60 bg-card p-3 space-y-2">
                        <p className="text-sm">
                          <span className="font-medium">{ps.from_user_name}</span>
                          {' '}says they paid you{' '}
                          <span className="font-semibold">
                            {getCurrencySymbol(groupCurrency)}{Number(ps.amount).toFixed(2)}
                          </span>
                          {' '}outside the app.
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                            onClick={async () => {
                              const { error } = await confirmPendingSettle(ps.id);
                              if (error) {
                                toast.error('Failed to confirm payment');
                              } else {
                                toast.success('Payment confirmed! Settlement recorded.');
                                await refreshBalances();
                              }
                            }}
                          >
                            ✓ Yes, I received it
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
                            onClick={async () => {
                              const { error } = await rejectPendingSettle(ps.id);
                              if (error) {
                                toast.error('Failed to decline');
                              } else {
                                toast.info('Settlement request declined.');
                              }
                            }}
                          >
                            ✗ No, I didn't
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {settlementSuggestions.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">Settle up</h3>
                  <span className="text-xs text-muted-foreground">Pay directly via UPI</span>
                </div>
                <div className="space-y-2">
                  {settlementSuggestions.map((suggestion) => {
                    const upiHandle = suggestion.upiId || (suggestion.phone ? `${suggestion.phone.replace(/\s/g, '')}@paytm` : null);
                    const upiLink = upiHandle
                      ? `upi://pay?pa=${encodeURIComponent(upiHandle)}&pn=${encodeURIComponent(suggestion.fullName)}&am=${suggestion.amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent('HisaabKitab settlement')}`
                      : null;
                    return (
                    <div
                      key={suggestion.toUserId}
                      className="rounded-xl border border-border/60 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          <p className="font-medium">Pay {suggestion.fullName}</p>
                          <p className="text-muted-foreground">
                            {getCurrencySymbol(groupCurrency)}
                            {suggestion.amount.toFixed(2)}
                          </p>
                          {suggestion.upiId && (
                            <p className="text-xs text-muted-foreground mt-0.5">UPI: {suggestion.upiId}</p>
                          )}
                        </div>
                        {upiLink ? (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => {
                              window.location.href = upiLink;
                            }}
                          >
                            <IndianRupee className="w-3.5 h-3.5 mr-1" />
                            Pay via UPI
                          </Button>
                        ) : (
                          <span className="text-xs text-amber-500 text-right max-w-[120px]">
                            Ask {suggestion.fullName} to add UPI ID in profile
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs"
                        onClick={() => handleRequestManualSettle(suggestion.toUserId, suggestion.amount)}
                        disabled={settlingUserId === suggestion.toUserId}
                      >
                        {settlingUserId === suggestion.toUserId ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : null}
                        Mark as settled (paid outside app)
                      </Button>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <h3 className="font-semibold">{membersLoading ? 'Members' : `Members (${members.length})`}</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSendGroupReminder}
                    disabled={reminderLoading}
                    title="Remind all members to settle up (max once per 24h)"
                  >
                    {reminderLoading ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Bell className="w-3 h-3 mr-1" />
                    )}
                    Remind All
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowInviteLink(true)}>
                    <Link2 className="w-3 h-3 mr-1" />
                    Invite Link
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowAddMember(true)}>
                    <UserPlus className="w-3 h-3 mr-1" />
                    Add
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2" aria-busy={membersLoading}>
                {membersLoading
                  ? Array.from({ length: 5 }).map((_, index) => (
                    <div key={`member-loading-${index}`} className="flex flex-col items-center gap-1 min-w-[60px]">
                      <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
                      <div className="h-3 w-12 bg-muted animate-pulse rounded" />
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
                {pendingMembers.map((p) => (
                  <div key={p.id} className="flex flex-col items-center gap-1 min-w-[60px] opacity-60">
                    <div className="w-12 h-12 rounded-full bg-muted border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                      <span className="text-lg">?</span>
                    </div>
                    <span className="text-[10px] text-amber-500 truncate max-w-[60px]">Invited</span>
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
                      <div className="flex items-center gap-1">
                        <span className={balance.balance >= 0 ? 'text-success font-semibold' : 'text-destructive font-semibold'}>
                          {balance.balance >= 0 ? '+' : ''}{getCurrencySymbol(groupCurrency)}{Math.abs(balance.balance).toLocaleString(groupCurrency === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        {balance.user_id !== user?.id && balance.balance < 0 && group && (
                          <SendReminderButton
                            debtorName={balance.full_name}
                            amount={Math.abs(balance.balance)}
                            groupName={group.name}
                            debtorUserId={balance.user_id}
                            groupId={id || ''}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Balances will appear once expenses are added.</div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Recent Expenses</h3>
                {expenses.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportExpensesToCSV(expenses, group.name, `${group.name}-expenses.csv`)}
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportExpensesToPDF(expenses, group.name, `${group.name}-expenses`)}
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      PDF
                    </Button>
                  </div>
                )}
              </div>
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
                    <ExpenseCard key={expense.id} expense={expense} index={index} currency={groupCurrency} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* FAB only shows on expenses tab */}
      {activeTab === 'expenses' && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] right-[calc(1.5rem+var(--safe-area-right))]"
        >
          <Button size="lg" className="rounded-full w-14 h-14 shadow-float" aria-label="Add expense" onClick={() => setShowAddExpense(true)}>
            <Plus className="w-6 h-6" />
          </Button>
        </motion.div>
      )}

      <AddExpenseDialog
        open={showAddExpense}
        onClose={async () => {
          setShowAddExpense(false);
          await refreshBalances();
        }}
        groupId={id || ''}
        createExpense={createExpense}
      />

      {showAddMember && (
        <AddMemberDialog
          groupId={id || ''}
          members={members}
          pendingMembers={pendingMembers}
          onClose={() => setShowAddMember(false)}
          onAdded={async () => {
            setShowAddMember(false);
            if (id) await refreshMembers(id);
          }}
        />
      )}

      {showInviteLink && group && (
        <InviteLinkDialog
          groupId={id || ''}
          groupName={group.name}
          onClose={() => setShowInviteLink(false)}
        />
      )}

      <BottomNav />
    </div>
  );
}
