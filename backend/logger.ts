const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('CRITICAL: SUPABASE_URL and SUPABASE_KEY must be provided in .env');
}

let supabase;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.error('Supabase client not initialized due to missing SUPABASE_URL or SUPABASE_KEY.');
 
  supabase = {
    from: () => ({
      insert: () => Promise.resolve({ error: { message: 'Supabase client not initialized' } })
    })
  };
}

async function logToSupabase(logData) {
  if (!supabase || typeof supabase.from !== 'function') {
    console.error('Supabase client is not properly initialized. Cannot log to Supabase.', logData);
    return;
  }

  const { type, roomId, userId, message, data } = logData;

  const logEntry = {
    type,
    room_id: roomId,
    user_id: userId,
    message,
    data,
  };

 
  Object.keys(logEntry).forEach(key => {
    if (logEntry[key] === undefined) {
      delete logEntry[key];
    }
  });

  try {
    const { error } = await supabase.from('logs').insert([logEntry]);

    if (error) {
      console.error('Failed to log to Supabase:', error.message, logEntry);
    }
  } catch (err) {
    console.error('Exception during Supabase log insertion:', err.message, logEntry);
  }
}

module.exports = {
  logToSupabase,
};
