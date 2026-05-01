-- =============================================
-- Supabase SQL Setup for Beach Bums Auto-Print
-- =============================================
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- 1. Create the orders table
CREATE TABLE IF NOT EXISTS orders (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id      TEXT UNIQUE,
  delivery_date DATE,
  end_date      DATE,
  customer_name TEXT,
  email         TEXT,
  phone         TEXT,
  address       TEXT,
  access_point  TEXT,
  items         JSONB DEFAULT '{}'::JSONB,
  total         NUMERIC(10,2) DEFAULT 0,
  logo_url      TEXT DEFAULT '/assets/logo.webp',
  printed       BOOLEAN DEFAULT FALSE,
  last_printed_date TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Index on delivery_date + printed (the daily cron query)
CREATE INDEX IF NOT EXISTS idx_orders_delivery_printed
  ON orders (delivery_date, printed);

-- 3. Enable Row-Level Security (recommended by Supabase)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 4. Allow inserts from the anon key (Netlify Function uses anon key)
CREATE POLICY "Allow insert from anon"
  ON orders FOR INSERT
  WITH CHECK (true);

-- 5. Allow select from the anon key (cron function reads orders)
CREATE POLICY "Allow select from anon"
  ON orders FOR SELECT
  USING (true);

-- 6. Allow update from the anon key (cron function marks printed = true)
CREATE POLICY "Allow update from anon"
  ON orders FOR UPDATE
  USING (true)
  WITH CHECK (true);
