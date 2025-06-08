import React, { useState, useEffect, useCallback } from "react";
import dayjs from "dayjs";
import { supabase } from "@/lib/supabase";
import { CalculationMethod, PrayerTimes, Coordinates } from "adhan";
import { toast } from "sonner";

interface Schedule {
  id: string;
  day_of_week: string;
  prayer_name: string;
  imam_name: string;
  muezzin_name?: string | null;
  display_order: number;
}

// Mengubah kunci menjadi huruf kecil agar sesuai dengan output adhan library
const prayerNameMap: { [key: string]: string } = {
  fajr: "Subuh",
  dhuhr: "Dzuhur",
  asr: "Ashar",
  maghrib: "Maghrib",
  isha: "Isya",
};

const getIndonesianDayOfWeek = (date: dayjs.Dayjs): string => {
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  return days[date.day()];
};

const ImamMuezzinDisplay: React.FC = () => {
  const [currentSchedule, setCurrentSchedule] = useState<Schedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAndDisplaySchedule = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch app settings for prayer time calculation
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

      // 2. Calculate prayer times for today
      const now = dayjs();
      const coordinates = new Coordinates(latitude, longitude);
      const params = CalculationMethod[calculationMethod as keyof typeof CalculationMethod]();
      const times = new PrayerTimes(coordinates, now.toDate(), params);

      let nextPrayerAdhanName = times.nextPrayer(); // Akan mengembalikan 'fajr', 'dhuhr', dll. (huruf kecil) atau null
      let targetDay = now; // Default ke hari ini

      // Jika tidak ada sholat lagi hari ini (setelah Isya), anggap Subuh hari berikutnya
      if (!nextPrayerAdhanName) {
        nextPrayerAdhanName = "fajr"; // Set ke 'fajr' (huruf kecil) untuk hari berikutnya
        targetDay = now.add(1, 'day'); // Dan itu akan terjadi besok
      }

      let nextPrayerDisplayName = prayerNameMap[nextPrayerAdhanName];

      // Penanganan khusus untuk Jumat Dzuhur -> Jumat
      // Pastikan menggunakan nama adhan asli ('dhuhr') dan targetDay yang benar
      if (targetDay.day() === 5 && nextPrayerAdhanName === "dhuhr") { // Jumat adalah hari 5, dan sholat Dzuhur dari adhan
        nextPrayerDisplayName = "Jumat";
      }

      if (!nextPrayerDisplayName) {
        setError("Tidak dapat menentukan waktu sholat berikutnya.");
        setIsLoading(false);
        return;
      }

      // 4. Dapatkan nama hari dalam bahasa Indonesia, berdasarkan targetDay
      const currentDayOfWeek = getIndonesianDayOfWeek(targetDay);

      // 5. Ambil jadwal imam/muadzin untuk sholat berikutnya dan hari ini
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("imam_muezzin_schedules")
        .select("*")
        .eq("day_of_week", currentDayOfWeek)
        .eq("prayer_name", nextPrayerDisplayName)
        .order("display_order", { ascending: true })
        .limit(1)
        .single();

      if (scheduleError && scheduleError.code !== 'PGRST116') {
        console.error("Error fetching imam/muezzin schedule:", scheduleError);
        setError("Gagal memuat jadwal imam & muadzin.");
      } else if (scheduleData) {
        setCurrentSchedule(scheduleData);
      } else {
        setCurrentSchedule(null); // Tidak ada jadwal ditemukan untuk sholat/hari ini
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
    fetchAndDisplaySchedule(); // Initial fetch

    // Set up real-time listeners for relevant tables
    const settingsChannel = supabase
      .channel('imam_muezzin_display_settings_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'id=eq.1' }, (payload) => {
        console.log('App settings change received for ImamMuezzinDisplay!', payload);
        fetchAndDisplaySchedule();
      })
      .subscribe();

    const schedulesChannel = supabase
      .channel('imam_muezzin_display_schedules_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'imam_muezzin_schedules' }, (payload) => {
        console.log('Imam/Muezzin schedule change received for display!', payload);
        fetchAndDisplaySchedule();
      })
      .subscribe();

    // Update every minute to ensure next prayer is always accurate
    const interval = setInterval(fetchAndDisplaySchedule, 60 * 1000); 

    return () => {
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(schedulesChannel);
      clearInterval(interval);
    };
  }, [fetchAndDisplaySchedule]);

  if (isLoading) {
    return (
      <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-2xl w-11/12 max-w-4xl text-center mb-8 text-white">
        <p className="text-xl">Memuat jadwal imam & muadzin...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-800 bg-opacity-70 p-6 rounded-xl shadow-2xl w-11/12 max-w-4xl text-center mb-8 text-white">
        <p className="text-xl font-bold">Error:</p>
        <p className="text-lg">{error}</p>
      </div>
    );
  }

  if (!currentSchedule) {
    return (
      <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-2xl w-11/12 max-w-4xl text-center mb-8 text-white">
        <p className="text-xl text-gray-400">Jadwal imam & muadzin untuk sholat berikutnya tidak ditemukan.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-2xl w-11/12 max-w-4xl text-center mb-8">
      <h3 className="text-3xl font-bold mb-3 text-green-300">
        Sholat {currentSchedule.prayer_name} Berikutnya
      </h3>
      <p className="text-2xl text-blue-200">
        Imam: <span className="font-semibold">{currentSchedule.imam_name}</span>
      </p>
      {currentSchedule.muezzin_name && (
        <p className="text-xl text-gray-300 mt-1">
          Muadzin: <span className="font-medium">{currentSchedule.muezzin_name}</span>
        </p>
      )}
    </div>
  );
};

export default ImamMuezzinDisplay;