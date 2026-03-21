-- ═══════════════════════════════════════════════════════════════
-- Promobot — Mini Website Pro Upgrade SQL Migration
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ═══════════════════════════════════════════════════════════════

-- Add new columns to the existing mini_sites table
ALTER TABLE mini_sites 
ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS banner_url TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS products JSONB DEFAULT '[]'::jsonb;

-- (Optional) If you want to rename 'services' to 'description' or keep both, we keep both for backward compatibility.
-- The new professional template will prioritize 'products' JSON over the old 'services' text list.
