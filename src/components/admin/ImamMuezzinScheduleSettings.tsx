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

interface Schedule {
  id: string;
  day_of_week: string;
  prayer_name: string;
  imam_name: string;
  muezzin_name?: string | null;
  khatib_name?: string | null; // New field
  bilal_name?: string | null;  // New field
  display_order: number;
}

const scheduleFormSchema = z.object({
  id: z.string().optional(),
  day_of_week: z.string().min(1, "Hari tidak boleh kosong."),
  prayer_name: z.string().min(1, "Nama sholat tidak boleh kosong."),
  imam_name: z.string().min(1, "Nama imam tidak boleh kosong."),
  muezzin_name: z.string().nullable().optional(),
  khatib_name: z.string().nullable().optional(), // New field
  bilal_name: z.string().nullable().optional(),  // New field
  display_order: z.coerce.number().int().min(0, "Urutan tampilan harus non-negatif.").default(0),
});

type ScheduleFormValues = z.infer<typeof scheduleFormSchema>;

const DAYS_OF_WEEK = [
  { value: "Ahad", label: "Ahad" }, // Changed Minggu to Ahad
  { value: "Senin", label: "Senin" },
  { value: "Selasa", label: "Selasa" },
  { value: "Rabu", label: "Rabu" },
  { value: "Kamis", label: "Kamis" },
  { value: "Jumat", label: "Jumat" },
  { value: "Sabtu", label: "Sabtu" },
];

const PRAYER_NAMES = [
  { value: "Subuh", label: "Subuh" },
  { value: "Dzuhur", label: "Dzuhur" },
  { value: "Ashar", label: "Ashar" },
  { value: "Maghrib", label: "Maghrib" },
  { value: "Isya", label: "Isya" },
  { value: "Jumat", label: "Jumat" },
  { value: "Tarawih", label: "Tarawih" }, // Added Tarawih
  { value: "Idul Fitri", label: "Idul Fitri" },
  { value: "Idul Adha", label: "Idul Adha" },
];

const ImamMuezzinScheduleSettings: React.FC = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: {
      day_of_week: "",
      prayer_name: "",
      imam_name: "",
      muezzin_name: "",
      khatib_name: "", // Initialize new fields
      bilal_name: "",  // Initialize new fields
      display_order: 0,
    },
  });

  const { handleSubmit, register, setValue, watch, reset, formState: { isSubmitting, errors } } = form;
  const selectedPrayerName = watch("prayer_name"); // Watch for prayer_name changes

  const fetchSchedules = useCallback(async () => {
    const { data, error } = await supabase
      .from("imam_muezzin_schedules")
      .select("*")
      .order("display_order", { ascending: true })
      .order("day_of_week", { ascending: true })
      .order("prayer_name", { ascending: true });

    if (error) {
      console.error("Error fetching schedules:", error);
      toast.error("Gagal memuat jadwal imam & muadzin.");
    } else {
      setSchedules(data || []);
    }
  }, []);

  useEffect(() => {
    fetchSchedules(); // Initial fetch on mount

    // Setup Realtime Channel
    const channel = supabase
      .channel('imam_muezzin_schedules_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'imam_muezzin_schedules' }, (payload) => {
        console.log('Schedule change received!', payload);
        fetchSchedules(); // Re-fetch all schedules on any change
      })
      .subscribe();
    console.log("ImamMuezzinScheduleSettings: Subscribed to channel 'imam_muezzin_schedules_changes'.");

    // Cleanup function
    return () => {
      supabase.removeChannel(channel);
      console.log("ImamMuezzinScheduleSettings: Unsubscribed from channel 'imam_muezzin_schedules_changes'.");
    };
  }, [fetchSchedules]);

  const handleAddSchedule = () => {
    setEditingSchedule(null);
    reset({ day_of_week: "", prayer_name: "", imam_name: "", muezzin_name: "", khatib_name: "", bilal_name: "", display_order: 0 });
    setIsDialogOpen(true);
  };

  const handleEditSchedule = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    reset({
      id: schedule.id,
      day_of_week: schedule.day_of_week,
      prayer_name: schedule.prayer_name,
      imam_name: schedule.imam_name,
      muezzin_name: schedule.muezzin_name || "",
      khatib_name: schedule.khatib_name || "", // Set new fields for editing
      bilal_name: schedule.bilal_name || "",    // Set new fields for editing
      display_order: schedule.display_order,
    });
    setIsDialogOpen(true);
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus jadwal ini?")) {
      return;
    }
    const { error } = await supabase
      .from("imam_muezzin_schedules")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting schedule:", error);
      toast.error("Gagal menghapus jadwal.");
    } else {
      toast.success("Jadwal berhasil dihapus!");
      fetchSchedules(); // Re-fetch to update list
    }
  };

  const onSubmit = async (values: ScheduleFormValues) => {
    const payload = {
      day_of_week: values.day_of_week,
      prayer_name: values.prayer_name,
      imam_name: values.imam_name,
      muezzin_name: values.muezzin_name || null,
      khatib_name: values.prayer_name === "Jumat" ? (values.khatib_name || null) : null, // Only save if Jumat
      bilal_name: values.prayer_name === "Jumat" ? (values.bilal_name || null) : null,   // Only save if Jumat
      display_order: values.display_order,
    };

    if (editingSchedule) {
      // Update existing schedule
      const { error } = await supabase
        .from("imam_muezzin_schedules")
        .update(payload)
        .eq("id", editingSchedule.id);

      if (error) {
        console.error("Error updating schedule:", error);
        toast.error("Gagal memperbarui jadwal.");
      } else {
        toast.success("Jadwal berhasil diperbarui!");
        setIsDialogOpen(false);
        fetchSchedules(); // Re-fetch to update list
      }
    } else {
      // Add new schedule
      const { error } = await supabase
        .from("imam_muezzin_schedules")
        .insert(payload);

      if (error) {
        console.error("Error adding schedule:", error);
        toast.error("Gagal menambahkan jadwal.");
      } else {
        toast.success("Jadwal berhasil ditambahkan!");
        setIsDialogOpen(false);
        fetchSchedules(); // Re-fetch to update list
      }
    }
  };

  return (
    <Card className="bg-gray-800 text-white border-gray-700 col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-blue-300">Pengaturan Jadwal Imam & Muadzin</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-400 mb-4">Kelola jadwal imam dan muadzin untuk sholat fardhu, Jumat, dan Tarawih.</p>
        <Button onClick={handleAddSchedule} className="w-full bg-green-600 hover:bg-green-700 text-white mb-4">
          <PlusCircle className="mr-2 h-4 w-4" /> Tambah Jadwal Baru
        </Button>

        <div className="space-y-3">
          {schedules.length === 0 ? (
            <p className="text-gray-400 text-center">Belum ada jadwal. Tambahkan yang pertama!</p>
          ) : (
            schedules.map((schedule) => (
              <div key={schedule.id} className="flex items-center justify-between bg-gray-700 p-3 rounded-md shadow-sm">
                <div>
                  <p className="font-medium text-lg text-blue-200">
                    {schedule.day_of_week} - {schedule.prayer_name}
                  </p>
                  <p className="text-sm text-gray-300">Imam: {schedule.imam_name}</p>
                  {schedule.muezzin_name && (
                    <p className="text-xs text-gray-400">Muadzin: {schedule.muezzin_name}</p>
                  )}
                  {schedule.khatib_name && (
                    <p className="text-xs text-gray-400">Khatib: {schedule.khatib_name}</p>
                  )}
                  {schedule.bilal_name && (
                    <p className="text-xs text-gray-400">Bilal: {schedule.bilal_name}</p>
                  )}
                  <p className="text-xs text-gray-400">Urutan: {schedule.display_order}</p>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="icon" onClick={() => handleEditSchedule(schedule)} className="text-blue-400 border-blue-400 hover:bg-blue-400 hover:text-white">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleDeleteSchedule(schedule.id)} className="text-red-400 border-red-400 hover:bg-red-400 hover:text-white">
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
              <DialogTitle className="text-blue-300">{editingSchedule ? "Edit Jadwal" : "Tambah Jadwal Baru"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="day_of_week" className="text-gray-300">Hari</Label>
                <Select
                  onValueChange={(value) => setValue("day_of_week", value)}
                  defaultValue={form.getValues("day_of_week")}
                >
                  <SelectTrigger className="w-full bg-gray-700 border-gray-600 text-white mt-1">
                    <SelectValue placeholder="Pilih Hari" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 text-white border-gray-600">
                    {DAYS_OF_WEEK.map((day) => (
                      <SelectItem key={day.value} value={day.value}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.day_of_week && <p className="text-red-400 text-sm mt-1">{errors.day_of_week.message}</p>}
              </div>

              <div>
                <Label htmlFor="prayer_name" className="text-gray-300">Nama Sholat</Label>
                <Select
                  onValueChange={(value) => setValue("prayer_name", value)}
                  defaultValue={form.getValues("prayer_name")}
                >
                  <SelectTrigger className="w-full bg-gray-700 border-gray-600 text-white mt-1">
                    <SelectValue placeholder="Pilih Nama Sholat" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 text-white border-gray-600">
                    {PRAYER_NAMES.map((prayer) => (
                      <SelectItem key={prayer.value} value={prayer.value}>
                        {prayer.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.prayer_name && <p className="text-red-400 text-sm mt-1">{errors.prayer_name.message}</p>}
              </div>

              <div>
                <Label htmlFor="imam_name" className="text-gray-300">Nama Imam</Label>
                <Input
                  id="imam_name"
                  {...register("imam_name")}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                  placeholder="Nama Imam"
                />
                {errors.imam_name && <p className="text-red-400 text-sm mt-1">{errors.imam_name.message}</p>}
              </div>

              <div>
                <Label htmlFor="muezzin_name" className="text-gray-300">Nama Muadzin (Opsional)</Label>
                <Input
                  id="muezzin_name"
                  {...register("muezzin_name")}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                  placeholder="Nama Muadzin"
                />
                {errors.muezzin_name && <p className="text-red-400 text-sm mt-1">{errors.muezzin_name.message}</p>}
              </div>

              {selectedPrayerName === "Jumat" && ( // Conditional fields for Jumat
                <>
                  <div>
                    <Label htmlFor="khatib_name" className="text-gray-300">Nama Khatib (Opsional)</Label>
                    <Input
                      id="khatib_name"
                      {...register("khatib_name")}
                      className="bg-gray-700 border-gray-600 text-white mt-1"
                      placeholder="Nama Khatib"
                    />
                    {errors.khatib_name && <p className="text-red-400 text-sm mt-1">{errors.khatib_name.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="bilal_name" className="text-gray-300">Nama Bilal (Opsional)</Label>
                    <Input
                      id="bilal_name"
                      {...register("bilal_name")}
                      className="bg-gray-700 border-gray-600 text-white mt-1"
                      placeholder="Nama Bilal"
                    />
                    {errors.bilal_name && <p className="text-red-400 text-sm mt-1">{errors.bilal_name.message}</p>}
                  </div>
                </>
              )}
              {selectedPrayerName === "Tarawih" && ( // Keep Tarawih specific fields if any
                <>
                  {/* Add Tarawih specific fields here if needed, e.g., for a different Khatib/Bilal for Tarawih */}
                </>
              )}

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
                  {isSubmitting ? "Menyimpan..." : (editingSchedule ? "Simpan Perubahan" : "Tambah Jadwal")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default ImamMuezzinScheduleSettings;