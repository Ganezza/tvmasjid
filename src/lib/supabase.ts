import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseClient: SupabaseClient | null = null;

// Pastikan klien hanya dibuat sekali secara global di sisi klien (browser)
if (typeof window !== 'undefined') {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase URL or Anon Key is not set in environment variables. Please check your .env file.");
    // Di aplikasi produksi, Anda mungkin ingin melempar error atau menampilkan pesan yang lebih ramah pengguna
  } else {
    const realtimeUrl = supabaseUrl.replace('https://', 'wss://') + '/realtime/v1';
    console.log("Supabase Client Init: Creating new Supabase client instance.");
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
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
} else {
  console.warn("Supabase Client Init: Running in a non-browser environment. Supabase client will not be initialized.");
}

// Ekspor klien yang sudah diinisialisasi
export const supabase = supabaseClient;