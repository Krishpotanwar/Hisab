import { useLocation, useNavigate } from 'react-router-dom';
import { Home, BarChart2, Bell, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNotifications } from '@/hooks/useNotifications';

const TABS = [
  { id: 'home',          path: '/',              icon: Home,      label: 'Home'      },
  { id: 'analytics',     path: '/analytics',     icon: BarChart2, label: 'Analytics' },
  { id: 'notifications', path: '/notifications', icon: Bell,      label: 'Alerts'    },
  { id: 'profile',       path: '/profile',       icon: User,      label: 'Profile'   },
];

export function BottomNav() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { unreadCount } = useNotifications();

  const isActive = (tabPath: string) =>
    tabPath === '/' ? pathname === '/' : pathname.startsWith(tabPath);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="container max-w-2xl mx-auto flex items-stretch h-16">
        {TABS.map(({ id, path, icon: Icon, label }) => {
          const active = isActive(path);
          return (
            <button
              key={id}
              onClick={() => nav(path)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 relative focus:outline-none"
              aria-label={label}
            >
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute top-0 inset-x-4 h-[3px] rounded-full bg-primary"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <div className="relative">
                <Icon
                  className={`w-[22px] h-[22px] transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`}
                  strokeWidth={active ? 2.5 : 1.8}
                />
                {id === 'notifications' && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
