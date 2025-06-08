import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Trash2, Edit, PlusCircle, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface IslamicHoliday {
  id: string;
  name: string;
  holiday_date: string; // YYYY-MM-DD format
  display_order: number;
}

const holidayFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Nama hari besar tidak boleh kosong.").max(100, "Nama terlalu panjang."),
  holiday_date: z.string().min(1, "Tanggal hari besar tidak boleh kosong."),
  display_order: z.coerce.number().int().min(0, "Urutan tampilan harus non-negatif.").default(0),
});

type HolidayFormValues = z.infer<typeof holidayFormSchema>;

const IslamicHolidaySettings: React.FC = () => {
  const [holidays, setHolidays] = useState<IslamicHoliday[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<IslamicHoliday | null>(null);

  const form = useForm<HolidayFormValues>({
    resolver: zodResolver(holidayFormSchema),
    defaultValues: {
      name: "",
      holiday_date: "",
      display_order: 0,
    },
  });

  const { handleSubmit, register, setValue, watch, reset, formState: { isSubmitting, errors } } = form;
  const holidayDate = watch("holiday_date");

  const fetchHolidays = useCallback(async () => {
    const { data, error } = await supabase
      .from("islamic_holidays")
      .select("*")
      .order("holiday_date", { ascending: true })
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching Islamic holidays:", error);
      toast.error("Gagal memuat hari besar Islam.");
    } else {
      setHolidays(data || []);
    }
  }, []);

  useEffect(() => {
    fetchHolidays();

    const channel = supabase
      .channel('islamic_holidays_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'islamic_holidays' }, (payload) => {
        console.log('Islamic holiday change received!', payload);
        fetchHolidays(); // Re-fetch all holidays on any change
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchHolidays]);

  const handleAddHoliday = () => {
    setEditingHoliday(null);
    reset({ name: "", holiday_date: "", display_order: 0 });
    setIsDialogOpen(true);
  };

  const handleEditHoliday = (holiday: IslamicHoliday) => {
    setEditingHoliday(holiday);
    reset({
      id: holiday.id,
      name: holiday.name,
      holiday_date: holiday.holiday_date,
      display_order: holiday.display_order,
    });
    setIsDialogOpen(true);
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus hari besar ini?")) {
      return;
    }
    const { error } = await supabase
      .from("islamic_holidays")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting holiday:", error);
      toast.error("Gagal menghapus hari besar.");
    } else {
      toast.success("Hari besar berhasil dihapus!");
      fetchHolidays(); // Re-fetch to update list
    }
  };

  const onSubmit = async (values: HolidayFormValues) => {
    const payload = {
      name: values.name,
      holiday_date: values.holiday_date,
      display_order: values.display_order,
    };

    if (editingHoliday) {
      // Update existing holiday
      const { error } = await supabase
        .from("islamic_holidays")
        .update(payload)
        .eq("id", editingHoliday.id);

      if (error) {
        console.error("Error updating holiday:", error);
        toast.error("Gagal memperbarui hari besar.");
      } else {
        toast.success("Hari besar berhasil diperbarui!");
        setIsDialogOpen(false);
        fetchHolidays(); // Re-fetch to update list
      }
    } else {
      // Add new holiday
      const { error } = await supabase
        .from("islamic_holidays")
        .insert(payload);

      if (error) {
        console.error("Error adding holiday:", error);
        toast.error("Gagal menambahkan hari besar.");
      } else {
        toast.success("Hari besar berhasil ditambahkan!");
        setIsDialogOpen(false);
        fetchHolidays(); // Re-fetch to update list
      }
    }
  };

  return (
    <Card className="bg-gray-800 text-white border-gray-700 col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-blue-300">Pengaturan Hari Besar Islam</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-400 mb-4">Kelola daftar hari besar Islam yang akan ditampilkan dengan hitung mundur.</p>
        <Button onClick={handleAddHoliday} className="w-full bg-green-600 hover:bg-green-700 text-white mb-4">
          <PlusCircle className="mr-2 h-4 w-4" /> Tambah Hari Besar
        </Button>

        <div className="space-y-3">
          {holidays.length === 0 ? (
            <p className="text-gray-400 text-center">Belum ada hari besar Islam yang tercatat.</p>
          ) : (
            holidays.map((holiday) => (
              <div key={holiday.id} className="flex items-center justify-between bg-gray-700 p-3 rounded-md shadow-sm">
                <div>
                  <p className="font-medium text-lg text-blue-200">{holiday.name}</p>
                  <p className="text-sm text-gray-300">
                    Tanggal: {format(new Date(holiday.holiday_date), "dd MMMM yyyy", { locale: id })}
                  </p>
                  <p className="text-xs text-gray-400">Urutan: {holiday.display_order}</p>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="icon" onClick={() => handleEditHoliday(holiday)} className="text-blue-400 border-blue-400 hover:bg-blue-400 hover:text-white">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleDeleteHoliday(holiday.id)} className="text-red-400 border-red-400 hover:bg-red-400 hover:text-white">
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
              <DialogTitle className="text-blue-300">{editingHoliday ? "Edit Hari Besar Islam" : "Tambah Hari Besar Islam Baru"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-gray-300">Nama Hari Besar</Label>
                <Input
                  id="name"
                  {...register("name")}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                  placeholder="Contoh: Idul Fitri 1445 H"
                />
                {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <Label htmlFor="holiday_date" className="text-gray-300 block mb-1">Tanggal Hari Besar</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal bg-gray-700 border-gray-600 text-white",
                        !holidayDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {holidayDate ? format(new Date(holidayDate), "PPP", { locale: id }) : <span>Pilih tanggal</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-gray-700 border-gray-600 text-white">
                    <Calendar
                      mode="single"
                      selected={holidayDate ? new Date(holidayDate) : undefined}
                      onSelect={(date) => setValue("holiday_date", date ? format(date, "yyyy-MM-dd") : "")}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {errors.holiday_date && <p className="text-red-400 text-sm mt-1">{errors.holiday_date.message}</p>}
              </div>

              <div>
                <Label htmlFor="display_order" className="text-gray-300">Urutan Tampilan</Label>
                <Input
                  id="display_order"
                  type="number"
                  {...register("display_order")}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
                {errors.display_order && <p className="text-red-400 text-sm mt-1">{errors.display_order.message}</p>}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="text-gray-300 border-gray-600 hover:bg-gray-700">
                  Batal
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {isSubmitting ? "Menyimpan..." : (editingHoliday ? "Simpan Perubahan" : "Tambah Hari Besar")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default IslamicHolidaySettings;