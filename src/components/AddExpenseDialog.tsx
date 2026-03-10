import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Check, Calendar, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { getCategoryInfo, ExpenseSplit } from '@/hooks/useExpenses';
import { useGroups, GroupMember, PendingMember } from '@/hooks/useGroups';
import { useAuth } from '@/lib/auth';
import { MemberAvatar } from './MemberAvatar';
import { ReceiptScanButton } from './ReceiptScanButton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AddExpenseDialogProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  createExpense: (
    description: string,
    amount: number,
    category: string,
    splits: ExpenseSplit[],
    date?: string,
    notes?: string,
    paidBy?: string,
    isRecurring?: boolean,
    recurringInterval?: string,
  ) => Promise<{ error: Error | null; data?: any }>;
}

const CATEGORIES = ['food', 'transport', 'entertainment', 'shopping', 'utilities', 'healthcare', 'other'];

type SplitMode = 'equal' | 'custom' | 'percent';
const SPLIT_MODES: { value: SplitMode; label: string }[] = [
  { value: 'equal', label: 'Equal' },
  { value: 'custom', label: 'Custom' },
  { value: 'percent', label: 'Percent' },
];

export function AddExpenseDialog({ open, onClose, groupId, createExpense }: AddExpenseDialogProps) {
  const { user } = useAuth();
  const { getGroupMembers, getPendingMembers } = useGroups();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('other');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);
  const [paidBy, setPaidBy] = useState<string>(user?.id ?? '');
  const [multiPayer, setMultiPayer] = useState(false);
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({});
  const [selectedPayers, setSelectedPayers] = useState<string[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [membersLoading, setMembersLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  // Maps userId -> custom amount string (for custom mode)
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  // Maps userId -> percent string (for percent mode)
  const [percentValues, setPercentValues] = useState<Record<string, string>>({});
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState<string>('monthly');

  useEffect(() => {
    if (open && groupId) {
      setMembersLoading(true);
      Promise.all([
        getGroupMembers(groupId),
        getPendingMembers(groupId),
      ]).then(([m, pending]) => {
        setMembers(m);
        setSelectedMembers(m.map(mem => mem.user_id));
        setPaidBy(user?.id ?? m[0]?.user_id ?? '');
        setPendingMembers(pending);
        setSelectedPendingIds(pending.map(p => p.id));
        setMembersLoading(false);
      });
    }
  }, [open, groupId, getGroupMembers, getPendingMembers, user]);

  const handleSplitModeChange = (mode: SplitMode) => {
    setSplitMode(mode);
    setCustomAmounts({});
    setPercentValues({});
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const togglePending = (pendingId: string) => {
    setSelectedPendingIds(prev =>
      prev.includes(pendingId)
        ? prev.filter(id => id !== pendingId)
        : [...prev, pendingId]
    );
  };

  const totalSplitCount = selectedMembers.length + selectedPendingIds.length;

  const perPerson = amount && totalSplitCount > 0
    ? Math.floor((parseFloat(amount) / totalSplitCount) * 100) / 100
    : 0;

  // Validation for custom mode
  const customTotal = useMemo(() => {
    return selectedMembers.reduce((sum, id) => {
      const val = parseFloat(customAmounts[id] || '0');
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [customAmounts, selectedMembers]);

  const amountNum = parseFloat(amount) || 0;
  const customRemaining = Math.round((amountNum - customTotal) * 100) / 100;
  const isCustomValid = splitMode !== 'custom' || (Math.abs(customRemaining) < 0.01 && amountNum > 0);

  // Validation for percent mode
  const percentTotal = useMemo(() => {
    return selectedMembers.reduce((sum, id) => {
      const val = parseFloat(percentValues[id] || '0');
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [percentValues, selectedMembers]);

  const percentRemaining = Math.round((100 - percentTotal) * 100) / 100;
  const isPercentValid = splitMode !== 'percent' || (Math.abs(percentRemaining) < 0.01);

  // Validation for multiple payers
  const payerTotal = useMemo(() => {
    if (!multiPayer) return amountNum;
    return selectedPayers.reduce((sum, id) => {
      const val = parseFloat(payerAmounts[id] || '0');
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [multiPayer, payerAmounts, selectedPayers, amountNum]);

  const payerRemaining = Math.round((amountNum - payerTotal) * 100) / 100;
  const isPayerValid = !multiPayer || (selectedPayers.length > 0 && Math.abs(payerRemaining) < 0.01 && amountNum > 0);

  const isSplitValid = (splitMode === 'equal' || isCustomValid || isPercentValid) && isPayerValid;

  const updateCustomAmount = (userId: string, value: string) => {
    setCustomAmounts(prev => ({ ...prev, [userId]: value }));
  };

  const updatePercent = (userId: string, value: string) => {
    setPercentValues(prev => ({ ...prev, [userId]: value }));
  };

  const getMemberName = (userId: string): string => {
    const member = members.find(m => m.user_id === userId);
    return member?.full_name ?? userId;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount || selectedMembers.length === 0) return;

    const totalAmount = parseFloat(amount);
    let splits: ExpenseSplit[];

    if (splitMode === 'custom') {
      // Validate custom amounts sum
      if (!isCustomValid) {
        toast.error(`Custom amounts must sum to ${totalAmount.toFixed(2)}. Remaining: ${customRemaining.toFixed(2)}`);
        return;
      }
      splits = selectedMembers.map(userId => ({
        user_id: userId,
        amount: parseFloat(customAmounts[userId] || '0'),
      }));
    } else if (splitMode === 'percent') {
      // Validate percentages sum to 100
      if (!isPercentValid) {
        toast.error(`Percentages must sum to 100%. Currently: ${percentTotal.toFixed(1)}%`);
        return;
      }
      splits = selectedMembers.map(userId => ({
        user_id: userId,
        amount: Math.round((parseFloat(percentValues[userId] || '0') / 100) * totalAmount * 100) / 100,
      }));
      // Fix rounding: assign remainder to first member
      const splitSum = splits.reduce((s, sp) => s + sp.amount, 0);
      const diff = Math.round((totalAmount - splitSum) * 100) / 100;
      if (diff !== 0 && splits.length > 0) {
        splits[0].amount = Math.round((splits[0].amount + diff) * 100) / 100;
      }
    } else {
      // Equal split
      const baseSplit = Math.floor((totalAmount / totalSplitCount) * 100) / 100;
      const remainder = Math.round((totalAmount - baseSplit * totalSplitCount) * 100) / 100;
      splits = selectedMembers.map((userId, index) => ({
        user_id: userId,
        amount: index === 0 ? baseSplit + remainder : baseSplit,
      }));
    }

    // Build notes
    const notesParts: string[] = [];

    // Multi-payer info encoded in notes
    if (multiPayer && selectedPayers.length > 1) {
      const multiPayerData = selectedPayers.map(uid => ({
        userId: uid,
        amount: parseFloat(payerAmounts[uid] || '0'),
      }));
      notesParts.push(`__MULTIPAYER__${JSON.stringify(multiPayerData)}`);
    }

    // Pending member notes
    const selectedPending = pendingMembers.filter(p => selectedPendingIds.includes(p.id));
    if (selectedPending.length > 0) {
      if (splitMode === 'equal') {
        const baseSplit = Math.floor((totalAmount / totalSplitCount) * 100) / 100;
        notesParts.push(selectedPending
          .map(p => `Invited: ${p.invited_name || p.invited_email} owes ₹${baseSplit.toFixed(2)}`)
          .join('; '));
      } else {
        notesParts.push(selectedPending
          .map(p => `Invited: ${p.invited_name || p.invited_email} (split pending)`)
          .join('; '));
      }
    }

    const finalNotes = notesParts.length > 0 ? notesParts.join('\n') : undefined;
    const primaryPayer = multiPayer && selectedPayers.length > 0
      ? selectedPayers.reduce((best, uid) => {
          const bestAmt = parseFloat(payerAmounts[best] || '0');
          const curAmt = parseFloat(payerAmounts[uid] || '0');
          return curAmt > bestAmt ? uid : best;
        })
      : paidBy;

    setLoading(true);
    const { error } = await createExpense(
      description.trim(),
      totalAmount,
      category,
      splits,
      date,
      finalNotes,
      primaryPayer,
      isRecurring,
      isRecurring ? recurringInterval : undefined,
    );
    setLoading(false);

    if (error) {
      toast.error('Failed to add expense');
    } else {
      toast.success('Expense added!');
      setDescription('');
      setAmount('');
      setCategory('other');
      setDate(new Date().toISOString().slice(0, 10));
      setSplitMode('equal');
      setCustomAmounts({});
      setPercentValues({});
      setIsRecurring(false);
      setRecurringInterval('monthly');
      setMultiPayer(false);
      setPayerAmounts({});
      setSelectedPayers([]);
      onClose();
    }
  };

  const modal = (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998]"
          />

          {/* Centering wrapper */}
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              className="w-full max-w-md bg-card rounded-2xl shadow-2xl flex flex-col max-h-[85dvh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
                <h2 className="text-lg font-semibold">Add Expense</h2>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label htmlFor="amount">Amount (₹)</Label>
                      <ReceiptScanButton
                        onScanned={(amt, _text) => {
                          if (amt) setAmount(String(amt));
                        }}
                        disabled={loading}
                      />
                    </div>
                    <Input
                      id="amount"
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      required
                      min="0"
                      step="0.01"
                      autoFocus
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What was this expense for?"
                      className="mt-1.5"
                      required
                    />
                  </div>

                  {/* Date picker */}
                  <div>
                    <Label htmlFor="expense-date" className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      Date
                    </Label>
                    <Input
                      id="expense-date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      max={new Date().toISOString().slice(0, 10)}
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-2 block">Category</Label>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIES.map((cat) => {
                        const info = getCategoryInfo(cat);
                        if (!info) return null;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setCategory(cat)}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-sm flex items-center gap-1.5 transition-all",
                              category === cat
                                ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            )}
                          >
                            <span>{info.icon}</span>
                            <span>{info.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Paid By selector */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium">Paid by</Label>
                      <button
                        type="button"
                        onClick={() => {
                          setMultiPayer(prev => {
                            if (!prev) {
                              setSelectedPayers([user?.id ?? members[0]?.user_id ?? '']);
                              setPayerAmounts({});
                            }
                            return !prev;
                          });
                        }}
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full transition-all",
                          multiPayer
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        )}
                      >
                        {multiPayer ? 'Multiple' : 'Single'}
                      </button>
                    </div>

                    {!multiPayer ? (
                      <div className="flex gap-2 flex-wrap" aria-busy={membersLoading}>
                        {membersLoading
                          ? Array.from({ length: 3 }).map((_, index) => (
                            <Skeleton key={`paid-skeleton-${index}`} className="h-8 w-20 rounded-full" />
                          ))
                          : members.map(m => (
                            <button
                              key={m.user_id}
                              type="button"
                              onClick={() => setPaidBy(m.user_id)}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-sm transition-all",
                                paidBy === m.user_id
                                  ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              )}
                            >
                              {m.full_name.split(' ')[0]}
                            </button>
                          ))
                        }
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {!membersLoading && members.map(m => {
                          const isSelected = selectedPayers.includes(m.user_id);
                          return (
                            <div key={m.user_id} className={cn(
                              "flex items-center gap-3 p-3 rounded-xl transition-all",
                              isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-muted'
                            )}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPayers(prev =>
                                    prev.includes(m.user_id)
                                      ? prev.filter(id => id !== m.user_id)
                                      : [...prev, m.user_id]
                                  );
                                }}
                                className="flex items-center gap-2 flex-1 text-left"
                              >
                                <MemberAvatar name={m.full_name} size="sm" />
                                <span className="text-sm font-medium">{m.full_name.split(' ')[0]}</span>
                              </button>
                              {isSelected && (
                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                  <span className="text-xs text-muted-foreground">₹</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={payerAmounts[m.user_id] ?? ''}
                                    onChange={e => setPayerAmounts(prev => ({ ...prev, [m.user_id]: e.target.value }))}
                                    className="w-20 h-7 rounded-md border border-border bg-background px-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {amount && selectedPayers.length > 0 && (
                          <p className={cn(
                            "text-sm text-center font-medium",
                            isPayerValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                          )}>
                            {isPayerValid
                              ? 'Payer amounts match total'
                              : `Remaining: ₹${payerRemaining.toFixed(2)} of ₹${amountNum.toFixed(2)}`}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Split mode selector */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Split mode</Label>
                    <div className="flex flex-wrap gap-2">
                      {SPLIT_MODES.map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleSplitModeChange(value)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-sm transition-all",
                            splitMode === value
                              ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-2 block">Split between</Label>
                    <div className="space-y-2" aria-busy={membersLoading}>
                      {membersLoading
                        ? Array.from({ length: 4 }).map((_, index) => (
                          <div
                            key={`member-skeleton-${index}`}
                            className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted"
                          >
                            <Skeleton className="h-8 w-8 rounded-full" />
                            <Skeleton className="h-4 flex-1" />
                            <Skeleton className="h-5 w-5 rounded-full" />
                          </div>
                        ))
                        : members.map((member) => {
                          const isSelected = selectedMembers.includes(member.user_id);
                          return (
                            <div key={member.user_id} className="space-y-1">
                              <button
                                type="button"
                                onClick={() => toggleMember(member.user_id)}
                                className={cn(
                                  "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
                                  isSelected
                                    ? 'bg-primary/10 ring-1 ring-primary/30'
                                    : 'bg-muted hover:bg-muted/80'
                                )}
                              >
                                <MemberAvatar name={member.full_name} size="sm" />
                                <span className="flex-1 text-left font-medium">{member.full_name}</span>

                                {/* Inline split input for custom / percent modes */}
                                {isSelected && splitMode === 'custom' && (
                                  <div
                                    className="flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <span className="text-xs text-muted-foreground">₹</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      placeholder="0.00"
                                      value={customAmounts[member.user_id] ?? ''}
                                      onChange={(e) => updateCustomAmount(member.user_id, e.target.value)}
                                      className="w-20 h-7 rounded-md border border-border bg-background px-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                  </div>
                                )}

                                {isSelected && splitMode === 'percent' && (
                                  <div
                                    className="flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.1"
                                      placeholder="0"
                                      value={percentValues[member.user_id] ?? ''}
                                      onChange={(e) => updatePercent(member.user_id, e.target.value)}
                                      className="w-16 h-7 rounded-md border border-border bg-background px-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                    <span className="text-xs text-muted-foreground">%</span>
                                  </div>
                                )}

                                {isSelected && splitMode === 'equal' && (
                                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                    <Check className="w-3 h-3 text-primary-foreground" />
                                  </div>
                                )}
                                {isSelected && splitMode !== 'equal' && (
                                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center ml-1">
                                    <Check className="w-3 h-3 text-primary-foreground" />
                                  </div>
                                )}
                                {!isSelected && null}
                              </button>
                            </div>
                          );
                        })}

                      {/* Pending / Invited members */}
                      {!membersLoading && pendingMembers.length > 0 && (
                        <>
                          <p className="text-xs text-muted-foreground pt-1 pb-0.5 font-medium">Invited (not yet joined)</p>
                          {pendingMembers.map((pending) => {
                            const isSelected = selectedPendingIds.includes(pending.id);
                            return (
                              <button
                                key={pending.id}
                                type="button"
                                onClick={() => togglePending(pending.id)}
                                className={cn(
                                  "w-full flex items-center gap-3 p-3 rounded-xl transition-all opacity-75",
                                  isSelected
                                    ? 'bg-amber-500/10 ring-1 ring-amber-500/30'
                                    : 'bg-muted hover:bg-muted/80'
                                )}
                              >
                                <div className="w-8 h-8 rounded-full bg-muted border-2 border-dashed border-amber-400/60 flex items-center justify-center flex-shrink-0">
                                  <span className="text-sm">?</span>
                                </div>
                                <span className="flex-1 text-left font-medium text-sm">
                                  {pending.invited_name || pending.invited_email}
                                </span>
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 mr-1">
                                  Invited
                                </span>
                                {isSelected && (
                                  <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                                    <Check className="w-3 h-3 text-white" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </>
                      )}
                    </div>

                    {/* Split summary / validation feedback */}
                    {amount && totalSplitCount > 0 && splitMode === 'equal' && (
                      <p className="mt-2 text-sm text-muted-foreground text-center">
                        ₹{perPerson.toFixed(2)} per person
                      </p>
                    )}

                    {amount && selectedMembers.length > 0 && splitMode === 'custom' && (
                      <p
                        className={cn(
                          "mt-2 text-sm text-center font-medium",
                          isCustomValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                        )}
                      >
                        {isCustomValid
                          ? 'Amounts add up correctly'
                          : `Remaining: ₹${customRemaining.toFixed(2)} of ₹${amountNum.toFixed(2)}`}
                      </p>
                    )}

                    {amount && selectedMembers.length > 0 && splitMode === 'percent' && (
                      <p
                        className={cn(
                          "mt-2 text-sm text-center font-medium",
                          isPercentValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                        )}
                      >
                        {isPercentValid
                          ? 'Percentages add up to 100%'
                          : `Total: ${percentTotal.toFixed(1)}% — remaining: ${percentRemaining.toFixed(1)}%`}
                      </p>
                    )}
                  </div>

                  {/* Recurring expense toggle */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setIsRecurring(prev => !prev)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
                        isRecurring
                          ? 'bg-primary/10 ring-1 ring-primary/30'
                          : 'bg-muted hover:bg-muted/80'
                      )}
                    >
                      <Repeat className={cn("w-4 h-4", isRecurring ? "text-primary" : "text-muted-foreground")} />
                      <span className="flex-1 text-left text-sm font-medium">Recurring expense</span>
                      {isRecurring && (
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                      )}
                    </button>

                    {isRecurring && (
                      <div className="flex gap-2">
                        {(['weekly', 'monthly', 'yearly'] as const).map((interval) => (
                          <button
                            key={interval}
                            type="button"
                            onClick={() => setRecurringInterval(interval)}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-sm capitalize transition-all",
                              recurringInterval === interval
                                ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            )}
                          >
                            {interval}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 border-t border-border flex-shrink-0">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading || !description.trim() || !amount || selectedMembers.length === 0 || !isSplitValid}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {loading ? 'Adding...' : 'Add Expense'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
}
