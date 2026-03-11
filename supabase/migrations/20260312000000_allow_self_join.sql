-- =====================================================================
-- Allow any authenticated user to join a group via invite link
-- (self-join policy — user can only insert their own user_id)
-- =====================================================================
CREATE POLICY "Users can join groups via invite link"
  ON public.group_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- =====================================================================
-- Fix activity_logs: restrict INSERT to authenticated user's own groups
-- (previously WITH CHECK (true) — anyone could log anything)
-- =====================================================================
DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON public.activity_logs;

CREATE POLICY "Users can insert activity logs for their groups"
  ON public.activity_logs FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = activity_logs.group_id
        AND group_members.user_id = auth.uid()
    )
  );

-- NOTE: payment_events is a raw Razorpay webhook log (no group_id/user_id columns).
-- It is intentionally service-role-only. No user-facing RLS policies needed.
