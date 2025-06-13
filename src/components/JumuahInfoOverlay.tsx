import React, { useState, useEffect, useCallback, useRef } from "react";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import isBetween from "dayjs/plugin/isBetween"; // Import isBetween plugin
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import AutoScrollingFinancialRecords from "@/components/AutoScrollingFinancialRecords";
import { cn } from "@/lib/utils";

dayjs.extend(duration);
dayjs.extend(isBetween); // Extend dayjs with isBetween plugin

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

interface FinancialRecord {
  id: string;
  created_at: string;
  transaction_type: "inflow" | "outflow";
  amount: number;
  description: string;
}

interface JumuahInfoOverlayProps {
  jumuahDhuhrTime: dayjs.Dayjs; // Exact Dhuhr time for Friday
  khutbahDurationMinutes: number;
  onClose: () => void;
}

const PRE_ADHAN_JUMUAH_SECONDS = 300; // 5 minutes before Adhan
const ADHAN_JUMUAH_DURATION_SECONDS = 90; // Approx 1.5 minutes for Adhan

const JumuahInfoOverlay: React.FC<JumuahInfoOverlayProps> = ({ jumuahDhuhrTime, khutbahDurationMinutes, onClose }) => {
  const [jumuahSchedule, setJumuahSchedule] = useState<Schedule | null>(null);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [recentRecords, setRecentRecords] = useState<FinancialRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [displayPhase, setDisplayPhase] = useState<"pre-adhan" | "adhan" | "khutbah" | "hidden">("hidden");
  const [countdownText, setCountdownText] = useState<string>("");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchJumuahInfo = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const today = dayjs();
      const currentDayOfWeek = "Jumat"; // Explicitly for Friday

      // Fetch Jumuah schedule
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("imam_muezzin_schedules")
        .select("*")
        .eq("day_of_week", currentDayOfWeek)
        .eq("prayer_name", "Jumat")
        .order("display_order", { ascending: true })
        .limit(1)
        .single();

      if (scheduleError && scheduleError.code !== 'PGRST116') {
        console.error("Error fetching Jumuah schedule:", scheduleError);
        setError("Gagal memuat jadwal Jumat.");
      } else if (scheduleData) {
        setJumuahSchedule(scheduleData);
      } else {
        setJumuahSchedule(null);
      }

      // Fetch financial records
      const { data: financialData, error: financialError } = await supabase
        .from("financial_records")
        .select("id, created_at, transaction_type, amount, description")
        .order("created_at", { ascending: false });

      if (financialError) {
        console.error("Error fetching financial records for Jumuah display:", financialError);
        setError("Gagal memuat catatan keuangan.");
      } else {
        const balance = (financialData || []).reduce((sum, record) => {
          return record.transaction_type === "inflow" ? sum + record.amount : sum - record.amount;
        }, 0);
        setTotalBalance(balance);
        setRecentRecords(financialData || []);
      }
    } catch (err) {
      console.error("Unexpected error in JumuahInfoOverlay:", err);
      setError("Terjadi kesalahan saat memuat informasi Jumat.");
      toast.error("Terjadi kesalahan saat memuat informasi Jumat.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJumuahInfo();

    const scheduleChannel = supabase
      .channel('jumuah_schedule_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'imam_muezzin_schedules' }, (payload) => {
        console.log('Jumuah schedule change received!', payload);
        fetchJumuahInfo();
      })
      .subscribe();

    const financialChannel = supabase
      .channel('jumuah_financial_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_records' }, (payload) => {
        console.log('Financial record change received for Jumuah display!', payload);
        fetchJumuahInfo();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(scheduleChannel);
      supabase.removeChannel(financialChannel);
    };
  }, [fetchJumuahInfo]);

  // Jumuah Countdown and Phase Logic
  useEffect(() => {
    if (!jumuahDhuhrTime) {
      setDisplayPhase("hidden");
      setCountdownText("");
      if (intervalRef.current) clearInterval(intervalRef.current);
      onClose();
      return;
    }

    const adhanTime = jumuahDhuhrTime;
    const preAdhanStartTime = adhanTime.subtract(PRE_ADHAN_JUMUAH_SECONDS, 'second');
    const adhanEndTime = adhanTime.add(ADHAN_JUMUAH_DURATION_SECONDS, 'second');
    const khutbahEndTime = adhanEndTime.add(khutbahDurationMinutes, 'minute');

    const updatePhaseAndCountdown = () => {
      const now = dayjs();

      if (now.isBefore(preAdhanStartTime)) {
        setDisplayPhase("hidden");
        setCountdownText("");
        return;
      }

      if (now.isBetween(preAdhanStartTime, adhanTime, null, '[)')) {
        setDisplayPhase("pre-adhan");
        const diff = adhanTime.diff(now);
        const durationRemaining = dayjs.duration(diff);
        setCountdownText(`${String(durationRemaining.minutes()).padStart(2, '0')}:${String(durationRemaining.seconds()).padStart(2, '0')}`);
      } else if (now.isBetween(adhanTime, adhanEndTime, null, '[)')) {
        setDisplayPhase("adhan");
        setCountdownText(""); // No countdown during adhan
      } else if (now.isBetween(adhanEndTime, khutbahEndTime, null, '[)')) {
        setDisplayPhase("khutbah");
        const diff = khutbahEndTime.diff(now);
        const durationRemaining = dayjs.duration(diff);
        setCountdownText(`${String(durationRemaining.minutes()).padStart(2, '0')}:${String(durationRemaining.seconds()).padStart(2, '0')}`);
      } else if (now.isAfter(khutbahEndTime)) {
        // After khutbah, hide the overlay
        setDisplayPhase("hidden");
        setCountdownText("");
        onClose(); // Notify parent to close
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }
    };

    // Clear any existing interval before setting a new one
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(updatePhaseAndCountdown, 1000);
    updatePhaseAndCountdown(); // Initial call

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [jumuahDhuhrTime, khutbahDurationMinutes, onClose]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 text-white">
        <p className="text-3xl">Memuat informasi Jumat...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-red-800 bg-opacity-90 flex flex-col items-center justify-center z-50 text-white p-8">
        <p className="text-3xl font-bold">Error:</p>
        <p className="text-2xl text-center">{error}</p>
      </div>
    );
  }

  if (displayPhase === "hidden") {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-50 text-white p-4 md:p-8">
      <div className="flex flex-col items-center justify-center w-full max-w-6xl h-full">
        <h2 className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-yellow-300 mb-6 text-outline-black">
          JUMAT MUBARAK
        </h2>

        {displayPhase === "pre-adhan" && (
          <>
            {jumuahSchedule ? (
              <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-2xl w-full max-w-4xl text-center mb-8">
                <h3 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-3 text-green-300">
                  Jadwal Sholat Jumat
                </h3>
                <p className="text-3xl md:text-4xl lg:text-5xl text-blue-200">
                  Imam: <span className="font-semibold">{jumuahSchedule.imam_name}</span>
                </p>
                {jumuahSchedule.khatib_name && (
                  <p className="text-2xl md:text-3xl lg:text-4xl text-gray-300 mt-1">
                    Khatib: <span className="font-medium">{jumuahSchedule.khatib_name}</span>
                  </p>
                )}
                {jumuahSchedule.bilal_name && (
                  <p className="text-2xl md:text-3xl lg:text-4xl text-gray-300 mt-1">
                    Bilal: <span className="font-medium">{jumuahSchedule.bilal_name}</span>
                  </p>
                )}
                {jumuahSchedule.muezzin_name && (
                  <p className="text-2xl md:text-3xl lg:text-4xl text-gray-300 mt-1">
                    Muadzin: <span className="font-medium">{jumuahSchedule.muezzin_name}</span>
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-2xl w-full max-w-4xl text-center mb-8">
                <p className="text-2xl text-gray-400">Jadwal Jumat tidak ditemukan.</p>
              </div>
            )}

            <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-2xl w-full max-w-4xl text-center mb-8">
              <h4 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 text-blue-300">
                Informasi Kas Masjid
              </h4>
              <p className="text-4xl md:text-5xl lg:text-6xl font-bold text-green-400 mb-2">
                Saldo: Rp {totalBalance.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              {recentRecords.length > 0 && (
                <>
                  <h4 className="text-2xl md:text-3xl lg:text-4xl font-bold mt-6 mb-3 text-yellow-300">
                    Transaksi Terbaru
                  </h4>
                  <AutoScrollingFinancialRecords heightClass="h-48 md:h-64">
                    <div className="space-y-3">
                      {recentRecords.map((record) => (
                        <div key={record.id} className="flex flex-col items-start bg-gray-700 p-3 rounded-md shadow-sm text-left">
                          <p className="font-medium text-xl md:text-2xl text-blue-200">
                            {record.description}
                          </p>
                          <p className={`text-lg md:text-xl font-semibold ${record.transaction_type === "inflow" ? "text-green-400" : "text-red-400"}`}>
                            {record.transaction_type === "inflow" ? "Pemasukan" : "Pengeluaran"}: Rp {record.amount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                          <p className="text-xs text-gray-400">
                            {format(new Date(record.created_at), "dd MMMM yyyy, HH:mm", { locale: id })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </AutoScrollingFinancialRecords>
                </>
              )}
            </div>
            <h5 className="text-4xl md:text-5xl lg:text-6xl font-bold text-red-400 text-outline-black">
              Menuju Adzan: {countdownText}
            </h5>
          </>
        )}

        {displayPhase === "adhan" && (
          <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-2xl w-full max-w-4xl text-center mb-8">
            <h3 className="text-6xl md:text-7xl lg:text-8xl font-bold text-red-400 text-outline-black">
              ADZAN JUMAT
            </h3>
          </div>
        )}

        {displayPhase === "khutbah" && (
          <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-2xl w-full max-w-4xl text-center mb-8">
            <h3 className="text-6xl md:text-7xl lg:text-8xl font-bold text-green-400 text-outline-black">
              KHUTBAH JUMAT
            </h3>
            {jumuahSchedule?.khatib_name ? (
              <p className="text-5xl md:text-6xl lg:text-7xl font-bold text-blue-400 mt-4 text-outline-black">
                Khatib: {jumuahSchedule.khatib_name}
              </p>
            ) : (
              <p className="text-5xl md:text-6xl lg:text-7xl font-bold text-blue-400 mt-4 text-outline-black">
                Khatib: (Belum Ditentukan)
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default JumuahInfoOverlay;