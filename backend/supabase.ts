require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('CRITICAL: SUPABASE_URL and SUPABASE_ANON_KEY must be provided in .env');
}

let supabase;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.error('Supabase client not initialized due to missing SUPABASE_URL or SUPABASE_ANON_KEY.');

  supabase = {
    from: () => ({
      insert: () => Promise.resolve({ error: { message: 'Supabase client not initialized' } })
    })
  };
}

module.exports = {
  supabase,
};