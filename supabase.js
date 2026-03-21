const { createClient } = require('@supabase/supabase-js');

// ─── Supabase Configuration ────────────────────────────────────
// Set these in your environment (Vercel dashboard or .env file):
//   SUPABASE_URL=https://your-project.supabase.co
//   SUPABASE_ANON_KEY=your-anon-key
//   SUPABASE_SERVICE_KEY=your-service-role-key

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://knmlukyykwtmtfoqmeyx.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtubWx1a3l5a3d0bXRmb3FtZXl4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk3NjQ4OCwiZXhwIjoyMDg5NTUyNDg4fQ.Ewkf3FRm1P8ljK41aoIHMZV-Idr_euyO8t2-EyxZWKQ';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn('⚠️  SUPABASE_URL or SUPABASE_SERVICE_KEY not set — database calls will fail!');
    console.warn('   Set them in your .env or Vercel environment variables.');
}

// Use service role key for admin operations (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

module.exports = { supabase };
