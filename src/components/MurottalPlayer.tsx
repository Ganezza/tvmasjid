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
  
  // Menggunakan useRef untuk playedToday dan lastCheckedDay agar tidak memicu re-render
  const playedTodayRef = useRef<Set<string>>(new Set());
  const lastCheckedDayRef = useRef<string | null>(null);

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

      // Reset playedTodayRef pada awal hari baru
      if (lastCheckedDayRef.current !== todayDate) {
        playedTodayRef.current = new Set();
        lastCheckedDayRef.current = todayDate;
      }

      const preAdhanDurationMs = settings.murottal_pre_adhan_duration * 60 * 1000; // Konversi menit ke milidetik

      for (const config of PRAYER_CONFIGS) {
        let prayerTime: dayjs.Dayjs | null = null;
        let audioUrl: string | null = null;

        if (config.name === "Imsak") {
          if (!settings.is_ramadan_mode_active) continue; // Lewati Imsak jika mode Ramadan tidak aktif
          const fajrTime = dayjs(prayerTimes.fajr);
          prayerTime = fajrTime.subtract(10, 'minute'); // Imsak adalah 10 menit sebelum Fajr
          audioUrl = settings[config.audioUrlField];
        } else {
          const adhanTime = prayerTimes[config.adhanName];
          if (!adhanTime) continue; // Lewati jika waktu sholat tidak tersedia
          prayerTime = dayjs(adhanTime);
          audioUrl = settings[config.audioUrlField];
        }

        if (!prayerTime || !audioUrl) continue;

        const timeUntilPrayer = prayerTime.diff(now);

        // Periksa apakah sudah waktunya memutar murottal
        // Putar jika dalam durasi pra-adzan, belum diputar untuk sholat ini hari ini,
        // DAN audio ini belum sedang diputar.
        if (timeUntilPrayer > 0 && timeUntilPrayer <= preAdhanDurationMs && !playedTodayRef.current.has(config.name)) {
          if (audioRef.current && audioRef.current.src !== audioUrl) { // Hanya ganti src jika berbeda
            console.log(`Playing murottal for ${config.name}. Time until prayer: ${dayjs.duration(timeUntilPrayer).format("H:mm:ss")}`);
            audioRef.current.src = audioUrl;
            audioRef.current.load(); // Pastikan memuat sumber baru
            audioRef.current.play().then(() => {
                playedTodayRef.current.add(config.name); // Tandai sudah diputar untuk hari ini
            }).catch(e => console.error("Error playing audio:", e));
          }
        }
      }
    };

    const interval = setInterval(checkAndPlayMurottal, 1000); // Periksa setiap detik

    return () => {
      clearInterval(interval);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = ""; // Hapus sumber saat unmount
      }
    };
  }, [settings, prayerTimes, isAudioEnabledByUser]); // Dependensi sekarang hanya props/state yang tidak berubah dalam logika efek ini

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