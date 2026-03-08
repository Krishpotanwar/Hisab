-- Add FK from group_members.user_id to public.profiles.id
-- so PostgREST can navigate the profiles!inner() join
ALTER TABLE public.group_members
  ADD CONSTRAINT group_members_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Also add FK from expenses.paid_by to public.profiles so PostgREST can join
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_paid_by_profiles_fkey
  FOREIGN KEY (paid_by) REFERENCES public.profiles(id) ON DELETE CASCADE;
