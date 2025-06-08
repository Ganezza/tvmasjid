import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Volume2, VolumeX, BellRing } from "lucide-react";

interface AudioSettings {
  murottal_active: boolean;
  tarhim_active: boolean;
  iqomah_countdown_duration: number;
}

const AudioDisplay: React.FC = () => {
  const [settings, setSettings] = useState<AudioSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAudioSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("app_settings")
        .select("murottal_active, tarhim_active, iqomah_countdown_duration")
        .eq("id", 1)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error("Error fetching audio settings for display:", fetchError);
        setError("Gagal memuat pengaturan audio.");
        toast.error("Gagal memuat pengaturan audio.");
      } else if (data) {
        setSettings(data);
      } else {
        setSettings({ murottal_active: false, tarhim_active: false, iqomah_countdown_duration: 300 }); // Default if no settings found
      }
    } catch (err) {
      console.error("Unexpected error fetching audio settings:", err);
      setError("Terjadi kesalahan saat memuat pengaturan audio.");
      toast.error("Terjadi kesalahan saat memuat pengaturan audio.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAudioSettings();

    const channel = supabase
      .channel('audio_settings_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'id=eq.1' }, (payload) => {
        console.log('Audio settings change received!', payload);
        setSettings(payload.new as AudioSettings);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAudioSettings]);

  if (isLoading) {
    return (
      <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-2xl text-center mb-8 text-white">
        <p className="text-xl">Memuat pengaturan audio...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-800 bg-opacity-70 p-6 rounded-xl shadow-2xl text-center mb-8 text-white">
        <p className="text-xl font-bold">Error:</p>
        <p className="text-lg">{error}</p>
      </div>
    );
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} menit ${remainingSeconds} detik`;
  };

  return (
    <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-2xl text-center mb-8">
      <h3 className="text-3xl font-bold mb-3 text-yellow-300">Status Audio & Iqomah</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xl md:text-2xl">
        <div className="flex items-center justify-center p-2 rounded-md bg-gray-700 text-gray-200">
          {settings?.murottal_active ? (
            <Volume2 className="h-6 w-6 mr-2 text-green-400" />
          ) : (
            <VolumeX className="h-6 w-6 mr-2 text-red-400" />
          )}
          Murottal: <span className={`font-semibold ml-2 ${settings?.murottal_active ? "text-green-400" : "text-red-400"}`}>
            {settings?.murottal_active ? "Aktif" : "Nonaktif"}
          </span>
        </div>
        <div className="flex items-center justify-center p-2 rounded-md bg-gray-700 text-gray-200">
          {settings?.tarhim_active ? (
            <Volume2 className="h-6 w-6 mr-2 text-green-400" />
          ) : (
            <VolumeX className="h-6 w-6 mr-2 text-red-400" />
          )}
          Tarhim: <span className={`font-semibold ml-2 ${settings?.tarhim_active ? "text-green-400" : "text-red-400"}`}>
            {settings?.tarhim_active ? "Aktif" : "Nonaktif"}
          </span>
        </div>
      </div>
      <div className="mt-6 text-blue-300 font-semibold text-2xl md:text-3xl flex items-center justify-center">
        <BellRing className="h-8 w-8 mr-3 text-yellow-400" />
        Durasi Iqomah: <span className="text-green-400 ml-2">{formatDuration(settings?.iqomah_countdown_duration || 0)}</span>
      </div>
      <p className="text-lg text-gray-400 mt-2">
        (Hitung mundur Iqomah akan dimulai setelah waktu sholat masuk)
      </p>
    </div>
  );
};

export default AudioDisplay;