import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, Users, BarChart2, Wallet, IndianRupee, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { BottomNav } from '@/components/BottomNav';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Stats {
  totalUsers: number;
  totalGroups: number;
  totalExpenses: number;
  totalAmount: number;
  totalMessages: number;
}

interface GroupOption {
  id: string;
  name: string;
}

export default function Admin() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isAdminLoading, setIsAdminLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertTarget, setAlertTarget] = useState<'all' | string>('all');
  const [alertSending, setAlertSending] = useState(false);

  // Check admin status
  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setIsAdmin(!!data?.is_admin);
        setIsAdminLoading(false);
      });
  }, [user]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    const [usersRes, groupsRes, expensesRes, messagesRes] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('groups').select('*', { count: 'exact', head: true }),
      supabase.from('expenses').select('amount'),
      supabase.from('group_messages').select('*', { count: 'exact', head: true }),
    ]);

    const totalAmount = (expensesRes.data ?? []).reduce(
      (sum, e) => sum + (Number(e.amount) || 0),
      0
    );

    setStats({
      totalUsers: usersRes.count ?? 0,
      totalGroups: groupsRes.count ?? 0,
      totalExpenses: expensesRes.data?.length ?? 0,
      totalAmount,
      totalMessages: messagesRes.count ?? 0,
    });
    setStatsLoading(false);
  }, []);

  const loadGroups = useCallback(async () => {
    const { data } = await supabase.from('groups').select('id, name').order('name');
    if (data) setGroups(data as GroupOption[]);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadStats();
      loadGroups();
    }
  }, [isAdmin, loadStats, loadGroups]);

  const handleSendAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertTitle.trim() || !alertMessage.trim()) return;
    setAlertSending(true);

    try {
      let userIds: string[] = [];

      if (alertTarget === 'all') {
        const { data } = await supabase.from('profiles').select('id');
        userIds = (data ?? []).map(p => p.id);
      } else {
        // specific group — get members
        const { data } = await supabase
          .from('group_members')
          .select('user_id')
          .eq('group_id', alertTarget);
        userIds = (data ?? []).map(m => m.user_id);
      }

      if (userIds.length === 0) {
        toast.error('No users found for target');
        setAlertSending(false);
        return;
      }

      const notifications = userIds.map(uid => ({
        user_id: uid,
        type: 'group_invite' as const,
        title: alertTitle.trim(),
        body: alertMessage.trim(),
        read: false,
      }));

      const { error } = await supabase.from('notifications').insert(notifications);

      if (error) {
        toast.error('Failed to send alert');
      } else {
        toast.success(`Alert sent to ${userIds.length} user${userIds.length !== 1 ? 's' : ''}!`);
        setAlertTitle('');
        setAlertMessage('');
        setAlertTarget('all');
      }
    } catch {
      toast.error('Failed to send alert');
    } finally {
      setAlertSending(false);
    }
  };

  if (isAdminLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground mb-6">
            You don't have permission to access the Developer Portal.
          </p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Users',
      value: stats?.totalUsers ?? '—',
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      label: 'Groups',
      value: stats?.totalGroups ?? '—',
      icon: BarChart2,
      color: 'text-purple-500',
      bg: 'bg-purple-50 dark:bg-purple-950/30',
    },
    {
      label: 'Expenses',
      value: stats?.totalExpenses ?? '—',
      icon: Wallet,
      color: 'text-green-500',
      bg: 'bg-green-50 dark:bg-green-950/30',
    },
    {
      label: 'Total ₹',
      value: stats ? `₹${stats.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—',
      icon: IndianRupee,
      color: 'text-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-primary/5 via-background to-background">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container max-w-2xl mx-auto px-4 pb-4 pt-[calc(1rem+var(--safe-area-top))] flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-lg">Developer Portal</h1>
            <p className="text-xs text-muted-foreground">Admin tools</p>
          </div>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6 pb-[calc(7rem+var(--safe-area-bottom))] space-y-6">
        {/* Stats grid */}
        <section>
          <h2 className="font-semibold mb-3">Overview</h2>
          {statsLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {statCards.map(({ label, value, icon: Icon, color, bg }) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-2"
                >
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', bg)}>
                    <Icon className={cn('w-5 h-5', color)} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Push Alert section */}
        <section className="rounded-2xl border border-border/60 bg-card p-4 space-y-4">
          <h2 className="font-semibold">Send Push Alert</h2>
          <form onSubmit={handleSendAlert} className="space-y-3">
            <div>
              <Label htmlFor="alert-title">Title</Label>
              <Input
                id="alert-title"
                value={alertTitle}
                onChange={(e) => setAlertTitle(e.target.value)}
                placeholder="Alert title"
                className="mt-1.5"
                required
              />
            </div>

            <div>
              <Label htmlFor="alert-message">Message</Label>
              <textarea
                id="alert-message"
                value={alertMessage}
                onChange={(e) => setAlertMessage(e.target.value)}
                placeholder="Alert message body…"
                required
                className={cn(
                  'mt-1.5 w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm',
                  'ring-offset-background placeholder:text-muted-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'resize-none'
                )}
              />
            </div>

            <div>
              <Label htmlFor="alert-target">Target</Label>
              <select
                id="alert-target"
                value={alertTarget}
                onChange={(e) => setAlertTarget(e.target.value)}
                className={cn(
                  'mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                  'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                )}
              >
                <option value="all">All users</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <Button type="submit" className="w-full" disabled={alertSending}>
              {alertSending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {alertSending ? 'Sending…' : 'Send Alert'}
            </Button>
          </form>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
