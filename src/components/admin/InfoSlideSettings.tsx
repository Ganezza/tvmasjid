import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"; // Import DialogDescription
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Trash2, Edit, PlusCircle } from "lucide-react";
import { v4 as uuidv4 } from 'uuid'; // Import uuid for unique file names
import { RealtimeChannel } from "@supabase/supabase-js"; // Import RealtimeChannel

interface Slide {
  id: string;
  type: "text" | "image"; // Keep both types for existing data, but new data will be 'image'
  content: string; // Text or image URL
  title?: string;
  display_order: number;
}

const slideFormSchema = z.object({
  id: z.string().optional(),
  type: z.literal("image"),
  title: z.string().max(100, "Judul terlalu panjang.").nullable().optional(),
  content: z.string().min(1, "URL gambar tidak boleh kosong."), // Content will store the URL
  display_order: z.coerce.number().int().min(0, "Urutan tampilan harus non-negatif.").default(0),
});

type SlideFormValues = z.infer<typeof slideFormSchema>;

const InfoSlideSettings: React.FC = () => {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<Slide | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null); // State for image preview
  const channelRef = useRef<RealtimeChannel | null>(null); // Ref for Supabase channel

  const form = useForm<SlideFormValues>({
    resolver: zodResolver(slideFormSchema),
    defaultValues: {
      type: "image",
      title: "",
      content: "",
      display_order: 0,
    },
  });

  const { handleSubmit, register, setValue, reset, formState: { isSubmitting, errors } } = form;

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

    if (!channelRef.current) { // Only subscribe if no channel exists
      channelRef.current = supabase
        .channel('info_slides_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'info_slides' }, (payload) => {
          console.log('Info slides change received!', payload);
          fetchSlides();
        })
        .subscribe();
      console.log("InfoSlideSettings: Subscribed to channel 'info_slides_changes'.");
    }

    return () => {
      if (channelRef.current) { // Only unsubscribe if a channel exists
        supabase.removeChannel(channelRef.current);
        console.log("InfoSlideSettings: Unsubscribed from channel 'info_slides_changes'.");
        channelRef.current = null; // Clear the ref
      }
    };
  }, [fetchSlides]);

  const handleAddSlide = () => {
    setEditingSlide(null);
    reset({ type: "image", title: "", content: "", display_order: 0 });
    setPreviewImageUrl(null); // Clear preview
    setIsDialogOpen(true);
  };

  const handleEditSlide = (slide: Slide) => {
    setEditingSlide(slide);
    reset({
      id: slide.id,
      type: "image",
      title: slide.title || "",
      content: slide.content,
      display_order: slide.display_order,
    });
    setPreviewImageUrl(slide.content); // Set preview to current image
    setIsDialogOpen(true);
  };

  const handleDeleteSlide = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus slide ini?")) {
      return;
    }
    // Optionally, delete the file from storage as well
    const { data: slideToDelete, error: fetchError } = await supabase
      .from("info_slides")
      .select("content")
      .eq("id", id)
      .single();

    if (fetchError) {
      console.error("Error fetching slide content for deletion:", fetchError);
      toast.error("Gagal menghapus slide.");
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
      fetchSlides();

      // Attempt to delete the file from storage
      if (slideToDelete?.content) {
        try {
          const urlParts = slideToDelete.content.split('/');
          const publicIndex = urlParts.indexOf('public');
          const fileNameWithFolder = urlParts.slice(publicIndex + 2).join('/');
          const { error: deleteFileError } = await supabase.storage
            .from('images')
            .remove([fileNameWithFolder]);
          if (deleteFileError) {
            console.warn("Failed to delete file from storage:", deleteFileError);
          }
        } catch (e) {
          console.warn("Error parsing file path for deletion:", e);
        }
      }
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const fileExtension = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    const filePath = `slides/${fileName}`; // Path inside the bucket

    const uploadToastId = toast.loading("Mengunggah gambar slide: 0%");

    // Capture the old image URL if editing
    const oldImageUrl = editingSlide?.content || null;

    try {
      const { data, error } = await supabase.storage
        .from('images') // Use 'images' bucket
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: (event: ProgressEvent) => {
            const percent = Math.round((event.loaded * 100) / event.total);
            console.log(`Upload progress for info slide: ${percent}%`); // ADDED LOG
            toast.loading(`Mengunggah gambar slide: ${percent}%`, { id: uploadToastId });
          },
        });

      if (error) {
        throw error;
      }

      const { data: publicUrlData } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      if (publicUrlData?.publicUrl) {
        setValue("content", publicUrlData.publicUrl);
        setPreviewImageUrl(publicUrlData.publicUrl); // Set preview
        // Explicitly update to 100% before success
        toast.loading("Mengunggah gambar slide: 100%", { id: uploadToastId });
        toast.success("Gambar slide berhasil diunggah!", { id: uploadToastId });
        toast.info("Untuk performa terbaik di perangkat rendah, pastikan ukuran file gambar dioptimalkan (misal: format WebP, resolusi sesuai kebutuhan).");

        // Attempt to delete the old image if it exists and is different from the new one
        if (oldImageUrl && oldImageUrl !== publicUrlData.publicUrl) {
          try {
            const oldUrlParts = oldImageUrl.split('/');
            const publicIndex = oldUrlParts.indexOf('public');
            const oldFileNameWithFolder = oldUrlParts.slice(publicIndex + 2).join('/');
            const { error: deleteFileError } = await supabase.storage
              .from('images')
              .remove([oldFileNameWithFolder]);
            if (deleteFileError) {
              console.warn("Gagal menghapus gambar slide lama dari storage:", deleteFileError);
              toast.warning("Gagal menghapus gambar slide lama.");
            } else {
              console.log("Gambar slide lama berhasil dihapus.");
            }
          } catch (e) {
            console.warn("Error parsing old image path for deletion:", e);
          }
        }

      } else {
        throw new Error("Gagal mendapatkan URL publik gambar.");
      }
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast.error(`Gagal mengunggah gambar: ${error.message}`, { id: uploadToastId });
    }
  };

  const onSubmit = async (values: SlideFormValues) => {
    const payload = {
      type: "image",
      title: values.title || null,
      content: values.content,
      display_order: values.display_order,
    };

    if (editingSlide) {
      const { error } = await supabase
        .from("info_slides")
        .update(payload)
        .eq("id", editingSlide.id);

      if (error) {
        console.error("Error updating slide:", error);
        toast.error("Gagal memperbarui slide.");
      } else {
        toast.success("Slide berhasil diperbarui!");
        setIsDialogOpen(false);
        fetchSlides();
      }
    } else {
      const { error } = await supabase
        .from("info_slides")
        .insert(payload);

      if (error) {
        console.error("Error adding slide:", error);
        toast.error("Gagal menambahkan slide.");
      } else {
        toast.success("Slide berhasil ditambahkan!");
        setIsDialogOpen(false);
        fetchSlides();
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
              <DialogDescription>
                {editingSlide ? "Perbarui detail slide gambar ini." : "Isi detail untuk slide gambar baru."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                <Label htmlFor="imageUpload" className="text-gray-300">Unggah Gambar</Label>
                <Input
                  id="imageUpload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="bg-gray-700 border-gray-600 text-white mt-1 file:text-white file:bg-blue-600 file:hover:bg-blue-700 file:border-none file:rounded-md file:px-3 file:py-1"
                />
                {previewImageUrl && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-400 mb-1">Pratinjau Gambar:</p>
                    <img src={previewImageUrl} alt="Image Preview" className="max-w-full h-32 object-contain rounded-md border border-gray-600" />
                  </div>
                )}
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