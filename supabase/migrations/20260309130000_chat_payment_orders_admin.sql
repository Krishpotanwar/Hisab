-- is_admin flag for developer portal
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Group chat messages
CREATE TABLE IF NOT EXISTS public.group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members read messages" ON public.group_messages;
CREATE POLICY "Group members read messages" ON public.group_messages
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = group_messages.group_id
      AND group_members.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Group members send messages" ON public.group_messages;
CREATE POLICY "Group members send messages" ON public.group_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = group_messages.group_id
        AND group_members.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_group_messages_group_created
  ON public.group_messages(group_id, created_at);

-- Payment orders table (used by Razorpay edge functions)
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  payer_user_id UUID NOT NULL REFERENCES auth.users(id),
  payee_user_id UUID NOT NULL REFERENCES auth.users(id),
  provider TEXT NOT NULL DEFAULT 'razorpay',
  provider_order_id TEXT,
  provider_payment_id TEXT,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','paid','failed','cancelled')),
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own payment orders" ON public.payment_orders;
CREATE POLICY "Users see own payment orders" ON public.payment_orders
  FOR SELECT USING (auth.uid() = payer_user_id OR auth.uid() = payee_user_id);

DROP POLICY IF EXISTS "Service manages payment orders" ON public.payment_orders;
CREATE POLICY "Service manages payment orders" ON public.payment_orders
  FOR ALL USING (true);
