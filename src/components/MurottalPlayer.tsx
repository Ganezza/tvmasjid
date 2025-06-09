import React, { useState, useEffect, useRef, useCallback } from "react";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import isBetween from "dayjs/plugin/isBetween";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter"; // Import isSameOrAfter
import { supabase } from "@/lib/supabase";
import * as Adhan from "adhan";
import { toast } from "sonner";

dayjs.extend(duration);
dayjs.extend(isBetween);
dayjs.extend(isSameOrAfter); // Extend dayjs with isSameOrAfter

interface PrayerTimeConfig {
  name: string;
  adhanName: keyof Adhan.PrayerTimes;
  audioUrlField: string;
}

const PRAYER_CONFIGS: PrayerTimeConfig[] = [
  { name: "Subuh", adhanName: "fajr", audioUrlField: "murottal_audio_url_fajr" },
  { name: "Dzuhur", adhanName: "dhuhr", audioUrlField: "murottal_audio_url_dhuhr" },
  { name: "Ashar", adhanName: "asr", audioUrlField: "murottal_audio_url_asr" },
  { name: "Maghrib", adhanName: "maghrib", audioUrlField: "murottal_audio_url_maghrib" },
  { name: "Isya", adhanName: "isha", audioUrlField: "murottal_audio_url_isha" },
];

const ADHAN_DURATION_SECONDS = 120; // Durasi adzan sekitar 2 menit

const MurottalPlayer: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [settings, setSettings] = useState<any | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<Adhan.PrayerTimes | null>(null);
  const [pausedMurottalInfo, setPausedMurottalInfo] = useState<{ url: string; currentTime: number } | null>(null);
  
  const playedTodayRef = useRef<Set<string>>(new Set());
  const lastCheckedDayRef = useRef<string | null>(null);

  const fetchSettingsAndPrayerTimes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("latitude, longitude, calculation_method, murottal_active, murottal_pre_adhan_duration, murottal_audio_url_fajr, murottal_audio_url_dhuhr, murottal_audio_url_asr, murottal_audio_url_maghrib, murottal_audio_url_isha, murottal_audio_url_imsak, is_ramadan_mode_active, tarhim_active, tarhim_audio_url, tarhim_pre_adhan_duration, is_master_audio_active, adhan_beep_audio_url, iqomah_beep_audio_url, imsak_beep_audio_url")
        .eq("id", 1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("MurottalPlayer: Error fetching murottal settings:", error);
        toast.error("Gagal memuat pengaturan audio.");
        setSettings(null);
        setPrayerTimes(null);
        return;
      }

      if (data) {
        setSettings(data);
        console.log("MurottalPlayer: Fetched settings:", {
            murottalActive: data.murottal_active,
            tarhimActive: data.tarhim_active,
            tarhimAudioUrl: data.tarhim_audio_url,
            murottalPreAdhanDuration: data.murottal_pre_adhan_duration,
            tarhimPreAdhanDuration: data.tarhim_pre_adhan_duration,
            isRamadanModeActive: data.is_ramadan_mode_active,
            tarhimAudioUrlExists: !!data.tarhim_audio_url,
            isMasterAudioActive: data.is_master_audio_active,
            adhanBeepAudioUrl: data.adhan_beep_audio_url,
            iqomahBeepAudioUrl: data.iqomah_beep_audio_url,
            imsakBeepAudioUrl: data.imsak_beep_audio_url 
        });

        if (data.murottal_active || data.tarhim_active || data.adhan_beep_audio_url || data.iqomah_beep_audio_url || data.imsak_beep_audio_url) {
          const coordinates = new Adhan.Coordinates(data.latitude || -6.2088, data.longitude || 106.8456);
          const params = Adhan.CalculationMethod[data.calculation_method as keyof typeof Adhan.CalculationMethod]();
          const today = new Date();
          setPrayerTimes(new Adhan.PrayerTimes(coordinates, today, params));
          console.log("MurottalPlayer: Prayer times calculated.");
        } else {
          setPrayerTimes(null);
          console.log("MurottalPlayer: All audio features inactive. Skipping prayer time calculation.");
        }
      }
    } catch (err) {
      console.error("MurottalPlayer: Unexpected error fetching murottal settings:", err);
      toast.error("Terjadi kesalahan saat memuat pengaturan audio.");
      setSettings(null);
      setPrayerTimes(null);
    }
  }, []);

  useEffect(() => {
    fetchSettingsAndPrayerTimes();

    const channel = supabase
      .channel('murottal_settings_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'id=eq.1' }, (payload) => {
        console.log('MurottalPlayer: Murottal settings change received!', payload);
        fetchSettingsAndPrayerTimes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSettingsAndPrayerTimes]);

  useEffect(() => {
    if (!settings || !prayerTimes || !settings.is_master_audio_active) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      console.log("MurottalPlayer: Settings, prayerTimes, or master audio not available/active. Audio player inactive.");
      return;
    }

    const playAudio = async (url: string, eventName: string, isMurottal: boolean = false) => {
      if (!audioRef.current || !url) {
        console.log(`MurottalPlayer: Cannot play ${eventName}. Audio ref not ready or URL is empty.`);
        return false;
      }

      // If the requested audio is already playing, do nothing
      if (audioRef.current.src === url && !audioRef.current.paused) {
        console.log(`MurottalPlayer: Audio for ${eventName} is already playing.`);
        return true;
      }

      // If current audio is murottal and a non-murottal audio is about to play, pause and store murottal info
      const isCurrentAudioMurottal = PRAYER_CONFIGS.some(config => audioRef.current?.src === settings[config.audioUrlField]);
      
      if (isCurrentAudioMurottal && !isMurottal && !audioRef.current.paused) {
        setPausedMurottalInfo({
          url: audioRef.current.src,
          currentTime: audioRef.current.currentTime
        });
        console.log(`MurottalPlayer: Pausing current murottal (${audioRef.current.src}) at ${audioRef.current.currentTime}s to play ${eventName}.`);
        audioRef.current.pause(); // Explicitly pause
      } else if (isMurottal && pausedMurottalInfo) {
        // If we are trying to play murottal and there's paused info, clear it
        // This handles cases where murottal might be resumed by other means or manually
        setPausedMurottalInfo(null);
      }

      // Set new source and play
      audioRef.current.src = url;
      audioRef.current.load(); // Ensure the new source is loaded

      try {
        await audioRef.current.play();
        playedTodayRef.current.add(eventName);
        console.log(`MurottalPlayer: Audio for ${eventName} started playing.`);
        return true;
      } catch (e: any) {
        if (e.name === 'AbortError') {
          console.warn(`MurottalPlayer: Playback of ${eventName} aborted. This is expected if a higher priority audio takes over quickly.`);
        } else {
          console.error(`MurottalPlayer: Error playing audio for ${eventName}:`, e);
        }
        return false;
      }
    };

    const handleAudioEnded = () => {
      if (!audioRef.current) return;

      const endedAudioSrc = audioRef.current.src;
      console.log(`MurottalPlayer: Audio playback ended for ${endedAudioSrc}.`);

      // Check if the ended audio was the Imsak beep
      if (settings.imsak_beep_audio_url && endedAudioSrc.includes(settings.imsak_beep_audio_url.split('/').pop() || '')) { // Use .includes and .pop() for robust URL comparison
        console.log("MurottalPlayer: Imsak beep ended. Attempting to resume murottal if paused.");
        if (pausedMurottalInfo) {
          // Resume paused murottal
          audioRef.current.src = pausedMurottalInfo.url;
          audioRef.current.currentTime = pausedMurottalInfo.currentTime;
          audioRef.current.play().then(() => {
            console.log(`MurottalPlayer: Resumed murottal from ${pausedMurottalInfo.currentTime}s.`);
            setPausedMurottalInfo(null); // Clear paused info
          }).catch(e => console.error("MurottalPlayer: Error resuming murottal:", e));
          return; // Don't clear src if resuming
        }
      } else if (settings.tarhim_audio_url && endedAudioSrc.includes(settings.tarhim_audio_url.split('/').pop() || '')) { // Robust URL comparison
        console.log("MurottalPlayer: Tarhim audio ended. Murottal will NOT resume.");
        // For Tarhim, we explicitly do not resume murottal. Clear paused info if any.
        setPausedMurottalInfo(null);
      }

      // Default behavior: pause and clear src
      audioRef.current.pause();
      audioRef.current.src = "";
      console.log("MurottalPlayer: Audio playback ended. Resetting audio source.");
    };

    // Attach the event listener
    if (audioRef.current) {
      audioRef.current.addEventListener('ended', handleAudioEnded);
    }

    const checkAndPlayAudioLoop = async () => { // Made async
      const now = dayjs();
      const todayDate = now.format("YYYY-MM-DD");

      if (lastCheckedDayRef.current !== todayDate) {
        playedTodayRef.current = new Set();
        lastCheckedDayRef.current = todayDate;
        console.log(`MurottalPlayer: New day detected (${todayDate}). Resetting played audio list.`);
      }

      // --- Logic for Imsak Beep (Ramadan Mode) ---
      console.log(`MurottalPlayer: Checking Imsak Beep. Ramadan Active: ${settings.is_ramadan_mode_active}, URL: ${!!settings.imsak_beep_audio_url}`);
      if (settings.is_ramadan_mode_active && settings.imsak_beep_audio_url) {
        const imsakTime = dayjs(prayerTimes.fajr).subtract(10, 'minute');
        const imsakEventName = "Imsak Beep";
        console.log(`MurottalPlayer: Imsak Time: ${imsakTime.format('HH:mm:ss')}, Current Time: ${now.format('HH:mm:ss')}, Played Today: ${playedTodayRef.current.has(imsakEventName)}`);
        
        // Trigger Imsak beep if current time is at or after imsakTime AND hasn't played today
        if (now.isSameOrAfter(imsakTime) && !playedTodayRef.current.has(imsakEventName)) {
          console.log(`MurottalPlayer: *** Imsak Beep condition MET! Attempting to play. ***`);
          if (await playAudio(settings.imsak_beep_audio_url, imsakEventName)) {
            console.log(`MurottalPlayer: Imsak Beep successfully triggered.`);
            return; // Successfully started Imsak beep, stop checking other audio
          } else {
            console.log(`MurottalPlayer: Failed to play Imsak Beep.`);
          }
        }
      }

      // --- Logic for Tarhim ---
      console.log(`MurottalPlayer: Checking Tarhim. Tarhim Active: ${settings.tarhim_active}, URL: ${!!settings.tarhim_audio_url}`);
      if (settings.tarhim_active && settings.tarhim_audio_url) {
        const tarhimPreAdhanDurationMs = (settings.tarhim_pre_adhan_duration || 300) * 1000;
        const tarhimPrayers = [
          { name: "Tarhim Subuh", adhanTime: dayjs(prayerTimes.fajr) },
          { name: "Tarhim Isya", adhanTime: dayjs(prayerTimes.isha) },
        ];

        for (const tarhimConfig of tarhimPrayers) {
          const tarhimStartTime = tarhimConfig.adhanTime.subtract(tarhimPreAdhanDurationMs, 'millisecond');
          const tarhimEndTime = tarhimConfig.adhanTime; 
          console.log(`MurottalPlayer: Tarhim ${tarhimConfig.name} Start: ${tarhimStartTime.format('HH:mm:ss')}, End: ${tarhimEndTime.format('HH:mm:ss')}, Current: ${now.format('HH:mm:ss')}`);
          
          if (now.isBetween(tarhimStartTime, tarhimEndTime, null, '[)')) {
            console.log(`MurottalPlayer: Condition met for Tarhim ${tarhimConfig.name}. Attempting to play.`);
            if (await playAudio(settings.tarhim_audio_url, tarhimConfig.name)) {
              return; // Successfully started Tarhim, stop checking other audio
            }
          }
        }
      }

      // --- Logic for Adhan Beep ---
      console.log(`MurottalPlayer: Checking Adhan Beep. URL: ${!!settings.adhan_beep_audio_url}`);
      if (settings.adhan_beep_audio_url) {
        const adhanPrayers = [
          { name: "Subuh", adhanTime: dayjs(prayerTimes.fajr) },
          { name: "Dzuhur", adhanTime: dayjs(prayerTimes.dhuhr) },
          { name: "Ashar", adhanTime: dayjs(prayerTimes.asr) },
          { name: "Maghrib", adhanTime: dayjs(prayerTimes.maghrib) },
          { name: "Isya", adhanTime: dayjs(prayerTimes.isha) },
        ];

        for (const adhanConfig of adhanPrayers) {
          const adhanTime = adhanConfig.adhanTime;
          const adhanBeepEventName = `${adhanConfig.name} Adhan Beep`;
          console.log(`MurottalPlayer: Adhan Beep ${adhanConfig.name} Time: ${adhanTime.format('HH:mm:ss')}, Current: ${now.format('HH:mm:ss')}`);
          if (now.isBetween(adhanTime.subtract(1, 'second'), adhanTime.add(1, 'second'), null, '[]')) {
            console.log(`MurottalPlayer: Condition met for Adhan Beep ${adhanConfig.name}. Attempting to play.`);
            if (await playAudio(settings.adhan_beep_audio_url, adhanBeepEventName)) {
              return;
            }
          }
        }
      }

      // --- Logic for Iqomah Beep ---
      console.log(`MurottalPlayer: Checking Iqomah Beep. URL: ${!!settings.iqomah_beep_audio_url}`);
      if (settings.iqomah_beep_audio_url) {
        const iqomahPrayers = [
          { name: "Subuh", adhanTime: dayjs(prayerTimes.fajr) },
          { name: "Dzuhur", adhanTime: dayjs(prayerTimes.dhuhr) },
          { name: "Ashar", adhanTime: dayjs(prayerTimes.asr) },
          { name: "Maghrib", adhanTime: dayjs(prayerTimes.maghrib) },
          { name: "Isya", adhanTime: dayjs(prayerTimes.isha) },
        ];

        for (const iqomahConfig of iqomahPrayers) {
          const iqomahTime = iqomahConfig.adhanTime.add(ADHAN_DURATION_SECONDS, 'second'); // Use ADHAN_DURATION_SECONDS
          const iqomahBeepEventName = `${iqomahConfig.name} Iqomah Beep`;
          console.log(`MurottalPlayer: Iqomah Beep ${iqomahConfig.name} Time: ${iqomahTime.format('HH:mm:ss')}, Current: ${now.format('HH:mm:ss')}`);
          if (now.isBetween(iqomahTime.subtract(1, 'second'), iqomahTime.add(1, 'second'), null, '[]')) {
            console.log(`MurottalPlayer: Condition met for Iqomah Beep ${iqomahConfig.name}. Attempting to play.`);
            if (await playAudio(settings.iqomah_beep_audio_url, iqomahBeepEventName)) {
              return;
            }
          }
        }
      }

      // --- Logic for Murottal (only if no higher priority audio is playing and no murottal is paused) ---
      console.log(`MurottalPlayer: Checking Murottal. Murottal Active: ${settings.murottal_active}, Paused Murottal Info: ${!!pausedMurottalInfo}`);
      if (settings.murottal_active && !pausedMurottalInfo) {
        const preAdhanDurationMs = settings.murottal_pre_adhan_duration * 60 * 1000;

        for (const config of PRAYER_CONFIGS) {
          let prayerTime: dayjs.Dayjs | null = null;
          let audioUrl: string | null = null;

          const adhanTime = prayerTimes[config.adhanName];
          if (!adhanTime) continue;
          prayerTime = dayjs(adhanTime);
          audioUrl = settings[config.audioUrlField];
          
          if (!prayerTime || !audioUrl) continue;

          const timeUntilPrayer = prayerTime.diff(now);
          console.log(`MurottalPlayer: Murottal ${config.name} - Time until prayer: ${timeUntilPrayer / 1000}s. Pre-Adhan Duration: ${preAdhanDurationMs / 1000}s.`);

          if (timeUntilPrayer > 0 && timeUntilPrayer <= preAdhanDurationMs) {
            console.log(`MurottalPlayer: Condition met for Murottal ${config.name}. Attempting to play.`);
            if (await playAudio(audioUrl, `Murottal ${config.name}`, true)) {
              return;
            }
          }
        }
      }

      // If no audio condition is met, ensure audio is paused and source cleared
      if (audioRef.current && !audioRef.current.paused && !pausedMurottalInfo) {
        audioRef.current.pause();
        audioRef.current.src = "";
        console.log("MurottalPlayer: Paused and cleared audio because no active audio condition met.");
      }
    };

    const interval = setInterval(checkAndPlayAudioLoop, 1000);

    return () => {
      clearInterval(interval);
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', handleAudioEnded); // Clean up event listener
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      console.log("MurottalPlayer: Cleanup. Audio player stopped.");
    };
  }, [settings, prayerTimes, pausedMurottalInfo]); // Add pausedMurottalInfo to dependencies

  return (
    <audio ref={audioRef} />
  );
};

export default MurottalPlayer;