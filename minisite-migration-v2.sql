-- ═══════════════════════════════════════════════════════════════
-- Promobot — Mini Website Sagar Tailor Upgrade SQL Migration
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ═══════════════════════════════════════════════════════════════

-- Add gallery and custom links columns to the mini_sites table
ALTER TABLE mini_sites 
ADD COLUMN IF NOT EXISTS gallery JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS custom_links JSONB DEFAULT '[]'::jsonb;
