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

interface MurottalPlayerProps {
  isAudioEnabledByUser: boolean;
}

const MurottalPlayer: React.FC<MurottalPlayerProps> = ({ isAudioEnabledByUser }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [settings, setSettings] = useState<any | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<Adhan.PrayerTimes | null>(null);
  const [playedToday, setPlayedToday] = useState<Set<string>>(new Set()); // To track which murottal has played today
  const [lastCheckedDay, setLastCheckedDay] = useState<string | null>(null); // To reset playedToday set daily

  const fetchSettingsAndPrayerTimes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("latitude, longitude, calculation_method, murottal_active, murottal_pre_adhan_duration, murottal_audio_url_fajr, murottal_audio_url_dhuhr, murottal_audio_url_asr, murottal_audio_url_maghrib, murottal_audio_url_isha, murottal_audio_url_imsak, is_ramadan_mode_active")
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
        if (data.murottal_active) {
          const coordinates = new Adhan.Coordinates(data.latitude || -6.2088, data.longitude || 106.8456);
          const params = Adhan.CalculationMethod[data.calculation_method as keyof typeof Adhan.CalculationMethod]();
          const today = new Date();
          setPrayerTimes(new Adhan.PrayerTimes(coordinates, today, params));
        } else {
          setPrayerTimes(null); // Murottal is not active
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
    if (!settings || !settings.murottal_active || !prayerTimes || !isAudioEnabledByUser) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      return;
    }

    const checkAndPlayMurottal = () => {
      const now = dayjs();
      const todayDate = now.format("YYYY-MM-DD");

      // Reset playedToday set at the start of a new day
      if (lastCheckedDay !== todayDate) {
        setPlayedToday(new Set());
        setLastCheckedDay(todayDate);
      }

      const preAdhanDurationMs = settings.murottal_pre_adhan_duration * 60 * 1000; // Convert minutes to milliseconds

      for (const config of PRAYER_CONFIGS) {
        let prayerTime: dayjs.Dayjs | null = null;
        let audioUrl: string | null = null;

        if (config.name === "Imsak") {
          if (!settings.is_ramadan_mode_active) continue; // Skip Imsak if Ramadan mode is not active
          const fajrTime = dayjs(prayerTimes.fajr);
          prayerTime = fajrTime.subtract(10, 'minute'); // Imsak is 10 minutes before Fajr
          audioUrl = settings[config.audioUrlField];
        } else {
          const adhanTime = prayerTimes[config.adhanName];
          if (!adhanTime) continue; // Skip if prayer time is not available
          prayerTime = dayjs(adhanTime);
          audioUrl = settings[config.audioUrlField];
        }

        if (!prayerTime || !audioUrl) continue;

        const timeUntilPrayer = prayerTime.diff(now);

        // Check if it's time to play murottal
        // Play if within the pre-adhan duration, and hasn't been played for this prayer today
        if (timeUntilPrayer > 0 && timeUntilPrayer <= preAdhanDurationMs && !playedToday.has(config.name)) {
          console.log(`Playing murottal for ${config.name}. Time until prayer: ${dayjs.duration(timeUntilPrayer).format("H:mm:ss")}`);
          if (audioRef.current) {
            audioRef.current.src = audioUrl;
            audioRef.current.play().catch(e => console.error("Error playing audio:", e));
            setPlayedToday(prev => new Set(prev).add(config.name)); // Mark as played for today
          }
        }
      }
    };

    const interval = setInterval(checkAndPlayMurottal, 1000); // Check every second

    return () => {
      clearInterval(interval);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = ""; // Clear source on unmount
      }
    };
  }, [settings, prayerTimes, playedToday, lastCheckedDay, isAudioEnabledByUser]);

  // Hidden audio element for playback
  return (
    <audio ref={audioRef} onEnded={() => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = ""; // Clear source after playing
      }
    }} />
  );
};

export default MurottalPlayer;