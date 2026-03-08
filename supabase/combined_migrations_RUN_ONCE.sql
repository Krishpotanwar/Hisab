-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Create trigger for new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data ->> 'full_name', new.email));
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create groups table
CREATE TABLE public.groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '👥',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Create group members table
CREATE TABLE public.group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  paid_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Create expense splits table
CREATE TABLE public.expense_splits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  UNIQUE(expense_id, user_id)
);

ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;

-- Create settlements table
CREATE TABLE public.settlements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  from_user UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  notes TEXT,
  settled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for groups
CREATE POLICY "Users can view groups they are members of" ON public.groups
  FOR SELECT USING (
    id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create groups" ON public.groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group creators can update groups" ON public.groups
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Group creators can delete groups" ON public.groups
  FOR DELETE USING (created_by = auth.uid());

-- RLS Policies for group_members
CREATE POLICY "Members can view group members" ON public.group_members
  FOR SELECT USING (
    group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Group creators can add members" ON public.group_members
  FOR INSERT WITH CHECK (
    group_id IN (SELECT id FROM public.groups WHERE created_by = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Members can leave groups" ON public.group_members
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for expenses
CREATE POLICY "Members can view group expenses" ON public.expenses
  FOR SELECT USING (
    group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Members can create expenses" ON public.expenses
  FOR INSERT WITH CHECK (
    group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
    AND paid_by = auth.uid()
  );

CREATE POLICY "Expense creators can update" ON public.expenses
  FOR UPDATE USING (paid_by = auth.uid());

CREATE POLICY "Expense creators can delete" ON public.expenses
  FOR DELETE USING (paid_by = auth.uid());

-- RLS Policies for expense_splits
CREATE POLICY "Members can view expense splits" ON public.expense_splits
  FOR SELECT USING (
    expense_id IN (
      SELECT id FROM public.expenses WHERE group_id IN (
        SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Expense creators can manage splits" ON public.expense_splits
  FOR INSERT WITH CHECK (
    expense_id IN (SELECT id FROM public.expenses WHERE paid_by = auth.uid())
  );

CREATE POLICY "Expense creators can delete splits" ON public.expense_splits
  FOR DELETE USING (
    expense_id IN (SELECT id FROM public.expenses WHERE paid_by = auth.uid())
  );

-- RLS Policies for settlements
CREATE POLICY "Members can view settlements" ON public.settlements
  FOR SELECT USING (
    group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create settlements as payer" ON public.settlements
  FOR INSERT WITH CHECK (from_user = auth.uid());

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();-- Fix function search path for update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;-- Advanced Splitwise-like features: comments, receipts (for OCR), recurring + metadata, activity logs, indexes, and storage policies

-- ########################################
-- Expense metadata (currency, split type, recurring flags)
-- ########################################

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'expense_split_type'
  ) THEN
    CREATE TYPE public.expense_split_type AS ENUM ('equal', 'shares', 'exact');
  END IF;
END;
$$;

ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS split_type public.expense_split_type NOT NULL DEFAULT 'equal';

ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS recurring_interval TEXT;

-- ########################################
-- Receipts table (for OCR + image attachments)
-- ########################################

CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID NULL REFERENCES public.expenses(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL,
  ocr_text TEXT,
  total_amount DECIMAL(12,2),
  currency TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own receipts"
  ON public.receipts
  FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own receipts"
  ON public.receipts
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own receipts"
  ON public.receipts
  FOR DELETE
  USING (auth.uid() = created_by);

-- ########################################
-- Expense comments (Splitwise-style notes / chat per expense)
-- ########################################

CREATE TABLE IF NOT EXISTS public.expense_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view expense comments"
  ON public.expense_comments
  FOR SELECT
  USING (
    expense_id IN (
      SELECT e.id
      FROM public.expenses e
      JOIN public.group_members gm ON gm.group_id = e.group_id
      WHERE gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can create expense comments"
  ON public.expense_comments
  FOR INSERT
  WITH CHECK (
    expense_id IN (
      SELECT e.id
      FROM public.expenses e
      JOIN public.group_members gm ON gm.group_id = e.group_id
      WHERE gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Authors can delete their comments"
  ON public.expense_comments
  FOR DELETE
  USING (user_id = auth.uid());

-- ########################################
-- Activity log (for auditing + activity feed)
-- ########################################

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expense_id UUID NULL REFERENCES public.expenses(id) ON DELETE SET NULL,
  settlement_id UUID NULL REFERENCES public.settlements(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view activity logs for their groups"
  ON public.activity_logs
  FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert activity logs"
  ON public.activity_logs
  FOR INSERT
  WITH CHECK (true);

-- NOTE: You can wire triggers later to auto-log events on expenses/settlements/groups.

-- ########################################
-- Performance indexes
-- ########################################

-- Core foreign keys
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);

CREATE INDEX IF NOT EXISTS idx_expenses_group_id_date ON public.expenses(group_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON public.expenses(paid_by);

CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_id ON public.expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_user_id ON public.expense_splits(user_id);

CREATE INDEX IF NOT EXISTS idx_settlements_group_id ON public.settlements(group_id);
CREATE INDEX IF NOT EXISTS idx_settlements_from_to ON public.settlements(from_user, to_user);

CREATE INDEX IF NOT EXISTS idx_receipts_expense_id ON public.receipts(expense_id);
CREATE INDEX IF NOT EXISTS idx_receipts_created_by ON public.receipts(created_by);

CREATE INDEX IF NOT EXISTS idx_expense_comments_expense_id ON public.expense_comments(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_comments_user_id ON public.expense_comments(user_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_group_created_at ON public.activity_logs(group_id, created_at DESC);

-- ########################################
-- Storage policies for avatars and receipts
-- (Requires buckets named 'avatars' and 'receipts' to exist in Storage)
--
-- NOTE: We do NOT alter storage.objects here because it is owned by
-- Supabase's internal role. RLS is already enabled by default.
-- ########################################

-- Avatar images: publicly readable, only owner can write/delete
CREATE POLICY "Avatar images are publicly readable"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can manage their avatar images"
  ON storage.objects
  FOR ALL
  USING (bucket_id = 'avatars' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'avatars' AND owner = auth.uid());

-- Receipts: private to owner by default
CREATE POLICY "Users can view their own receipts files"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'receipts' AND owner = auth.uid());

CREATE POLICY "Users can manage their own receipts files"
  ON storage.objects
  FOR ALL
  USING (bucket_id = 'receipts' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'receipts' AND owner = auth.uid());

-- Fix recursive policy on group_members that caused "infinite recursion detected"
-- We replace the self-referential policy with non-recursive ones.

-- Drop old policies
DROP POLICY IF EXISTS "Members can view group members" ON public.group_members;
DROP POLICY IF EXISTS "Group creators can add members" ON public.group_members;
DROP POLICY IF EXISTS "Members can leave groups" ON public.group_members;

-- Select: creators can see all members of their groups; anyone can see their own membership row
CREATE POLICY "Creators or self can view group members"
  ON public.group_members
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() = (SELECT created_by FROM public.groups WHERE id = group_id)
  );

-- Insert: only group creator can add members
CREATE POLICY "Group creators can add members (safe)"
  ON public.group_members
  FOR INSERT
  WITH CHECK (
    auth.uid() = (SELECT created_by FROM public.groups WHERE id = group_id)
  );

-- Delete: members can remove themselves; creator can remove anyone
CREATE POLICY "Members or creator can delete membership"
  ON public.group_members
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR auth.uid() = (SELECT created_by FROM public.groups WHERE id = group_id)
  );
-- Break mutual recursion between groups and group_members RLS policies
-- Old groups SELECT policy referenced group_members, while group_members
-- policies referenced groups, causing "infinite recursion detected".

-- Replace membership-based groups SELECT policy with a simpler, non-recursive one.

DROP POLICY IF EXISTS "Users can view groups they are members of" ON public.groups;

CREATE POLICY "Users can view all groups (non-recursive)"
  ON public.groups
  FOR SELECT
  USING (true);

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
-- Harden payment and settlement integrity rules after security audit

CREATE OR REPLACE FUNCTION public.group_has_member(target_group_id UUID, target_user_id UUID)
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
      AND gm.user_id = target_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.group_has_member(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.group_has_member(UUID, UUID) TO authenticated;

-- Prevent authenticated clients from mutating payment order status directly
DROP POLICY IF EXISTS "Payer can update pending payment orders" ON public.payment_orders;

-- Keep client-side inserts constrained to valid "created" payment orders only
DROP POLICY IF EXISTS "Payer can create payment orders" ON public.payment_orders;
CREATE POLICY "Payer can create payment orders"
  ON public.payment_orders
  FOR INSERT
  WITH CHECK (
    payer_user_id = auth.uid()
    AND status = 'created'
    AND payer_user_id <> payee_user_id
    AND public.group_has_member(group_id, payer_user_id)
    AND public.group_has_member(group_id, payee_user_id)
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_orders_distinct_participants'
      AND conrelid = 'public.payment_orders'::regclass
  ) THEN
    ALTER TABLE public.payment_orders
      ADD CONSTRAINT payment_orders_distinct_participants
      CHECK (payer_user_id <> payee_user_id);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.validate_payment_order_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payer_user_id = NEW.payee_user_id THEN
    RAISE EXCEPTION USING
      MESSAGE = 'payer_user_id and payee_user_id must be different',
      ERRCODE = '23514';
  END IF;

  IF NOT public.group_has_member(NEW.group_id, NEW.payer_user_id) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'payer_user_id must be a member of the payment order group',
      ERRCODE = '23514';
  END IF;

  IF NOT public.group_has_member(NEW.group_id, NEW.payee_user_id) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'payee_user_id must be a member of the payment order group',
      ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_payment_order_participants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_payment_order_participants() TO authenticated;

DROP TRIGGER IF EXISTS validate_payment_order_participants ON public.payment_orders;
CREATE TRIGGER validate_payment_order_participants
  BEFORE INSERT OR UPDATE OF group_id, payer_user_id, payee_user_id
  ON public.payment_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_payment_order_participants();

-- Tighten settlement insert policy: payer and payee must both belong to the group
DROP POLICY IF EXISTS "Users can create settlements as payer" ON public.settlements;
DROP POLICY IF EXISTS "Members can create settlements as payer" ON public.settlements;
CREATE POLICY "Members can create settlements as payer"
  ON public.settlements
  FOR INSERT
  WITH CHECK (
    from_user = auth.uid()
    AND from_user <> to_user
    AND public.group_has_member(group_id, from_user)
    AND public.group_has_member(group_id, to_user)
  );

-- Keep one settlement row per payment order and clean up legacy duplicates first
WITH ranked_settlements AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY payment_order_id
      ORDER BY settled_at ASC, id ASC
    ) AS row_number
  FROM public.settlements
  WHERE payment_order_id IS NOT NULL
)
DELETE FROM public.settlements s
USING ranked_settlements rs
WHERE s.id = rs.id
  AND rs.row_number > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'settlements_payment_order_id_unique'
      AND conrelid = 'public.settlements'::regclass
  ) THEN
    ALTER TABLE public.settlements
      ADD CONSTRAINT settlements_payment_order_id_unique UNIQUE (payment_order_id);
  END IF;
END
$$;
-- Set INR as default currency for India-first product
ALTER TABLE public.groups ALTER COLUMN currency SET DEFAULT 'INR';
ALTER TABLE public.expenses ALTER COLUMN currency SET DEFAULT 'INR';
ALTER TABLE public.payment_orders ALTER COLUMN currency SET DEFAULT 'INR';
-- Add FK from group_members.user_id to public.profiles.id
-- so PostgREST can navigate the profiles!inner() join
ALTER TABLE public.group_members
  ADD CONSTRAINT group_members_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Also add FK from expenses.paid_by to public.profiles so PostgREST can join
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_paid_by_profiles_fkey
  FOREIGN KEY (paid_by) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone TEXT;
