import React, { useState, useEffect, useRef, useCallback } from "react";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { supabase } from "@/lib/supabase";
import * as Adhan from "adhan";
import { toast } from "sonner";

dayjs.extend(duration);

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

const MurottalPlayer: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [settings, setSettings] = useState<any | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<Adhan.PrayerTimes | null>(null);
  
  const playedTodayRef = useRef<Set<string>>(new Set());
  const lastCheckedDayRef = useRef<string | null>(null);

  const fetchSettingsAndPrayerTimes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("latitude, longitude, calculation_method, murottal_active, murottal_pre_adhan_duration, murottal_audio_url_fajr, murottal_audio_url_dhuhr, murottal_audio_url_asr, murottal_audio_url_maghrib, murottal_audio_url_isha, murottal_audio_url_imsak, is_ramadan_mode_active, tarhim_active, tarhim_audio_url") // Fetch new Tarhim settings
        .eq("id", 1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching murottal settings:", error);
        toast.error("Gagal memuat pengaturan murottal.");
        setSettings(null);
        setPrayerTimes(null);
        return;
      }

      if (data) {
        setSettings(data);
        if (data.murottal_active || data.tarhim_active) { // Calculate prayer times if either is active
          const coordinates = new Adhan.Coordinates(data.latitude || -6.2088, data.longitude || 106.8456);
          const params = Adhan.CalculationMethod[data.calculation_method as keyof typeof Adhan.CalculationMethod]();
          const today = new Date();
          setPrayerTimes(new Adhan.PrayerTimes(coordinates, today, params));
        } else {
          setPrayerTimes(null);
        }
      }
    } catch (err) {
      console.error("Unexpected error fetching murottal settings:", err);
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
        console.log('Murottal settings change received!', payload);
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
      return;
    }

    const checkAndPlayAudio = () => {
      const now = dayjs();
      const todayDate = now.format("YYYY-MM-DD");

      if (lastCheckedDayRef.current !== todayDate) {
        playedTodayRef.current = new Set();
        lastCheckedDayRef.current = todayDate;
      }

      // --- Logic for Tarhim ---
      if (settings.tarhim_active && settings.tarhim_audio_url) {
        const tarhimPrayers = [
          { name: "Tarhim Subuh", adhanTime: dayjs(prayerTimes.fajr) },
          { name: "Tarhim Isya", adhanTime: dayjs(prayerTimes.isha) },
          // Add other prayers for Tarhim if needed, e.g., Maghrib
          // { name: "Tarhim Maghrib", adhanTime: dayjs(prayerTimes.maghrib) },
        ];

        for (const tarhimConfig of tarhimPrayers) {
          const tarhimPlaybackTime = tarhimConfig.adhanTime.subtract(TARHIM_PLAYBACK_MINUTES_BEFORE_PRAYER, 'minute');
          const timeUntilTarhim = tarhimPlaybackTime.diff(now);

          // Play Tarhim if within 1 second of its scheduled time and not yet played today
          if (timeUntilTarhim > 0 && timeUntilTarhim <= 1000 && !playedTodayRef.current.has(tarhimConfig.name)) {
            if (audioRef.current && audioRef.current.src !== settings.tarhim_audio_url) {
              console.log(`Playing ${tarhimConfig.name}. Time until prayer: ${dayjs.duration(tarhimConfig.adhanTime.diff(now)).format("H:mm:ss")}`);
              audioRef.current.src = settings.tarhim_audio_url;
              audioRef.current.load();
              audioRef.current.play().then(() => {
                playedTodayRef.current.add(tarhimConfig.name);
              }).catch(e => console.error(`Error playing ${tarhimConfig.name} audio:`, e));
              return; // Play Tarhim and exit to avoid playing Murottal simultaneously
            }
          }
        }
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

          // Play Murottal if within pre-adhan duration, not yet played today,
          // and no Tarhim is currently playing or about to play.
          if (timeUntilPrayer > 0 && timeUntilPrayer <= preAdhanDurationMs && !playedTodayRef.current.has(config.name)) {
            if (audioRef.current && audioRef.current.src !== audioUrl) {
              console.log(`Playing murottal for ${config.name}. Time until prayer: ${dayjs.duration(timeUntilPrayer).format("H:mm:ss")}`);
              audioRef.current.src = audioUrl;
              audioRef.current.load();
              audioRef.current.play().then(() => {
                  playedTodayRef.current.add(config.name);
              }).catch(e => console.error("Error playing audio:", e));
              return; // Play Murottal and exit
            }
          }
        }
      }
    };

    const interval = setInterval(checkAndPlayAudio, 1000); // Periksa setiap detik

    return () => {
      clearInterval(interval);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = ""; // Hapus sumber saat unmount
      }
    };
  }, [settings, prayerTimes]);

  // Elemen audio tersembunyi untuk pemutaran
  return (
    <audio ref={audioRef} onEnded={() => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = ""; // Hapus sumber setelah selesai diputar
      }
    }} />
  );
};

export default MurottalPlayer;