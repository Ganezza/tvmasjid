import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Declare a global type for the window object to avoid TypeScript errors
declare global {
  interface Window {
    _supabaseClientInstance: SupabaseClient | undefined; // Use a distinct name for the global instance
  }
}

// Pastikan klien hanya dibuat sekali secara global di sisi klien (browser)
if (typeof window !== 'undefined' && !window._supabaseClientInstance) {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase URL or Anon Key is not set in environment variables. Please check your .env file.");
    // Di aplikasi produksi, Anda mungkin ingin melempar error atau menampilkan pesan yang lebih ramah pengguna
  } else {
    const realtimeUrl = supabaseUrl.replace('https://', 'wss://') + '/realtime/v1';
    console.log("Supabase Client Init: Creating new Supabase client instance.");
    window._supabaseClientInstance = createClient(supabaseUrl, supabaseAnonKey, {
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
  }
} else if (typeof window !== 'undefined' && window._supabaseClientInstance) {
  console.log("Supabase Client Init: Reusing existing Supabase client instance from window object.");
} else {
  console.warn("Supabase Client Init: Running in a non-browser environment or window object is undefined. Supabase client might not be initialized.");
}

// Ekspor klien yang sudah diinisialisasi dari objek window
export const supabase = typeof window !== 'undefined' ? window._supabaseClientInstance || null : null;