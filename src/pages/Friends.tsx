import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, UserPlus, Check, X, Loader2,
  UserCheck, UserX, Wallet, Bell, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BottomNav } from '@/components/BottomNav';
import { useFriends, FriendUser } from '@/hooks/useFriends';
import { usePayments } from '@/hooks/usePayments';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Tab = 'friends' | 'requests' | 'find';

// ──────────────────────────────────────────────
// Avatar helper
// ──────────────────────────────────────────────
function Avatar({ name, avatarUrl, size = 'md' }: { name: string; avatarUrl?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm';
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className={`${sizeClass} rounded-full object-cover flex-shrink-0`} />;
  }
  const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className={`${sizeClass} rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center flex-shrink-0`}>
      {initials}
    </div>
  );
}

// ──────────────────────────────────────────────
// Balance badge
// ──────────────────────────────────────────────
function BalanceBadge({ amount }: { amount: number }) {
  if (Math.abs(amount) < 0.01) return <span className="text-xs text-muted-foreground">Settled up</span>;
  const isPositive = amount > 0;
  return (
    <span className={`text-xs font-semibold ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
      {isPositive ? `Gets ₹${amount.toFixed(0)}` : `Owes ₹${Math.abs(amount).toFixed(0)}`}
    </span>
  );
}

// ──────────────────────────────────────────────
// Empty state
// ──────────────────────────────────────────────
function EmptyState({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

// ──────────────────────────────────────────────
// Friends Tab
// ──────────────────────────────────────────────
function FriendsTab() {
  const { friends, unfriend, loading } = useFriends();
  const { startSettlementPayment, processingPayment } = usePayments();
  const [activePayId, setActivePayId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (friends.length === 0) {
    return <EmptyState icon={Users} title="No friends yet" subtitle="Find people to add in the Find tab." />;
  }

  const handlePay = async (friendshipId: string, userId: string, amount: number, sharedGroups: { id: string; balance: number }[]) => {
    // Find the group where I owe the friend the most (most negative balance from my perspective)
    const payGroup = [...sharedGroups]
      .filter((g) => g.balance < 0)
      .sort((a, b) => a.balance - b.balance)[0];

    if (!payGroup) {
      toast.info('No group balance to settle.');
      return;
    }

    setActivePayId(friendshipId);
    const { error } = await startSettlementPayment({
      groupId: payGroup.id,
      payeeUserId: userId,
      amount: Math.abs(amount),
    });
    setActivePayId(null);

    if (error && error.message !== 'Payment cancelled') {
      toast.error(error.message);
    } else if (!error) {
      toast.success('Payment successful!');
    }
  };

  return (
    <div className="space-y-2 py-2">
      {friends.map((f) => (
        <motion.div
          key={f.friendshipId}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 bg-card border border-border/50 rounded-xl mx-4"
        >
          <Avatar name={f.user.full_name} avatarUrl={f.user.avatar_url} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground truncate">{f.user.full_name}</p>
            <BalanceBadge amount={f.netBalance} />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {f.netBalance < -0.01 && (
              <Button
                size="sm"
                className="h-8 text-xs px-3"
                disabled={processingPayment && activePayId === f.friendshipId}
                onClick={() => handlePay(f.friendshipId, f.user.id, f.netBalance, f.sharedGroups)}
              >
                {processingPayment && activePayId === f.friendshipId
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : `Pay ₹${Math.abs(f.netBalance).toFixed(0)}`
                }
              </Button>
            )}
            {f.netBalance > 0.01 && (
              <Button size="sm" variant="outline" className="h-8 text-xs px-3 gap-1" onClick={() => toast.info('Reminder sent!')}>
                <Bell className="w-3 h-3" />
                Remind
              </Button>
            )}
            <button
              onClick={async () => {
                const { error } = await unfriend(f.friendshipId);
                if (error) toast.error('Failed to remove friend');
                else toast.success('Removed from friends');
              }}
              className="text-muted-foreground hover:text-destructive transition-colors p-1"
              title="Remove friend"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────
// Requests Tab
// ──────────────────────────────────────────────
function RequestsTab() {
  const { pendingReceived, pendingSent, acceptRequest, rejectRequest, cancelRequest, loading } = useFriends();
  const [actingOn, setActingOn] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pendingReceived.length === 0 && pendingSent.length === 0) {
    return <EmptyState icon={UserPlus} title="No pending requests" subtitle="Friend requests you send or receive will appear here." />;
  }

  const handle = async (fn: () => Promise<{ error: Error | null }>, id: string, successMsg: string) => {
    setActingOn(id);
    const { error } = await fn();
    setActingOn(null);
    if (error) toast.error(error.message);
    else toast.success(successMsg);
  };

  return (
    <div className="py-2 space-y-4">
      {pendingReceived.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 mb-2">Received</p>
          <div className="space-y-2">
            {pendingReceived.map((req) => (
              <motion.div
                key={req.friendshipId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 px-4 py-3 bg-card border border-border/50 rounded-xl mx-4"
              >
                <Avatar name={req.user.full_name} avatarUrl={req.user.avatar_url} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{req.user.full_name}</p>
                  {req.user.email && <p className="text-xs text-muted-foreground truncate">{req.user.email}</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handle(() => acceptRequest(req.friendshipId), req.friendshipId, 'Friend added!')}
                    disabled={actingOn === req.friendshipId}
                    className="w-8 h-8 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors flex items-center justify-center"
                  >
                    {actingOn === req.friendshipId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handle(() => rejectRequest(req.friendshipId), req.friendshipId, 'Request declined')}
                    disabled={actingOn === req.friendshipId}
                    className="w-8 h-8 rounded-full bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {pendingSent.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 mb-2">Sent</p>
          <div className="space-y-2">
            {pendingSent.map((req) => (
              <motion.div
                key={req.friendshipId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 px-4 py-3 bg-card border border-border/50 rounded-xl mx-4"
              >
                <Avatar name={req.user.full_name} avatarUrl={req.user.avatar_url} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{req.user.full_name}</p>
                  {req.user.email && <p className="text-xs text-muted-foreground truncate">{req.user.email}</p>}
                </div>
                <span className="text-xs text-muted-foreground mr-2 flex-shrink-0">Pending</span>
                <button
                  onClick={() => handle(() => cancelRequest(req.friendshipId), req.friendshipId, 'Request cancelled')}
                  disabled={actingOn === req.friendshipId}
                  className="w-8 h-8 rounded-full bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors flex items-center justify-center flex-shrink-0"
                  title="Cancel request"
                >
                  {actingOn === req.friendshipId ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Find Tab
// ──────────────────────────────────────────────
function FindTab() {
  const { searchUsers, sendFriendRequest, acceptRequest, getFriendshipStatus } = useFriends();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FriendUser[]>([]);
  const [statuses, setStatuses] = useState<Record<string, { status: string; friendshipId?: string }>>({});
  const [searching, setSearching] = useState(false);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const found = await searchUsers(query);
      setResults(found);
      // Fetch status for each result
      const statusEntries = await Promise.all(
        found.map(async (u) => {
          const s = await getFriendshipStatus(u.id);
          return [u.id, s] as const;
        })
      );
      setStatuses(Object.fromEntries(statusEntries));
      setSearching(false);
    }, 300);
  }, [query]);

  const handleAdd = async (user: FriendUser) => {
    const current = statuses[user.id];
    if (!current) return;

    setActingOn(user.id);
    let error: Error | null = null;

    if (current.status === 'none') {
      ({ error } = await sendFriendRequest(user.id));
      if (!error) {
        setStatuses((prev) => ({ ...prev, [user.id]: { status: 'pending_sent' } }));
        toast.success(`Friend request sent to ${user.full_name}`);
      }
    } else if (current.status === 'pending_received' && current.friendshipId) {
      ({ error } = await acceptRequest(current.friendshipId));
      if (!error) {
        setStatuses((prev) => ({ ...prev, [user.id]: { status: 'accepted' } }));
        toast.success(`${user.full_name} added as friend!`);
      }
    }

    if (error) toast.error(error.message);
    setActingOn(null);
  };

  const getActionButton = (user: FriendUser) => {
    const s = statuses[user.id];
    if (!s) return null;

    const isActing = actingOn === user.id;

    if (s.status === 'accepted') {
      return (
        <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
          <UserCheck className="w-4 h-4" /> Friends
        </span>
      );
    }
    if (s.status === 'pending_sent') {
      return <span className="text-xs text-muted-foreground">Sent</span>;
    }
    if (s.status === 'pending_received') {
      return (
        <Button size="sm" className="h-8 text-xs px-3 gap-1" disabled={isActing} onClick={() => handleAdd(user)}>
          {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Accept
        </Button>
      );
    }
    return (
      <Button size="sm" variant="outline" className="h-8 text-xs px-3 gap-1" disabled={isActing} onClick={() => handleAdd(user)}>
        {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
        Add
      </Button>
    );
  };

  return (
    <div className="py-2">
      <div className="px-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
            autoFocus
          />
        </div>
      </div>

      {searching && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!searching && query.trim().length >= 2 && results.length === 0 && (
        <EmptyState icon={UserX} title="No users found" subtitle="Try a different name or email address." />
      )}

      {!searching && results.length > 0 && (
        <div className="space-y-2">
          {results.map((u) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 px-4 py-3 bg-card border border-border/50 rounded-xl mx-4"
            >
              <Avatar name={u.full_name} avatarUrl={u.avatar_url} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground truncate">{u.full_name}</p>
                {u.email && <p className="text-xs text-muted-foreground truncate">{u.email}</p>}
              </div>
              <div className="flex-shrink-0">{getActionButton(u)}</div>
            </motion.div>
          ))}
        </div>
      )}

      {query.trim().length < 2 && (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Find Friends</h3>
          <p className="text-sm text-muted-foreground">Type a name or email to search for people on HisaabKitaab.</p>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Main Friends Page
// ──────────────────────────────────────────────
export default function Friends() {
  const [tab, setTab] = useState<Tab>('friends');
  const { refresh, pendingReceived, loading } = useFriends();

  useEffect(() => {
    refresh();
  }, [refresh]);

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'friends', label: 'Friends' },
    { id: 'requests', label: 'Requests', badge: pendingReceived.length },
    { id: 'find', label: 'Find' },
  ];

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 px-4 pt-12 pb-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Friends</h1>
        </div>

        {/* Tabs */}
        <div className="flex bg-muted rounded-xl p-1 mb-0">
          {tabs.map(({ id, label, badge }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 py-2 rounded-lg text-sm font-medium transition-all relative',
                tab === id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
              )}
            >
              {label}
              {badge && badge > 0 ? (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                  {badge > 9 ? '9+' : badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {tab === 'friends' && <FriendsTab />}
          {tab === 'requests' && <RequestsTab />}
          {tab === 'find' && <FindTab />}
        </motion.div>
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
