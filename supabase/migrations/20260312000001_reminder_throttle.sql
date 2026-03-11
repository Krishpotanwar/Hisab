-- =====================================================================
-- reminder_sends: tracks when settle-up reminders are sent per group
-- Rate limit: 1 reminder per group per 24 hours (enforced in app layer)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.reminder_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  sent_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reminder_sends ENABLE ROW LEVEL SECURITY;

-- Group members can view reminder history for their group
CREATE POLICY "Group members can view reminders"
  ON public.reminder_sends FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = reminder_sends.group_id
        AND group_members.user_id = auth.uid()
    )
  );

-- Group members can insert a reminder for their own group
CREATE POLICY "Group members can send reminders"
  ON public.reminder_sends FOR INSERT
  WITH CHECK (
    sent_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = reminder_sends.group_id
        AND group_members.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_reminder_sends_group ON public.reminder_sends(group_id, sent_at DESC);
