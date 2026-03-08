import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface CreateGroupDialogProps {
  open: boolean;
  onClose: () => void;
  // Passed from Dashboard so both list and dialog use the same groups hook instance
  createGroup: (name: string, description?: string, icon?: string) => Promise<{
    data?: unknown;
    error: Error | null;
  }>;
}

const ICONS = ['👥', '🏠', '✈️', '🎉', '🍕', '🎮', '💼', '🏖️', '🎬', '🛍️', '❤️', '🎓'];

export function CreateGroupDialog({ open, onClose, createGroup }: CreateGroupDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('👥');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    const { error } = await createGroup(name.trim(), description.trim(), icon);
    setLoading(false);

    if (error) {
      console.error('Failed to create group:', error);
      toast.error(error.message || 'Failed to create group');
    } else {
      toast.success('Group created successfully!');
      setName('');
      setDescription('');
      setIcon('👥');
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-card rounded-2xl shadow-float overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-lg font-semibold">Create Group</h2>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col max-h-[calc(90vh-140px)]">
                <div className="p-4 space-y-4 overflow-y-auto flex-1">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Icon</Label>
                  <div className="flex flex-wrap gap-2">
                    {ICONS.map((i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setIcon(i)}
                        className={`w-10 h-10 rounded-xl text-lg flex items-center justify-center transition-all ${
                          icon === i 
                            ? 'bg-primary/20 ring-2 ring-primary scale-110' 
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        {i}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="name">Group Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Goa Trip 2024"
                    className="mt-1.5"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What's this group for?"
                    className="mt-1.5 resize-none"
                    rows={2}
                  />
                </div>
              </div>

              <div className="p-4 border-t border-border">
                <Button type="submit" className="w-full" disabled={loading || !name.trim()}>
                  <Plus className="w-4 h-4 mr-2" />
                  {loading ? 'Creating...' : 'Create Group'}
                </Button>
              </div>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
