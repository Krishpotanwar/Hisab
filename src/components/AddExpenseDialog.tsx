import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useExpenses, getCategoryInfo } from '@/hooks/useExpenses';
import { useGroups, GroupMember } from '@/hooks/useGroups';
import { MemberAvatar } from './MemberAvatar';
import { ReceiptScanButton } from './ReceiptScanButton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AddExpenseDialogProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
}

const CATEGORIES = ['food', 'transport', 'entertainment', 'shopping', 'utilities', 'healthcare', 'other'];

export function AddExpenseDialog({ open, onClose, groupId }: AddExpenseDialogProps) {
  const { createExpense } = useExpenses(groupId);
  const { getGroupMembers } = useGroups();
  
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('other');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && groupId) {
      setMembersLoading(true);
      getGroupMembers(groupId).then(m => {
        setMembers(m);
        setSelectedMembers(m.map(m => m.user_id));
        setMembersLoading(false);
      });
    }
  }, [open, groupId, getGroupMembers]);

  const toggleMember = (userId: string) => {
    setSelectedMembers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount || selectedMembers.length === 0) return;

    const amountNum = parseFloat(amount);
    const splitAmount = amountNum / selectedMembers.length;
    
    const splits = selectedMembers.map(userId => ({
      user_id: userId,
      amount: splitAmount,
    }));

    setLoading(true);
    const { error } = await createExpense(
      description.trim(),
      amountNum,
      category,
      splits
    );
    setLoading(false);

    if (error) {
      toast.error('Failed to add expense');
    } else {
      toast.success('Expense added!');
      setDescription('');
      setAmount('');
      setCategory('other');
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
                  </div>
                  {amount && selectedMembers.length > 0 && (
                    <p className="mt-2 text-sm text-muted-foreground text-center">
                      ₹{(parseFloat(amount) / selectedMembers.length).toFixed(2)} per person
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

