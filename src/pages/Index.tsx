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
import AppBackground from "@/components/AppBackground";
import MurottalPlayer from "@/components/MurottalPlayer";
import IslamicHolidayCountdown from "@/components/IslamicHolidayCountdown";
import PrayerCountdownOverlay from "@/components/PrayerCountdownOverlay";
import JumuahInfoOverlay from "@/components/JumuahInfoOverlay";
import AudioEnablerOverlay from "@/components/AudioEnablerOverlay"; // Import the new component
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import * as Adhan from "adhan";

dayjs.extend(duration);

const Index = () => {
  const navigate = useNavigate();
  const [clickCount, setClickCount] = useState(0);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [masjidName, setMasjidName] = useState<string>("Masjid Digital TV");
  const [masjidLogoUrl, setMasjidLogoUrl] = useState<string | null>(null);
  const [masjidAddress, setMasjidAddress] = useState<string | null>(null);

  const [nextPrayerName, setNextPrayerName] = useState<string | null>(null);
  const [nextPrayerTime, setNextPrayerTime] = useState<dayjs.Dayjs | null>(null);
  const [iqomahCountdownDuration, setIqomahCountdownDuration] = useState<number>(300);
  const [khutbahDurationMinutes, setKhutbahDurationMinutes] = useState<number>(45);
  const [isRamadanModeActive, setIsRamadanModeActive] = useState(false);

  const [showPrayerOverlay, setShowPrayerOverlay] = useState(false);
  const [showJumuahOverlay, setShowJumuahOverlay] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false); // New state for audio permission

  const fetchMasjidInfoAndSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("masjid_name, masjid_logo_url, masjid_address, latitude, longitude, calculation_method, iqomah_countdown_duration, khutbah_duration_minutes, is_ramadan_mode_active")
        .eq("id", 1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching masjid info and settings:", error);
        toast.error("Gagal memuat informasi masjid & pengaturan.");
      } else if (data) {
        setMasjidName(data.masjid_name || "Masjid Digital TV");
        setMasjidLogoUrl(data.masjid_logo_url);
        setMasjidAddress(data.masjid_address);
        setIqomahCountdownDuration(data.iqomah_countdown_duration || 300);
        setKhutbahDurationMinutes(data.khutbah_duration_minutes || 45);
        setIsRamadanModeActive(data.is_ramadan_mode_active || false);

        const coordinates = new Adhan.Coordinates(data.latitude || -6.2088, data.longitude || 106.8456);
        const params = Adhan.CalculationMethod[data.calculation_method as keyof typeof Adhan.CalculationMethod]();
        const today = new Date();
        const times = new Adhan.PrayerTimes(coordinates, today, params);

        const prayerTimesList = [
          { name: "Fajr", time: dayjs(times.fajr) },
          { name: "Dhuhr", time: dayjs(times.dhuhr) },
          { name: "Asr", time: dayjs(times.asr) },
          { name: "Maghrib", time: dayjs(times.maghrib) },
          { name: "Isha", time: dayjs(times.isha) },
        ];

        let foundNextPrayer: { name: string; time: dayjs.Dayjs } | null = null;
        let minDiff = Infinity;
        const now = dayjs();

        for (const prayer of prayerTimesList) {
          let prayerDateTime = prayer.time;
          if (prayerDateTime.isBefore(now)) {
            prayerDateTime = prayerDateTime.add(1, 'day');
          }
          const diff = prayerDateTime.diff(now);
          if (diff > 0 && diff < minDiff) {
            minDiff = diff;
            foundNextPrayer = { name: prayer.name, time: prayerDateTime };
          }
        }
        
        setNextPrayerName(foundNextPrayer?.name || null);
        setNextPrayerTime(foundNextPrayer?.time || null);
      }
    } catch (err) {
      console.error("Unexpected error fetching masjid info and settings:", err);
      toast.error("Terjadi kesalahan saat memuat informasi masjid & pengaturan.");
    }
  }, []);

  useEffect(() => {
    fetchMasjidInfoAndSettings();

    const channel = supabase
      .channel('masjid_info_and_settings_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'id=eq.1' }, (payload) => {
        console.log('Masjid info and settings change received!', payload);
        fetchMasjidInfoAndSettings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMasjidInfoAndSettings]);

  useEffect(() => {
    const updateOverlayVisibility = () => {
      const now = dayjs();
      const isFriday = now.day() === 5;

      const isJumuahTimeWindow = isFriday && now.hour() >= 11 && now.hour() <= 14;

      if (isJumuahTimeWindow) {
        setShowJumuahOverlay(true);
        setShowPrayerOverlay(false);
      } else {
        setShowJumuahOverlay(false);

        if (nextPrayerTime && nextPrayerName && nextPrayerName !== "Syuruq") {
          const ADHAN_DURATION_SECONDS = 90;
          const PRE_ADHAN_COUNTDOWN_SECONDS = 30;

          const overlayStartTime = nextPrayerTime.subtract(PRE_ADHAN_COUNTDOWN_SECONDS, 'second');
          const overlayEndTime = nextPrayerTime.add(ADHAN_DURATION_SECONDS + iqomahCountdownDuration, 'second');

          if (now.isBetween(overlayStartTime, overlayEndTime, null, '[)')) {
            setShowPrayerOverlay(true);
          } else {
            setShowPrayerOverlay(false);
          }
        } else {
          setShowPrayerOverlay(false);
        }
      }
    };

    const interval = setInterval(updateOverlayVisibility, 1000);
    updateOverlayVisibility();

    return () => clearInterval(interval);
  }, [nextPrayerTime, nextPrayerName, iqomahCountdownDuration, khutbahDurationMinutes]);

  useEffect(() => {
    if (clickCount >= 5) {
      navigate("/admin");
      setClickCount(0);
    }

    if (clickCount > 0) {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
      clickTimerRef.current = setTimeout(() => {
        setClickCount(0);
      }, 1000);
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

  const handleEnableAudio = () => {
    setIsAudioEnabled(true);
  };

  const isOverlayActive = showPrayerOverlay || showJumuahOverlay;

  return (
    <AppBackground>
      {!isAudioEnabled && <AudioEnablerOverlay onEnable={handleEnableAudio} />}
      <MurottalPlayer isAudioEnabled={isAudioEnabled} /> {/* Pass the new prop */}

      {/* Overlays */}
      {showPrayerOverlay && (
        <PrayerCountdownOverlay
          nextPrayerName={nextPrayerName}
          nextPrayerTime={nextPrayerTime}
          iqomahCountdownDuration={iqomahCountdownDuration}
          onClose={() => setShowPrayerOverlay(false)}
          isJumuah={false}
        />
      )}
      {showJumuahOverlay && (
        <JumuahInfoOverlay
          khutbahDurationMinutes={khutbahDurationMinutes}
          onClose={() => setShowJumuahOverlay(false)}
        />
      )}

      {/* Main Content (hidden when overlay is active or audio not enabled) */}
      <div className={`w-full flex flex-col items-center justify-between flex-grow ${isOverlayActive || !isAudioEnabled ? 'hidden' : ''}`}>
        {/* Header Section */}
        <div className="w-full flex justify-between items-center p-4">
          <div className="flex items-center gap-4">
            {masjidLogoUrl && (
              <img src={masjidLogoUrl} alt="Masjid Logo" className="h-24 md:h-32 lg:h-40 object-contain" />
            )}
            <div>
              <h1 className="text-4xl md:text-6xl lg:text-7xl xl:text-8xl font-extrabold text-green-400 drop-shadow-lg text-left text-outline-black">
                {masjidName}
              </h1>
              {masjidAddress && (
                <p className="text-xl md:text-2xl lg:text-3xl xl:text-4xl text-gray-300 text-left mt-1 text-outline-black">
                  {masjidAddress}
                </p>
              )}
            </div>
          </div>
          <HijriCalendarDisplay />
        </div>

        {/* Main Content Area - Using Grid for better layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full px-4 py-4 md:py-6">
          {/* Prayer Times Display - Now full width */}
          <div className="col-span-full">
            <PrayerTimesDisplay hideCountdown={isOverlayActive} />
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

          {/* Right Column (Info Slides, Islamic Holiday Countdown, Tarawih) */}
          <div className="col-span-full md:col-span-2 lg:col-span-1 flex flex-col gap-6">
            <InfoSlides />
            <IslamicHolidayCountdown />
            <TarawihScheduleDisplay />
          </div>
        </div>

        {/* Footer Section - Running Text and MadeWithDyad */}
        <div className="w-full">
          <RunningText />
          <MadeWithDyad />
        </div>
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