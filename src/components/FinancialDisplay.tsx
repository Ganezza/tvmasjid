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
  const [lastFridayDate, setLastFridayDate] = useState<string>("");

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
      <div className="bg-gray-800 bg-opacity-70 p-4 rounded-xl shadow-2xl w-full text-center text-white flex-grow flex flex-col"> {/* Reduced padding */}
        <p className="text-xl">Memuat informasi keuangan...</p> {/* Reduced font size */}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-800 bg-opacity-70 p-4 rounded-xl shadow-2xl w-full text-center text-white flex-grow flex flex-col"> {/* Reduced padding */}
        <p className="text-xl font-bold">Error:</p> {/* Reduced font size */}
        <p className="text-lg">{error}</p> {/* Reduced font size */}
      </div>
    );
  }

  return (
    <div className="bg-gray-800 bg-opacity-70 p-4 rounded-xl shadow-2xl w-full text-center flex-grow flex flex-col"> {/* Reduced padding */}
      <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-2 text-yellow-300"> {/* Reduced font size and margin */}
        Informasi Keuangan Masjid
      </h3>
      <p className="text-4xl md:text-5xl lg:text-6xl font-bold text-green-400 mb-1"> {/* Reduced font size and margin */}
        Saldo Kas: Rp {totalBalance.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </p>
      <p className="text-lg md:text-xl lg:text-2xl text-gray-300 mb-3"> {/* Reduced font size and margin */}
        Data per: <span className="font-semibold">{lastFridayDate}</span>
      </p>

      <h4 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 text-blue-300"> {/* Reduced font size and margin */}
        Rincian Transaksi Terbaru
      </h4>
      {recentRecords.length === 0 ? (
        <p className="text-lg md:text-xl text-gray-400">Belum ada transaksi yang tercatat.</p> {/* Reduced font size */}
      ) : (
        <AutoScrollingFinancialRecords>
          <div className="space-y-2"> {/* Reduced space-y */}
            {recentRecords.map((record) => (
              <div key={record.id} className="flex flex-col items-start bg-gray-700 p-2 rounded-md shadow-sm text-left"> {/* Reduced padding */}
                <p className="font-medium text-xl md:text-2xl text-blue-200"> {/* Reduced font size */}
                  {record.description}
                </p>
                <p className={`text-lg md:text-xl font-semibold ${record.transaction_type === "inflow" ? "text-green-400" : "text-red-400"}`}> {/* Reduced font size */}
                  {record.transaction_type === "inflow" ? "Pemasukan" : "Pengeluaran"}: Rp {record.amount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-gray-400"> {/* Reduced font size */}
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