import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User, Mail, Phone, Moon, Sun, Bell, Shield, LogOut,
  ChevronRight, Edit2, Check, X, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { BottomNav } from '@/components/BottomNav';

interface SettingRowProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  chevron?: boolean;
  danger?: boolean;
  onClick?: () => void;
  right?: React.ReactNode;
}

function SettingRow({ icon, label, value, chevron = true, danger, onClick, right }: SettingRowProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-muted/60 ${danger ? 'text-red-500' : ''}`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${danger ? 'bg-red-50 dark:bg-red-950/40' : 'bg-muted'}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${danger ? 'text-red-500' : ''}`}>{label}</p>
        {value && <p className="text-xs text-muted-foreground mt-0.5 truncate">{value}</p>}
      </div>
      {right ?? (chevron && <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />)}
    </button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 pt-6 pb-1">
      {children}
    </p>
  );
}

export default function Profile() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(user?.user_metadata?.full_name ?? '');
  const [phone, setPhone] = useState(user?.user_metadata?.phone ?? '');

  const initials = (user?.user_metadata?.full_name ?? user?.email ?? '?')
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const saveProfile = async () => {
    if (!name.trim()) { toast.error('Name cannot be empty'); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim(), phone: phone.trim() } });
    if (!error) {
      await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', user!.id);
      toast.success('Profile updated');
      setEditing(false);
    } else {
      toast.error(error.message);
    }
    setSaving(false);
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-primary/5 via-background to-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container max-w-2xl mx-auto px-4 pb-4 pt-[calc(1rem+var(--safe-area-top))]">
          <h1 className="font-bold text-lg">Profile & Settings</h1>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">

        {/* Avatar card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-6 mb-2 bg-card rounded-2xl border border-border/50 shadow-sm p-5"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-2xl flex-shrink-0">
              {initials}
            </div>
            {editing ? (
              <div className="flex-1 space-y-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  className="h-9 text-sm"
                  autoFocus
                />
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number"
                  type="tel"
                  className="h-9 text-sm"
                />
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="flex-1 h-8 gap-1" onClick={saveProfile} disabled={saving}>
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Save
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setEditing(false)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base">{user?.user_metadata?.full_name ?? 'User'}</p>
                <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                {user?.user_metadata?.phone && (
                  <p className="text-sm text-muted-foreground">{user.user_metadata.phone}</p>
                )}
              </div>
            )}
            {!editing && (
              <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => setEditing(true)}>
                <Edit2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </motion.div>

        {/* Account section */}
        <SectionTitle>Account</SectionTitle>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mx-4 bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden"
        >
          <SettingRow
            icon={<User className="w-4 h-4 text-primary" />}
            label="Full Name"
            value={user?.user_metadata?.full_name ?? 'Not set'}
            onClick={() => setEditing(true)}
          />
          <div className="h-px bg-border/40 mx-4" />
          <SettingRow
            icon={<Mail className="w-4 h-4 text-blue-500" />}
            label="Email"
            value={user?.email ?? ''}
            chevron={false}
          />
          <div className="h-px bg-border/40 mx-4" />
          <SettingRow
            icon={<Phone className="w-4 h-4 text-green-500" />}
            label="Phone"
            value={user?.user_metadata?.phone || 'Not set'}
            onClick={() => setEditing(true)}
          />
        </motion.div>

        {/* Preferences */}
        <SectionTitle>Preferences</SectionTitle>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mx-4 bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden"
        >
          <SettingRow
            icon={theme === 'dark'
              ? <Moon className="w-4 h-4 text-slate-400" />
              : <Sun className="w-4 h-4 text-amber-500" />}
            label="Appearance"
            value={theme === 'dark' ? 'Dark mode' : 'Light mode'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            right={
              <div className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${theme === 'dark' ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
            }
          />
          <div className="h-px bg-border/40 mx-4" />
          <SettingRow
            icon={<Bell className="w-4 h-4 text-orange-500" />}
            label="Notifications"
            value="Expenses, settlements, invites"
          />
        </motion.div>

        {/* Security */}
        <SectionTitle>Security</SectionTitle>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mx-4 bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden"
        >
          <SettingRow
            icon={<Shield className="w-4 h-4 text-purple-500" />}
            label="Change Password"
            value="Update your account password"
            onClick={async () => {
              const { error } = await supabase.auth.resetPasswordForEmail(user?.email ?? '', {
                redirectTo: `${window.location.origin}/auth`,
              });
              if (!error) toast.success('Password reset email sent!');
              else toast.error(error.message);
            }}
          />
        </motion.div>

        {/* Danger zone */}
        <SectionTitle>Account Actions</SectionTitle>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mx-4 bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden"
        >
          <SettingRow
            icon={<LogOut className="w-4 h-4 text-red-500" />}
            label="Sign Out"
            chevron={false}
            danger
            onClick={signOut}
          />
        </motion.div>

        {/* App info */}
        <p className="text-center text-xs text-muted-foreground/50 mt-8 mb-2">
          HisaabKitaab · Made with ❤️ in India 🇮🇳
        </p>

      </main>

      <BottomNav />
    </div>
  );
}
