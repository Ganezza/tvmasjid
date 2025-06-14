import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Declare a global type for the window object to avoid TypeScript errors
declare global {
  interface Window {
    __SUPABASE_CLIENT__: SupabaseClient | undefined;
  }
}

function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase URL or Anon Key is not set in environment variables. Please check your .env file.");
    return null;
  }

  // Check if the client already exists on the global window object
  if (typeof window !== 'undefined' && window.__SUPABASE_CLIENT__) {
    console.log("Supabase Client Init: Reusing existing Supabase client from window object.");
    return window.__SUPABASE_CLIENT__;
  }

  // If not, create a new client
  const realtimeUrl = supabaseUrl.replace('https://', 'wss://') + '/realtime/v1';
  console.log("Supabase Client Init: Realtime URL constructed:", realtimeUrl);

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    global: {
      realtime: {
        url: realtimeUrl,
      },
    },
  });
  console.log("Supabase Client Init: New Supabase client created successfully.");

  // Store the new client on the global window object
  if (typeof window !== 'undefined') {
    window.__SUPABASE_CLIENT__ = client;
  }
  
  return client;
}

// Export the client instance obtained from the singleton function
export const supabase = getSupabaseClient();