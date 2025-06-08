import React, { useState, useEffect, useCallback } from "react";
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

const FinancialDisplay: React.FC = () => {
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [recentRecords, setRecentRecords] = useState<FinancialRecord[]>([]);
  const [lastFridayDate, setLastFridayDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFinancialSummary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("financial_records")
        .select("id, created_at, transaction_type, amount, description")
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Error fetching financial records for display:", fetchError);
        setError("Gagal memuat ringkasan keuangan.");
        toast.error("Gagal memuat ringkasan keuangan.");
      } else {
        // Hitung hari Jumat terakhir dari tanggal saat ini
        let friday = dayjs();
        // day() returns 0 for Sunday, 1 for Monday, ..., 5 for Friday, 6 for Saturday
        // Loop back until we find the most recent Friday (inclusive of today if today is Friday)
        while (friday.day() !== 5) { 
          friday = friday.subtract(1, 'day');
        }
        const lastFridayFormatted = format(friday.toDate(), "EEEE, dd MMMM yyyy", { locale: id });
        setLastFridayDate(lastFridayFormatted);

        // Filter records to only include those created on or before the last Friday
        const lastFridayEndOfDay = friday.endOf('day'); // Get the end of the day for the last Friday

        const filteredRecords = (data || []).filter(record => {
          const recordCreatedAt = dayjs(record.created_at);
          return recordCreatedAt.isSameOrBefore(lastFridayEndOfDay);
        });

        const balance = filteredRecords.reduce((sum, record) => {
          return record.transaction_type === "inflow" ? sum + record.amount : sum - record.amount;
        }, 0);
        setTotalBalance(balance);
        setRecentRecords(filteredRecords);
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

    // Set up real-time listener for financial_records changes
    const channel = supabase
      .channel('financial_display_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_records' }, (payload) => {
        console.log('Financial record change received for display!', payload);
        fetchFinancialSummary(); // Re-fetch if records change
      })
      .subscribe();

    // Add an interval to update the "last Friday" date daily, in case the app runs for a long time
    const dailyInterval = setInterval(() => {
      fetchFinancialSummary();
    }, 24 * 60 * 60 * 1000); // Update once every 24 hours

    return () => {
      supabase.removeChannel(channel);
      clearInterval(dailyInterval);
    };
  }, [fetchFinancialSummary]);

  if (isLoading) {
    return (
      <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-2xl w-11/12 max-w-4xl text-center mb-8 text-white">
        <p className="text-2xl">Memuat informasi keuangan...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-800 bg-opacity-70 p-6 rounded-xl shadow-2xl w-11/12 max-w-4xl text-center mb-8 text-white">
        <p className="text-2xl font-bold">Error:</p>
        <p className="text-xl">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-2xl w-11/12 max-w-4xl text-center mb-8">
      <h3 className="text-3xl md:text-4xl font-bold mb-3 text-yellow-300">
        Informasi Keuangan Masjid
      </h3>
      <p className="text-4xl md:text-5xl font-bold text-green-400 mb-2">
        Saldo Kas: Rp {totalBalance.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </p>
      {lastFridayDate && (
        <p className="text-xl md:text-2xl text-gray-300 mb-6">
          Data per {lastFridayDate}
        </p>
      )}

      <h4 className="text-2xl md:text-3xl font-bold mb-3 text-blue-300">
        Rincian Transaksi Terbaru
      </h4>
      {recentRecords.length === 0 ? (
        <p className="text-gray-400 text-lg">Belum ada transaksi yang tercatat hingga Jumat terakhir.</p>
      ) : (
        <AutoScrollingFinancialRecords heightClass="h-48 md:h-64">
          <div className="space-y-3">
            {recentRecords.map((record) => (
              <div key={record.id} className="flex flex-col items-start bg-gray-700 p-3 rounded-md shadow-sm text-left">
                <p className="font-medium text-lg text-blue-200">
                  {record.description}
                </p>
                <p className={`text-base font-semibold ${record.transaction_type === "inflow" ? "text-green-400" : "text-red-400"}`}>
                  {record.transaction_type === "inflow" ? "Pemasukan" : "Pengeluaran"}: Rp {record.amount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-gray-400">
                  {format(new Date(record.created_at), "dd MMMM yyyy, HH:mm", { locale: id })}
                </p>
              </div>
            ))}
          </div>
        </AutoScrollingFinancialRecords>
      )}
    </div>
  );
};

export default FinancialDisplay;