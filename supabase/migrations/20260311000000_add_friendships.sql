-- Friendships table for the Add Friends feature
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Prevent duplicate friendship rows in either direction
  UNIQUE(requester_id, recipient_id),
  -- Prevent self-friending
  CONSTRAINT friendships_no_self_reference CHECK (requester_id <> recipient_id)
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Users can view any friendship row they are part of
CREATE POLICY "Users can view their friendships"
  ON public.friendships FOR SELECT
  USING (requester_id = auth.uid() OR recipient_id = auth.uid());

-- Only the requester can insert a friendship request
CREATE POLICY "Users can send friend requests"
  ON public.friendships FOR INSERT
  WITH CHECK (requester_id = auth.uid());

-- Only the recipient can accept or reject (not the requester, to prevent self-acceptance)
CREATE POLICY "Recipient can respond to friend requests"
  ON public.friendships FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (status IN ('accepted', 'rejected'));

-- Either party can delete (requester cancels, recipient removes)
CREATE POLICY "Users can delete their friendships"
  ON public.friendships FOR DELETE
  USING (requester_id = auth.uid() OR recipient_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_recipient ON public.friendships(recipient_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON public.friendships(status);
