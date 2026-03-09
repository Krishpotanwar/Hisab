-- ============================================================
-- Notifications table
-- ============================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('expense_added','settlement','group_invite','member_joined')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  related_group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  related_expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role (edge function) can insert for any user
CREATE POLICY "Service inserts notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_notifications_user_unread
  ON public.notifications(user_id, read, created_at DESC);

-- ============================================================
-- Pending members table (invite by email before signup)
-- ============================================================
CREATE TABLE public.pending_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_name TEXT,
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, invited_email)
);

ALTER TABLE public.pending_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members view pending invites"
  ON public.pending_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = pending_members.group_id
        AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members insert pending invites"
  ON public.pending_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = pending_members.group_id
        AND group_members.user_id = auth.uid()
    )
  );

-- Service role (edge function) can delete pending after claim
CREATE POLICY "Service manages pending invites"
  ON public.pending_members FOR ALL
  USING (true);

-- ============================================================
-- Auto-claim pending memberships when a user signs up
-- Fires on auth.users INSERT (has email in NEW.email)
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_pending_memberships()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Add the new user to every group they were pending in
  INSERT INTO public.group_members (group_id, user_id)
  SELECT group_id, NEW.id
  FROM public.pending_members
  WHERE lower(invited_email) = lower(NEW.email)
  ON CONFLICT DO NOTHING;

  -- Clean up claimed invites
  DELETE FROM public.pending_members
  WHERE lower(invited_email) = lower(NEW.email);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_claim_pending
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.claim_pending_memberships();
