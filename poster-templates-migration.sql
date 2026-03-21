-- Promobot — Poster Templates Migration SQL
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS poster_templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'generic',
    background_url TEXT NOT NULL,
    thumbnail_url TEXT,
    overlay_config JSONB DEFAULT '{}'::jsonb,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Optional: Insert a sample daily quote
INSERT INTO poster_templates (name, category, background_url, thumbnail_url, overlay_config) VALUES 
('Good Morning Sunrise', 'Daily Motivation', 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1000&auto=format&fit=crop', 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1000&auto=format&fit=crop', '{"name_x": 50, "name_y": 80, "mobile_x": 50, "mobile_y": 88, "logo_x": 50, "logo_y": 15, "logo_size": 80, "text_color": "#FFFFFF", "font_size": 28}');
