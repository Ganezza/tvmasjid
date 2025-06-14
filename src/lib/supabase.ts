import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;

console.log("Supabase Client Init: VITE_SUPABASE_URL =", supabaseUrl ? "Loaded" : "NOT LOADED", supabaseUrl);
console.log("Supabase Client Init: VITE_SUPABASE_ANON_KEY =", supabaseAnonKey ? "Loaded" : "NOT LOADED", supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key is not set in environment variables. Please check your .env file.");
  // Anda mungkin ingin melempar error atau menangani ini dengan lebih baik di aplikasi produksi
} else {
  // Pastikan klien hanya dibuat sekali
  if (!supabase) {
    // Construct the Realtime URL explicitly
    const realtimeUrl = supabaseUrl.replace('https://', 'wss://') + '/realtime/v1';
    console.log("Supabase Client Init: Realtime URL constructed:", realtimeUrl);

    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true, // Pastikan sesi disimpan secara persisten
        detectSessionInUrl: true, // Penting untuk menangani redirect dari alur autentikasi
      },
      global: {
        // Explicitly set the Realtime URL
        realtime: {
          url: realtimeUrl,
        },
      },
    });
    console.log("Supabase Client Init: Supabase client created successfully with explicit Realtime URL.");
  } else {
    console.log("Supabase Client Init: Supabase client already exists.");
  }
}

// Ekspor klien yang sudah diinisialisasi
export { supabase };