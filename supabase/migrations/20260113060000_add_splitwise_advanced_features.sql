-- Advanced Splitwise-like features: comments, receipts (for OCR), recurring + metadata, activity logs, indexes, and storage policies

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

