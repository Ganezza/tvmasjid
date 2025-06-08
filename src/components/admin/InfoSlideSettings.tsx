import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // Keep Textarea import for now, might be removed if not used at all
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Trash2, Edit } from "lucide-react";

interface Slide {
  id: string;
  type: "text" | "image"; // Keep both types for existing data, but form will only allow 'image'
  title?: string;
  content: string;
  display_order: number;
}

const slideFormSchema = z.object({
  id: z.string().optional(),
  type: z.literal("image"), // Only allow 'image' type
  title: z.string().max(100, "Judul terlalu panjang.").optional(),
  content: z.string().url("Konten harus berupa URL gambar yang valid.").min(1, "URL gambar tidak boleh kosong."), // Enforce URL
  display_order: z.coerce.number().int().min(0, "Urutan tampilan harus non-negatif.").default(0),
});

type SlideFormValues = z.infer<typeof slideFormSchema>;

const InfoSlideSettings: React.FC = () => {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<Slide | null>(null);

  const form = useForm<SlideFormValues>({
    resolver: zodResolver(slideFormSchema),
    defaultValues: {
      type: "image", // Default to image
      title: "",
      content: "",
      display_order: 0,
    },
  });

  const { handleSubmit, register, setValue, watch, reset, formState: { isSubmitting, errors } } = form;
  // const slideType = watch("type"); // No longer needed as type is fixed to 'image'

  const fetchSlides = useCallback(async () => {
    const { data, error } = await supabase
      .from("info_slides")
      .select("*")
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching info slides:", error);
      toast.error("Gagal memuat slide informasi.");
    } else {
      setSlides(data || []);
    }
  }, []);

  useEffect(() => {
    fetchSlides();

    const channel = supabase
      .channel('info_slides_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'info_slides' }, (payload) => {
        console.log('Info slides change received!', payload);
        fetchSlides(); // Re-fetch all slides on any change
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSlides]);

  const handleAddSlide = () => {
    setEditingSlide(null);
    reset({ type: "image", title: "", content: "", display_order: 0 }); // Default to image
    setIsDialogOpen(true);
  };

  const handleEditSlide = (slide: Slide) => {
    setEditingSlide(slide);
    reset({
      id: slide.id,
      type: "image", // Force type to image for editing, assuming all new/edited will be images
      title: slide.title || "",
      content: slide.content,
      display_order: slide.display_order,
    });
    setIsDialogOpen(true);
  };

  const handleDeleteSlide = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus slide ini?")) {
      return;
    }
    const { error } = await supabase
      .from("info_slides")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting slide:", error);
      toast.error("Gagal menghapus slide.");
    } else {
      toast.success("Slide berhasil dihapus!");
      fetchSlides(); // Re-fetch to update list
    }
  };

  const onSubmit = async (values: SlideFormValues) => {
    if (editingSlide) {
      // Update existing slide
      const { error } = await supabase
        .from("info_slides")
        .update({
          type: "image", // Always save as image
          title: values.title || null,
          content: values.content,
          display_order: values.display_order,
        })
        .eq("id", editingSlide.id);

      if (error) {
        console.error("Error updating slide:", error);
        toast.error("Gagal memperbarui slide.");
      } else {
        toast.success("Slide berhasil diperbarui!");
        setIsDialogOpen(false);
        fetchSlides(); // Re-fetch to update list
      }
    } else {
      // Add new slide
      const { error } = await supabase
        .from("info_slides")
        .insert({
          type: "image", // Always save as image
          title: values.title || null,
          content: values.content,
          display_order: values.display_order,
        });

      if (error) {
        console.error("Error adding slide:", error);
        toast.error("Gagal menambahkan slide.");
      } else {
        toast.success("Slide berhasil ditambahkan!");
        setIsDialogOpen(false);
        fetchSlides(); // Re-fetch to update list
      }
    }
  };

  return (
    <Card className="bg-gray-800 text-white border-gray-700 col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-blue-300">Pengaturan Slide Informasi (Gambar)</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-400 mb-4">Kelola slide gambar yang akan ditampilkan di layar utama.</p>
        <Button onClick={handleAddSlide} className="w-full bg-green-600 hover:bg-green-700 text-white mb-4">
          Tambah Slide Gambar Baru
        </Button>

        <div className="space-y-3">
          {slides.length === 0 ? (
            <p className="text-gray-400 text-center">Belum ada slide gambar. Tambahkan yang pertama!</p>
          ) : (
            slides.map((slide) => (
              <div key={slide.id} className="flex items-center justify-between bg-gray-700 p-3 rounded-md shadow-sm">
                <div>
                  <p className="font-medium text-lg text-blue-200">{slide.title || "(Tanpa Judul)"}</p>
                  <p className="text-sm text-gray-300 truncate max-w-xs">{slide.content}</p>
                  <p className="text-xs text-gray-400">Tipe: {slide.type} | Urutan: {slide.display_order}</p>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="icon" onClick={() => handleEditSlide(slide)} className="text-blue-400 border-blue-400 hover:bg-blue-400 hover:text-white">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleDeleteSlide(slide.id)} className="text-red-400 border-red-400 hover:bg-red-400 hover:text-white">
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
              <DialogTitle className="text-blue-300">{editingSlide ? "Edit Slide Gambar" : "Tambah Slide Gambar Baru"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Type selection removed as it's fixed to 'image' */}
              <input type="hidden" {...register("type")} value="image" />

              <div>
                <Label htmlFor="title" className="text-gray-300">Judul (Opsional)</Label>
                <Input
                  id="title"
                  {...register("title")}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                  placeholder="Judul slide (mis: Nama Acara)"
                />
                {errors.title && <p className="text-red-400 text-sm mt-1">{errors.title.message}</p>}
              </div>

              <div>
                <Label htmlFor="content" className="text-gray-300">URL Gambar</Label>
                <Input
                  id="content"
                  type="url" // Enforce URL input
                  {...register("content")}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                  placeholder="URL Gambar (mis: https://example.com/image.jpg)"
                />
                {errors.content && <p className="text-red-400 text-sm mt-1">{errors.content.message}</p>}
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
                  {isSubmitting ? "Menyimpan..." : (editingSlide ? "Simpan Perubahan" : "Tambah Slide")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default InfoSlideSettings;