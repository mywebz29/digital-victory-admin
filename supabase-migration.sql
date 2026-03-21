-- ═══════════════════════════════════════════════════════════════
-- Promobot — Supabase Migration SQL
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ═══════════════════════════════════════════════════════════════

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email TEXT DEFAULT '',
  device_id TEXT DEFAULT '',
  name TEXT DEFAULT '',
  mobile TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Plans (NEW)
CREATE TABLE IF NOT EXISTS plans (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  duration_days INT DEFAULT 30,
  price DECIMAL(10,2) DEFAULT 0,
  features JSONB DEFAULT '{"sms":true,"whatsapp":false,"broadcast":false,"minisite":false,"posters":false}',
  max_sms_per_day INT DEFAULT 100,
  max_whatsapp_per_day INT DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Activation Keys
CREATE TABLE IF NOT EXISTS activation_keys (
  id SERIAL PRIMARY KEY,
  key_value TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  plan_name TEXT NOT NULL,
  duration_days INT NOT NULL,
  assigned_username TEXT DEFAULT '',
  assigned_mobile TEXT DEFAULT '',
  is_used BOOLEAN DEFAULT false,
  is_revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  used_at TIMESTAMPTZ
);

-- 4. Licenses
CREATE TABLE IF NOT EXISTS licenses (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  key_id INT REFERENCES activation_keys(id) ON DELETE SET NULL,
  token TEXT UNIQUE NOT NULL,
  expiry_date TIMESTAMPTZ NOT NULL,
  plan_name TEXT,
  plan_amount TEXT DEFAULT '0',
  payment_status TEXT DEFAULT 'Paid',
  support_mobile TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Mini Sites
CREATE TABLE IF NOT EXISTS mini_sites (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  business_name TEXT NOT NULL,
  tagline TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  whatsapp TEXT DEFAULT '',
  email TEXT DEFAULT '',
  address TEXT DEFAULT '',
  maps_link TEXT DEFAULT '',
  services TEXT DEFAULT '',
  upi_id TEXT DEFAULT '',
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Poster Templates (admin-managed festive backgrounds)
CREATE TABLE IF NOT EXISTS poster_templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'generic',
  background_url TEXT NOT NULL,
  thumbnail_url TEXT DEFAULT '',
  overlay_config JSONB DEFAULT '{"name_x":50,"name_y":80,"mobile_x":50,"mobile_y":88,"logo_x":50,"logo_y":15,"logo_size":80,"text_color":"#FFFFFF","font_size":28}',
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Banners (admin-managed promotional banners for app dashboard)
CREATE TABLE IF NOT EXISTS banners (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT DEFAULT '',
  link_type TEXT DEFAULT 'none',  -- "none", "url", "screen"
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- Seed Default Data
-- ═══════════════════════════════════════════════════════════════

-- Default plans
INSERT INTO plans (name, duration_days, price, features, max_sms_per_day, max_whatsapp_per_day) VALUES
('Basic',   365,  500,  '{"sms":true,"whatsapp":false,"broadcast":false,"minisite":false,"posters":false}', 100, 0),
('Pro',     365,  999,  '{"sms":true,"whatsapp":true,"broadcast":true,"minisite":true,"posters":false}', 200, 50),
('Premium', 365, 2999, '{"sms":true,"whatsapp":true,"broadcast":true,"minisite":true,"posters":true}', 500, 200)
ON CONFLICT (name) DO NOTHING;

-- Create Supabase Storage bucket for poster templates
-- (Run this via Supabase Dashboard > Storage > New Bucket)
-- Bucket name: "poster-templates"
-- Public: Yes

-- ═══════════════════════════════════════════════════════════════
-- RLS Policies (optional, service key bypasses these)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE activation_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE mini_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE poster_templates ENABLE ROW LEVEL SECURITY;

-- Allow public read on poster_templates and mini_sites
CREATE POLICY "Public can read active posters" ON poster_templates FOR SELECT USING (is_active = true);
CREATE POLICY "Public can read mini sites" ON mini_sites FOR SELECT USING (true);
