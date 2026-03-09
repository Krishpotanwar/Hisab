import { useState } from 'react';
import { UserPlus, Mail, User, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGroups, GroupMember, PendingMember } from '@/hooks/useGroups';
import { MemberAvatar } from '@/components/MemberAvatar';
import { toast } from 'sonner';
import ReactDOM from 'react-dom';

interface Props {
  groupId: string;
  members: GroupMember[];
  pendingMembers: PendingMember[];
  onClose: () => void;
  onAdded: () => void;
}

export function AddMemberDialog({ groupId, members, pendingMembers, onClose, onAdded }: Props) {
  const { addMemberByEmail } = useGroups();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await addMemberByEmail(groupId, email.trim(), name.trim() || undefined);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Invite sent! They will join automatically when they sign up.');
      setEmail('');
      setName('');
      onAdded();
    }
  };

  const modal = (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-border/50">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" /> Add Member
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Add by email — they'll be invited even if they haven't signed up yet
          </p>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-3">
          <div>
            <Label htmlFor="invite-email" className="text-xs font-medium">Email address *</Label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="invite-email"
                type="email"
                placeholder="friend@example.com"
                className="pl-9"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                autoFocus
              />
            </div>
          </div>
          <div>
            <Label htmlFor="invite-name" className="text-xs font-medium">Display name (optional)</Label>
            <div className="relative mt-1">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="invite-name"
                type="text"
                placeholder="e.g. Rahul"
                className="pl-9"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Current members */}
        <div className="px-5 pb-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">Members ({members.length})</p>
          <div className="space-y-2 max-h-36 overflow-y-auto">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center gap-2">
                <MemberAvatar name={m.full_name} avatarUrl={m.avatar_url} size="sm" />
                <span className="text-sm">{m.full_name}</span>
              </div>
            ))}
            {pendingMembers.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div>
                  <span className="text-sm">{p.invited_name || p.invited_email}</span>
                  <span className="ml-2 text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">Invited</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border/50 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleAdd} disabled={loading || !email.trim()}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Invite'}
          </Button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
}
