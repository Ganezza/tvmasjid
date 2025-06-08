import React, { useState, useEffect, useCallback } from "react";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import isBetween from "dayjs/plugin/isBetween";
import { supabase } from "@/lib/supabase";
import * as Adhan from "adhan";
import { toast } from "sonner";

dayjs.extend(duration);
dayjs.extend(isBetween);

interface PrayerTime {
  name: string;
  time: string; // e.g., "04:30"
}

const PrayerTimesDisplay: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(dayjs());
  const [prayerTimes, setPrayerTimes] = useState<PrayerTime[]>([]);
  const [nextPrayer, setNextPrayer] = useState<PrayerTime | null>(null);
  const [countdown, setCountdown] = useState<string>("");
  const [currentPrayerName, setCurrentPrayerName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRamadanModeActive, setIsRamadanModeActive] = useState(false); // State untuk mode Ramadan

  const fetchAndCalculatePrayerTimes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log("Fetching app settings for prayer times...");
      const { data, error: fetchError } = await supabase
        .from("app_settings")
        .select("latitude, longitude, calculation_method, is_ramadan_mode_active")
        .eq("id", 1)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error("Error fetching prayer time settings from Supabase:", fetchError);
        setError(`Gagal memuat pengaturan waktu sholat: ${fetchError.message}. Pastikan pengaturan sudah disimpan.`);
        toast.error("Gagal memuat pengaturan waktu sholat.");
        setIsLoading(false);
        return;
      }

      let latitude = data?.latitude || -6.2088;
      let longitude = data?.longitude || 106.8456;
      let calculationMethod = data?.calculation_method || "MuslimWorldLeague";
      const ramadanModeStatus = data?.is_ramadan_mode_active || false; // Ambil status mode Ramadan
      setIsRamadanModeActive(ramadanModeStatus); // Set state mode Ramadan

      console.log("Settings fetched:", { latitude, longitude, calculationMethod, ramadanModeStatus });

      const coordinates = new Adhan.Coordinates(latitude, longitude);
      const params = Adhan.CalculationMethod[calculationMethod as keyof typeof Adhan.CalculationMethod]();
      
      const today = new Date();
      console.log("Calculating prayer times for today:", today);
      const times = new Adhan.PrayerTimes(coordinates, today, params);

      // Calculate Imsak manually as 10 minutes before Fajr
      const imsakTime = dayjs(times.fajr).subtract(10, 'minute').format("HH:mm");
      console.log("Manually calculated Imsak time (10 mins before Fajr):", imsakTime);

      const basePrayerTimes: PrayerTime[] = [
        { name: "Subuh", time: dayjs(times.fajr).format("HH:mm") },
        { name: "Syuruq", time: dayjs(times.sunrise).format("HH:mm") },
        { name: "Dzuhur", time: dayjs(times.dhuhr).format("HH:mm") },
        { name: "Ashar", time: dayjs(times.asr).format("HH:mm") },
        { name: "Maghrib", time: dayjs(times.maghrib).format("HH:mm") },
        { name: "Isya", time: dayjs(times.isha).format("HH:mm") },
      ];

      let finalPrayerTimes: PrayerTime[] = [];
      if (ramadanModeStatus) {
        // Jika mode Ramadan aktif, tambahkan Imsak di awal
        finalPrayerTimes.push({ name: "Imsak", time: imsakTime });
      }
      finalPrayerTimes = finalPrayerTimes.concat(basePrayerTimes);
      
      console.log("Calculated prayer times:", finalPrayerTimes);
      setPrayerTimes(finalPrayerTimes);
      setIsLoading(false);
    } catch (err: any) {
      console.error("Error in fetchAndCalculatePrayerTimes:", err);
      setError(`Terjadi kesalahan saat menghitung waktu sholat: ${err.message || "Kesalahan tidak diketahui"}.`);
      toast.error("Terjadi kesalahan saat menghitung waktu sholat.");
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAndCalculatePrayerTimes();

    const channel = supabase
      .channel('app_settings_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'id=eq.1' }, (payload) => {
        console.log('App settings change received for PrayerTimesDisplay!', payload);
        fetchAndCalculatePrayerTimes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAndCalculatePrayerTimes]);

  useEffect(() => {
    if (prayerTimes.length === 0 && !isLoading && !error) {
      setError("Waktu sholat belum dimuat. Silakan atur lokasi di panel admin.");
      return;
    }

    const updateDisplay = () => {
      const now = dayjs();
      setCurrentTime(now);

      if (prayerTimes.length === 0) {
        setNextPrayer(null);
        setCountdown("N/A");
        setCurrentPrayerName(null);
        return;
      }

      let foundNextPrayer: PrayerTime | null = null;
      let minDiff = Infinity;
      let currentPrayer: PrayerTime | null = null;

      const sortedPrayerTimes = prayerTimes.map(prayer => {
        const [hour, minute] = prayer.time.split(":").map(Number);
        return {
          ...prayer,
          dateTimeToday: now.hour(hour).minute(minute).second(0).millisecond(0)
        };
      }).sort((a, b) => a.dateTimeToday.diff(b.dateTimeToday));

      for (let i = 0; i < sortedPrayerTimes.length; i++) {
        const prayer = sortedPrayerTimes[i];
        let prayerDateTime = prayer.dateTimeToday;

        if (prayerDateTime.isBefore(now)) {
          prayerDateTime = prayerDateTime.add(1, "day");
        }

        const diff = prayerDateTime.diff(now);
        if (diff > 0 && diff < minDiff) {
          minDiff = diff;
          foundNextPrayer = prayer;
        }
      }

      for (let i = 0; i < sortedPrayerTimes.length; i++) {
        const prayer = sortedPrayerTimes[i];
        const nextIndex = (i + 1) % sortedPrayerTimes.length;
        const nextPrayerInList = sortedPrayerTimes[nextIndex];

        let startOfInterval = prayer.dateTimeToday;
        let endOfInterval = nextPrayerInList.dateTimeToday;

        if (endOfInterval.isBefore(startOfInterval)) {
          endOfInterval = endOfInterval.add(1, 'day');
        }

        if (now.isBetween(startOfInterval, endOfInterval, null, '[)')) {
          currentPrayer = prayer;
          break;
        }
      }

      if (!currentPrayer && sortedPrayerTimes.length > 0) {
        const lastPrayerToday = sortedPrayerTimes[sortedPrayerTimes.length - 1].dateTimeToday;
        const firstPrayerTomorrow = sortedPrayerTimes[0].dateTimeToday.add(1, 'day');
        if (now.isBetween(lastPrayerToday, firstPrayerTomorrow, null, '[)')) {
          currentPrayer = sortedPrayerTimes[sortedPrayerTimes.length - 1];
        }
      }

      setNextPrayer(foundNextPrayer);
      setCurrentPrayerName(currentPrayer ? currentPrayer.name : null);

      if (foundNextPrayer) {
        const [hour, minute] = foundNextPrayer.time.split(":").map(Number);
        let nextPrayerDateTime = now.hour(hour).minute(minute).second(0);
        if (nextPrayerDateTime.isBefore(now)) {
          nextPrayerDateTime = nextPrayerDateTime.add(1, "day");
        }

        const durationRemaining = dayjs.duration(nextPrayerDateTime.diff(now));
        const hours = String(durationRemaining.hours()).padStart(2, "0");
        const minutes = String(durationRemaining.minutes()).padStart(2, "0");
        const seconds = String(durationRemaining.seconds()).padStart(2, "0");
        setCountdown(`${hours}:${minutes}:${seconds}`);
      } else {
        setCountdown("N/A");
      }
    };

    const interval = setInterval(updateDisplay, 1000);
    updateDisplay();

    return () => clearInterval(interval);
  }, [prayerTimes, isLoading, error]);

  return (
    <div className="bg-gray-800 bg-opacity-70 p-8 rounded-xl shadow-2xl w-11/12 max-w-4xl text-center mb-8">
      <h2 className="text-4xl font-bold mb-4 text-blue-300">Jadwal Sholat</h2>
      {isLoading ? (
        <p className="text-2xl text-white">Memuat waktu sholat...</p>
      ) : error ? (
        <div className="bg-red-800 bg-opacity-70 p-4 rounded-lg text-white">
          <p className="text-2xl font-bold">Error:</p>
          <p className="text-xl">{error}</p>
          <p className="text-lg mt-2">Silakan periksa pengaturan di <a href="/admin" className="underline text-blue-300">Admin Panel</a>.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xl md:text-2xl">
            {prayerTimes.map((prayer) => (
              <div
                key={prayer.name}
                className={`p-2 rounded-md ${
                  nextPrayer?.name === prayer.name
                    ? "bg-blue-600 text-white font-bold scale-105 transition-all duration-300"
                    : currentPrayerName === prayer.name
                    ? "bg-green-700 text-white font-bold"
                    : "bg-gray-700 text-gray-200"
                }`}
              >
                {prayer.name}: {prayer.time}
              </div>
            ))}
          </div>
          <div className="mt-6 text-yellow-300 font-semibold text-2xl md:text-3xl">
            {nextPrayer ? (
              nextPrayer.name === "Imsak" ? (
                <>
                  Waktu Imsak:{" "}
                  <span className="text-blue-400">{nextPrayer.time}</span>
                  <br />
                  Menuju Subuh: <span className="text-red-400">{countdown}</span>
                </>
              ) : (
                <>
                  Waktu Sholat Berikutnya:{" "}
                  <span className="text-blue-400">{nextPrayer.name}</span>
                  <br />
                  Hitung Mundur: <span className="text-red-400">{countdown}</span>
                </>
              )
            ) : (
              "Mencari waktu sholat berikutnya..."
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PrayerTimesDisplay;