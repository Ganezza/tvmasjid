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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFridayDate, setLastFridayDate] = useState<string>(""); // State untuk tanggal Jumat terakhir

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
        // Calculate balance from ALL records
        const balance = (data || []).reduce((sum, record) => {
          return record.transaction_type === "inflow" ? sum + record.amount : sum - record.amount;
        }, 0);
        setTotalBalance(balance);
        setRecentRecords(data || []); // Set all fetched records as recent
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

    // Calculate the most recent Friday (inclusive of today if it's Friday)
    const today = dayjs();
    const currentDayIndex = today.day(); // 0 for Sunday, 1 for Monday, ..., 5 for Friday, 6 for Saturday

    // If today is Friday (5) or Saturday (6), we want the Friday of the current week.
    // If today is Sunday (0) to Thursday (4), we want the Friday of the previous week.
    const lastFriday = today.day(currentDayIndex >= 5 ? 5 : 5 - 7);
    setLastFridayDate(format(lastFriday.toDate(), "EEEE, dd MMMM yyyy", { locale: id }));

    // Set up real-time listener for financial_records changes
    const channel = supabase
      .channel('financial_records_changes_display')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_records' }, (payload) => {
        console.log('Financial record change received for display!', payload);
        fetchFinancialSummary(); // Re-fetch all records on any change
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
      <h3 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-3 text-yellow-300">
        Informasi Keuangan Masjid
      </h3>
      <p className="text-5xl md:text-6xl lg:text-7xl font-bold text-green-400 mb-2">
        Saldo Kas: Rp {totalBalance.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </p>
      <p className="text-xl md:text-2xl lg:text-3xl text-gray-300 mb-4">
        Data per: <span className="font-semibold">{lastFridayDate}</span>
      </p>

      <h4 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 text-blue-300">
        Rincian Transaksi Terbaru
      </h4>
      {recentRecords.length === 0 ? (
        <p className="text-gray-400 text-xl md:text-2xl">Belum ada transaksi yang tercatat.</p>
      ) : (
        <AutoScrollingFinancialRecords heightClass="h-48 md:h-64">
          <div className="space-y-3">
            {recentRecords.map((record) => (
              <div key={record.id} className="flex flex-col items-start bg-gray-700 p-3 rounded-md shadow-sm text-left">
                <p className="font-medium text-2xl md:text-3xl text-blue-200">
                  {record.description}
                </p>
                <p className={`text-xl md:text-2xl font-semibold ${record.transaction_type === "inflow" ? "text-green-400" : "text-red-400"}`}>
                  {record.transaction_type === "inflow" ? "Pemasukan" : "Pengeluaran"}: Rp {record.amount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
                <p className="text-sm text-gray-400">
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