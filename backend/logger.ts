import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('CRITICAL: SUPABASE_URL and SUPABASE_KEY must be provided in .env');
}

let supabase: SupabaseClient;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  // Dummy fallback to prevent crashes if env is missing
  supabase = {
    from: () => ({
      insert: async () => ({ error: { message: 'Supabase client not initialized' } })
    })
  } as unknown as SupabaseClient;
}

export interface LogData {
  type: string;
  roomId?: string;
  userId?: string;
  message: string;
  data?: any;
}

export type LogToSupabaseFn = (logData: LogData) => Promise<void>;

export const logToSupabase: LogToSupabaseFn = async (logData) => {
  if (!supabase || typeof supabase.from !== 'function') {
    console.error('Supabase client is not properly initialized. Cannot log to Supabase.', logData);
    return;
  }

  const { type, roomId, userId, message, data } = logData;

  const logEntry: Record<string, any> = {
    type,
    room_id: roomId,
    user_id: userId,
    message,
    data,
  };

  // Remove undefined fields
  for (const key in logEntry) {
    if (logEntry[key] === undefined) {
      delete logEntry[key];
    }
  }

  try {
    const { error } = await supabase.from('logs').insert([logEntry]);

    if (error) {
      console.error('Failed to log to Supabase:', error.message, logEntry);
    }
  } catch (err: any) {
    console.error('Exception during Supabase log insertion:', err.message, logEntry);
  }
};
