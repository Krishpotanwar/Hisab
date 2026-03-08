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
