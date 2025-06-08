import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MadeWithDyad } from "@/components/made-with-dyad";
import HijriCalendarDisplay from "@/components/HijriCalendarDisplay";
import PrayerTimesDisplay from "@/components/PrayerTimesDisplay";
import RunningText from "@/components/RunningText";
import InfoSlides from "@/components/InfoSlides";
import ImamMuezzinDisplay from "@/components/ImamMuezzinDisplay";
import NotificationStudyDisplay from "@/components/NotificationStudyDisplay";
import FinancialDisplay from "@/components/FinancialDisplay";
import TarawihScheduleDisplay from "@/components/TarawihScheduleDisplay";
import AudioDisplay from "@/components/AudioDisplay"; // Import the new component
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const Index = () => {
  const navigate = useNavigate();
  const [clickCount, setClickCount] = useState(0);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
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
    fetchDisplaySettings();

    const channel = supabase
      .channel('display_settings_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'id=eq.1' }, (payload) => {
        console.log('Display settings change received!', payload);
        setBackgroundImageUrl(payload.new.background_image_url);
        setBackgroundColor(payload.new.background_color || "#0A0A0A");
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDisplaySettings]);

  useEffect(() => {
    if (clickCount >= 5) {
      navigate("/admin");
      setClickCount(0); // Reset count after navigation
    }

    if (clickCount > 0) {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
      clickTimerRef.current = setTimeout(() => {
        setClickCount(0); // Reset count if clicks are too slow
      }, 1000); // 1 second window for 5 clicks
    }

    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
    };
  }, [clickCount, navigate]);

  const handleSecretShortcutClick = () => {
    setClickCount((prev) => prev + 1);
  };

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
      {/* Header Section */}
      <div className="w-full flex justify-between items-center p-4">
        <h1 className="text-4xl md:text-6xl font-extrabold text-green-400 drop-shadow-lg">
          Masjid Digital TV
        </h1>
        <HijriCalendarDisplay />
      </div>

      {/* Main Content Area - Using Grid for better layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 w-full px-4 py-8 md:py-12">
        {/* Prayer Times - always prominent, full width */}
        <div className="col-span-full">
          <PrayerTimesDisplay />
        </div>

        {/* Notification & Info Slides - side by side on larger screens */}
        <div className="col-span-full lg:col-span-1">
          <NotificationStudyDisplay />
        </div>
        <div className="col-span-full lg:col-span-1">
          <InfoSlides />
        </div>

        {/* Imam/Muezzin & Tarawih (grouped) and Financial - side by side on larger screens */}
        <div className="col-span-full lg:col-span-1 flex flex-col gap-6">
          <ImamMuezzinDisplay />
          <TarawihScheduleDisplay />
        </div>
        <div className="col-span-full lg:col-span-1 flex flex-col gap-6"> {/* Added flex-col and gap-6 here */}
          <FinancialDisplay />
          <AudioDisplay /> {/* New AudioDisplay component */}
        </div>
      </div>

      {/* Footer Section - Running Text and MadeWithDyad */}
      <div className="w-full">
        <RunningText />
        <MadeWithDyad />
      </div>

      {/* Secret Shortcut Area (Bottom Right Corner) */}
      <div
        className="absolute bottom-0 right-0 w-24 h-24 cursor-pointer z-50"
        onClick={handleSecretShortcutClick}
        aria-label="Secret shortcut to admin panel"
      />
    </div>
  );
};

export default Index;