import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Wallet, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { useGroups } from '@/hooks/useGroups';
import { GroupCard } from '@/components/GroupCard';
import { CreateGroupDialog } from '@/components/CreateGroupDialog';
import { BottomNav } from '@/components/BottomNav';
import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';

export default function Dashboard() {
  const { user } = useAuth();
  const { groups, loading, createGroup } = useGroups();
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const navigate = useNavigate();
  const displayName =
    user?.user_metadata?.full_name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'there';
  const totalMembers = groups.reduce((sum, group) => sum + (group.member_count ?? 0), 0);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-primary/5 via-background to-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container max-w-2xl mx-auto px-4 pb-4 pt-[calc(1rem+var(--safe-area-top))] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg">HisaabKitaab</h1>
              <p className="text-xs text-muted-foreground">Welcome back, {displayName}.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6 pb-[calc(7rem+var(--safe-area-bottom))]">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h2 className="text-2xl font-bold mb-1">Your Groups</h2>
          <p className="text-muted-foreground">Manage expenses with friends & family</p>
        </motion.div>

        {!loading && groups.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm">
              <p className="text-xs text-muted-foreground">Active groups</p>
              <p className="text-2xl font-semibold mt-1">{groups.length}</p>
            </div>
            <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm">
              <p className="text-xs text-muted-foreground">People in groups</p>
              <p className="text-2xl font-semibold mt-1">{totalMembers}</p>
            </div>
          </div>
        )}

        {/* Groups List */}
        <div className="space-y-3" aria-busy={loading}>
          {loading ? (
            <DashboardSkeleton />
          ) : groups.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                <Users className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">No groups yet</h3>
              <p className="text-muted-foreground mb-4">Create your first group to start splitting expenses</p>
              <Button onClick={() => setShowCreateGroup(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Group
              </Button>
            </motion.div>
          ) : (
            groups.map((group, i) => (
              <GroupCard
                key={group.id}
                group={group}
                index={i}
                onClick={() => navigate(`/group/${group.id}`)}
              />
            ))
          )}
        </div>
      </main>

      {/* FAB */}
      {groups.length > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] right-[calc(1.5rem+var(--safe-area-right))]"
        >
          <Button
            size="lg"
            className="rounded-full w-14 h-14 shadow-float"
            onClick={() => setShowCreateGroup(true)}
            aria-label="Create new group"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </motion.div>
      )}

      <CreateGroupDialog
        open={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        createGroup={createGroup}
      />

      <BottomNav />
    </div>
  );
}
