import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MadeWithDyad } from "@/components/made-with-dyad";
import HijriCalendarDisplay from "@/components/HijriCalendarDisplay";
import PrayerTimesDisplay from "@/components/PrayerTimesDisplay";
import RunningText from "@/components/RunningText";
import ImamMuezzinDisplay from "@/components/ImamMuezzinDisplay";
import NotificationStudyDisplay from "@/components/NotificationStudyDisplay";
import FinancialDisplay from "@/components/FinancialDisplay";
import TarawihScheduleDisplay from "@/components/TarawihScheduleDisplay";
import AppBackground from "@/components/AppBackground";
import MurottalPlayer from "@/components/MurottalPlayer";
import IslamicHolidayCountdown from "@/components/IslamicHolidayCountdown";
import PrayerCountdownOverlay from "@/components/PrayerCountdownOverlay";
import JumuahInfoOverlay from "@/components/JumuahInfoOverlay";
import DarkScreenOverlay from "@/components/DarkScreenOverlay";
import ImsakOverlay from "@/components/ImsakOverlay";
import Screensaver from "@/components/Screensaver";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import isBetween from "dayjs/plugin/isBetween";
import * as Adhan from "adhan";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RealtimeChannel } from "@supabase/supabase-js";

dayjs.extend(duration);
dayjs.extend(isBetween);

// Menggunakan React.lazy untuk memuat komponen InfoSlides secara dinamis
const InfoSlides = React.lazy(() => import("@/components/InfoSlides"));

const ADHAN_DURATION_SECONDS = 120;
const ADHAN_JUMUAH_DURATION_SECONDS = 120;
const PRE_ADHAN_COUNTDOWN_SECONDS = 30;
const IMSAK_OVERLAY_DURATION_SECONDS = 10;

const Index = () => {
  const navigate = useNavigate();

  const [masjidName, setMasjidName] = useState<string>("Masjid Digital TV");
  const [masjidLogoUrl, setMasjidLogoUrl] = useState<string | null>(null);
  const [masjidAddress, setMasjidAddress] = useState<string | null>(null);
  const [masjidNameColor, setMasjidNameColor] = useState<string>("#34D399");

  const [nextPrayerName, setNextPrayerName] = useState<string | null>(null);
  const [nextPrayerTime, setNextPrayerTime] = useState<dayjs.Dayjs | null>(null);
  const [iqomahCountdownDuration, setIqomahCountdownDuration] = useState<number>(300);
  const [khutbahDurationMinutes, setKhutbahDurationMinutes] = useState<number>(45);
  const [isRamadanModeActive, setIsRamadanModeActive] = useState(false);
  const [screensaverIdleMinutes, setScreensaverIdleMinutes] = useState<number>(5);

  const [showPrayerOverlay, setShowPrayerOverlay] = useState(false);
  const [showJumuahOverlay, setShowJumuahOverlay] = useState(false);
  const [showImsakOverlay, setShowImsakOverlay] = useState(false);
  const [isScreenDarkened, setIsScreenDarkened] = useState(false);
  const [isScreensaverActive, setIsScreensaverActive] = useState(false);

  const [jumuahDhuhrTime, setJumuahDhuhrTime] = useState<dayjs.Dayjs | null>(null);
  const [imsakTime, setImsakTime] = useState<dayjs.Dayjs | null>(null);

  const activityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const settingsChannelRef = useRef<RealtimeChannel | null>(null);

  const resetActivityTimer = useCallback(() => {
    if (activityTimerRef.current) {
      clearTimeout(activityTimerRef.current);
    }
    if (screensaverIdleMinutes > 0) {
      activityTimerRef.current = setTimeout(() => {
        setIsScreensaverActive(true);
        console.log("Screensaver activated due to inactivity.");
      }, screensaverIdleMinutes * 60 * 1000);
    }
    if (isScreensaverActive) {
      setIsScreensaverActive(false);
      console.log("Activity detected, screensaver deactivated.");
    }
  }, [screensaverIdleMinutes, isScreensaverActive]);

  useEffect(() => {
    resetActivityTimer();

    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach(event => {
      window.addEventListener(event, resetActivityTimer);
    });

    return () => {
      if (activityTimerRef.current) {
        clearTimeout(activityTimerRef.current);
      }
      events.forEach(event => {
        window.removeEventListener(event, resetActivityTimer);
      });
    };
  }, [resetActivityTimer]);

  const fetchMasjidInfoAndSettings = useCallback(async () => {
    try {
      console.log("Index: Fetching masjid info and settings...");
      const { data, error } = await supabase
        .from("app_settings")
        .select("masjid_name, masjid_logo_url, masjid_address, latitude, longitude, calculation_method, iqomah_countdown_duration, khutbah_duration_minutes, is_ramadan_mode_active, masjid_name_color, fajr_offset, dhuhr_offset, asr_offset, maghrib_offset, isha_offset, imsak_offset, screensaver_idle_minutes")
        .eq("id", 1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("Index: Error fetching masjid info and settings:", error);
        toast.error("Gagal memuat informasi masjid & pengaturan.");
      } else if (data) {
        setMasjidName(data.masjid_name || "Masjid Digital TV");
        setMasjidLogoUrl(data.masjid_logo_url);
        setMasjidAddress(data.masjid_address);
        setIqomahCountdownDuration(data.iqomah_countdown_duration || 300);
        setKhutbahDurationMinutes(data.khutbah_duration_minutes || 45);
        setIsRamadanModeActive(data.is_ramadan_mode_active || false);
        setMasjidNameColor(data.masjid_name_color || "#34D399");
        setScreensaverIdleMinutes(data.screensaver_idle_minutes || 5);
        console.log("Index: Settings fetched:", data);

        const coordinates = new Adhan.Coordinates(data.latitude || -6.2088, data.longitude || 106.8456);
        const params = Adhan.CalculationMethod[data.calculation_method as keyof typeof Adhan.CalculationMethod]();
        const today = dayjs();
        const times = new Adhan.PrayerTimes(coordinates, today.toDate(), params);

        const adjustedFajr = dayjs(times.fajr).add(data.fajr_offset ?? 0, 'minute');
        const adjustedDhuhr = dayjs(times.dhuhr).add(data.dhuhr_offset ?? 0, 'minute');
        const adjustedAsr = dayjs(times.asr).add(data.asr_offset ?? 0, 'minute');
        const adjustedMaghrib = dayjs(times.maghrib).add(data.maghrib_offset ?? 0, 'minute');
        const adjustedIsha = dayjs(times.isha).add(data.isha_offset ?? 0, 'minute');
        const calculatedImsakTime = dayjs(times.fajr).subtract(10, 'minute').add(data.imsak_offset ?? 0, 'minute');

        const isFriday = today.day() === 5;

        const prayerTimesList = [
          { name: "Subuh", time: adjustedFajr },
          { name: "Syuruq", time: dayjs(times.sunrise) },
          { name: isFriday ? "Jum'at" : "Dzuhur", time: adjustedDhuhr },
          { name: "Ashar", time: adjustedAsr },
          { name: "Maghrib", time: adjustedMaghrib },
          { name: "Isya", time: adjustedIsha },
        ];

        if (isFriday) {
          setJumuahDhuhrTime(adjustedDhuhr);
          console.log("Index: Jumuah Dhuhr Time set:", adjustedDhuhr.format('HH:mm:ss'));
        } else {
          setJumuahDhuhrTime(null);
        }

        if (data.is_ramadan_mode_active) {
          setImsakTime(calculatedImsakTime);
          console.log("Index: Imsak Time set (Ramadan mode active):", calculatedImsakTime.format('HH:mm:ss'));
        } else {
          setImsakTime(null);
        }

        let foundNextPrayer: { name: string; time: dayjs.Dayjs } | null = null;
        let minDiff = Infinity;
        const now = dayjs();

        for (const prayer of prayerTimesList) {
          if (prayer.name === "Syuruq") continue;

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
        console.log("Index: Next prayer determined:", foundNextPrayer?.name, foundNextPrayer?.time?.format('HH:mm:ss'));
      }
    } catch (err) {
      console.error("Index: Unexpected error fetching masjid info and settings:", err);
      toast.error("Terjadi kesalahan saat memuat informasi masjid & pengaturan.");
    }
  }, []);

  useEffect(() => {
    fetchMasjidInfoAndSettings();

    if (!settingsChannelRef.current) {
      settingsChannelRef.current = supabase
        .channel('masjid_info_and_settings_changes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'id=eq.1' }, (payload) => {
          console.log('Index: Masjid info and settings change received!', payload);
          fetchMasjidInfoAndSettings();
        })
        .subscribe();
      console.log("Index: Subscribed to channel 'masjid_info_and_settings_changes'.");
    }

    return () => {
      if (settingsChannelRef.current) {
        supabase.removeChannel(settingsChannelRef.current);
        console.log("Index: Unsubscribed from channel 'masjid_info_and_settings_changes'.");
        settingsChannelRef.current = null;
      }
    };
  }, [fetchMasjidInfoAndSettings]);

  const handlePrayerOrKhutbahEnd = useCallback(() => {
    console.log("Index: handlePrayerOrKhutbahEnd called.");
    setShowPrayerOverlay(false);
    setShowJumuahOverlay(false);

    if (nextPrayerName !== "Imsak") {
      setIsScreenDarkened(true);
      console.log("Index: Screen darkened for prayer/khutbah. Will revert in 5 minutes.");
      setTimeout(() => {
        setIsScreenDarkened(false);
        console.log("Index: Screen reverted to normal after prayer/khutbah.");
      }, 5 * 60 * 1000);
    }
  }, [nextPrayerName]);

  useEffect(() => {
    const updateOverlayVisibility = () => {
      const now = dayjs();
      const isFriday = now.day() === 5;

      setShowPrayerOverlay(false);
      setShowJumuahOverlay(false);
      setShowImsakOverlay(false);
      setIsScreenDarkened(false);

      console.log(`Index: updateOverlayVisibility - Current Time: ${now.format('HH:mm:ss')}`);

      if (isRamadanModeActive && imsakTime) {
        const imsakEndTime = imsakTime.add(IMSAK_OVERLAY_DURATION_SECONDS, 'second');
        console.log(`Index: Checking Imsak Overlay. Imsak Time: ${imsakTime.format('HH:mm:ss')}, End Time: ${imsakEndTime.format('HH:mm:ss')}`);
        if (now.isBetween(imsakTime, imsakEndTime, null, '[)')) {
          setShowImsakOverlay(true);
          console.log("Index: Imsak Overlay is active.");
          return;
        }
      }

      if (isFriday && jumuahDhuhrTime) {
        const PRE_ADHAN_JUMUAH_SECONDS_LOCAL = 300;
        const adhanEndTime = jumuahDhuhrTime.add(ADHAN_JUMUAH_DURATION_SECONDS, 'second');
        const preAdhanStartTime = jumuahDhuhrTime.subtract(PRE_ADHAN_JUMUAH_SECONDS_LOCAL, 'second');
        const khutbahEndTime = adhanEndTime.add(khutbahDurationMinutes, 'minute');

        console.log(`Index: Checking Jumuah Overlay. Pre-Adhan Start: ${preAdhanStartTime.format('HH:mm:ss')}, Adhan End: ${adhanEndTime.format('HH:mm:ss')}, Khutbah End: ${khutbahEndTime.format('HH:mm:ss')}`);
        if (now.isBetween(preAdhanStartTime, khutbahEndTime, null, '[)')) {
          setShowJumuahOverlay(true);
          console.log("Index: Jumuah Overlay is active.");
          return;
        }
      }

      if (nextPrayerTime && nextPrayerName && nextPrayerName !== "Syuruq") {
        const overlayStartTime = nextPrayerTime.subtract(PRE_ADHAN_COUNTDOWN_SECONDS, 'second');
        const overlayEndTime = nextPrayerTime.add(ADHAN_DURATION_SECONDS + iqomahCountdownDuration, 'second');

        console.log(`Index: Checking Prayer Overlay. Next Prayer: ${nextPrayerName} at ${nextPrayerTime.format('HH:mm:ss')}. Overlay Start: ${overlayStartTime.format('HH:mm:ss')}, Overlay End: ${overlayEndTime.format('HH:mm:ss')}`);
        if (now.isBetween(overlayStartTime, overlayEndTime, null, '[)')) {
          setShowPrayerOverlay(true);
          console.log("Index: Prayer Countdown Overlay is active.");
          return;
        }
      }
      console.log("Index: No prayer/Jumuah/Imsak overlay is active.");
    };

    const interval = setInterval(updateOverlayVisibility, 1000);
    updateOverlayVisibility();

    return () => clearInterval(interval);
  }, [nextPrayerTime, nextPrayerName, iqomahCountdownDuration, khutbahDurationMinutes, jumuahDhuhrTime, imsakTime, isRamadanModeActive]);

  const isOverlayActive = showPrayerOverlay || showJumuahOverlay || showImsakOverlay;

  return (
    <>
      <AppBackground>
        <MurottalPlayer />

        {isScreensaverActive && !isOverlayActive && !isScreenDarkened && (
          <Screensaver />
        )}

        {showImsakOverlay && isRamadanModeActive && imsakTime && (
          <ImsakOverlay
            imsakTime={imsakTime}
            onClose={() => {
              setShowImsakOverlay(false);
              console.log("Index: ImsakOverlay closed.");
            }}
          />
        )}
        {showPrayerOverlay && (
          <PrayerCountdownOverlay
            nextPrayerName={nextPrayerName}
            nextPrayerTime={nextPrayerTime}
            iqomahCountdownDuration={iqomahCountdownDuration}
            onClose={handlePrayerOrKhutbahEnd}
            isJumuah={false}
          />
        )}
        {showJumuahOverlay && jumuahDhuhrTime && (
          <JumuahInfoOverlay
            jumuahDhuhrTime={jumuahDhuhrTime}
            khutbahDurationMinutes={khutbahDurationMinutes}
            onClose={handlePrayerOrKhutbahEnd}
          />
        )}

        {isScreenDarkened && <DarkScreenOverlay />}

        <div className={`w-full flex flex-col items-center justify-between flex-grow ${isOverlayActive || isScreenDarkened || isScreensaverActive ? 'hidden' : ''}`}>
          <div className="w-full flex justify-between items-center p-0.5">
            <div className="flex items-center gap-0.5">
              {masjidLogoUrl && (
                <img src={masjidLogoUrl} alt="Masjid Logo" className="h-16 md:h-24 lg:h-32 object-contain" />
              )}
              <div>
                <h1 
                  className="text-2xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold drop-shadow-lg text-left text-outline-black"
                  style={{ color: masjidNameColor }}
                >
                  {masjidName}
                </h1>
                {masjidAddress && (
                  <p className="text-base md:text-lg lg:text-xl xl:text-2xl text-gray-300 text-left mt-0.5 text-outline-black">
                    {masjidAddress}
                  </p>
                )}
              </div>
            </div>
            <HijriCalendarDisplay />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1 w-full px-0.5 py-0.5 md:py-1 flex-grow">
            <div className="col-span-full flex flex-col min-h-0">
              <PrayerTimesDisplay hideCountdown={isOverlayActive} />
            </div>

            <div className="col-span-full md:col-span-1 lg:col-span-1 flex flex-col gap-1 flex-grow min-h-0">
              <FinancialDisplay />
            </div>

            <div className="col-span-full md:col-span-1 lg:col-span-1 flex flex-col gap-1 flex-grow min-h-0">
              <ImamMuezzinDisplay />
              <NotificationStudyDisplay />
            </div>

            <div className="col-span-full md:col-span-2 lg:col-span-1 flex flex-col gap-1 flex-grow min-h-0">
              {/* Menggunakan Suspense untuk lazy-loaded InfoSlides */}
              <React.Suspense fallback={<div>Memuat Info Slides...</div>}>
                <InfoSlides />
              </React.Suspense>
              <IslamicHolidayCountdown />
              <TarawihScheduleDisplay />
            </div>
          </div>

          <div className="w-full">
            <RunningText />
            <MadeWithDyad />
          </div>
        </div>

        <div
          className="absolute bottom-2 left-2 z-50"
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin")}
            className="text-gray-400 hover:text-gray-200"
            aria-label="Go to Admin Panel"
          >
            <Settings className="h-6 w-6" />
          </Button>
        </div>
      </AppBackground>
    </>
  );
};

export default Index;