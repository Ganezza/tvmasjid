import React, { useState, useEffect, useCallback, useRef } from "react";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { id } from "date-fns/locale";
import { format } from "date-fns";
import { RealtimeChannel } from "@supabase/supabase-js";

dayjs.extend(duration);
dayjs.extend(isSameOrAfter);

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
        const now = dayjs().startOf('day');
        const upcomingHolidays = data?.filter(holiday => dayjs(holiday.holiday_date).isSameOrAfter(now, 'day')) || [];

        if (upcomingHolidays.length > 0) {
          setNextHoliday(upcomingHolidays[0]);
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
          fetchNextHoliday();
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
      const holidayDate = dayjs(nextHoliday.holiday_date).endOf('day');

      const diffMs = holidayDate.diff(now);

      if (diffMs <= 0) {
        setCountdown("Hari ini!");
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
      if (years === 0 && months === 0 && days === 0) {
        countdownText += `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      } else if (years === 0 && months === 0 && days < 7) {
        countdownText += `${String(hours).padStart(2, '0')} jam ${String(minutes).padStart(2, '0')} menit`;
      }

      setCountdown(countdownText.trim());
    };

    const interval = setInterval(updateCountdown, 1000);
    updateCountdown();

    return () => clearInterval(interval);
  }, [nextHoliday, fetchNextHoliday]);

  if (isLoading) {
    return (
      <div className="bg-gray-800 bg-opacity-70 p-2 rounded-xl shadow-2xl w-full text-center text-white flex-grow flex flex-col"> {/* Reduced padding */}
        <p className="text-base">Memuat hari besar Islam...</p> {/* Reduced font size */}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-800 bg-opacity-70 p-2 rounded-xl shadow-2xl w-full text-center text-white flex-grow flex flex-col"> {/* Reduced padding */}
        <p className="text-base font-bold">Error:</p> {/* Reduced font size */}
        <p className="text-sm">{error}</p> {/* Reduced font size */}
      </div>
    );
  }

  return (
    <div className="bg-gray-800 bg-opacity-70 p-2 rounded-xl shadow-2xl w-full text-center flex-grow flex flex-col"> {/* Reduced padding */}
      <h3 className="text-xl md:text-2xl lg:text-3xl font-bold mb-1 text-yellow-300"> {/* Reduced font sizes */}
        Hari Besar Islam Mendatang
      </h3>
      {nextHoliday ? (
        <>
          <p className="text-xl md:text-2xl lg:text-3xl font-bold text-blue-200 mb-0.5"> {/* Reduced font sizes */}
            {nextHoliday.name}
          </p>
          <p className="text-base md:text-lg lg:text-xl text-gray-300 mb-1.5"> {/* Reduced font sizes and margin */}
            {format(new Date(nextHoliday.holiday_date), "EEEE, dd MMMM yyyy", { locale: id }).replace('Minggu', 'Ahad')}
          </p>
          <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-green-400"> {/* Reduced font sizes */}
            {countdown}
          </p>
        </>
      ) : (
        <p className="text-base text-gray-400">Tidak ada hari besar Islam mendatang yang tercatat.</p> {/* Reduced font size */}
      )}
    </div>
  );
};

export default IslamicHolidayCountdown;