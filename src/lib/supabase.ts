import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key is not set in environment variables.");
  // Anda mungkin ingin melempar error atau menangani ini dengan lebih baik di aplikasi produksi
} else {
  // Pastikan klien hanya dibuat sekali
  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true, // Pastikan sesi disimpan secara persisten
        detectSessionInUrl: true, // Penting untuk menangani redirect dari alur autentikasi
      },
    });
  }
}

// Ekspor klien yang sudah diinisialisasi
export { supabase };