import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface ChatMessage {
  id: string;
  group_id: string;
  user_id: string;
  sender_name: string;
  content: string;
  created_at: string;
}

export function useGroupChat(groupId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!groupId) return;
    const { data } = await supabase
      .from('group_messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
      .limit(100);
    if (data) setMessages(data as ChatMessage[]);
    setLoading(false);
  }, [groupId]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`chat:${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'group_messages',
        filter: `group_id=eq.${groupId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as ChatMessage]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId]);

  const sendMessage = async (content: string) => {
    if (!user || !groupId || !content.trim()) return;
    setSending(true);
    const senderName = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'User';
    await supabase.from('group_messages').insert({
      group_id: groupId,
      user_id: user.id,
      sender_name: senderName,
      content: content.trim(),
    });
    setSending(false);
  };

  return { messages, loading, sending, sendMessage };
}
