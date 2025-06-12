import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import dayjs from "dayjs";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import AutoScrollingFinancialRecords from "@/components/AutoScrollingFinancialRecords";

interface FinancialRecord {
  id: string;
  created_at: string;
  transaction_type: "inflow" | "outflow";
  amount: number;
  description: string;
}

const FinancialDisplay: React.FC = React.memo(() => {
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [recentRecords, setRecentRecords] = useState<FinancialRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFridayDate, setLastFridayDate] = useState<string>("");
  const viewportRef = useRef<HTMLDivElement>(null); // Create a ref for the viewport

  const fetchFinancialSummary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("financial_records")
        .select("id, created_at, transaction_type, amount, description")
        .order("created_at", { ascending: true }); // Changed to ascending: true

      if (fetchError) {
        console.error("Error fetching financial records for display:", fetchError);
        setError("Gagal memuat ringkasan keuangan.");
        toast.error("Gagal memuat ringkasan keuangan.");
      } else {
        const balance = (data || []).reduce((sum, record) => {
          return record.transaction_type === "inflow" ? sum + record.amount : sum - record.amount;
        }, 0);
        setTotalBalance(balance);
        setRecentRecords(data || []);
      }
    } catch (err) {
      console.error("Unexpected error fetching financial summary:", err);
      setError("Terjadi kesalahan saat memuat ringkasan keuangan.");
      toast.error("Terjadi kesalahan saat memuat ringkasan keuangan.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFinancialSummary();

    const today = dayjs();
    const currentDayIndex = today.day();

    const lastFriday = today.day(currentDayIndex >= 5 ? 5 : 5 - 7);
    setLastFridayDate(format(lastFriday.toDate(), "EEEE, dd MMMM yyyy", { locale: id }).replace('Minggu', 'Ahad'));

    const channel = supabase
      .channel('financial_records_changes_display')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_records' }, (payload) => {
        console.log('Financial record change received for display!', payload);
        fetchFinancialSummary();
      })
      .subscribe();
    console.log("FinancialDisplay: Subscribed to channel 'financial_records_changes_display'.");

    return () => {
      supabase.removeChannel(channel);
      console.log("FinancialDisplay: Unsubscribed from channel 'financial_records_changes_display'.");
    };
  }, [fetchFinancialSummary]);

  if (isLoading) {
    return (
      <div className="bg-gray-800 bg-opacity-70 p-2 rounded-xl shadow-2xl w-full text-center text-white flex-grow flex flex-col">
        <p className="text-sm">Memuat informasi keuangan...</p>
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

  return (
    <div className="bg-gray-800 bg-opacity-70 p-2 rounded-xl shadow-2xl w-full text-center flex-grow flex flex-col">
      <h3 className="text-xl md:text-2xl lg:text-3xl font-bold mb-0.5 text-yellow-300">
        Informasi Keuangan Masjid
      </h3>
      <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-green-400 mb-0.5">
        Saldo Kas: Rp {totalBalance.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </p>
      <p className="text-xs md:text-sm lg:text-base text-gray-300 mb-1.5">
        Data per: <span className="font-semibold">{format(new Date(), "EEEE, dd MMMM yyyy", { locale: id }).replace('Minggu', 'Ahad')}</span>
      </p>

      <h4 className="text-lg md:text-xl lg:text-2xl font-bold mb-1 text-blue-300">
        Rincian Transaksi Terbaru
      </h4>
      {recentRecords.length === 0 ? (
        <p className="text-sm md:text-base text-gray-400">Belum ada transaksi yang tercatat.</p>
      ) : (
        <AutoScrollingFinancialRecords heightClass="max-h-48 lg:max-h-64" viewportRef={viewportRef}>
          <div className="space-y-1">
            {recentRecords.map((record) => (
              <div key={record.id} className="flex flex-col items-start bg-gray-700 p-1 rounded-md shadow-sm text-left">
                <p className="font-medium text-base md:text-lg text-blue-200"> {/* Increased font size */}
                  {record.description}
                </p>
                <p className={`text-sm md:text-base font-semibold ${record.transaction_type === "inflow" ? "text-green-400" : "text-red-400"}`}> {/* Increased font size */}
                  {record.transaction_type === "inflow" ? "Pemasukan" : "Pengeluaran"}: Rp {record.amount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs md:text-sm text-gray-400"> {/* Increased font size */}
                  {format(new Date(record.created_at), "dd MMMM yyyy, HH:mm", { locale: id })}
                </p>
              </div>
            ))}
          </div>
        </AutoScrollingFinancialRecords>
      )}
    </div>
  );
});

export default FinancialDisplay;