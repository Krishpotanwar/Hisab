import { useState, useRef } from 'react';
import { Bell, X, CheckCheck, Receipt, Users, Wallet, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNotifications, AppNotification } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const TYPE_ICON: Record<AppNotification['type'], React.ReactNode> = {
  expense_added: <Receipt className="w-4 h-4 text-blue-500" />,
  settlement:    <Wallet className="w-4 h-4 text-green-500" />,
  group_invite:  <UserPlus className="w-4 h-4 text-purple-500" />,
  member_joined: <Users className="w-4 h-4 text-orange-500" />,
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  const handleNotificationClick = async (n: AppNotification) => {
    if (!n.read) await markRead(n.id);
    if (n.related_group_id) navigate(`/group/${n.related_group_id}`);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-12 z-50 w-80 max-h-[480px] flex flex-col bg-background border border-border rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background sticky top-0">
                <span className="font-semibold text-sm">Notifications</span>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={markAllRead}>
                      <CheckCheck className="w-3 h-3 mr-1" /> Mark all read
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setOpen(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* List */}
              <div className="overflow-y-auto flex-1">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Bell className="w-8 h-8 mb-2 opacity-30" />
                    <p className="text-sm">No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full text-left px-4 py-3 flex gap-3 items-start hover:bg-muted/50 transition-colors border-b border-border/40 last:border-0 ${!n.read ? 'bg-primary/5' : ''}`}
                    >
                      <div className="mt-0.5 p-1.5 rounded-full bg-muted flex-shrink-0">
                        {TYPE_ICON[n.type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-snug">{n.title}</p>
                          {!n.read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">{n.body}</p>
                        <p className="text-[11px] text-muted-foreground/60 mt-1">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
