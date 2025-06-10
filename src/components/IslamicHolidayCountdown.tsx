import React, { useState, useEffect, useCallback, useRef } from "react";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter"; // Import the plugin
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { id } from "date-fns/locale";
import { format } from "date-fns";
import { RealtimeChannel } from "@supabase/supabase-js";

dayjs.extend(duration);
dayjs.extend(isSameOrAfter); // Extend dayjs with the plugin

interface IslamicHoliday {
  id: string;
  name: string;
  holiday_date: string; // YYYY-MM-DD format
  display_order: number;
}

const IslamicHolidayCountdown: React.FC = () => {
  const [nextHoliday, setNextHoliday] = useState<IslamicHoliday | null>(null);
  const [countdown, setCountdown] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchNextHoliday = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("islamic_holidays")
        .select("*")
        .order("holiday_date", { ascending: true })
        .order("display_order", { ascending: true });

      if (fetchError) {
        console.error("Error fetching Islamic holidays:", fetchError);
        setError("Gagal memuat hari besar Islam.");
        toast.error("Gagal memuat hari besar Islam.");
      } else {
        const now = dayjs().startOf('day'); // Get current date without time for comparison
        const upcomingHolidays = data?.filter(holiday => dayjs(holiday.holiday_date).isSameOrAfter(now, 'day')) || [];

        if (upcomingHolidays.length > 0) {
          setNextHoliday(upcomingHolidays[0]); // The first one is the next upcoming
        } else {
          setNextHoliday(null);
        }
      }
    } catch (err) {
      console.error("Unexpected error fetching Islamic holidays:", err);
      setError("Terjadi kesalahan saat memuat hari besar Islam.");
      toast.error("Terjadi kesalahan saat memuat hari besar Islam.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNextHoliday();

    if (!channelRef.current) {
      channelRef.current = supabase
        .channel('islamic_holidays_display_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'islamic_holidays' }, (payload) => {
          console.log('Islamic holiday change received for display!', payload);
          fetchNextHoliday(); // Re-fetch if holidays change
        })
        .subscribe();
      console.log("IslamicHolidayCountdown: Subscribed to channel 'islamic_holidays_display_changes'.");
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        console.log("IslamicHolidayCountdown: Unsubscribed from channel 'islamic_holidays_display_changes'.");
        channelRef.current = null;
      }
    };
  }, [fetchNextHoliday]);

  useEffect(() => {
    const updateCountdown = () => {
      if (!nextHoliday) {
        setCountdown("Tidak ada hari besar mendatang.");
        return;
      }

      const now = dayjs();
      const holidayDate = dayjs(nextHoliday.holiday_date).endOf('day'); // End of day to include the whole day

      const diffMs = holidayDate.diff(now);

      if (diffMs <= 0) {
        setCountdown("Hari ini!");
        // Optionally, refetch after a short delay if the holiday just passed
        setTimeout(fetchNextHoliday, 5000); 
        return;
      }

      const durationRemaining = dayjs.duration(diffMs);

      const years = durationRemaining.years();
      const months = durationRemaining.months();
      const days = durationRemaining.days();
      const hours = durationRemaining.hours();
      const minutes = durationRemaining.minutes();
      const seconds = durationRemaining.seconds();

      let countdownText = "";
      if (years > 0) {
        countdownText += `${years} tahun `;
      }
      if (months > 0) {
        countdownText += `${months} bulan `;
      }
      if (days > 0) {
        countdownText += `${days} hari `;
      }
      // Only show hours/minutes/seconds if less than a day
      if (years === 0 && months === 0 && days === 0) {
        countdownText += `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      } else if (years === 0 && months === 0 && days < 7) { // Show hours/minutes if less than a week
        countdownText += `${String(hours).padStart(2, '0')} jam ${String(minutes).padStart(2, '0')} menit`;
      }

      setCountdown(countdownText.trim());
    };

    const interval = setInterval(updateCountdown, 1000);
    updateCountdown(); // Initial call

    return () => clearInterval(interval);
  }, [nextHoliday, fetchNextHoliday]);

  if (isLoading) {
    return (
      <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-2xl w-full text-center text-white">
        <p className="text-xl">Memuat hari besar Islam...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-800 bg-opacity-70 p-6 rounded-xl shadow-2xl w-full text-center text-white">
        <p className="text-xl font-bold">Error:</p>
        <p className="text-lg">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-2xl w-full text-center">
      <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 text-yellow-300">
        Hari Besar Islam Mendatang
      </h3>
      {nextHoliday ? (
        <>
          <p className="text-4xl md:text-5xl lg:text-6xl font-bold text-blue-200 mb-2">
            {nextHoliday.name}
          </p>
          <p className="text-2xl md:text-3xl lg:text-4xl text-gray-300 mb-4">
            {format(new Date(nextHoliday.holiday_date), "EEEE, dd MMMM yyyy", { locale: id }).replace('Minggu', 'Ahad')}
          </p>
          <p className="text-5xl md:text-6xl lg:text-7xl font-bold text-green-400">
            {countdown}
          </p>
        </>
      ) : (
        <p className="text-2xl text-gray-400">Tidak ada hari besar Islam mendatang yang tercatat.</p>
      )}
    </div>
  );
};

export default IslamicHolidayCountdown;