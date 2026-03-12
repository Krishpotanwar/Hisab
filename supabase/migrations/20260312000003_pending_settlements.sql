-- Pending settlements: Person A (debtor) requests settlement outside app.
-- Person B (creditor) must confirm receipt before it's recorded.

CREATE TABLE IF NOT EXISTS public.pending_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  from_user UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view pending settlements"
  ON public.pending_settlements FOR SELECT
  USING (from_user = auth.uid() OR to_user = auth.uid());

CREATE POLICY "Payer can create pending settlement"
  ON public.pending_settlements FOR INSERT
  WITH CHECK (from_user = auth.uid());

CREATE POLICY "Either party can delete pending settlement"
  ON public.pending_settlements FOR DELETE
  USING (from_user = auth.uid() OR to_user = auth.uid());

-- SECURITY DEFINER: creditor confirms receipt → inserts real settlement + removes pending
CREATE OR REPLACE FUNCTION public.confirm_pending_settlement(pending_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ps public.pending_settlements%ROWTYPE;
BEGIN
  SELECT * INTO ps FROM public.pending_settlements WHERE id = pending_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending settlement not found';
  END IF;
  IF ps.to_user != auth.uid() THEN
    RAISE EXCEPTION 'Only the payment recipient can confirm receipt';
  END IF;
  INSERT INTO public.settlements (group_id, from_user, to_user, amount, notes)
    VALUES (ps.group_id, ps.from_user, ps.to_user, ps.amount,
            COALESCE(ps.notes, 'Settled outside app'));
  DELETE FROM public.pending_settlements WHERE id = pending_id;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_pending_settlement(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_pending_settlement(UUID) TO authenticated;
