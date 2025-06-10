import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { RealtimeChannel } from "@supabase/supabase-js";

interface AppBackgroundProps {
  children: React.ReactNode;
}

const AppBackground: React.FC<AppBackgroundProps> = ({ children }) => {
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [backgroundColor, setBackgroundColor] = useState<string>("#0A0A0A"); // Default dark background

  const fetchDisplaySettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("background_image_url, background_color")
        .eq("id", 1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching display settings:", error);
        toast.error("Gagal memuat pengaturan tampilan.");
      } else if (data) {
        setBackgroundImageUrl(data.background_image_url);
        setBackgroundColor(data.background_color || "#0A0A0A");
      }
    } catch (err) {
      console.error("Unexpected error fetching display settings:", err);
      toast.error("Terjadi kesalahan saat memuat pengaturan tampilan.");
    }
  }, []);

  useEffect(() => {
    fetchDisplaySettings(); // Initial fetch on mount

    // Setup Realtime Channel
    const channel = supabase
      .channel('display_settings_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'id=eq.1' }, (payload) => {
        console.log('Display settings change received!', payload);
        setBackgroundImageUrl(payload.new.background_image_url);
        setBackgroundColor(payload.new.background_color || "#0A0A0A");
      })
      .subscribe();
    console.log("AppBackground: Subscribed to channel 'display_settings_changes'.");

    // Cleanup function
    return () => {
      supabase.removeChannel(channel);
      console.log("AppBackground: Unsubscribed from channel 'display_settings_changes'.");
    };
  }, [fetchDisplaySettings]);

  const backgroundStyle = {
    backgroundColor: backgroundColor,
    backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };

  return (
    <div
      className="relative min-h-screen w-full text-white flex flex-col items-center justify-between overflow-hidden p-4"
      style={backgroundStyle}
    >
      {children}
    </div>
  );
};

export default AppBackground;