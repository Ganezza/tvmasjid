import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"; // Import DialogDescription
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Trash2, Edit, PlusCircle } from "lucide-react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface NotificationStudy {
  id: string;
  type: "notification" | "study" | "event";
  title: string;
  content: string;
  event_date?: string | null; // YYYY-MM-DD format
  event_time?: string | null; // HH:MM format
  display_order: number;
}

const notificationStudyFormSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["notification", "study", "event"], { message: "Tipe tidak valid." }),
  title: z.string().min(1, "Judul tidak boleh kosong.").max(100, "Judul terlalu panjang."),
  content: z.string().min(1, "Konten tidak boleh kosong."),
  event_date: z.string().nullable().optional(),
  event_time: z.string().nullable().optional(),
  display_order: z.coerce.number().int().min(0, "Urutan tampilan harus non-negatif.").default(0),
});

type NotificationStudyFormValues = z.infer<typeof notificationStudyFormSchema>;

const NOTIFICATION_STUDY_TYPES = [
  { value: "notification", label: "Pengumuman" },
  { value: "study", label: "Kajian" },
  { value: "event", label: "Acara Khusus" },
];

const NotificationStudySettings: React.FC = () => {
  const [items, setItems] = useState<NotificationStudy[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<NotificationStudy | null>(null);

  const form = useForm<NotificationStudyFormValues>({
    resolver: zodResolver(notificationStudyFormSchema),
    defaultValues: {
      type: "notification",
      title: "",
      content: "",
      event_date: null,
      event_time: null,
      display_order: 0,
    },
  });

  const { handleSubmit, register, setValue, watch, reset, formState: { isSubmitting, errors } } = form;
  const itemType = watch("type");
  const eventDate = watch("event_date");

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from("notifications_and_studies")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching notifications/studies:", error);
      toast.error("Gagal memuat notifikasi & kajian.");
    } else {
      setItems(data || []);
    }
  }, []);

  useEffect(() => {
    fetchItems(); // Initial fetch on mount

    // Setup Realtime Channel
    const channel = supabase
      .channel('notifications_and_studies_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications_and_studies' }, (payload) => {
        console.log('Notification/Study change received!', payload);
        fetchItems(); // Re-fetch all items on any change
      })
      .subscribe();
    console.log("NotificationStudySettings: Subscribed to channel 'notifications_and_studies_changes'.");

    // Cleanup function
    return () => {
      supabase.removeChannel(channel);
      console.log("NotificationStudySettings: Unsubscribed from channel 'notifications_and_studies_changes'.");
    };
  }, [fetchItems]);

  const handleAddItem = () => {
    setEditingItem(null);
    reset({ type: "notification", title: "", content: "", event_date: null, event_time: null, display_order: 0 });
    setIsDialogOpen(true);
  };

  const handleEditItem = (item: NotificationStudy) => {
    setEditingItem(item);
    reset({
      id: item.id,
      type: item.type,
      title: item.title,
      content: item.content,
      event_date: item.event_date || null,
      event_time: item.event_time || null,
      display_order: item.display_order,
    });
    setIsDialogOpen(true);
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus item ini?")) {
      return;
    }
    const { error } = await supabase
      .from("notifications_and_studies")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting item:", error);
      toast.error("Gagal menghapus item.");
    } else {
      toast.success("Item berhasil dihapus!");
      fetchItems(); // Re-fetch to update list
    }
  };

  const onSubmit = async (values: NotificationStudyFormValues) => {
    const payload = {
      type: values.type,
      title: values.title,
      content: values.content,
      event_date: values.event_date || null,
      event_time: values.event_time || null,
      display_order: values.display_order,
    };

    if (editingItem) {
      // Update existing item
      const { error } = await supabase
        .from("notifications_and_studies")
        .update(payload)
        .eq("id", editingItem.id);

      if (error) {
        console.error("Error updating item:", error);
        toast.error("Gagal memperbarui item.");
      } else {
        toast.success("Item berhasil diperbarui!");
        setIsDialogOpen(false);
        fetchItems(); // Re-fetch to update list
      }
    } else {
      // Add new item
      const { error } = await supabase
        .from("notifications_and_studies")
        .insert(payload);

      if (error) {
        console.error("Error adding item:", error);
        toast.error("Gagal menambahkan item.");
      } else {
        toast.success("Item berhasil ditambahkan!");
        setIsDialogOpen(false);
        fetchItems(); // Re-fetch to update list
      }
    }
  };

  return (
    <Card className="bg-gray-800 text-white border-gray-700 col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-blue-300">Pengaturan Notifikasi & Kajian</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-400 mb-4">Kelola pengumuman, jadwal kajian, dan acara khusus.</p>
        <Button onClick={handleAddItem} className="w-full bg-green-600 hover:bg-green-700 text-white mb-4">
          <PlusCircle className="mr-2 h-4 w-4" /> Tambah Item Baru
        </Button>

        <div className="space-y-3">
          {items.length === 0 ? (
            <p className="text-gray-400 text-center">Belum ada notifikasi atau kajian. Tambahkan yang pertama!</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-center justify-between bg-gray-700 p-3 rounded-md shadow-sm">
                <div>
                  <p className="font-medium text-lg text-blue-200">{item.title}</p>
                  <p className="text-sm text-gray-300 truncate max-w-xs">{item.content}</p>
                  <p className="text-xs text-gray-400">
                    Tipe: {item.type} | Urutan: {item.display_order}
                    {(item.event_date || item.event_time) && (
                      <span> | Jadwal: {item.event_date ? format(new Date(item.event_date), "dd/MM/yyyy") : ""} {item.event_time}</span>
                    )}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="icon" onClick={() => handleEditItem(item)} className="text-blue-400 border-blue-400 hover:bg-blue-400 hover:text-white">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleDeleteItem(item.id)} className="text-red-400 border-red-400 hover:bg-red-400 hover:text-white">
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
              <DialogTitle className="text-blue-300">{editingItem ? "Edit Item Notifikasi/Kajian" : "Tambah Item Baru"}</DialogTitle>
              <DialogDescription>
                {editingItem ? "Perbarui detail notifikasi, kajian, atau acara khusus ini." : "Isi detail untuk notifikasi, kajian, atau acara khusus baru."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="type" className="text-gray-300">Tipe</Label>
                <Select
                  onValueChange={(value: "notification" | "study" | "event") => setValue("type", value)}
                  defaultValue={form.getValues("type")}
                >
                  <SelectTrigger className="w-full bg-gray-700 border-gray-600 text-white mt-1">
                    <SelectValue placeholder="Pilih Tipe" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 text-white border-gray-600">
                    {NOTIFICATION_STUDY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.type && <p className="text-red-400 text-sm mt-1">{errors.type.message}</p>}
              </div>

              <div>
                <Label htmlFor="title" className="text-gray-300">Judul</Label>
                <Input
                  id="title"
                  {...register("title")}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                  placeholder="Judul notifikasi atau kajian"
                />
                {errors.title && <p className="text-red-400 text-sm mt-1">{errors.title.message}</p>}
              </div>

              <div>
                <Label htmlFor="content" className="text-gray-300">Konten</Label>
                <Textarea
                  id="content"
                  {...register("content")}
                  className="bg-gray-700 border-gray-600 text-white mt-1 min-h-[100px]"
                  placeholder="Detail notifikasi atau kajian..."
                />
                {errors.content && <p className="text-red-400 text-sm mt-1">{errors.content.message}</p>}
              </div>

              {(itemType === "study" || itemType === "event") && (
                <>
                  <div>
                    <Label htmlFor="event_date" className="text-gray-300 block mb-1">Tanggal Acara (Opsional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal bg-gray-700 border-gray-600 text-white",
                            !eventDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {eventDate ? format(new Date(eventDate), "PPP") : <span>Pilih tanggal</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-gray-700 border-gray-600 text-white">
                        <Calendar
                          mode="single"
                          selected={eventDate ? new Date(eventDate) : undefined}
                          onSelect={(date) => setValue("event_date", date ? format(date, "yyyy-MM-dd") : null)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {errors.event_date && <p className="text-red-400 text-sm mt-1">{errors.event_date.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="event_time" className="text-gray-300">Waktu Acara (Opsional, HH:MM)</Label>
                    <Input
                      id="event_time"
                      {...register("event_time")}
                      className="bg-gray-700 border-gray-600 text-white mt-1"
                      placeholder="Contoh: 19:30"
                    />
                    {errors.event_time && <p className="text-red-400 text-sm mt-1">{errors.event_time.message}</p>}
                  </div>
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
                  {isSubmitting ? "Menyimpan..." : (editingItem ? "Simpan Perubahan" : "Tambah Item")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default NotificationStudySettings;