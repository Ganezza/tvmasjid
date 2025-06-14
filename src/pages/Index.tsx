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
// import Screensaver from "@/components/Screensaver"; // Dihapus
import MediaPlayerDisplay from "@/components/MediaPlayerDisplay";
import { supabase } from "@/lib/supabase"; // Keep supabase import for other uses
import { toast } from "sonner";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import isBetween from "dayjs/plugin/isBetween";
import * as Adhan from "adhan";
import { Settings, RefreshCw } from "lucide-react"; // Import RefreshCw icon
import { Button } from "@/components/ui/button";
import { useAppSettings } from "@/contexts/AppSettingsContext"; // Import useAppSettings
import { cn } from "@/lib/utils"; // Import cn utility

dayjs.extend(duration);
dayjs.extend(isBetween);

const InfoSlides = React.lazy(() => import("@/components/InfoSlides"));

const PRE_ADHAN_COUNTDOWN_SECONDS = 30;
const IMSAK_OVERLAY_DURATION_SECONDS = 10;

const Index = () => {
  const navigate = useNavigate();
  const { settings, isLoadingSettings } = useAppSettings(); // Use the new hook

  const [masjidName, setMasjidName] = useState<string>("");
  const [masjidLogoUrl, setMasjidLogoUrl] = useState<string | null>(null);
  const [masjidAddress, setMasjidAddress] = useState<string | null>(null);
  const [masjidNameColor, setMasjidNameColor] = useState<string>("#34D399");

  const [nextPrayerName, setNextPrayerName] = useState<string | null>(null);
  const [nextPrayerTime, setNextPrayerTime] = useState<dayjs.Dayjs | null>(null);
  const [iqomahCountdownDuration, setIqomahCountdownDuration] = useState<number>(300);
  const [maghribIqomahCountdownDuration, setMaghribIqomahCountdownDuration] = useState<number>(120); // New state for Maghrib Iqomah duration
  const [khutbahDurationMinutes, setKhutbahDurationMinutes] = useState<number>(45);
  const [adhanDurationSeconds, setAdhanDurationSeconds] = useState<number>(120); // New state for Adhan duration
  const [isRamadanModeActive, setIsRamadanModeActive] = useState(false);
  // const [screensaverIdleMinutes, setScreensaverIdleMinutes] = useState<number>(5); // Dihapus

  const [showPrayerOverlay, setShowPrayerOverlay] = useState(false);
  const [showJumuahOverlay, setShowJumuahOverlay] = useState(false);
  const [showImsakOverlay, setShowImsakOverlay] = useState(false);
  const [isScreenDarkened, setIsScreenDarkened] = useState(false);
  // const [isScreensaverActive, setIsScreensaverActive] = useState(false); // Dihapus
  const [isMurottalPlaying, setIsMurottalPlaying] = useState(false); // State for MurottalPlayer status
  // const [isMediaPlayerVideoActive, setIsMediaPlayerVideoActive] = useState(false); // REMOVED: New state for video player status

  const [jumuahDhuhrTime, setJumuahDhuhrTime] = useState<dayjs.Dayjs | null>(null);
  const [imsakTime, setImsakTime] = useState<dayjs.Dayjs | null>(null);

  // const activityTimerRef = useRef<NodeJS.Timeout | null>(null); // Dihapus

  // const resetActivityTimer = useCallback(() => { // Dihapus
  //   console.log("Index: resetActivityTimer called. Clearing existing timer.");
  //   if (activityTimerRef.current) {
  //     clearTimeout(activityTimerRef.current);
  //   }
  //   if (screensaverIdleMinutes > 0) {
  //     const timeoutDuration = screensaverIdleMinutes * 60 * 1000;
  //     activityTimerRef.current = setTimeout(() => {
  //       setIsScreensaverActive(true);
  //       console.log(`Index: Screensaver activated due to inactivity (${screensaverIdleMinutes} minutes).`);
  //     }, timeoutDuration);
  //     console.log(`Index: New screensaver timer set for ${screensaverIdleMinutes} minutes.`);
  //   } else {
  //     console.log("Index: screensaverIdleMinutes is 0 or less. Screensaver will not activate automatically.");
  //   }
  //   if (isScreensaverActive) {
  //     setIsScreensaverActive(false);
  //     console.log("Index: Activity detected, screensaver deactivated.");
  //   }
  // }, [screensaverIdleMinutes, isScreensaverActive]); // Dihapus

  useEffect(() => {
    // resetActivityTimer(); // Dihapus

    // const events = ['mousemove', 'keydown', 'click', 'scroll']; // Dihapus
    // events.forEach(event => { // Dihapus
    //   window.addEventListener(event, resetActivityTimer); // Dihapus
    // }); // Dihapus

    return () => {
      // if (activityTimerRef.current) { // Dihapus
      //   clearTimeout(activityTimerRef.current); // Dihapus
      // } // Dihapus
      // events.forEach(event => { // Dihapus
      //   window.removeEventListener(event, resetActivityTimer); // Dihapus
      // }); // Dihapus
    };
  }, []); // Dihapus: [resetActivityTimer]

  useEffect(() => {
    if (isLoadingSettings || !settings) {
      console.log("Index: Settings still loading or not available.");
      return;
    }

    console.log("Index: Settings available, updating state and calculating prayer times.");
    setMasjidName(settings.masjid_name || ""); // Ensure it's an empty string if null
    setMasjidLogoUrl(settings.masjid_logo_url);
    setMasjidAddress(settings.masjid_address);
    setIqomahCountdownDuration(settings.iqomah_countdown_duration || 300);
    setMaghribIqomahCountdownDuration(settings.maghrib_iqomah_countdown_duration || 120); // Set Maghrib Iqomah duration
    setKhutbahDurationMinutes(settings.khutbah_duration_minutes || 45);
    setAdhanDurationSeconds(settings.adhan_duration_seconds || 120); // Set Adhan duration from settings
    setIsRamadanModeActive(settings.is_ramadan_mode_active || false);
    setMasjidNameColor(settings.masjid_name_color || "#34D399");
    // setScreensaverIdleMinutes(settings.screensaver_idle_minutes || 5); // Dihapus
    // console.log("Index: screensaverIdleMinutes from settings:", settings.screensaver_idle_minutes); // Dihapus


    const coordinates = new Adhan.Coordinates(settings.latitude || -6.2088, settings.longitude || 106.8456);
    const params = Adhan.CalculationMethod[settings.calculation_method as keyof typeof Adhan.CalculationMethod]();
    const today = dayjs();
    const times = new Adhan.PrayerTimes(coordinates, today.toDate(), params);

    const adjustedFajr = dayjs(times.fajr).add(settings.fajr_offset ?? 0, 'minute');
    const adjustedDhuhr = dayjs(times.dhuhr).add(settings.dhuhr_offset ?? 0, 'minute');
    const adjustedAsr = dayjs(times.asr).add(settings.asr_offset ?? 0, 'minute');
    const adjustedMaghrib = dayjs(times.maghrib).add(settings.maghrib_offset ?? 0, 'minute');
    const adjustedIsha = dayjs(times.isha).add(settings.isha_offset ?? 0, 'minute');
    const calculatedImsakTime = dayjs(times.fajr).subtract(10, 'minute').add(settings.imsak_offset ?? 0, 'minute');

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

    if (settings.is_ramadan_mode_active) {
      setImsakTime(calculatedImsakTime);
      console.log("Index: Imsak Time set (Ramadan mode active):", calculatedImsakTime.format('HH:mm:ss'));
    } else {
      setImsakTime(null);
    }

    let foundNextPrayer: { name: string; time: dayjs.Dayjs } | null = null;
    let minDiff = Infinity;
    const now = dayjs();

    for (const prayer of prayerTimesList) {
      if (prayer.name === "Syuruq") continue; // Syuruq is not a prayer with countdown/overlay

      let prayerDateTime = prayer.time;
      // If the prayer time for today has already passed, consider it for tomorrow
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
  }, [isLoadingSettings, settings]); // Depend on settings and its loading state

  const handlePrayerOrKhutbahEnd = useCallback(() => {
    console.log("Index: handlePrayerOrKhutbahEnd called.");
    setShowPrayerOverlay(false);
    setShowJumuahOverlay(false);

    if (nextPrayerName !== "Imsak") { // Imsak doesn't darken the screen
      setIsScreenDarkened(true);
      console.log("Index: Screen darkened for prayer/khutbah. Will revert in 5 minutes.");
      setTimeout(() => {
        setIsScreenDarkened(false);
        console.log("Index: Screen reverted to normal after prayer/khutbah.");
      }, 5 * 60 * 1000); // 5 minutes
    }
  }, [nextPrayerName]);

  useEffect(() => {
    const updateOverlayVisibility = () => {
      const now = dayjs();
      const isFriday = now.day() === 5;

      // Reset all overlays first
      setShowPrayerOverlay(false);
      setShowJumuahOverlay(false);
      setShowImsakOverlay(false);
      // Do NOT reset isScreenDarkened here, it's managed by handlePrayerOrKhutbahEnd
      // setIsScreenDarkened(false); // Removed this line

      console.log(`Index: updateOverlayVisibility - Current Time: ${now.format('HH:mm:ss')}`);
      console.log(`Index: Current Overlay States - Prayer: ${showPrayerOverlay}, Jumuah: ${showJumuahOverlay}, Imsak: ${showImsakOverlay}, Darkened: ${isScreenDarkened}`); // Dihapus: Screensaver


      // Priority 1: Imsak Overlay (if Ramadan mode active)
      if (isRamadanModeActive && imsakTime) {
        const imsakEndTime = imsakTime.add(IMSAK_OVERLAY_DURATION_SECONDS, 'second');
        console.log(`Index: Checking Imsak Overlay. Imsak Time: ${imsakTime.format('HH:mm:ss')}, End Time: ${imsakEndTime.format('HH:mm:ss')}`);
        if (now.isBetween(imsakTime, imsakEndTime, null, '[)')) {
          setShowImsakOverlay(true);
          console.log("Index: Imsak Overlay is active.");
          return; // Stop checking other overlays
        }
      }

      // Priority 2: Jumuah Overlay (if Friday and Dhuhr time)
      if (isFriday && jumuahDhuhrTime) {
        const PRE_ADHAN_JUMUAH_SECONDS_LOCAL = 300;
        const adhanEndTime = jumuahDhuhrTime.add(adhanDurationSeconds, 'second'); // Use adhanDurationSeconds
        const preAdhanStartTime = jumuahDhuhrTime.subtract(PRE_ADHAN_JUMUAH_SECONDS_LOCAL, 'second');
        const khutbahEndTime = adhanEndTime.add(khutbahDurationMinutes, 'minute');

        console.log(`Index: Checking Jumuah Overlay. Pre-Adhan Start: ${preAdhanStartTime.format('HH:mm:ss')}, Adhan End: ${adhanEndTime.format('HH:mm:ss')}, Khutbah End: ${khutbahEndTime.format('HH:mm:ss')}`);
        if (now.isBetween(preAdhanStartTime, khutbahEndTime, null, '[)')) {
          setShowJumuahOverlay(true);
          console.log("Index: Jumuah Overlay is active.");
          return; // Stop checking other overlays
        }
      }

      // Priority 3: Regular Prayer Countdown Overlay
      if (nextPrayerTime && nextPrayerName && nextPrayerName !== "Syuruq") {
        const overlayStartTime = nextPrayerTime.subtract(PRE_ADHAN_COUNTDOWN_SECONDS, 'second');
        
        // Determine correct iqomah duration
        const currentIqomahDuration = nextPrayerName === "Maghrib" 
          ? maghribIqomahCountdownDuration 
          : iqomahCountdownDuration;

        const overlayEndTime = nextPrayerTime.add(adhanDurationSeconds + currentIqomahDuration, 'second'); // Use adhanDurationSeconds and dynamic iqomah duration

        console.log(`Index: Checking Prayer Overlay. Next Prayer: ${nextPrayerName} at ${nextPrayerTime.format('HH:mm:ss')}. Overlay Start: ${overlayStartTime.format('HH:mm:ss')}, Overlay End: ${overlayEndTime.format('HH:mm:ss')}. Using Iqomah Duration: ${currentIqomahDuration}s`);
        if (now.isBetween(overlayStartTime, overlayEndTime, null, '[)')) {
          setShowPrayerOverlay(true);
          console.log("Index: Prayer Countdown Overlay is active.");
          return; // Stop checking other overlays
        }
      }
      console.log("Index: No prayer/Jumuah/Imsak overlay is active.");
    };

    const interval = setInterval(updateOverlayVisibility, 1000);
    updateOverlayVisibility();

    return () => clearInterval(interval);
  }, [nextPrayerTime, nextPrayerName, iqomahCountdownDuration, maghribIqomahCountdownDuration, khutbahDurationMinutes, adhanDurationSeconds, jumuahDhuhrTime, imsakTime, isRamadanModeActive, isScreenDarkened]); // Dihapus: isScreensaverActive

  // Combine all conditions that should pause the MediaPlayerDisplay
  const isOverlayActive = showPrayerOverlay || showJumuahOverlay || showImsakOverlay;
  const shouldMediaPlayerBePaused = isOverlayActive || isScreenDarkened || isMurottalPlaying; // Dihapus: isScreensaverActive


  console.log(`Index: Render - isOverlayActive: ${isOverlayActive}, isScreenDarkened: ${isScreenDarkened}, shouldMediaPlayerBePaused: ${shouldMediaPlayerBePaused}`); // Dihapus: isScreensaverActive


  const handleRefresh = () => {
    window.location.reload();
  };

  // Determine the iqomah duration to pass to PrayerCountdownOverlay
  const currentPrayerIqomahDuration = nextPrayerName === "Maghrib" 
    ? maghribIqomahCountdownDuration 
    : iqomahCountdownDuration;

  return (
    <>
      <AppBackground>
        {/* MurottalPlayer now receives a callback to update its playing status */}
        <MurottalPlayer onPlayingChange={setIsMurottalPlaying} />

        {/* {isScreensaverActive && !isOverlayActive && !isScreenDarkened && ( // Dihapus
          <Screensaver /> // Dihapus
        )} */}

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
            iqomahCountdownDuration={currentPrayerIqomahDuration} // Pass the determined duration
            onClose={handlePrayerOrKhutbahEnd}
            isJumuah={false}
            adhanDurationSeconds={adhanDurationSeconds}
          />
        )}
        {showJumuahOverlay && jumuahDhuhrTime && (
          <JumuahInfoOverlay
            jumuahDhuhrTime={jumuahDhuhrTime}
            khutbahDurationMinutes={khutbahDurationMinutes}
            onClose={handlePrayerOrKhutbahEnd}
            adhanDurationSeconds={adhanDurationSeconds}
          />
        )}

        {isScreenDarkened && <DarkScreenOverlay />}

        {/* Main content div, hidden if any overlay or screensaver/dark screen is active */}
        <div className={`w-full flex flex-col items-center justify-between flex-grow ${shouldMediaPlayerBePaused ? 'hidden' : ''}`}>
          <div className="w-full flex justify-between items-center p-0.5">
            <div className="flex items-center gap-0.5">
              {masjidLogoUrl && (
                <img src={masjidLogoUrl} alt="Masjid Logo" className="h-20 md:h-28 lg:h-36 object-contain" />
              )}
              <div>
                {masjidName && ( // Only render if masjidName is not empty
                  <h1 
                    className="text-3xl md:text-5xl lg:text-6xl xl:text-7xl font-extrabold drop-shadow-lg text-left text-outline-black"
                    style={{ color: masjidNameColor }}
                  >
                    {masjidName}
                  </h1>
                )}
                {masjidAddress && (
                  <p className="text-lg md:text-xl lg:text-2xl xl:text-3xl text-gray-300 text-left mt-0.5 text-outline-black">
                    {masjidAddress}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2"> {/* Added flex and gap for alignment */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                className="text-gray-400 hover:text-gray-200"
                aria-label="Refresh Display"
              >
                <RefreshCw className="h-6 w-6" />
              </Button>
              <HijriCalendarDisplay />
            </div>
          </div>

          {/* Main grid container for 3 columns on small screens, 3 on medium, 3 on large */}
          <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-3 gap-1 w-full px-0.5 py-0.5 md:py-1 flex-grow">
            {/* Kolom 1: Jadwal Sholat, Imam, Hari Besar Islam, Tarawih */}
            <div className="col-span-1 flex flex-col gap-1 flex-grow min-h-0">
              <PrayerTimesDisplay hideCountdown={isOverlayActive} />
              <ImamMuezzinDisplay />
              <IslamicHolidayCountdown />
              <TarawihScheduleDisplay />
            </div>

            {/* Kolom 2: Pengumuman, Slide */}
            <div className="col-span-1 flex flex-col gap-1 flex-grow min-h-0">
              <NotificationStudyDisplay />
              <React.Suspense fallback={<div>Memuat Info Slides...</div>}>
                <InfoSlides />
              </React.Suspense>
            </div>

            {/* Kolom 3: Media Player, Informasi Keuangan Masjid */}
            <div className="col-span-1 flex flex-col gap-1 flex-grow min-h-0">
              <MediaPlayerDisplay 
                isOverlayActive={shouldMediaPlayerBePaused} 
                // REMOVED: onIsVideoActiveChange={setIsMediaPlayerVideoActive}
                // REMOVED: className={cn(isMediaPlayerVideoActive ? "flex-[3]" : "flex-[1]")}
              />
              <FinancialDisplay 
                // REMOVED: className={cn(isMediaPlayerVideoActive ? "flex-[1]" : "flex-[2]")}
              />
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