-- Break mutual recursion between groups and group_members RLS policies
-- Old groups SELECT policy referenced group_members, while group_members
-- policies referenced groups, causing "infinite recursion detected".

-- Replace membership-based groups SELECT policy with a simpler, non-recursive one.

DROP POLICY IF EXISTS "Users can view groups they are members of" ON public.groups;

CREATE POLICY "Users can view all groups (non-recursive)"
  ON public.groups
  FOR SELECT
  USING (true);

