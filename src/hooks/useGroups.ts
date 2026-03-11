import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/lib/auth';

export interface PendingMember {
  id: string;
  invited_email: string;
  invited_name: string | null;
  created_at: string;
}

type GroupRow = Tables<'groups'>;
type GroupWithCount = GroupRow & {
  group_members: Array<{
    count: number | null;
  }> | null;
};
type GroupMemberWithProfile = {
  id: string;
  user_id: string;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  } | null;
};
type ProfileLookup = {
  id: string;
  full_name: string;
  email: string | null;
};

export interface Group {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  currency: string;
  created_by: string;
  created_at: string;
  member_count?: number;
}

export interface GroupMember {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

export function useGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGroups = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('groups')
      .select(
        `
        *,
        group_members(count)
      `,
      )
      .order('created_at', { ascending: false });

    if (!error && data) {
      const mappedGroups = (data as GroupWithCount[]).map((group) => ({
        ...group,
        member_count: group.group_members?.[0]?.count ?? 0,
      }));
      setGroups(mappedGroups);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const createGroup = async (name: string, description?: string, icon?: string, currency?: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .insert({
        name,
        description: description || null,
        icon: icon || '👥',
        currency: currency || 'INR',
        created_by: user.id,
      })
      .select()
      .single();

    if (groupError) return { error: groupError };

    const { error: memberError } = await supabase.from('group_members').insert({
      group_id: groupData.id,
      user_id: user.id,
    });

    if (memberError) {
      // Fix #6: Rollback — delete the orphaned group
      await supabase.from('groups').delete().eq('id', groupData.id);
      return { error: memberError };
    }

    await fetchGroups();
    return { data: groupData, error: null };
  };

  const getGroupMembers = useCallback(async (groupId: string): Promise<GroupMember[]> => {
    const { data, error } = await supabase
      .from('group_members')
      .select(
        `
        id,
        user_id,
        profiles!inner(full_name, avatar_url)
      `,
      )
      .eq('group_id', groupId);

    if (error || !data) return [];

    return (data as GroupMemberWithProfile[]).map((member) => ({
      id: member.id,
      user_id: member.user_id,
      full_name: member.profiles?.full_name ?? 'Unknown',
      avatar_url: member.profiles?.avatar_url ?? null,
    }));
  }, []);

  const addMemberByEmail = useCallback(async (
    groupId: string,
    email: string,
    invitedName?: string,
  ): Promise<{ error: Error | null; wasPending?: boolean }> => {
    if (!user) return { error: new Error('Not authenticated') };
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return { error: new Error('Enter a valid email address') };
    }

    // Fix #9: Removed dead profile fetch (profileRows was never used)
    // Try to add as pending member, edge function will send email
    const { data: pending, error: pendingError } = await supabase
      .from('pending_members')
      .insert({
        group_id: groupId,
        invited_email: normalizedEmail,
        invited_name: invitedName || null,
        invited_by: user.id,
      })
      .select()
      .single();

    if (pendingError) {
      // Duplicate = already invited
      if (pendingError.code === '23505') {
        return { error: new Error('This person is already invited'), wasPending: true };
      }
      // Table doesn't exist yet (migration not run)
      if (pendingError.code === '42P01' || (pendingError.message || '').includes('does not exist')) {
        return { error: new Error('Database setup incomplete. Please run the pending migration in your Supabase SQL editor.') };
      }
      return { error: pendingError as unknown as Error };
    }

    // Trigger notify edge function (invite email)
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    const { data: groupData } = await supabase
      .from('groups')
      .select('name')
      .eq('id', groupId)
      .single();

    supabase.functions.invoke('notify', {
      body: {
        type: 'group_invite',
        inviteEmail: normalizedEmail,
        inviterName: (myProfile as any)?.full_name ?? 'A friend',
        groupName: (groupData as any)?.name ?? 'a group',
        groupId,
        title: 'You were invited to a group',
        body: `You have been invited to join "${(groupData as any)?.name}"`,
      },
    });

    return { error: null, wasPending: true };
  }, [user]);

  const getPendingMembers = useCallback(async (groupId: string): Promise<PendingMember[]> => {
    const { data, error } = await supabase
      .from('pending_members')
      .select('id, invited_email, invited_name, created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as PendingMember[];
  }, []);

  // -----------------------------------------------------------------------
  // sendSettleReminder: send a "please settle up" push to all group members
  // Rate-limited to 1 reminder per group per 24 hours (by anyone)
  // -----------------------------------------------------------------------
  const sendSettleReminder = useCallback(async (groupId: string): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated' };

    // Check if a reminder was sent in the last 24 hours by anyone
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent, error: checkError } = await supabase
      .from('reminder_sends')
      .select('id, sent_at')
      .eq('group_id', groupId)
      .gte('sent_at', since)
      .limit(1);

    if (checkError) {
      // If table doesn't exist yet (migration not run), skip throttle
      if (!checkError.message?.includes('does not exist') && checkError.code !== '42P01') {
        return { error: 'Could not check reminder status. Try again.' };
      }
    }

    if (recent && recent.length > 0) {
      const nextAllowed = new Date(new Date(recent[0].sent_at).getTime() + 24 * 60 * 60 * 1000);
      const hoursLeft = Math.ceil((nextAllowed.getTime() - Date.now()) / (1000 * 60 * 60));
      return { error: `A reminder was sent recently. Next one available in ${hoursLeft}h.` };
    }

    // Get all other group members
    const { data: members } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId)
      .neq('user_id', user.id);

    const recipientIds = (members ?? []).map((m) => m.user_id);

    // Record the reminder send (best-effort — don't fail if table missing)
    await supabase.from('reminder_sends').insert({ group_id: groupId, sent_by: user.id });

    if (recipientIds.length === 0) {
      return { error: 'No other members to remind.' };
    }

    // Dispatch in-app + email notification via edge function
    const { data: { session } } = await supabase.auth.getSession();
    const { data: groupData } = await supabase.from('groups').select('name').eq('id', groupId).single();
    const groupName = (groupData as any)?.name ?? 'your group';

    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        type: 'expense_added',
        recipientUserIds: recipientIds,
        title: '💸 Time to settle up!',
        body: `A member of "${groupName}" is reminding everyone to clear their balances.`,
        groupId,
        groupName,
      }),
    });

    return { error: null };
  }, [user]);

  return {
    groups,
    loading,
    createGroup,
    getGroupMembers,
    addMemberByEmail,
    getPendingMembers,
    sendSettleReminder,
    refetch: fetchGroups,
  };
}
