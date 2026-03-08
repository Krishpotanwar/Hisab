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
