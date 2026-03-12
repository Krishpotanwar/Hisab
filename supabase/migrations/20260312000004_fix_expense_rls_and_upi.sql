-- Fix 1: Relax expense INSERT policy so any group member can record
--         an expense paid by ANY other group member (not just themselves).
DROP POLICY IF EXISTS "Members can create expenses" ON public.expenses;
CREATE POLICY "Members can create expenses" ON public.expenses
  FOR INSERT WITH CHECK (
    -- Actor must be a member of the group
    group_id IN (
      SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    )
    -- The stated payer must also be a member of the same group
    AND paid_by IN (
      SELECT user_id FROM public.group_members WHERE group_id = expenses.group_id
    )
  );

-- Fix 2: Relax expense_splits INSERT/DELETE policy so the person who
--         submitted the expense (even on behalf of another payer) can add splits.
DROP POLICY IF EXISTS "Expense creators can manage splits" ON public.expense_splits;
CREATE POLICY "Group members can insert splits" ON public.expense_splits
  FOR INSERT WITH CHECK (
    expense_id IN (
      SELECT e.id FROM public.expenses e
      JOIN public.group_members gm ON gm.group_id = e.group_id
      WHERE gm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Expense creators can delete splits" ON public.expense_splits;
CREATE POLICY "Group members can delete splits" ON public.expense_splits
  FOR DELETE USING (
    expense_id IN (
      SELECT e.id FROM public.expenses e
      JOIN public.group_members gm ON gm.group_id = e.group_id
      WHERE gm.user_id = auth.uid()
    )
  );

-- Fix 3: Also allow group members to update expenses they submitted
--         (currently only allowed if paid_by = auth.uid()).
DROP POLICY IF EXISTS "Expense creators can update" ON public.expenses;
CREATE POLICY "Group members can update expenses" ON public.expenses
  FOR UPDATE USING (
    group_id IN (
      SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    )
  );

-- Fix 4: Add upi_id column to profiles for direct UPI payment routing.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS upi_id TEXT;
