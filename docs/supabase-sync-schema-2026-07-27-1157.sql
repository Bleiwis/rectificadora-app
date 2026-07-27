-- Supabase migration: full current sync schema (idempotent)
-- Date: 2026-07-27
-- Purpose:
--   Align remote schema with the current app payload and local sequence strategy.
--   Safe to re-run multiple times.

BEGIN;

-- 1) Core catalog tables
CREATE TABLE IF NOT EXISTS public.services (
  id text PRIMARY KEY,
  name text NOT NULL,
  "priceUSD" numeric NOT NULL,
  category text NOT NULL DEFAULT 'Otros',
  description text
);

CREATE TABLE IF NOT EXISTS public.inventory (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  "priceUSD" numeric NOT NULL,
  quantity integer NOT NULL,
  "minStock" integer NOT NULL,
  description text
);

CREATE TABLE IF NOT EXISTS public.clients (
  id text PRIMARY KEY,
  "docType" text NOT NULL,
  "docNumber" text NOT NULL,
  "docNormalized" text NOT NULL UNIQUE,
  "firstName" text,
  "lastName" text,
  phone text,
  address text,
  "createdAt" text NOT NULL,
  "updatedAt" text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.app_users (
  id text PRIMARY KEY,
  username text NOT NULL,
  "displayName" text NOT NULL,
  role text NOT NULL,
  status text NOT NULL,
  "requiresPasswordReset" integer NOT NULL DEFAULT 0,
  "createdAt" text NOT NULL,
  "updatedAt" text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.app_runtime_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  "updatedAt" text NOT NULL
);

ALTER TABLE IF EXISTS public.app_runtime_config ADD COLUMN IF NOT EXISTS key text;
ALTER TABLE IF EXISTS public.app_runtime_config ADD COLUMN IF NOT EXISTS value text;
ALTER TABLE IF EXISTS public.app_runtime_config ADD COLUMN IF NOT EXISTS "updatedAt" text;

INSERT INTO public.app_runtime_config (key, value, "updatedAt")
VALUES
  ('lan_mode', 'standalone', now()::text),
  ('lan_host', '127.0.0.1', now()::text),
  ('lan_port', '4510', now()::text),
  ('lan_token', '', now()::text)
ON CONFLICT (key) DO NOTHING;

-- 1.1) Local-order-code sequence state mirrored in Supabase for schema parity
CREATE TABLE IF NOT EXISTS public.order_sequence_state (
  id integer PRIMARY KEY,
  prefix text NOT NULL,
  "nextValue" integer NOT NULL DEFAULT 1,
  "updatedAt" text NOT NULL,
  CONSTRAINT order_sequence_state_id_chk CHECK (id = 1)
);

ALTER TABLE IF EXISTS public.order_sequence_state ADD COLUMN IF NOT EXISTS prefix text;
ALTER TABLE IF EXISTS public.order_sequence_state ADD COLUMN IF NOT EXISTS "nextValue" integer NOT NULL DEFAULT 1;
ALTER TABLE IF EXISTS public.order_sequence_state ADD COLUMN IF NOT EXISTS "updatedAt" text;

-- 2) Orders table (full current shape)
CREATE TABLE IF NOT EXISTS public.orders (
  id text PRIMARY KEY,
  code text NOT NULL,
  "clientId" text,
  "clientName" text NOT NULL,
  "clientLastName" text NOT NULL,
  "clientCI" text NOT NULL,
  "clientPhone" text NOT NULL,
  "clientAddress" text,
  "engineModel" text NOT NULL,
  parts text NOT NULL,
  services text NOT NULL,
  "inventoryItems" text,
  "totalUSD" numeric NOT NULL,
  "totalVES" numeric NOT NULL,
  "paidUSD" numeric NOT NULL DEFAULT 0,
  "balanceUSD" numeric NOT NULL DEFAULT 0,
  "entryDate" text NOT NULL,
  "deliveryDays" integer NOT NULL,
  "tentativeDeliveryDate" text NOT NULL,
  "paymentStatus" text NOT NULL,
  "orderStatus" text NOT NULL DEFAULT 'Ingresado',
  "cancelReason" text,
  "canceledAt" text,
  "canceledBy" text,
  "canceledByUserId" text,
  priority text NOT NULL DEFAULT 'Media',
  responsible text,
  "createdBy" text NOT NULL,
  "createdByUserId" text
);

ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS "clientId" text;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS "clientName" text;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS "clientLastName" text;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS "clientCI" text;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS "clientPhone" text;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS "clientAddress" text;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS "engineModel" text;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS parts text;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS services text;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS "inventoryItems" text;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS "totalUSD" numeric;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS "totalVES" numeric;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS "paidUSD" numeric NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS "balanceUSD" numeric NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS "entryDate" text;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS "deliveryDays" integer;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS "tentativeDeliveryDate" text;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS "paymentStatus" text;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS "orderStatus" text;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS "cancelReason" text;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS "canceledAt" text;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS "canceledBy" text;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS "canceledByUserId" text;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'Media';
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS responsible text;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS "createdBy" text;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS "createdByUserId" text;

-- Backfill safe defaults for status and payment summary
UPDATE public.orders
SET "orderStatus" = 'Ingresado'
WHERE "orderStatus" IS NULL OR btrim("orderStatus") = '';

UPDATE public.orders
SET "paidUSD" = CASE
  WHEN "paidUSD" IS NULL THEN CASE WHEN "paymentStatus" = 'Paga' THEN COALESCE("totalUSD", 0) ELSE 0 END
  WHEN "paidUSD" < 0 THEN 0
  ELSE "paidUSD"
END;

UPDATE public.orders
SET "balanceUSD" = CASE
  WHEN "balanceUSD" IS NULL THEN GREATEST(COALESCE("totalUSD", 0) - COALESCE("paidUSD", 0), 0)
  WHEN "balanceUSD" < 0 THEN 0
  ELSE "balanceUSD"
END;

ALTER TABLE public.orders
ALTER COLUMN "orderStatus" SET DEFAULT 'Ingresado';

ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_orderstatus_chk;

ALTER TABLE public.orders
ADD CONSTRAINT orders_orderstatus_chk
CHECK ("orderStatus" IN ('Ingresado', 'Parcialmente retirado', 'Retirado', 'Cancelada'));

ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_canceled_reason_chk;

ALTER TABLE public.orders
ADD CONSTRAINT orders_canceled_reason_chk
CHECK ("orderStatus" <> 'Cancelada' OR ("cancelReason" IS NOT NULL AND btrim("cancelReason") <> ''));

-- 3) Order payments table
CREATE TABLE IF NOT EXISTS public.order_payments (
  id text PRIMARY KEY,
  "orderId" text NOT NULL,
  "paidAt" text NOT NULL,
  currency text NOT NULL,
  amount numeric NOT NULL,
  "paidUSD" numeric NOT NULL,
  "paidVES" numeric,
  "exchangeRate" numeric,
  note text,
  "createdBy" text,
  "createdByUserId" text
);

ALTER TABLE IF EXISTS public.order_payments ADD COLUMN IF NOT EXISTS "orderId" text;
ALTER TABLE IF EXISTS public.order_payments ADD COLUMN IF NOT EXISTS "paidAt" text;
ALTER TABLE IF EXISTS public.order_payments ADD COLUMN IF NOT EXISTS currency text;
ALTER TABLE IF EXISTS public.order_payments ADD COLUMN IF NOT EXISTS amount numeric;
ALTER TABLE IF EXISTS public.order_payments ADD COLUMN IF NOT EXISTS "paidUSD" numeric;
ALTER TABLE IF EXISTS public.order_payments ADD COLUMN IF NOT EXISTS "paidVES" numeric;
ALTER TABLE IF EXISTS public.order_payments ADD COLUMN IF NOT EXISTS "exchangeRate" numeric;
ALTER TABLE IF EXISTS public.order_payments ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE IF EXISTS public.order_payments ADD COLUMN IF NOT EXISTS "createdBy" text;
ALTER TABLE IF EXISTS public.order_payments ADD COLUMN IF NOT EXISTS "createdByUserId" text;

-- 4) Part-level withdrawal events table
CREATE TABLE IF NOT EXISTS public.order_part_deliveries (
  id text PRIMARY KEY,
  "orderId" text NOT NULL,
  "partIndex" integer NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  note text,
  "deliveredAt" timestamptz NOT NULL DEFAULT now(),
  "createdBy" text,
  "createdByUserId" text,
  CONSTRAINT order_part_deliveries_order_fk
    FOREIGN KEY ("orderId") REFERENCES public.orders(id) ON DELETE CASCADE
);

ALTER TABLE IF EXISTS public.order_part_deliveries ADD COLUMN IF NOT EXISTS "orderId" text;
ALTER TABLE IF EXISTS public.order_part_deliveries ADD COLUMN IF NOT EXISTS "partIndex" integer;
ALTER TABLE IF EXISTS public.order_part_deliveries ADD COLUMN IF NOT EXISTS quantity integer;
ALTER TABLE IF EXISTS public.order_part_deliveries ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE IF EXISTS public.order_part_deliveries ADD COLUMN IF NOT EXISTS "deliveredAt" timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS public.order_part_deliveries ADD COLUMN IF NOT EXISTS "createdBy" text;
ALTER TABLE IF EXISTS public.order_part_deliveries ADD COLUMN IF NOT EXISTS "createdByUserId" text;

-- 5) Foreign keys (created only if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_clientid_fkey'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
    ADD CONSTRAINT orders_clientid_fkey
    FOREIGN KEY ("clientId") REFERENCES public.clients(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_canceledbyuserid_fkey'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
    ADD CONSTRAINT orders_canceledbyuserid_fkey
    FOREIGN KEY ("canceledByUserId") REFERENCES public.app_users(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_createdbyuserid_fkey'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
    ADD CONSTRAINT orders_createdbyuserid_fkey
    FOREIGN KEY ("createdByUserId") REFERENCES public.app_users(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_payments_orderid_fkey'
      AND conrelid = 'public.order_payments'::regclass
  ) THEN
    ALTER TABLE public.order_payments
    ADD CONSTRAINT order_payments_orderid_fkey
    FOREIGN KEY ("orderId") REFERENCES public.orders(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_payments_createdbyuserid_fkey'
      AND conrelid = 'public.order_payments'::regclass
  ) THEN
    ALTER TABLE public.order_payments
    ADD CONSTRAINT order_payments_createdbyuserid_fkey
    FOREIGN KEY ("createdByUserId") REFERENCES public.app_users(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_part_deliveries_order_fk'
      AND conrelid = 'public.order_part_deliveries'::regclass
  ) THEN
    ALTER TABLE public.order_part_deliveries
    ADD CONSTRAINT order_part_deliveries_order_fk
    FOREIGN KEY ("orderId") REFERENCES public.orders(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_part_deliveries_createdbyuserid_fkey'
      AND conrelid = 'public.order_part_deliveries'::regclass
  ) THEN
    ALTER TABLE public.order_part_deliveries
    ADD CONSTRAINT order_part_deliveries_createdbyuserid_fkey
    FOREIGN KEY ("createdByUserId") REFERENCES public.app_users(id);
  END IF;
END $$;

-- 6) Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_sequence_state_prefix
  ON public.order_sequence_state (prefix);

CREATE INDEX IF NOT EXISTS idx_orders_client_ci
  ON public.orders ("clientCI");

CREATE INDEX IF NOT EXISTS idx_orders_client_id
  ON public.orders ("clientId");

CREATE INDEX IF NOT EXISTS idx_orders_created_by_user_id
  ON public.orders ("createdByUserId");

CREATE INDEX IF NOT EXISTS idx_orders_order_status
  ON public.orders ("orderStatus");

CREATE INDEX IF NOT EXISTS idx_order_payments_order_id
  ON public.order_payments ("orderId");

CREATE INDEX IF NOT EXISTS idx_order_payments_paid_at
  ON public.order_payments ("paidAt");

CREATE INDEX IF NOT EXISTS idx_order_part_deliveries_order_id
  ON public.order_part_deliveries ("orderId");

CREATE INDEX IF NOT EXISTS idx_order_part_deliveries_order_part
  ON public.order_part_deliveries ("orderId", "partIndex");

COMMIT;

-- Optional rollback is intentionally omitted because this is a full alignment script.
