import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/lib/auth';

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

  const createGroup = async (name: string, description?: string, icon?: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .insert({
        name,
        description: description || null,
        icon: icon || '👥',
        created_by: user.id,
      })
      .select()
      .single();

    if (groupError) return { error: groupError };

    const { error: memberError } = await supabase.from('group_members').insert({
      group_id: groupData.id,
      user_id: user.id,
    });

    if (memberError) return { error: memberError };

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

  const addMemberByEmail = useCallback(async (groupId: string, email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return { error: new Error('Enter a valid email address') };
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('email', normalizedEmail)
      .limit(1);

    let profile = profileData?.[0] as ProfileLookup | undefined;

    if (!profile && !profileError) {
      const { data: fallbackData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .ilike('full_name', `%${normalizedEmail}%`)
        .limit(1);
      profile = fallbackData?.[0] as ProfileLookup | undefined;
    }

    if (profileError || !profile) {
      return { error: new Error('User not found') };
    }

    const { error } = await supabase.from('group_members').insert({
      group_id: groupId,
      user_id: profile.id,
    });

    return { error };
  }, []);

  return {
    groups,
    loading,
    createGroup,
    getGroupMembers,
    addMemberByEmail,
    refetch: fetchGroups,
  };
}
