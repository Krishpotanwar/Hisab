import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, BarChart2, Bell, User, CheckCheck, X, Receipt, Wallet, UserPlus, Users, LogOut, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications, AppNotification } from '@/hooks/useNotifications';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { useTheme } from 'next-themes';

const TYPE_ICON: Record<AppNotification['type'], React.ReactNode> = {
  expense_added: <Receipt className="w-4 h-4 text-blue-500" />,
  settlement:    <Wallet className="w-4 h-4 text-green-500" />,
  group_invite:  <UserPlus className="w-4 h-4 text-purple-500" />,
  member_joined: <Users className="w-4 h-4 text-orange-500" />,
};

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [sheet, setSheet] = useState<'notifications' | 'profile' | null>(null);

  const active = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const TABS = [
    { id: 'home',          icon: Home,      label: 'Home',      action: () => navigate('/') },
    { id: 'analytics',     icon: BarChart2, label: 'Analytics', action: () => navigate('/analytics') },
    { id: 'notifications', icon: Bell,      label: 'Alerts',    action: () => setSheet(s => s === 'notifications' ? null : 'notifications') },
    { id: 'profile',       icon: User,      label: 'Profile',   action: () => setSheet(s => s === 'profile' ? null : 'profile') },
  ];

  return (
    <>
      {/* Bottom nav bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="container max-w-2xl mx-auto flex items-stretch h-16">
          {TABS.map(({ id, icon: Icon, label, action }) => {
            const isActive = id === 'home'
              ? active('/')
              : id === 'analytics'
              ? active('/analytics')
              : sheet === id;

            return (
              <button
                key={id}
                onClick={action}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 relative focus:outline-none"
                aria-label={label}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute top-1 inset-x-3 h-0.5 rounded-full bg-primary"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <div className="relative">
                  <Icon
                    className={`w-[22px] h-[22px] transition-colors duration-150 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                    strokeWidth={isActive ? 2.5 : 1.8}
                  />
                  {id === 'notifications' && unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                  {id === 'profile'
                    ? (user?.user_metadata?.full_name?.split(' ')[0] ?? 'Profile')
                    : label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Sheets backdrop */}
      <AnimatePresence>
        {sheet && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setSheet(null)}
          />
        )}
      </AnimatePresence>

      {/* Notifications sheet */}
      <AnimatePresence>
        {sheet === 'notifications' && (
          <motion.div
            key="notif-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl border-t border-border/50 shadow-2xl max-h-[75dvh] flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
              <h2 className="font-bold text-base">Notifications</h2>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={markAllRead}>
                    <CheckCheck className="w-3 h-3 mr-1" />Mark all read
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setSheet(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {/* List */}
            <div className="overflow-y-auto flex-1 pb-4">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Bell className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={async () => {
                      if (!n.read) await markRead(n.id);
                      if (n.related_group_id) navigate(`/group/${n.related_group_id}`);
                      setSheet(null);
                    }}
                    className={`w-full text-left px-5 py-3.5 flex gap-3 items-start border-b border-border/30 last:border-0 active:bg-muted/50 ${!n.read ? 'bg-primary/5' : ''}`}
                  >
                    <div className="mt-0.5 p-1.5 rounded-full bg-muted flex-shrink-0">
                      {TYPE_ICON[n.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug">{n.title}</p>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-[11px] text-muted-foreground/60 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile sheet */}
      <AnimatePresence>
        {sheet === 'profile' && (
          <motion.div
            key="profile-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl border-t border-border/50 shadow-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="px-5 pt-4 pb-2">
              {/* Avatar */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
                  {(user?.user_metadata?.full_name ?? user?.email ?? '?')[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-base">{user?.user_metadata?.full_name ?? 'User'}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pb-4">
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-muted/50 hover:bg-muted active:bg-muted text-sm font-medium"
                >
                  {theme === 'dark'
                    ? <Sun className="w-5 h-5 text-amber-500" />
                    : <Moon className="w-5 h-5 text-slate-500" />}
                  {theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                </button>

                <button
                  onClick={() => { signOut(); setSheet(null); }}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 active:bg-red-100 text-sm font-medium text-red-600 dark:text-red-400"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
