import React, { useState, useEffect, useRef, useCallback } from "react";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import isBetween from "dayjs/plugin/isBetween"; // Import isBetween plugin
import { supabase } from "@/lib/supabase";
import * as Adhan from "adhan";
import { toast } from "sonner";

dayjs.extend(duration);
dayjs.extend(isBetween); // Extend dayjs with isBetween plugin

interface PrayerTimeConfig {
  name: string;
  adhanName: keyof Adhan.PrayerTimes;
  audioUrlField: string;
}

const PRAYER_CONFIGS: PrayerTimeConfig[] = [
  { name: "Imsak", adhanName: "fajr", audioUrlField: "murottal_audio_url_imsak" }, // Imsak is 10 mins before Fajr
  { name: "Subuh", adhanName: "fajr", audioUrlField: "murottal_audio_url_fajr" },
  { name: "Dzuhur", adhanName: "dhuhr", audioUrlField: "murottal_audio_url_dhuhr" },
  { name: "Ashar", adhanName: "asr", audioUrlField: "murottal_audio_url_asr" },
  { name: "Maghrib", adhanName: "maghrib", audioUrlField: "murottal_audio_url_maghrib" },
  { name: "Isya", adhanName: "isha", audioUrlField: "murottal_audio_url_isha" },
];

const TARHIM_PLAYBACK_MINUTES_BEFORE_PRAYER = 5; // Tarhim typically plays 5 minutes before Fajr/Isha

interface MurottalPlayerProps {
  hasUserInteracted: boolean; // New prop
}

const MurottalPlayer: React.FC<MurottalPlayerProps> = ({ hasUserInteracted }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [settings, setSettings] = useState<any | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<Adhan.PrayerTimes | null>(null);
  
  const playedTodayRef = useRef<Set<string>>(new Set());
  const lastCheckedDayRef = useRef<string | null>(null);

  const fetchSettingsAndPrayerTimes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("latitude, longitude, calculation_method, murottal_active, murottal_pre_adhan_duration, murottal_audio_url_fajr, murottal_audio_url_dhuhr, murottal_audio_url_asr, murottal_audio_url_maghrib, murottal_audio_url_isha, murottal_audio_url_imsak, is_ramadan_mode_active, tarhim_active, tarhim_audio_url")
        .eq("id", 1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("MurottalPlayer: Error fetching murottal settings:", error);
        toast.error("Gagal memuat pengaturan murottal.");
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
            isRamadanModeActive: data.is_ramadan_mode_active,
            tarhimAudioUrlExists: !!data.tarhim_audio_url // Check if URL exists
        });

        if (data.murottal_active || data.tarhim_active) {
          const coordinates = new Adhan.Coordinates(data.latitude || -6.2088, data.longitude || 106.8456);
          const params = Adhan.CalculationMethod[data.calculation_method as keyof typeof Adhan.CalculationMethod]();
          const today = new Date();
          setPrayerTimes(new Adhan.PrayerTimes(coordinates, today, params));
          console.log("MurottalPlayer: Prayer times calculated.");
        } else {
          setPrayerTimes(null);
          console.log("MurottalPlayer: Murottal and Tarhim are inactive. Skipping prayer time calculation.");
        }
      }
    } catch (err) {
      console.error("MurottalPlayer: Unexpected error fetching murottal settings:", err);
      toast.error("Terjadi kesalahan saat memuat pengaturan murottal.");
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
    if (!settings || !prayerTimes) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      console.log("MurottalPlayer: Settings or prayerTimes not available. Audio player inactive.");
      return;
    }

    const checkAndPlayAudio = () => {
      const now = dayjs();
      const todayDate = now.format("YYYY-MM-DD");

      if (lastCheckedDayRef.current !== todayDate) {
        playedTodayRef.current = new Set();
        lastCheckedDayRef.current = todayDate;
        console.log(`MurottalPlayer: New day detected (${todayDate}). Resetting played audio list.`);
      }

      // Only attempt to play audio if user has interacted
      if (!hasUserInteracted) {
        console.log("MurottalPlayer: User has not interacted yet. Skipping audio playback attempts.");
        return;
      }

      // --- Logic for Tarhim ---
      if (settings.tarhim_active && settings.tarhim_audio_url) {
        const tarhimPrayers = [
          { name: "Tarhim Subuh", adhanTime: dayjs(prayerTimes.fajr) },
          { name: "Tarhim Isya", adhanTime: dayjs(prayerTimes.isha) },
        ];

        for (const tarhimConfig of tarhimPrayers) {
          const tarhimStartTime = tarhimConfig.adhanTime.subtract(TARHIM_PLAYBACK_MINUTES_BEFORE_PRAYER, 'minute');
          const tarhimEndTime = tarhimConfig.adhanTime; // Tarhim plays until Adhan

          console.log(`MurottalPlayer: Checking ${tarhimConfig.name}`);
          console.log(`  Now: ${now.format('HH:mm:ss')}`);
          console.log(`  Tarhim Start: ${tarhimStartTime.format('HH:mm:ss')}`);
          console.log(`  Tarhim End: ${tarhimEndTime.format('HH:mm:ss')}`);
          console.log(`  Is between: ${now.isBetween(tarhimStartTime, tarhimEndTime, null, '[)')}`);
          console.log(`  Already played today: ${playedTodayRef.current.has(tarhimConfig.name)}`);
          console.log(`  Current audio src matches tarhim URL: ${audioRef.current?.src === settings.tarhim_audio_url}`);

          if (now.isBetween(tarhimStartTime, tarhimEndTime, null, '[)') && !playedTodayRef.current.has(tarhimConfig.name)) {
            if (audioRef.current && audioRef.current.src !== settings.tarhim_audio_url) {
              console.log(`MurottalPlayer: Attempting to play ${tarhimConfig.name} audio.`);
              audioRef.current.src = settings.tarhim_audio_url;
              audioRef.current.load();
              audioRef.current.play().then(() => {
                playedTodayRef.current.add(tarhimConfig.name);
                console.log(`MurottalPlayer: ${tarhimConfig.name} audio started playing.`);
              }).catch(e => console.error(`MurottalPlayer: Error playing ${tarhimConfig.name} audio:`, e));
              return; // Play one audio at a time
            } else if (audioRef.current && audioRef.current.src === settings.tarhim_audio_url) {
                console.log(`MurottalPlayer: ${tarhimConfig.name} audio already set/playing.`);
            }
          }
        }
      } else {
        console.log("MurottalPlayer: Tarhim is inactive or audio URL is missing.");
      }

      // --- Logic for Murottal (only if Tarhim is not playing) ---
      if (settings.murottal_active) {
        const preAdhanDurationMs = settings.murottal_pre_adhan_duration * 60 * 1000;

        for (const config of PRAYER_CONFIGS) {
          let prayerTime: dayjs.Dayjs | null = null;
          let audioUrl: string | null = null;

          if (config.name === "Imsak") {
            if (!settings.is_ramadan_mode_active) continue;
            const fajrTime = dayjs(prayerTimes.fajr);
            prayerTime = fajrTime.subtract(10, 'minute');
            audioUrl = settings[config.audioUrlField];
          } else {
            const adhanTime = prayerTimes[config.adhanName];
            if (!adhanTime) continue;
            prayerTime = dayjs(adhanTime);
            audioUrl = settings[config.audioUrlField];
          }

          if (!prayerTime || !audioUrl) continue;

          const timeUntilPrayer = prayerTime.diff(now);

          console.log(`MurottalPlayer: Checking Murottal for ${config.name}`);
          console.log(`  Now: ${now.format('HH:mm:ss')}`);
          console.log(`  Prayer Time: ${prayerTime.format('HH:mm:ss')}`);
          console.log(`  Time Until Prayer (ms): ${timeUntilPrayer}`);
          console.log(`  Pre-Adhan Duration (ms): ${preAdhanDurationMs}`);
          console.log(`  Already played today: ${playedTodayRef.current.has(config.name)}`);
          console.log(`  Current audio src matches murottal URL: ${audioRef.current?.src === audioUrl}`);


          if (timeUntilPrayer > 0 && timeUntilPrayer <= preAdhanDurationMs && !playedTodayRef.current.has(config.name)) {
            if (audioRef.current && audioRef.current.src !== audioUrl) {
              console.log(`MurottalPlayer: Attempting to play murottal for ${config.name}. Time until prayer: ${dayjs.duration(timeUntilPrayer).format("H:mm:ss")}`);
              audioRef.current.src = audioUrl;
              audioRef.current.load();
              audioRef.current.play().then(() => {
                  playedTodayRef.current.add(config.name);
                  console.log(`MurottalPlayer: Murottal for ${config.name} started playing.`);
              }).catch(e => console.error("MurottalPlayer: Error playing murottal audio:", e));
              return;
            } else if (audioRef.current && audioRef.current.src === audioUrl) {
                console.log(`MurottalPlayer: Murottal for ${config.name} audio already set/playing.`);
            }
          }
        }
      } else {
        console.log("MurottalPlayer: Murottal is inactive.");
      }
    };

    const interval = setInterval(checkAndPlayAudio, 1000);

    return () => {
      clearInterval(interval);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      console.log("MurottalPlayer: Cleanup. Audio player stopped.");
    };
  }, [settings, prayerTimes, hasUserInteracted]); // Add hasUserInteracted to dependencies

  return (
    <audio ref={audioRef} onEnded={() => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        console.log("MurottalPlayer: Audio playback ended. Resetting audio source.");
      }
    }} />
  );
};

export default MurottalPlayer;