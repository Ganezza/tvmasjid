import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Trash2, Edit, PlusCircle } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface FinancialRecord {
  id: string;
  created_at: string;
  transaction_type: "inflow" | "outflow";
  amount: number;
  description: string;
}

const financialRecordFormSchema = z.object({
  id: z.string().optional(),
  transaction_type: z.enum(["inflow", "outflow"], { message: "Tipe transaksi tidak valid." }),
  amount: z.coerce.number().min(0.01, "Jumlah harus lebih besar dari 0."),
  description: z.string().min(1, "Deskripsi tidak boleh kosong.").max(255, "Deskripsi terlalu panjang."),
});

type FinancialRecordFormValues = z.infer<typeof financialRecordFormSchema>;

const TRANSACTION_TYPES = [
  { value: "inflow", label: "Pemasukan" },
  { value: "outflow", label: "Pengeluaran" },
];

const FinancialSettings: React.FC = () => {
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FinancialRecord | null>(null);

  const form = useForm<FinancialRecordFormValues>({
    resolver: zodResolver(financialRecordFormSchema),
    defaultValues: {
      transaction_type: "inflow",
      amount: 0,
      description: "",
    },
  });

  const { handleSubmit, register, setValue, reset, formState: { isSubmitting, errors } } = form;

  const fetchRecords = useCallback(async () => {
    const { data, error } = await supabase
      .from("financial_records")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching financial records:", error);
      toast.error("Gagal memuat catatan keuangan.");
    } else {
      setRecords(data || []);
      const balance = (data || []).reduce((sum, record) => {
        return record.transaction_type === "inflow" ? sum + record.amount : sum - record.amount;
      }, 0);
      setTotalBalance(balance);
    }
  }, []);

  useEffect(() => {
    fetchRecords();

    const channel = supabase
      .channel('financial_records_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_records' }, (payload) => {
        console.log('Financial record change received!', payload);
        fetchRecords(); // Re-fetch all records on any change
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRecords]);

  const handleAddRecord = () => {
    setEditingRecord(null);
    reset({ transaction_type: "inflow", amount: 0, description: "" });
    setIsDialogOpen(true);
  };

  const handleEditRecord = (record: FinancialRecord) => {
    setEditingRecord(record);
    reset({
      id: record.id,
      transaction_type: record.transaction_type,
      amount: record.amount,
      description: record.description,
    });
    setIsDialogOpen(true);
  };

  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus catatan ini?")) {
      return;
    }
    const { error } = await supabase
      .from("financial_records")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting record:", error);
      toast.error("Gagal menghapus catatan keuangan.");
    } else {
      toast.success("Catatan keuangan berhasil dihapus!");
      fetchRecords(); // Re-fetch to update list and balance
    }
  };

  const onSubmit = async (values: FinancialRecordFormValues) => {
    const payload = {
      transaction_type: values.transaction_type,
      amount: values.amount,
      description: values.description,
    };

    if (editingRecord) {
      // Update existing record
      const { error } = await supabase
        .from("financial_records")
        .update(payload)
        .eq("id", editingRecord.id);

      if (error) {
        console.error("Error updating record:", error);
        toast.error("Gagal memperbarui catatan keuangan.");
      } else {
        toast.success("Catatan keuangan berhasil diperbarui!");
        setIsDialogOpen(false);
        fetchRecords(); // Re-fetch to update list and balance
      }
    } else {
      // Add new record
      const { error } = await supabase
        .from("financial_records")
        .insert(payload);

      if (error) {
        console.error("Error adding record:", error);
        toast.error("Gagal menambahkan catatan keuangan.");
      } else {
        toast.success("Catatan keuangan berhasil ditambahkan!");
        setIsDialogOpen(false);
        fetchRecords(); // Re-fetch to update list and balance
      }
    }
  };

  return (
    <Card className="bg-gray-800 text-white border-gray-700 col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-blue-300">Informasi Keuangan</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-400 mb-4">Kelola catatan pemasukan dan pengeluaran masjid.</p>
        
        <div className="mb-6 p-4 bg-gray-700 rounded-md shadow-inner">
          <h3 className="text-xl font-semibold text-yellow-300">Saldo Saat Ini:</h3>
          <p className="text-4xl font-bold text-green-400">
            Rp {totalBalance.toLocaleString('id-ID')}
          </p>
        </div>

        <Button onClick={handleAddRecord} className="w-full bg-green-600 hover:bg-green-700 text-white mb-4">
          <PlusCircle className="mr-2 h-4 w-4" /> Tambah Transaksi Baru
        </Button>

        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
          {records.length === 0 ? (
            <p className="text-gray-400 text-center">Belum ada catatan keuangan. Tambahkan yang pertama!</p>
          ) : (
            records.map((record) => (
              <div key={record.id} className="flex items-center justify-between bg-gray-700 p-3 rounded-md shadow-sm">
                <div>
                  <p className="font-medium text-lg text-blue-200">
                    {record.description}
                  </p>
                  <p className={`text-sm font-semibold ${record.transaction_type === "inflow" ? "text-green-400" : "text-red-400"}`}>
                    {record.transaction_type === "inflow" ? "Pemasukan" : "Pengeluaran"}: Rp {record.amount.toLocaleString('id-ID')}
                  </p>
                  <p className="text-xs text-gray-400">
                    {format(new Date(record.created_at), "dd MMMM yyyy, HH:mm", { locale: id })}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="icon" onClick={() => handleEditRecord(record)} className="text-blue-400 border-blue-400 hover:bg-blue-400 hover:text-white">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleDeleteRecord(record.id)} className="text-red-400 border-red-400 hover:bg-red-400 hover:text-white">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-gray-800 text-white border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-blue-300">{editingRecord ? "Edit Catatan Keuangan" : "Tambah Transaksi Baru"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="transaction_type" className="text-gray-300">Tipe Transaksi</Label>
                <Select
                  onValueChange={(value: "inflow" | "outflow") => setValue("transaction_type", value)}
                  defaultValue={form.getValues("transaction_type")}
                >
                  <SelectTrigger className="w-full bg-gray-700 border-gray-600 text-white mt-1">
                    <SelectValue placeholder="Pilih Tipe" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 text-white border-gray-600">
                    {TRANSACTION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.transaction_type && <p className="text-red-400 text-sm mt-1">{errors.transaction_type.message}</p>}
              </div>

              <div>
                <Label htmlFor="amount" className="text-gray-300">Jumlah (Rp)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  {...register("amount")}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                  placeholder="Contoh: 150000"
                />
                {errors.amount && <p className="text-red-400 text-sm mt-1">{errors.amount.message}</p>}
              </div>

              <div>
                <Label htmlFor="description" className="text-gray-300">Deskripsi</Label>
                <Input
                  id="description"
                  {...register("description")}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                  placeholder="Contoh: Donasi hamba Allah"
                />
                {errors.description && <p className="text-red-400 text-sm mt-1">{errors.description.message}</p>}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="text-gray-300 border-gray-600 hover:bg-gray-700">
                  Batal
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {isSubmitting ? "Menyimpan..." : (editingRecord ? "Simpan Perubahan" : "Tambah Transaksi")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default FinancialSettings;