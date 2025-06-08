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
import AudioDisplay from "@/components/AudioDisplay";
import AppBackground from "@/components/AppBackground";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const Index = () => {
  const navigate = useNavigate();
  const [clickCount, setClickCount] = useState(0);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [masjidName, setMasjidName] = useState<string>("Masjid Digital TV");
  const [masjidLogoUrl, setMasjidLogoUrl] = useState<string | null>(null);
  const [masjidAddress, setMasjidAddress] = useState<string | null>(null);

  const fetchMasjidInfo = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("masjid_name, masjid_logo_url, masjid_address")
        .eq("id", 1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching masjid info:", error);
        toast.error("Gagal memuat informasi masjid.");
      } else if (data) {
        setMasjidName(data.masjid_name || "Masjid Digital TV");
        setMasjidLogoUrl(data.masjid_logo_url);
        setMasjidAddress(data.masjid_address);
      }
    } catch (err) {
      console.error("Unexpected error fetching masjid info:", err);
      toast.error("Terjadi kesalahan saat memuat informasi masjid.");
    }
  }, []);

  useEffect(() => {
    fetchMasjidInfo();

    const channel = supabase
      .channel('masjid_info_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'id=eq.1' }, (payload) => {
        console.log('Masjid info change received!', payload);
        setMasjidName(payload.new.masjid_name || "Masjid Digital TV");
        setMasjidLogoUrl(payload.new.masjid_logo_url);
        setMasjidAddress(payload.new.masjid_address);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMasjidInfo]);

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

  return (
    <AppBackground>
      {/* Header Section */}
      <div className="w-full flex justify-between items-center p-4">
        <div className="flex items-center gap-4">
          {masjidLogoUrl && (
            <img src={masjidLogoUrl} alt="Masjid Logo" className="h-16 md:h-24 object-contain" />
          )}
          <div>
            <h1 className="text-5xl md:text-7xl font-extrabold text-green-400 drop-shadow-lg text-left">
              {masjidName}
            </h1>
            {masjidAddress && (
              <p className="text-xl md:text-2xl text-gray-300 text-left mt-1">
                {masjidAddress}
              </p>
            )}
          </div>
        </div>
        <HijriCalendarDisplay />
      </div>

      {/* Main Content Area - Using Grid for better layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full px-4 py-4 md:py-6">
        {/* Prayer Times Display - Now full width */}
        <div className="col-span-full">
          <PrayerTimesDisplay className="flex-grow" />
        </div>

        {/* Left Column (FinancialDisplay) */}
        <div className="col-span-full md:col-span-1 lg:col-span-1 flex flex-col gap-6">
          <FinancialDisplay />
        </div>

        {/* Middle Column (ImamMuezzinDisplay and NotificationStudyDisplay) */}
        <div className="col-span-full md:col-span-1 lg:col-span-1 flex flex-col gap-6">
          <ImamMuezzinDisplay />
          <NotificationStudyDisplay />
        </div>

        {/* Right Column (Info Slides, AudioDisplay, Tarawih) */}
        <div className="col-span-full md:col-span-2 lg:col-span-1 flex flex-col gap-6">
          <InfoSlides />
          <AudioDisplay />
          <TarawihScheduleDisplay />
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
    </AppBackground>
  );
};

export default Index;