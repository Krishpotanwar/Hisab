import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Check, Calendar } from 'lucide-react';
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
  ) => Promise<{ error: Error | null; data?: any }>;
}

const CATEGORIES = ['food', 'transport', 'entertainment', 'shopping', 'utilities', 'healthcare', 'other'];

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
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [membersLoading, setMembersLoading] = useState(false);
  const [loading, setLoading] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount || selectedMembers.length === 0) return;

    const amountNum = parseFloat(amount);

    // Round to 2 decimal places, assign remainder to first confirmed member
    const baseSplit = Math.floor((amountNum / totalSplitCount) * 100) / 100;
    const remainder = Math.round((amountNum - baseSplit * totalSplitCount) * 100) / 100;

    const splits = selectedMembers.map((userId, index) => ({
      user_id: userId,
      amount: index === 0 ? baseSplit + remainder : baseSplit,
    }));

    // Build notes for pending members
    const selectedPending = pendingMembers.filter(p => selectedPendingIds.includes(p.id));
    const pendingNotes = selectedPending.length > 0
      ? selectedPending
          .map(p => `Invited: ${p.invited_name || p.invited_email} owes ₹${baseSplit.toFixed(2)}`)
          .join('; ')
      : undefined;

    setLoading(true);
    const { error } = await createExpense(
      description.trim(),
      amountNum,
      category,
      splits,
      date,
      pendingNotes,
      paidBy,
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
                    <Label className="text-sm font-medium mb-2 block">Paid by</Label>
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
                        : members.map((member) => (
                          <button
                            key={member.user_id}
                            type="button"
                            onClick={() => toggleMember(member.user_id)}
                            className={cn(
                              "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
                              selectedMembers.includes(member.user_id)
                                ? 'bg-primary/10 ring-1 ring-primary/30'
                                : 'bg-muted hover:bg-muted/80'
                            )}
                          >
                            <MemberAvatar name={member.full_name} size="sm" />
                            <span className="flex-1 text-left font-medium">{member.full_name}</span>
                            {selectedMembers.includes(member.user_id) && (
                              <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                <Check className="w-3 h-3 text-primary-foreground" />
                              </div>
                            )}
                          </button>
                        ))}

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
                    {amount && totalSplitCount > 0 && (
                      <p className="mt-2 text-sm text-muted-foreground text-center">
                        ₹{perPerson.toFixed(2)} per person
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-4 border-t border-border flex-shrink-0">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading || !description.trim() || !amount || selectedMembers.length === 0}
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
