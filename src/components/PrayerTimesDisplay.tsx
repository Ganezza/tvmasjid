import React, { useState, useEffect, useCallback, useRef } from "react";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import isBetween from "dayjs/plugin/isBetween";
import { supabase } from "@/lib/supabase";
import * as Adhan from "adhan";
import { toast } from "sonner";
import { RealtimeChannel } from "@supabase/supabase-js";

dayjs.extend(duration);
dayjs.extend(isBetween);

interface PrayerTime {
  name: string;
  time: string; // e.g., "04:30"
}

interface PrayerTimesDisplayProps {
  hideCountdown?: boolean; // New prop
}

const PrayerTimesDisplay: React.FC<PrayerTimesDisplayProps> = ({ hideCountdown = false }) => {
  const [currentTime, setCurrentTime] = useState(dayjs());
  const [prayerTimes, setPrayerTimes] = useState<PrayerTime[]>([]);
  const [nextPrayer, setNextPrayer] = useState<PrayerTime | null>(null);
  const [countdown, setCountdown] = useState<string>("");
  const [currentPrayerName, setCurrentPrayerName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRamadanModeActive, setIsRamadanModeActive] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchAndCalculatePrayerTimes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log("Fetching app settings for prayer times...");
      const { data, error: fetchError } = await supabase
        .from("app_settings")
        .select("latitude, longitude, calculation_method, is_ramadan_mode_active, fajr_offset, dhuhr_offset, asr_offset, maghrib_offset, isha_offset, imsak_offset")
        .eq("id", 1)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means no rows found
        console.error("Error fetching prayer time settings from Supabase:", fetchError);
        setError(`Gagal memuat pengaturan waktu sholat: ${fetchError.message || "Pastikan pengaturan sudah disimpan."}`);
        toast.error("Gagal memuat pengaturan waktu sholat.");
        setIsLoading(false);
        return;
      }

      let latitude = data?.latitude || -6.2088;
      let longitude = data?.longitude || 106.8456;
      let calculationMethod = data?.calculation_method || "MuslimWorldLeague";
      const ramadanModeStatus = data?.is_ramadan_mode_active || false;
      setIsRamadanModeActive(ramadanModeStatus);

      const fajrOffset = data?.fajr_offset ?? 0;
      const dhuhrOffset = data?.dhuhr_offset ?? 0;
      const asrOffset = data?.asr_offset ?? 0;
      const maghribOffset = data?.maghrib_offset ?? 0;
      const ishaOffset = data?.isha_offset ?? 0;
      const imsakOffset = data?.imsak_offset ?? 0;

      console.log("Settings fetched:", { latitude, longitude, calculationMethod, ramadanModeStatus, fajrOffset, dhuhrOffset, asrOffset, maghribOffset, ishaOffset, imsakOffset });

      const coordinates = new Adhan.Coordinates(latitude, longitude);
      const params = Adhan.CalculationMethod[calculationMethod as keyof typeof Adhan.CalculationMethod]();
      
      const today = dayjs(); // Use dayjs for current day check
      const adhanTimes = new Adhan.PrayerTimes(coordinates, today.toDate(), params);

      // Apply offsets to Adhan times
      const adjustedFajr = dayjs(adhanTimes.fajr).add(fajrOffset, 'minute');
      const adjustedDhuhr = dayjs(adhanTimes.dhuhr).add(dhuhrOffset, 'minute');
      const adjustedAsr = dayjs(adhanTimes.asr).add(asrOffset, 'minute');
      const adjustedMaghrib = dayjs(adhanTimes.maghrib).add(maghribOffset, 'minute');
      const adjustedIsha = dayjs(adhanTimes.isha).add(ishaOffset, 'minute');
      const adjustedSunrise = dayjs(adhanTimes.sunrise); // Sunrise typically doesn't have an offset

      // Calculate Imsak manually as 10 minutes before Fajr, then apply its own offset
      const calculatedImsakTime = dayjs(adhanTimes.fajr).subtract(10, 'minute').add(imsakOffset, 'minute');
      const imsakTimeFormatted = calculatedImsakTime.format("HH:mm");
      console.log("Manually calculated Imsak time (10 mins before Fajr + offset):", imsakTimeFormatted);

      const isFriday = today.day() === 5; // 0 for Sunday, 5 for Friday

      const basePrayerTimes: PrayerTime[] = [
        { name: "Subuh", time: adjustedFajr.format("HH:mm") },
        { name: "Syuruq", time: adjustedSunrise.format("HH:mm") },
        { name: isFriday ? "Jum'at" : "Dzuhur", time: adjustedDhuhr.format("HH:mm") },
        { name: "Ashar", time: adjustedAsr.format("HH:mm") },
        { name: "Maghrib", time: adjustedMaghrib.format("HH:mm") },
        { name: "Isya", time: adjustedIsha.format("HH:mm") },
      ];

      let finalPrayerTimes: PrayerTime[] = [];
      if (ramadanModeStatus) {
        // Jika mode Ramadan aktif, tambahkan Imsak di awal untuk perhitungan internal
        finalPrayerTimes.push({ name: "Imsak", time: imsakTimeFormatted });
      }
      finalPrayerTimes = finalPrayerTimes.concat(basePrayerTimes);
      
      console.log("Calculated prayer times (with offsets):", finalPrayerTimes);
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

    if (!channelRef.current) {
      channelRef.current = supabase
        .channel('app_settings_changes_prayer_times') // Unique channel name
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'id=eq.1' }, (payload) => {
          console.log('App settings change received for PrayerTimesDisplay!', payload);
          fetchAndCalculatePrayerTimes();
        })
        .subscribe();
      console.log("PrayerTimesDisplay: Subscribed to channel 'app_settings_changes_prayer_times'.");
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        console.log("PrayerTimesDisplay: Unsubscribed from channel 'app_settings_changes_prayer_times'.");
        channelRef.current = null;
      }
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

      // Find the next *actual* prayer (excluding Syuruq and Imsak for next prayer calculation)
      const prayersForNextCalculation = sortedPrayerTimes.filter(p => p.name !== "Syuruq" && p.name !== "Imsak");

      for (let i = 0; i < prayersForNextCalculation.length; i++) {
        const prayer = prayersForNextCalculation[i];
        
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

      // Determine current prayer (including Syuruq and Imsak for display purposes)
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

  // Filter out Imsak for display if Ramadan mode is active
  const prayersToDisplay = prayerTimes.filter(prayer => !(isRamadanModeActive && prayer.name === "Imsak"));

  return (
    <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-2xl text-center flex flex-col justify-between flex-grow">
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 text-blue-300">Jadwal Sholat</h2>
      {isLoading ? (
        <p className="text-xl text-white">Memuat waktu sholat...</p>
      ) : error ? (
        <div className="bg-red-800 bg-opacity-70 p-3 rounded-lg text-white">
          <p className="text-xl font-bold">Error:</p>
          <p className="text-lg">{error}</p>
          <p className="text-base mt-1">Silakan periksa pengaturan di <a href="/admin" className="underline text-blue-300">Admin Panel</a>.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-2xl md:text-3xl lg:text-4xl xl:text-5xl">
            {prayersToDisplay.map((prayer) => (
              <div
                key={prayer.name}
                className={`p-1 rounded-md ${
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
          {!hideCountdown && (
            <div className="mt-4 text-yellow-300 font-semibold text-3xl md:text-4xl lg:text-5xl xl:text-6xl">
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
          )}
        </>
      )}
    </div>
  );
};

export default PrayerTimesDisplay;