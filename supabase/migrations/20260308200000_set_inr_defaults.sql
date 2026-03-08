-- Set INR as default currency for India-first product
ALTER TABLE public.groups ALTER COLUMN currency SET DEFAULT 'INR';
ALTER TABLE public.expenses ALTER COLUMN currency SET DEFAULT 'INR';
ALTER TABLE public.payment_orders ALTER COLUMN currency SET DEFAULT 'INR';
