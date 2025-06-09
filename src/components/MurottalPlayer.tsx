import React, { useState, useEffect, useRef, useCallback } from "react";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import isBetween from "dayjs/plugin/isBetween";
import { supabase } from "@/lib/supabase";
import * as Adhan from "adhan";
import { toast } from "sonner";

dayjs.extend(duration);
dayjs.extend(isBetween);

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

const ADHAN_DURATION_SECONDS = 90; // Durasi adzan sekitar 1.5 menit

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

    const playAudio = (url: string, eventName: string, isMurottal: boolean = false) => {
      if (!audioRef.current) return false;

      // If current audio is murottal and a non-murottal audio is about to play, pause and store murottal info
      const isCurrentAudioMurottal = PRAYER_CONFIGS.some(config => audioRef.current?.src === settings[config.audioUrlField]);
      
      if (isCurrentAudioMurottal && !isMurottal && !audioRef.current.paused) {
        setPausedMurottalInfo({
          url: audioRef.current.src,
          currentTime: audioRef.current.currentTime
        });
        console.log(`MurottalPlayer: Pausing current murottal (${audioRef.current.src}) at ${audioRef.current.currentTime}s to play ${eventName}.`);
      } else if (isMurottal && pausedMurottalInfo) {
        // If we are trying to play murottal and there's paused info, clear it
        // This handles cases where murottal might be resumed by other means or manually
        setPausedMurottalInfo(null);
      }

      if (audioRef.current.src !== url || audioRef.current.paused) {
        audioRef.current.pause();
        audioRef.current.src = url;
        audioRef.current.load();
        audioRef.current.play().then(() => {
          playedTodayRef.current.add(eventName);
          console.log(`MurottalPlayer: Audio for ${eventName} started playing.`);
        }).catch(e => console.error(`MurottalPlayer: Error playing audio for ${eventName}:`, e));
        return true;
      } else if (audioRef.current.src === url && !audioRef.current.paused) {
          console.log(`MurottalPlayer: Audio for ${eventName} is already playing.`);
          return true;
      }
      return false;
    };

    const handleAudioEnded = () => {
      if (!audioRef.current) return;

      const endedAudioSrc = audioRef.current.src;
      console.log(`MurottalPlayer: Audio playback ended for ${endedAudioSrc}.`);

      // Check if the ended audio was the Imsak beep
      if (settings.imsak_beep_audio_url && endedAudioSrc === settings.imsak_beep_audio_url) {
        console.log("MurottalPlayer: Imsak beep ended.");
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
      } else if (settings.tarhim_audio_url && endedAudioSrc === settings.tarhim_audio_url) {
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

    const checkAndPlayAudioLoop = () => {
      const now = dayjs();
      const todayDate = now.format("YYYY-MM-DD");

      if (lastCheckedDayRef.current !== todayDate) {
        playedTodayRef.current = new Set();
        lastCheckedDayRef.current = todayDate;
        console.log(`MurottalPlayer: New day detected (${todayDate}). Resetting played audio list.`);
      }

      // --- Logic for Imsak Beep (Ramadan Mode) ---
      if (settings.is_ramadan_mode_active && settings.imsak_beep_audio_url) {
        const imsakTime = dayjs(prayerTimes.fajr).subtract(10, 'minute');
        const imsakEventName = "Imsak Beep";
        if (now.isBetween(imsakTime.subtract(1, 'second'), imsakTime.add(1, 'second'), null, '[]') && playAudio(settings.imsak_beep_audio_url, imsakEventName)) {
          return;
        }
      }

      // --- Logic for Tarhim ---
      if (settings.tarhim_active && settings.tarhim_audio_url) {
        const tarhimPreAdhanDurationMs = (settings.tarhim_pre_adhan_duration || 300) * 1000;
        const tarhimPrayers = [
          { name: "Tarhim Subuh", adhanTime: dayjs(prayerTimes.fajr) },
          { name: "Tarhim Isya", adhanTime: dayjs(prayerTimes.isha) },
        ];

        for (const tarhimConfig of tarhimPrayers) {
          const tarhimStartTime = tarhimConfig.adhanTime.subtract(tarhimPreAdhanDurationMs, 'millisecond');
          const tarhimEndTime = tarhimConfig.adhanTime; 
          
          if (now.isBetween(tarhimStartTime, tarhimEndTime, null, '[)') && playAudio(settings.tarhim_audio_url, tarhimConfig.name)) {
            return;
          }
        }
      }

      // --- Logic for Adhan Beep ---
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
          if (now.isBetween(adhanTime.subtract(1, 'second'), adhanTime.add(1, 'second'), null, '[]') && playAudio(settings.adhan_beep_audio_url, adhanBeepEventName)) {
            return;
          }
        }
      }

      // --- Logic for Iqomah Beep ---
      if (settings.iqomah_beep_audio_url) {
        const iqomahPrayers = [
          { name: "Subuh", adhanTime: dayjs(prayerTimes.fajr) },
          { name: "Dzuhur", adhanTime: dayjs(prayerTimes.dhuhr) },
          { name: "Ashar", adhanTime: dayjs(prayerTimes.asr) },
          { name: "Maghrib", adhanTime: dayjs(prayerTimes.maghrib) },
          { name: "Isya", adhanTime: dayjs(prayerTimes.isha) },
        ];

        for (const iqomahConfig of iqomahPrayers) {
          const iqomahTime = iqomahConfig.adhanTime.add(ADHAN_DURATION_SECONDS, 'second');
          const iqomahBeepEventName = `${iqomahConfig.name} Iqomah Beep`;
          if (now.isBetween(iqomahTime.subtract(1, 'second'), iqomahTime.add(1, 'second'), null, '[]') && playAudio(settings.iqomah_beep_audio_url, iqomahBeepEventName)) {
            return;
          }
        }
      }

      // --- Logic for Murottal (only if no higher priority audio is playing and no murottal is paused) ---
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

          if (timeUntilPrayer > 0 && timeUntilPrayer <= preAdhanDurationMs && playAudio(audioUrl, `Murottal ${config.name}`, true)) {
            return;
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