import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Users, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function JoinGroup() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [groupName, setGroupName] = useState<string | null>(null);
  const [groupIcon, setGroupIcon] = useState<string>('');
  const [status, setStatus] = useState<'loading' | 'joining' | 'joined' | 'already_member' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  // If not logged in, redirect to auth with a redirect back here
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate(`/auth?redirect=/join/${groupId}`, { replace: true });
    }
  }, [authLoading, user, navigate, groupId]);

  // Once we have a user, fetch group info and join
  useEffect(() => {
    if (authLoading || !user || !groupId) return;

    let cancelled = false;

    async function joinGroup() {
      // Fetch group info
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('id, name, icon')
        .eq('id', groupId!)
        .single();

      if (cancelled) return;

      if (groupError || !group) {
        setStatus('error');
        setErrorMsg('This group does not exist or the invite link is invalid.');
        return;
      }

      setGroupName(group.name);
      setGroupIcon(group.icon || '');

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', groupId!)
        .eq('user_id', user!.id)
        .maybeSingle();

      if (cancelled) return;

      if (existingMember) {
        setStatus('already_member');
        return;
      }

      // Join the group
      setStatus('joining');
      const { error: joinError } = await supabase
        .from('group_members')
        .insert({
          group_id: groupId!,
          user_id: user!.id,
        });

      if (cancelled) return;

      if (joinError) {
        // Could be RLS or duplicate
        if (joinError.code === '23505') {
          setStatus('already_member');
        } else {
          setStatus('error');
          setErrorMsg('Failed to join group. You may not have permission.');
        }
        return;
      }

      setStatus('joined');
      toast.success(`You joined "${group.name}"!`);
    }

    joinGroup();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, groupId]);

  const goToGroup = () => navigate(`/group/${groupId}`, { replace: true });
  const goHome = () => navigate('/', { replace: true });

  // While auth is loading, show a loader
  if (authLoading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // If user is null (redirect is happening), show loader
  if (!user) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-card border border-border/50 p-6 w-full max-w-sm text-center space-y-4">
        {(status === 'loading' || status === 'joining') && (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
            <h2 className="text-lg font-semibold">
              {status === 'loading' ? 'Loading group...' : 'Joining group...'}
            </h2>
            {groupName && (
              <p className="text-muted-foreground">
                {groupIcon} {groupName}
              </p>
            )}
          </>
        )}

        {status === 'joined' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <h2 className="text-lg font-semibold">You're in!</h2>
            <p className="text-muted-foreground">
              You successfully joined <strong>{groupIcon} {groupName}</strong>
            </p>
            <Button className="w-full" onClick={goToGroup}>
              <Users className="w-4 h-4 mr-2" />
              Go to Group
            </Button>
          </>
        )}

        {status === 'already_member' && (
          <>
            <Users className="w-12 h-12 text-primary mx-auto" />
            <h2 className="text-lg font-semibold">Already a member</h2>
            <p className="text-muted-foreground">
              You're already in <strong>{groupIcon} {groupName}</strong>
            </p>
            <Button className="w-full" onClick={goToGroup}>
              Go to Group
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold">Unable to join</h2>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <Button variant="outline" className="w-full" onClick={goHome}>
              Go Home
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
