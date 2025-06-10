import React, { useState, useEffect, useCallback, useRef } from "react";
import dayjs from "dayjs";
import { supabase } from "@/lib/supabase";
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

const getIndonesianDayOfWeek = (date: dayjs.Dayjs): string => {
  const days = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  return days[date.day()];
};

const TarawihScheduleDisplay: React.FC = () => {
  const [tarawihSchedule, setTarawihSchedule] = useState<Schedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRamadanModeActive, setIsRamadanModeActive] = useState(false); // State untuk mode Ramadan
  const settingsChannelRef = useRef<RealtimeChannel | null>(null);
  const schedulesChannelRef = useRef<RealtimeChannel | null>(null);

  const fetchTarawihSchedule = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // 1. Check Ramadan Mode status
      const { data: settings, error: settingsError } = await supabase
        .from("app_settings")
        .select("is_ramadan_mode_active")
        .eq("id", 1)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error("Error fetching app settings for Tarawih display:", settingsError);
        setError("Gagal memuat pengaturan mode Ramadan.");
        setIsLoading(false);
        return;
      }

      const ramadanModeStatus = settings?.is_ramadan_mode_active || false;
      setIsRamadanModeActive(ramadanModeStatus);

      if (!ramadanModeStatus) {
        setTarawihSchedule(null); // Clear schedule if Ramadan mode is off
        setIsLoading(false);
        return;
      }

      // 2. If Ramadan mode is active, fetch Tarawih schedule for today
      const today = dayjs();
      const currentDayOfWeek = getIndonesianDayOfWeek(today);

      const { data: scheduleData, error: scheduleError } = await supabase
        .from("imam_muezzin_schedules")
        .select("*")
        .eq("day_of_week", currentDayOfWeek)
        .eq("prayer_name", "Tarawih")
        .order("display_order", { ascending: true })
        .limit(1); // Removed .single()

      if (scheduleError) {
        console.error("Error fetching Tarawih schedule:", scheduleError);
        setError("Gagal memuat jadwal Tarawih.");
      } else if (scheduleData && scheduleData.length > 0) { // Check for data[0]
        setTarawihSchedule(scheduleData[0]);
      } else {
        setTarawihSchedule(null); // No Tarawih schedule found for today
      }
    } catch (err) {
      console.error("Unexpected error in TarawihScheduleDisplay:", err);
      setError("Terjadi kesalahan saat memuat jadwal Tarawih.");
      toast.error("Terjadi kesalahan saat memuat jadwal Tarawih.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTarawihSchedule(); // Initial fetch

    // Set up real-time listeners for relevant tables
    if (!settingsChannelRef.current) {
      settingsChannelRef.current = supabase
        .channel('tarawih_display_settings_changes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'id=eq.1' }, (payload) => {
          console.log('App settings change received for TarawihDisplay!', payload);
          fetchTarawihSchedule();
        })
        .subscribe();
      console.log("TarawihScheduleDisplay: Subscribed to channel 'tarawih_display_settings_changes'.");
    }

    if (!schedulesChannelRef.current) {
      schedulesChannelRef.current = supabase
        .channel('tarawih_display_schedules_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'imam_muezzin_schedules' }, (payload) => {
          console.log('Imam/Muezzin schedule change received for Tarawih display!', payload);
          fetchTarawihSchedule();
        })
        .subscribe();
      console.log("TarawihScheduleDisplay: Subscribed to channel 'tarawih_display_schedules_changes'.");
    }

    return () => {
      if (settingsChannelRef.current) {
        supabase.removeChannel(settingsChannelRef.current);
        console.log("TarawihScheduleDisplay: Unsubscribed from channel 'tarawih_display_settings_changes'.");
        settingsChannelRef.current = null;
      }
      if (schedulesChannelRef.current) {
        supabase.removeChannel(schedulesChannelRef.current);
        console.log("TarawihScheduleDisplay: Unsubscribed from channel 'tarawih_display_schedules_changes'.");
        schedulesChannelRef.current = null;
      }
    };
  }, [fetchTarawihSchedule]);

  if (isLoading) {
    return (
      <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-2xl w-11/12 max-w-4xl text-center mb-8 text-white">
        <p className="text-xl">Memuat jadwal Tarawih...</p>
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

  // Only render if Ramadan mode is active and a schedule is found
  if (!isRamadanModeActive || !tarawihSchedule) {
    return null; // Do not render if Ramadan mode is off or no schedule
  }

  return (
    <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-2xl w-11/12 max-w-4xl text-center mb-8">
      <h3 className="text-3xl font-bold mb-3 text-yellow-300">
        Jadwal Sholat Tarawih
      </h3>
      <p className="text-3xl text-blue-200">
        Imam: <span className="font-semibold">{tarawihSchedule.imam_name}</span>
      </p>
      {tarawihSchedule.khatib_name && (
        <p className="text-2xl text-gray-300 mt-1">
          Khatib: <span className="font-medium">{tarawihSchedule.khatib_name}</span>
        </p>
      )}
      {tarawihSchedule.bilal_name && (
        <p className="text-2xl text-gray-300 mt-1">
          Bilal: <span className="font-medium">{tarawihSchedule.bilal_name}</span>
        </p>
      )}
      {tarawihSchedule.muezzin_name && ( // Muezzin is still relevant for Tarawih
        <p className="text-2xl text-gray-300 mt-1">
          Muadzin: <span className="font-medium">{tarawihSchedule.muezzin_name}</span>
        </p>
      )}
    </div>
  );
};

export default TarawihScheduleDisplay;