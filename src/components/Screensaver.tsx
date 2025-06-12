import React, { useState, useEffect, useCallback, useRef } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, Navigation } from "swiper/modules";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { RealtimeChannel } from "@supabase/supabase-js";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import dayjs from "dayjs";
import { cn } from "@/lib/utils";
import * as Adhan from "adhan";

// Import Swiper styles
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";

interface ScreensaverContent {
  id: string;
  type: "image" | "financial_summary" | "jumuah_schedule";
  title: string | null;
  content: string | null; // For image_url
  display_order: number;
  is_active: boolean;
}

interface FinancialRecord {
  id: string;
  created_at: string;
  transaction_type: "inflow" | "outflow";
  amount: number;
  description: string;
}

const Screensaver: React.FC = () => {
  const { settings, isLoadingSettings } = useAppSettings();
  const [screensaverContents, setScreensaverContents] = useState<ScreensaverContent[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [recentRecords, setRecentRecords] = useState<FinancialRecord[]>([]);
  const [jumuahSchedule, setJumuahSchedule] = useState<any | null>(null);
  const contentChannelRef = useRef<RealtimeChannel | null>(null);
  const financialChannelRef = useRef<RealtimeChannel | null>(null);
  const jumuahScheduleChannelRef = useRef<RealtimeChannel | null>(null);

  const fetchScreensaverContent = useCallback(async () => {
    setIsLoadingContent(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("screensaver_content")
        .select("*")
        .eq("is_active", true) // Only fetch active content
        .order("display_order", { ascending: true });

      if (fetchError) {
        console.error("Error fetching screensaver content:", fetchError);
        setError("Gagal memuat konten screensaver.");
      } else {
        setScreensaverContents(data || []);
      }
    } catch (err) {
      console.error("Unexpected error fetching screensaver content:", err);
      setError("Terjadi kesalahan saat memuat konten screensaver.");
    } finally {
      setIsLoadingContent(false);
    }
  }, []);

  const fetchFinancialData = useCallback(async () => {
    try {
      const { data: financialData, error: financialError } = await supabase
        .from("financial_records")
        .select("id, created_at, transaction_type, amount, description")
        .order("created_at", { ascending: false });

      if (financialError) {
        console.error("Error fetching financial records for screensaver:", financialError);
      } else {
        const balance = (financialData || []).reduce((sum, record) => {
          return record.transaction_type === "inflow" ? sum + record.amount : sum - record.amount;
        }, 0);
        setTotalBalance(balance);
        setRecentRecords(financialData || []);
      }
    } catch (err) {
      console.error("Unexpected error fetching financial data for screensaver:", err);
    }
  }, []);

  const fetchJumuahSchedule = useCallback(async () => {
    const today = dayjs();
    const isFriday = today.day() === 5; // 0 for Sunday, 1 for Monday, ..., 5 for Friday, 6 for Saturday

    if (!isFriday) {
      setJumuahSchedule(null);
      return;
    }

    try {
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("imam_muezzin_schedules")
        .select("*")
        .eq("day_of_week", "Jumat")
        .eq("prayer_name", "Jumat")
        .order("display_order", { ascending: true })
        .limit(1);

      if (scheduleError) {
        console.error("Error fetching Jumuah schedule for screensaver:", scheduleError);
      } else if (scheduleData && scheduleData.length > 0) {
        setJumuahSchedule(scheduleData[0]);
      } else {
        setJumuahSchedule(null);
      }
    } catch (err) {
      console.error("Unexpected error fetching Jumuah schedule for screensaver:", err);
    }
  }, []);

  useEffect(() => {
    fetchScreensaverContent();
    fetchFinancialData();
    fetchJumuahSchedule();

    if (!contentChannelRef.current) {
      contentChannelRef.current = supabase
        .channel('screensaver_content_display_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'screensaver_content' }, (payload) => {
          console.log('Screensaver content display change received!', payload);
          fetchScreensaverContent();
        })
        .subscribe();
      console.log("Screensaver: Subscribed to channel 'screensaver_content_display_changes'.");
    }

    if (!financialChannelRef.current) {
      financialChannelRef.current = supabase
        .channel('screensaver_financial_display_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_records' }, (payload) => {
          console.log('Screensaver financial display change received!', payload);
          fetchFinancialData();
        })
        .subscribe();
      console.log("Screensaver: Subscribed to channel 'screensaver_financial_display_changes'.");
    }

    if (!jumuahScheduleChannelRef.current) {
      jumuahScheduleChannelRef.current = supabase
        .channel('screensaver_jumuah_display_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'imam_muezzin_schedules' }, (payload) => {
          console.log('Screensaver Jumuah schedule display change received!', payload);
          fetchJumuahSchedule();
        })
        .subscribe();
      console.log("Screensaver: Subscribed to channel 'screensaver_jumuah_display_changes'.");
    }

    // Also re-fetch Jumuah schedule daily to ensure it updates correctly for Friday
    const dailyInterval = setInterval(fetchJumuahSchedule, 24 * 60 * 60 * 1000); // Every 24 hours

    return () => {
      if (contentChannelRef.current) {
        supabase.removeChannel(contentChannelRef.current);
        console.log("Screensaver: Unsubscribed from channel 'screensaver_content_display_changes'.");
        contentChannelRef.current = null;
      }
      if (financialChannelRef.current) {
        supabase.removeChannel(financialChannelRef.current);
        console.log("Screensaver: Unsubscribed from channel 'screensaver_financial_display_changes'.");
        financialChannelRef.current = null;
      }
      if (jumuahScheduleChannelRef.current) {
        supabase.removeChannel(jumuahScheduleChannelRef.current);
        console.log("Screensaver: Unsubscribed from channel 'screensaver_jumuah_display_changes'.");
        jumuahScheduleChannelRef.current = null;
      }
      clearInterval(dailyInterval);
    };
  }, [fetchScreensaverContent, fetchFinancialData, fetchJumuahSchedule]);

  const filteredContents = screensaverContents.filter(content => {
    if (content.type === 'jumuah_schedule') {
      return dayjs().day() === 5 && jumuahSchedule; // Only show Jumuah schedule on Friday if data exists
    }
    return true; // Show other types of content always if active
  });

  if (isLoadingContent || isLoadingSettings) {
    return (
      <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center z-[100] text-white p-4">
        <p className="text-2xl md:text-3xl lg:text-4xl text-gray-300">Memuat konten screensaver...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-red-800 flex flex-col items-center justify-center z-[100] text-white p-4">
        <p className="text-2xl md:text-3xl lg:text-4xl font-bold">Error Memuat Screensaver:</p>
        <p className="text-xl md:text-2xl lg:text-3xl text-center mt-2">{error}</p>
      </div>
    );
  }

  if (filteredContents.length === 0) {
    return (
      <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center z-[100] text-white p-4">
        <div className="text-center animate-pulse">
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-green-400 mb-4 text-outline-gold">
            Masjid Digital TV
          </h1>
          <p className="text-2xl md:text-3xl lg:text-4xl text-gray-300">
            Layar akan kembali aktif saat ada aktivitas.
          </p>
          <p className="text-xl md:text-2xl lg:text-3xl text-gray-400 mt-4">
            Sentuh layar atau tekan tombol apa saja untuk melanjutkan.
          </p>
          <p className="text-lg md:text-xl lg:text-2xl text-gray-500 mt-8">
            Tidak ada konten screensaver yang aktif. Silakan tambahkan di Admin Panel.
          </p>
        </div>
      </div>
    );
  }

  // Use the screensaver_slide_duration directly as it's already in milliseconds from settings
  const slideDuration = settings?.screensaver_slide_duration || 10000; // Default to 10 seconds (10000 ms)

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center z-[100] text-white p-4">
      <Swiper
        spaceBetween={30}
        centeredSlides={true}
        autoplay={{
          delay: slideDuration,
          disableOnInteraction: false,
        }}
        pagination={{
          clickable: true,
        }}
        navigation={false}
        modules={[Autoplay, Pagination, Navigation]}
        className="mySwiper w-full h-full max-w-screen-xl max-h-screen-xl"
      >
        {filteredContents.map((content) => (
          <SwiperSlide key={content.id} className="flex flex-col items-center justify-center p-4">
            {content.type === "image" && content.content && (
              <>
                {content.title && (
                  <h3 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 text-yellow-300 text-outline-black text-center">
                    {content.title}
                  </h3>
                )}
                <img
                  src={content.content}
                  alt={content.title || "Screensaver Image"}
                  className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-lg"
                />
              </>
            )}
            {content.type === "financial_summary" && (
              <div className="w-full max-w-4xl bg-gray-800 bg-opacity-70 p-8 rounded-xl shadow-2xl text-center">
                <h3 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 text-yellow-300 text-outline-black">
                  {content.title || "Informasi Keuangan Masjid"}
                </h3>
                <p className="text-6xl md:text-7xl lg:text-8xl font-bold text-green-400 mb-8 text-outline-black">
                  Saldo Kas: Rp {totalBalance.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
                {recentRecords.length > 0 && (
                  <>
                    <h4 className="text-3xl md:text-4xl lg:text-5xl font-bold mt-8 mb-4 text-blue-300 text-outline-black">
                      Transaksi Terbaru
                    </h4>
                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                      <div className="space-y-4">
                        {recentRecords.slice(0, 5).map((record) => (
                          <div key={record.id} className="flex flex-col items-start bg-gray-700 p-4 rounded-md shadow-sm text-left">
                            <p className="font-medium text-2xl md:text-3xl text-blue-200">
                              {record.description}
                            </p>
                            <p className={`text-xl md:text-2xl font-semibold ${record.transaction_type === "inflow" ? "text-green-400" : "text-red-400"}`}>
                              {record.transaction_type === "inflow" ? "Pemasukan" : "Pengeluaran"}: Rp {record.amount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                            <p className="text-base text-gray-400">
                              {format(new Date(record.created_at), "dd MMMM yyyy, HH:mm", { locale: id })}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            {content.type === "jumuah_schedule" && jumuahSchedule && (
              <div className="w-full max-w-4xl bg-gray-800 bg-opacity-70 p-8 rounded-xl shadow-2xl text-center">
                <h3 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 text-green-300 text-outline-black">
                  {content.title || "Jadwal Sholat Jum'at"}
                </h3>
                <p className="text-4xl md:text-5xl lg:text-6xl text-blue-200 mb-4">
                  Imam: <span className="font-semibold">{jumuahSchedule.imam_name}</span>
                </p>
                {jumuahSchedule.khatib_name && (
                  <p className="text-3xl md:text-4xl lg:text-5xl text-gray-300 mt-2">
                    Khatib: <span className="font-medium">{jumuahSchedule.khatib_name}</span>
                  </p>
                )}
                {jumuahSchedule.bilal_name && (
                  <p className="text-3xl md:text-4xl lg:text-5xl text-gray-300 mt-2">
                    Bilal: <span className="font-medium">{jumuahSchedule.bilal_name}</span>
                  </p>
                )}
                {jumuahSchedule.muezzin_name && (
                  <p className="text-3xl md:text-4xl lg:text-5xl text-gray-300 mt-2">
                    Muadzin: <span className="font-medium">{jumuahSchedule.muezzin_name}</span>
                  </p>
                )}
                <p className="text-2xl md:text-3xl lg:text-4xl text-yellow-300 mt-8 text-outline-black">
                  Jangan lupa datang lebih awal untuk sholat sunnah dan mendengarkan khutbah.
                </p>
              </div>
            )}
          </SwiperSlide>
        ))}
      </Swiper>
      <p className="text-xl md:text-2xl lg:text-3xl text-gray-400 mt-4">
        Sentuh layar atau tekan tombol apa saja untuk melanjutkan.
      </p>
    </div>
  );
};

export default Screensaver;