-- SECURITY DEFINER function: returns group (id, name, icon) for any authenticated user
-- Used only for invite-link preview before joining, bypasses the "members-only" SELECT
-- policy on groups. Exposes no sensitive data (no members, balances, or expenses).
CREATE OR REPLACE FUNCTION public.get_group_for_invite(target_group_id UUID)
RETURNS TABLE(id UUID, name TEXT, icon TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, icon FROM public.groups WHERE id = target_group_id;
$$;

REVOKE ALL ON FUNCTION public.get_group_for_invite(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_group_for_invite(UUID) TO authenticated;
