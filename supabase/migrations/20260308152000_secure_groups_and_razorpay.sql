-- Add profile email support for reliable member lookup
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email TEXT;

UPDATE public.profiles p
SET email = lower(u.email)
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR p.email <> lower(u.email));

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_unique
  ON public.profiles ((lower(email)))
  WHERE email IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    lower(NEW.email)
  )
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET email = lower(NEW.email)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
AFTER UPDATE OF email ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_email();

-- Security-definer helpers avoid RLS recursion between groups and group_members
CREATE OR REPLACE FUNCTION public.user_is_group_member(target_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = target_group_id
      AND gm.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_is_group_creator(target_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.groups g
    WHERE g.id = target_group_id
      AND g.created_by = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.user_is_group_member(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_is_group_creator(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_is_group_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_group_creator(UUID) TO authenticated;

DROP POLICY IF EXISTS "Users can view groups they are members of" ON public.groups;
DROP POLICY IF EXISTS "Users can view all groups (non-recursive)" ON public.groups;

CREATE POLICY "Members can view groups (secure)"
  ON public.groups
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR public.user_is_group_member(id)
  );

DROP POLICY IF EXISTS "Members can view group members" ON public.group_members;
DROP POLICY IF EXISTS "Group creators can add members" ON public.group_members;
DROP POLICY IF EXISTS "Members can leave groups" ON public.group_members;
DROP POLICY IF EXISTS "Creators or self can view group members" ON public.group_members;
DROP POLICY IF EXISTS "Group creators can add members (safe)" ON public.group_members;
DROP POLICY IF EXISTS "Members or creator can delete membership" ON public.group_members;

CREATE POLICY "Members can view group members (secure)"
  ON public.group_members
  FOR SELECT
  USING (public.user_is_group_member(group_id) OR public.user_is_group_creator(group_id));

CREATE POLICY "Creators can add group members (secure)"
  ON public.group_members
  FOR INSERT
  WITH CHECK (public.user_is_group_creator(group_id));

CREATE POLICY "Members can remove self or creator can remove anyone"
  ON public.group_members
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR public.user_is_group_creator(group_id)
  );

-- Payment ledger tables for Razorpay settlement flow
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  payer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payee_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'razorpay',
  provider_order_id TEXT NOT NULL UNIQUE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'paid', 'failed', 'cancelled', 'refunded')),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view payment orders" ON public.payment_orders;
DROP POLICY IF EXISTS "Payer can create payment orders" ON public.payment_orders;
DROP POLICY IF EXISTS "Payer can update pending payment orders" ON public.payment_orders;

CREATE POLICY "Participants can view payment orders"
  ON public.payment_orders
  FOR SELECT
  USING (
    payer_user_id = auth.uid()
    OR payee_user_id = auth.uid()
    OR public.user_is_group_member(group_id)
  );

CREATE POLICY "Payer can create payment orders"
  ON public.payment_orders
  FOR INSERT
  WITH CHECK (
    payer_user_id = auth.uid()
    AND public.user_is_group_member(group_id)
  );

CREATE POLICY "Payer can update pending payment orders"
  ON public.payment_orders
  FOR UPDATE
  USING (payer_user_id = auth.uid() AND status = 'created')
  WITH CHECK (payer_user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_order_id UUID NOT NULL REFERENCES public.payment_orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'razorpay',
  provider_payment_id TEXT NOT NULL UNIQUE,
  provider_signature TEXT,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'captured'
    CHECK (status IN ('authorized', 'captured', 'failed', 'refunded')),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view payment transactions" ON public.payment_transactions;
CREATE POLICY "Participants can view payment transactions"
  ON public.payment_transactions
  FOR SELECT
  USING (
    payment_order_id IN (
      SELECT po.id
      FROM public.payment_orders po
      WHERE po.payer_user_id = auth.uid()
         OR po.payee_user_id = auth.uid()
         OR public.user_is_group_member(po.group_id)
    )
  );

CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'razorpay',
  provider_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS payment_order_id UUID REFERENCES public.payment_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payment_orders_group_id ON public.payment_orders(group_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_payer ON public.payment_orders(payer_user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_payee ON public.payment_orders(payee_user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON public.payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON public.payment_transactions(payment_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_provider_event_id ON public.payment_events(provider_event_id);
CREATE INDEX IF NOT EXISTS idx_settlements_payment_order_id ON public.settlements(payment_order_id);

DROP TRIGGER IF EXISTS update_payment_orders_updated_at ON public.payment_orders;
CREATE TRIGGER update_payment_orders_updated_at
  BEFORE UPDATE ON public.payment_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
