import { motion } from 'framer-motion';
import { Bell, CheckCheck, Receipt, Wallet, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications, AppNotification } from '@/hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { BottomNav } from '@/components/BottomNav';

const TYPE_ICON: Record<AppNotification['type'], React.ReactNode> = {
  expense_added: <Receipt className="w-5 h-5 text-blue-500" />,
  settlement:    <Wallet className="w-5 h-5 text-green-500" />,
  group_invite:  <UserPlus className="w-5 h-5 text-purple-500" />,
  member_joined: <Users className="w-5 h-5 text-orange-500" />,
};

const TYPE_BG: Record<AppNotification['type'], string> = {
  expense_added: 'bg-blue-50 dark:bg-blue-950/30',
  settlement:    'bg-green-50 dark:bg-green-950/30',
  group_invite:  'bg-purple-50 dark:bg-purple-950/30',
  member_joined: 'bg-orange-50 dark:bg-orange-950/30',
};

export default function Notifications() {
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-primary/5 via-background to-background">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container max-w-2xl mx-auto px-4 pb-4 pt-[calc(1rem+var(--safe-area-top))] flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg">Notifications</h1>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead} className="gap-1.5">
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </Button>
          )}
        </div>
      </header>

      <main className="container max-w-2xl mx-auto pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
        {notifications.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-muted-foreground"
          >
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 opacity-40" />
            </div>
            <p className="font-medium">No notifications yet</p>
            <p className="text-sm mt-1 text-muted-foreground/70">
              You'll see alerts for expenses, settlements and group activity here
            </p>
          </motion.div>
        ) : (
          <div className="divide-y divide-border/40">
            {notifications.map((n, i) => (
              <motion.button
                key={n.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={async () => {
                  if (!n.read) await markRead(n.id);
                  if (n.related_group_id) navigate(`/group/${n.related_group_id}`);
                }}
                className={`w-full text-left px-4 py-4 flex gap-4 items-start transition-colors active:bg-muted/50 ${!n.read ? 'bg-primary/[0.04]' : ''}`}
              >
                {/* Icon */}
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${TYPE_BG[n.type]}`}>
                  {TYPE_ICON[n.type]}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm leading-snug ${!n.read ? 'font-semibold' : 'font-medium'}`}>
                      {n.title}
                    </p>
                    {!n.read && (
                      <span className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{n.body}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1.5">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
