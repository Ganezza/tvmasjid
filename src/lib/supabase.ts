import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key is not set in environment variables.");
  // Anda mungkin ingin melempar error atau menangani ini dengan lebih baik di aplikasi produksi
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true, // Pastikan sesi disimpan secara persisten
    detectSessionInUrl: true, // Penting untuk menangani redirect dari alur autentikasi
  },
});