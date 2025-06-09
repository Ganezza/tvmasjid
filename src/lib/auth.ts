import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const signOutAndClearSession = async () => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Error signing out:", error);
      toast.error(`Gagal logout: ${error.message}`);
      return;
    }

    // Hapus item Supabase dari local storage secara eksplisit
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("sb-dectagjljgxcwsequkdt")) { // Ganti dengan project ID Supabase Anda
        localStorage.removeItem(key);
      }
    }

    toast.success("Berhasil logout dan membersihkan sesi.");
    console.log("User signed out and session cleared from local storage.");
  } catch (err) {
    console.error("Unexpected error during sign out and session clear:", err);
    toast.error("Terjadi kesalahan saat logout.");
  }
};