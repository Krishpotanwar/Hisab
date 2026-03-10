import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface ExpenseComment {
  id: string;
  expense_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_name: string;
  avatar_url: string | null;
}

export function useExpenseComments(expenseId: string) {
  const { user } = useAuth();
  const [comments, setComments] = useState<ExpenseComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!expenseId) return;

    const { data, error } = await supabase
      .from('expense_comments')
      .select('*, profiles!expense_comments_user_id_fkey(full_name, avatar_url)')
      .eq('expense_id', expenseId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      const mapped: ExpenseComment[] = data.map((row: any) => ({
        id: row.id,
        expense_id: row.expense_id,
        user_id: row.user_id,
        content: row.content,
        created_at: row.created_at,
        user_name: row.profiles?.full_name ?? 'Unknown',
        avatar_url: row.profiles?.avatar_url ?? null,
      }));
      setComments(mapped);
    }
    setLoading(false);
  }, [expenseId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Realtime subscription for new comments
  useEffect(() => {
    if (!expenseId) return;

    const channel = supabase
      .channel(`expense-comments:${expenseId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expense_comments',
          filter: `expense_id=eq.${expenseId}`,
        },
        () => {
          fetchComments();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [expenseId, fetchComments]);

  const addComment = async (content: string) => {
    if (!user || !expenseId || !content.trim()) return;
    setSubmitting(true);

    await supabase.from('expense_comments').insert({
      expense_id: expenseId,
      user_id: user.id,
      content: content.trim(),
    });

    setSubmitting(false);
  };

  const deleteComment = async (commentId: string) => {
    if (!user) return;
    await supabase
      .from('expense_comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', user.id);
  };

  return { comments, loading, submitting, addComment, deleteComment };
}
