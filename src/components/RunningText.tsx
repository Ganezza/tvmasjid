import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const RunningText: React.FC = () => {
  const [text, setText] = useState<string>("Memuat teks berjalan...");
  const [error, setError] = useState<string | null>(null);

  const fetchRunningText = useCallback(async () => {
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("app_settings")
        .select("running_text")
        .eq("id", 1)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error("Error fetching running text:", fetchError);
        setError("Gagal memuat teks berjalan.");
        toast.error("Gagal memuat teks berjalan.");
      } else if (data) {
        setText(data.running_text || "Selamat datang di Masjid Agung Al-Falah. Mari tingkatkan iman dan taqwa kita. Jangan lupa matikan ponsel saat sholat. Semoga Allah menerima amal ibadah kita. Aamiin.");
      } else {
        // If no settings found, use default and potentially create it
        setText("Selamat datang di Masjid Agung Al-Falah. Mari tingkatkan iman dan taqwa kita. Jangan lupa matikan ponsel saat sholat. Semoga Allah menerima amal ibadah kita. Aamiin.");
        // Optionally, you could upsert the default here if it doesn't exist
      }
    } catch (err) {
      console.error("Unexpected error fetching running text:", err);
      setError("Terjadi kesalahan saat memuat teks berjalan.");
      toast.error("Terjadi kesalahan saat memuat teks berjalan.");
    }
  }, []);

  useEffect(() => {
    fetchRunningText();

    // Set up real-time listener for app_settings changes
    const channel = supabase
      .channel('running_text_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'id=eq.1' }, (payload) => {
        console.log('Running text change received!', payload);
        fetchRunningText(); // Re-fetch if settings change
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRunningText]);

  if (error) {
    return (
      <div className="w-full bg-red-800 bg-opacity-70 p-4 rounded-lg shadow-xl mt-auto overflow-hidden text-center">
        <p className="text-xl md:text-2xl text-red-200">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-800 bg-opacity-70 p-4 rounded-lg shadow-xl mt-auto overflow-hidden">
      <p className="text-xl md:text-2xl text-gray-200 whitespace-nowrap animate-marquee">
        {text}
      </p>
    </div>
  );
};

export default RunningText;