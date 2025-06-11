import React, { useState, useEffect, useCallback, useRef } from "react";
import dayjs from "dayjs";
import { supabase } from "@/lib/supabase";
import { CalculationMethod, PrayerTimes, Coordinates } from "adhan";
import { toast } from "sonner";
import { RealtimeChannel } from "@supabase/supabase-js";

interface Schedule {
  id: string;
  day_of_week: string;
  prayer_name: string;
  imam_name: string;
  muezzin_name?: string | null;
  khatib_name?: string | null;
  bilal_name?: string | null;
  display_order: number;
}

const prayerNameMap: { [key: string]: string } = {
  Fajr: "Subuh",
  Dhuhr: "Dzuhur",
  Asr: "Ashar",
  Maghrib: "Maghrib",
  Isha: "Isya",
};

const getIndonesianDayOfWeek = (date: dayjs.Dayjs): string => {
  const days = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jum'at", "Sabtu"];
  return days[date.day()];
};

const ImamMuezzinDisplay: React.FC = () => {
  const [currentSchedule, setCurrentSchedule] = useState<Schedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextPrayerInfo, setNextPrayerInfo] = useState<{ day: string; prayer: string } | null>(null);
  const settingsChannelRef = useRef<RealtimeChannel | null>(null);
  const schedulesChannelRef = useRef<RealtimeChannel | null>(null);

  const fetchAndDisplaySchedule = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setNextPrayerInfo(null);

    try {
      const { data: settings, error: settingsError } = await supabase
        .from("app_settings")
        .select("latitude, longitude, calculation_method")
        .eq("id", 1)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error("Error fetching app settings:", settingsError);
        setError("Gagal memuat pengaturan aplikasi.");
        setIsLoading(false);
        return;
      }

      const latitude = settings?.latitude || -6.2088;
      const longitude = settings?.longitude || 106.8456;
      const calculationMethod = settings?.calculation_method || "MuslimWorldLeague";

      const now = dayjs();
      const coordinates = new Coordinates(latitude, longitude);
      const params = CalculationMethod[calculationMethod as keyof typeof CalculationMethod]();
      const times = new PrayerTimes(coordinates, now.toDate(), params);

      const todayPrayerTimes = [
        { name: "Fajr", time: dayjs(times.fajr) },
        { name: "Dhuhr", time: dayjs(times.dhuhr) },
        { name: "Asr", time: dayjs(times.asr) },
        { name: "Maghrib", time: dayjs(times.maghrib) },
        { name: "Isha", time: dayjs(times.isha) },
      ];

      let nextPrayerAdhanName: string | null = null;
      let targetDay = now;

      for (const prayer of todayPrayerTimes) {
        if (prayer.time.isAfter(now)) {
          nextPrayerAdhanName = prayer.name;
          break;
        }
      }

      if (!nextPrayerAdhanName) {
        nextPrayerAdhanName = "Fajr";
        targetDay = now.add(1, 'day');
      }

      let nextPrayerDisplayName = prayerNameMap[nextPrayerAdhanName];

      if (targetDay.day() === 5 && nextPrayerAdhanName === "Dhuhr") {
        nextPrayerDisplayName = "Jum'at";
      }

      if (!nextPrayerDisplayName) {
        setError("Tidak dapat menentukan waktu sholat berikutnya (pemetaan nama).");
        setIsLoading(false);
        return;
      }

      const currentDayOfWeek = getIndonesianDayOfWeek(targetDay);

      setNextPrayerInfo({ day: currentDayOfWeek, prayer: nextPrayerDisplayName });

      const { data: scheduleData, error: scheduleError } = await supabase
        .from("imam_muezzin_schedules")
        .select("*")
        .eq("day_of_week", currentDayOfWeek)
        .eq("prayer_name", nextPrayerDisplayName)
        .order("display_order", { ascending: true })
        .limit(1);

      if (scheduleError) {
        console.error("Error fetching imam/muezzin schedule:", scheduleError);
        setError("Gagal memuat jadwal imam & muadzin.");
      } else if (scheduleData && scheduleData.length > 0) {
        setCurrentSchedule(scheduleData[0]);
      } else {
        setCurrentSchedule(null);
      }
    } catch (err) {
      console.error("Unexpected error in ImamMuezzinDisplay:", err);
      setError("Terjadi kesalahan saat memuat jadwal.");
      toast.error("Terjadi kesalahan saat memuat jadwal imam & muadzin.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAndDisplaySchedule();

    if (!settingsChannelRef.current) {
      settingsChannelRef.current = supabase
        .channel('imam_muezzin_display_settings_changes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'id=eq.1' }, (payload) => {
          console.log('App settings change received for ImamMuezzinDisplay!', payload);
          fetchAndDisplaySchedule();
        })
        .subscribe();
      console.log("ImamMuezzinDisplay: Subscribed to channel 'imam_muezzin_display_settings_changes'.");
    }

    if (!schedulesChannelRef.current) {
      schedulesChannelRef.current = supabase
        .channel('imam_muezzin_display_schedules_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'imam_muezzin_schedules' }, (payload) => {
          console.log('Imam/Muezzin schedule change received for display!', payload);
          fetchAndDisplaySchedule();
        })
        .subscribe();
      console.log("ImamMuezzinDisplay: Subscribed to channel 'imam_muezzin_display_schedules_changes'.");
    }

    const interval = setInterval(fetchAndDisplaySchedule, 60 * 1000); 

    return () => {
      if (settingsChannelRef.current) {
        supabase.removeChannel(settingsChannelRef.current);
        console.log("ImamMuezzinDisplay: Unsubscribed from channel 'imam_muezzin_display_settings_changes'.");
        settingsChannelRef.current = null;
      }
      if (schedulesChannelRef.current) {
        supabase.removeChannel(schedulesChannelRef.current);
        console.log("ImamMuezzinDisplay: Unsubscribed from channel 'imam_muezzin_display_schedules_changes'.");
        schedulesChannelRef.current = null;
      }
      clearInterval(interval);
    };
  }, [fetchAndDisplaySchedule]);

  if (isLoading) {
    return (
      <div className="bg-gray-800 bg-opacity-70 p-2 rounded-xl shadow-2xl w-full text-center text-white flex-grow flex flex-col">
        <p className="text-sm">Memuat jadwal imam & muadzin...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-800 bg-opacity-70 p-2 rounded-xl shadow-2xl w-full text-center text-white flex-grow flex flex-col">
        <p className="text-sm font-bold">Error:</p>
        <p className="text-xs">{error}</p>
      </div>
    );
  }

  if (!currentSchedule) {
    return (
      <div className="bg-gray-800 bg-opacity-70 p-2 rounded-xl shadow-2xl w-full text-center text-white flex-grow flex flex-col">
        <p className="text-xs text-gray-400">
          Jadwal imam & muadzin untuk sholat berikutnya tidak ditemukan.
          {nextPrayerInfo && (
            <span className="block mt-0.5 text-xs">
              Mencari: <span className="font-semibold">{nextPrayerInfo.prayer}</span> pada hari <span className="font-semibold">{nextPrayerInfo.day}</span>.
            </span>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 bg-opacity-70 p-2 rounded-xl shadow-2xl w-full text-center flex-grow flex flex-col">
      <h3 className="text-xl md:text-2xl lg:text-3xl font-bold mb-0.5 text-green-300">
        Sholat {currentSchedule.prayer_name} Berikutnya
      </h3>
      <p className="text-lg md:text-xl lg:text-2xl text-blue-200">
        Imam: <span className="font-semibold">{currentSchedule.imam_name}</span>
      </p>
      {currentSchedule.muezzin_name && (
        <p className="text-sm md:text-base lg:text-xl text-gray-300 mt-0.5">
          Muadzin: <span className="font-medium">{currentSchedule.muezzin_name}</span>
        </p>
      )}
      {currentSchedule.khatib_name && (
        <p className="text-sm md:text-base lg:text-xl text-gray-300 mt-0.5">
          Khatib: <span className="font-medium">{currentSchedule.khatib_name}</span>
        </p>
      )}
      {currentSchedule.bilal_name && (
        <p className="text-sm md:text-base lg:text-xl text-gray-300 mt-0.5">
          Bilal: <span className="font-medium">{currentSchedule.bilal_name}</span>
        </p>
      )}
    </div>
  );
};

export default ImamMuezzinDisplay;