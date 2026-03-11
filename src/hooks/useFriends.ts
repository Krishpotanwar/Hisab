import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface FriendUser {
  id: string;
  full_name: string;
  avatar_url: string | null;
  email: string | null;
}

export interface SharedGroup {
  id: string;
  name: string;
  balance: number; // positive = friend owes me, negative = I owe friend
}

export interface FriendWithBalance {
  friendshipId: string;
  user: FriendUser;
  netBalance: number; // positive = they owe me, negative = I owe them
  sharedGroups: SharedGroup[];
  isRequester: boolean;
}

export interface FriendRequest {
  friendshipId: string;
  user: FriendUser;
  createdAt: string;
}

export function useFriends() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendWithBalance[]>([]);
  const [pendingReceived, setPendingReceived] = useState<FriendRequest[]>([]);
  const [pendingSent, setPendingSent] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);

  // ------------------------------------------------------------------
  // Internal: compute net balance between current user and a friend
  // across all shared groups. Mirrors the balance logic in useExpenses.ts
  // ------------------------------------------------------------------
  const computeFriendBalances = async (friendId: string): Promise<SharedGroup[]> => {
    if (!user) return [];

    // Find shared group IDs
    const { data: myGroups } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id);

    const { data: friendGroups } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', friendId);

    if (!myGroups || !friendGroups) return [];

    const myGroupIds = new Set(myGroups.map((g) => g.group_id));
    const sharedGroupIds = friendGroups
      .map((g) => g.group_id)
      .filter((id) => myGroupIds.has(id));

    if (sharedGroupIds.length === 0) return [];

    // Fetch group names
    const { data: groupRows } = await supabase
      .from('groups')
      .select('id, name')
      .in('id', sharedGroupIds);

    const groupNameMap: Record<string, string> = {};
    (groupRows ?? []).forEach((g) => { groupNameMap[g.id] = g.name; });

    const result: SharedGroup[] = [];

    for (const groupId of sharedGroupIds) {
      // Fetch expenses in this group
      const { data: expenses } = await supabase
        .from('expenses')
        .select('id, amount, paid_by, notes')
        .eq('group_id', groupId);

      if (!expenses) continue;

      const expenseIds = expenses.map((e) => e.id);

      // Fetch splits for this group's expenses
      let splits: Array<{ expense_id: string; user_id: string; amount: number }> = [];
      if (expenseIds.length > 0) {
        const { data: splitRows } = await supabase
          .from('expense_splits')
          .select('expense_id, user_id, amount')
          .in('expense_id', expenseIds);
        splits = (splitRows ?? []) as typeof splits;
      }

      // Fetch settlements in this group
      const { data: settlementRows } = await supabase
        .from('settlements')
        .select('from_user, to_user, amount')
        .eq('group_id', groupId);
      const settlements = (settlementRows ?? []) as Array<{ from_user: string; to_user: string; amount: number }>;

      // Compute balance for both users
      const balances: Record<string, number> = { [user.id]: 0, [friendId]: 0 };

      expenses.forEach((expense) => {
        const notes = expense.notes as string | null;
        const multiPayerMatch = notes?.match(/__MULTIPAYER__(.+)/);
        if (multiPayerMatch) {
          try {
            const payers = JSON.parse(multiPayerMatch[1]) as { userId: string; amount: number }[];
            for (const p of payers) {
              if (balances[p.userId] !== undefined) {
                balances[p.userId] += Number(p.amount);
              }
            }
          } catch {
            if (balances[expense.paid_by] !== undefined) {
              balances[expense.paid_by] += Number(expense.amount);
            }
          }
        } else {
          if (balances[expense.paid_by] !== undefined) {
            balances[expense.paid_by] += Number(expense.amount);
          }
        }
      });

      splits.forEach((split) => {
        if (balances[split.user_id] !== undefined) {
          balances[split.user_id] -= Number(split.amount);
        }
      });

      settlements.forEach((settlement) => {
        if (balances[settlement.from_user] !== undefined) {
          balances[settlement.from_user] -= Number(settlement.amount);
        }
        if (balances[settlement.to_user] !== undefined) {
          balances[settlement.to_user] += Number(settlement.amount);
        }
      });

      // Balance from my perspective: positive = they owe me, negative = I owe them
      const myBalance = balances[user.id] ?? 0;
      const friendBalance = balances[friendId] ?? 0;
      // Net: how much friend owes me (their debt to me)
      const net = myBalance - friendBalance;

      if (Math.abs(net) > 0.001) {
        result.push({
          id: groupId,
          name: groupNameMap[groupId] ?? groupId,
          balance: net,
        });
      }
    }

    return result;
  };

  // ------------------------------------------------------------------
  // Fetch all friend data
  // ------------------------------------------------------------------
  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: rows, error } = await supabase
      .from('friendships')
      .select('id, requester_id, recipient_id, status, created_at')
      .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`);

    if (error || !rows) {
      setLoading(false);
      return;
    }

    // Collect all user IDs we need profiles for
    const otherUserIds = rows.map((r) =>
      r.requester_id === user.id ? r.recipient_id : r.requester_id
    );

    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, email')
      .in('id', otherUserIds.length > 0 ? otherUserIds : ['00000000-0000-0000-0000-000000000000']);

    const profileMap: Record<string, FriendUser> = {};
    (profileRows ?? []).forEach((p) => {
      profileMap[p.id] = {
        id: p.id,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        email: p.email ?? null,
      };
    });

    const accepted: FriendWithBalance[] = [];
    const received: FriendRequest[] = [];
    const sent: FriendRequest[] = [];

    for (const row of rows) {
      const isRequester = row.requester_id === user.id;
      const otherId = isRequester ? row.recipient_id : row.requester_id;
      const otherUser = profileMap[otherId] ?? { id: otherId, full_name: 'Unknown', avatar_url: null, email: null };

      if (row.status === 'accepted') {
        const sharedGroups = await computeFriendBalances(otherId);
        const netBalance = sharedGroups.reduce((sum, g) => sum + g.balance, 0);
        accepted.push({
          friendshipId: row.id,
          user: otherUser,
          netBalance,
          sharedGroups,
          isRequester,
        });
      } else if (row.status === 'pending') {
        if (isRequester) {
          sent.push({ friendshipId: row.id, user: otherUser, createdAt: row.created_at });
        } else {
          received.push({ friendshipId: row.id, user: otherUser, createdAt: row.created_at });
        }
      }
    }

    setFriends(accepted);
    setPendingReceived(received);
    setPendingSent(sent);
    setLoading(false);
  }, [user]);

  // ------------------------------------------------------------------
  // Search users by name or email
  // ------------------------------------------------------------------
  const searchUsers = async (query: string): Promise<FriendUser[]> => {
    if (!user || query.trim().length < 2) return [];

    const q = query.trim();
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, email')
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
      .neq('id', user.id)
      .limit(20);

    return (data ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      email: p.email ?? null,
    }));
  };

  // ------------------------------------------------------------------
  // Get existing friendship status with a user
  // ------------------------------------------------------------------
  const getFriendshipStatus = async (
    otherUserId: string
  ): Promise<{ status: 'none' | 'pending_sent' | 'pending_received' | 'accepted'; friendshipId?: string }> => {
    if (!user) return { status: 'none' };

    const { data } = await supabase
      .from('friendships')
      .select('id, requester_id, status')
      .or(
        `and(requester_id.eq.${user.id},recipient_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},recipient_id.eq.${user.id})`
      )
      .maybeSingle();

    if (!data) return { status: 'none' };

    if (data.status === 'accepted') return { status: 'accepted', friendshipId: data.id };
    if (data.status === 'pending') {
      return {
        status: data.requester_id === user.id ? 'pending_sent' : 'pending_received',
        friendshipId: data.id,
      };
    }
    return { status: 'none' };
  };

  // ------------------------------------------------------------------
  // CRUD
  // ------------------------------------------------------------------
  const sendFriendRequest = async (recipientId: string): Promise<{ error: Error | null }> => {
    if (!user) return { error: new Error('Not authenticated') };
    const { error } = await supabase
      .from('friendships')
      .insert({ requester_id: user.id, recipient_id: recipientId, status: 'pending' });
    if (!error) await refresh();
    return { error };
  };

  const acceptRequest = async (friendshipId: string): Promise<{ error: Error | null }> => {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);
    if (!error) await refresh();
    return { error };
  };

  const rejectRequest = async (friendshipId: string): Promise<{ error: Error | null }> => {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'rejected' })
      .eq('id', friendshipId);
    if (!error) await refresh();
    return { error };
  };

  const unfriend = async (friendshipId: string): Promise<{ error: Error | null }> => {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    if (!error) await refresh();
    return { error };
  };

  const cancelRequest = async (friendshipId: string): Promise<{ error: Error | null }> => {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    if (!error) await refresh();
    return { error };
  };

  return {
    friends,
    pendingReceived,
    pendingSent,
    loading,
    refresh,
    searchUsers,
    getFriendshipStatus,
    sendFriendRequest,
    acceptRequest,
    rejectRequest,
    unfriend,
    cancelRequest,
  };
}
