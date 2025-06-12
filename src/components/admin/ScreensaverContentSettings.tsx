import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Trash2, Edit, PlusCircle, Image, DollarSign, CalendarDays } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { RealtimeChannel } from "@supabase/supabase-js";

interface ScreensaverContent {
  id: string;
  type: "image" | "financial_summary" | "jumuah_schedule";
  title: string | null;
  content: string | null; // For image_url
  display_order: number;
  is_active: boolean;
}

const screensaverContentFormSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["image", "financial_summary", "jumuah_schedule"], { message: "Tipe konten tidak valid." }),
  title: z.string().max(100, "Judul terlalu panjang.").nullable().optional(),
  file: z.instanceof(FileList).refine(file => file.length > 0, "File gambar harus diunggah.").optional(), // For image upload
  content: z.string().nullable().optional(), // For image URL
  display_order: z.coerce.number().int().min(0, "Urutan tampilan harus non-negatif.").default(0),
  is_active: z.boolean().default(true),
});

type ScreensaverContentFormValues = z.infer<typeof screensaverContentFormSchema>;

type DialogMode = 'none' | 'add-image' | 'edit-image' | 'edit-info';

const ScreensaverContentSettings: React.FC = () => {
  const [contents, setContents] = useState<ScreensaverContent[]>([]);
  const [dialogMode, setDialogMode] = useState<DialogMode>('none');
  const [editingContent, setEditingContent] = useState<ScreensaverContent | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const form = useForm<ScreensaverContentFormValues>({
    resolver: zodResolver(screensaverContentFormSchema),
    defaultValues: {
      type: "image",
      title: "",
      file: undefined,
      content: null,
      display_order: 0,
      is_active: true,
    },
  });

  const { handleSubmit, register, setValue, reset, watch, formState: { isSubmitting, errors } } = form;
  const contentType = watch("type");

  const fetchContents = useCallback(async () => {
    const { data, error } = await supabase
      .from("screensaver_content")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching screensaver content:", error);
      toast.error("Gagal memuat konten screensaver.");
    } else {
      setContents(data || []);
    }
  }, []);

  useEffect(() => {
    fetchContents();

    if (!channelRef.current) {
      channelRef.current = supabase
        .channel('screensaver_content_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'screensaver_content' }, (payload) => {
          console.log('Screensaver content change received!', payload);
          fetchContents();
        })
        .subscribe();
      console.log("ScreensaverContentSettings: Subscribed to channel 'screensaver_content_changes'.");
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        console.log("ScreensaverContentSettings: Unsubscribed from channel 'screensaver_content_changes'.");
        channelRef.current = null;
      }
    };
  }, [fetchContents]);

  const handleAddImageSlide = () => {
    setEditingContent(null);
    reset({ type: "image", title: "", file: undefined, content: null, display_order: 0, is_active: true });
    setPreviewImageUrl(null);
    setDialogMode('add-image');
  };

  const handleEditContent = (content: ScreensaverContent) => {
    setEditingContent(content);
    reset({
      id: content.id,
      type: content.type,
      title: content.title || "",
      content: content.content || null,
      display_order: content.display_order,
      is_active: content.is_active,
    });
    if (content.type === 'image') {
      setPreviewImageUrl(content.content);
      setDialogMode('edit-image');
    } else {
      setDialogMode('edit-info');
    }
  };

  const handleDeleteContent = async (content: ScreensaverContent) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus konten screensaver ini?")) {
      return;
    }

    const deleteToastId = toast.loading("Menghapus konten screensaver...");

    try {
      // If it's an image, attempt to delete from storage
      if (content.type === "image" && content.content) {
        try {
          const urlParts = content.content.split('/');
          const fileNameWithFolder = urlParts.slice(urlParts.indexOf('images') + 1).join('/');
          const { error: deleteFileError } = await supabase.storage
            .from('images')
            .remove([fileNameWithFolder]);
          if (deleteFileError) {
            console.warn("Gagal menghapus gambar screensaver lama dari storage:", deleteFileError);
            toast.warning("Gagal menghapus gambar screensaver lama.", { id: deleteToastId });
          } else {
            console.log("Gambar screensaver lama berhasil dihapus.");
          }
        } catch (e) {
          console.warn("Error parsing image path for deletion:", e);
        }
      }

      const { error } = await supabase
        .from("screensaver_content")
        .delete()
        .eq("id", content.id);

      if (error) {
        throw error;
      }

      toast.success("Konten screensaver berhasil dihapus!", { id: deleteToastId });
      fetchContents();
    } catch (error: any) {
      console.error("Error deleting screensaver content:", error);
      toast.error(`Gagal menghapus konten screensaver: ${error.message}`, { id: deleteToastId });
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const fileExtension = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    const filePath = `screensaver_slides/${fileName}`; // Path inside the bucket

    const uploadToastId = toast.loading("Mengunggah gambar screensaver: 0%");
    const oldImageUrl = editingContent?.type === 'image' ? editingContent.content : null;

    try {
      const { data, error } = await supabase.storage
        .from('images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: (event: ProgressEvent) => {
            const percent = Math.round((event.loaded * 100) / event.total);
            toast.loading(`Mengunggah gambar screensaver: ${percent}%`, { id: uploadToastId });
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
        setPreviewImageUrl(publicUrlData.publicUrl);
        toast.loading("Mengunggah gambar screensaver: 100%", { id: uploadToastId });
        toast.success("Gambar screensaver berhasil diunggah!", { id: uploadToastId });
        toast.info("Untuk performa terbaik di perangkat rendah, pastikan ukuran file gambar dioptimalkan (misal: format WebP, resolusi sesuai kebutuhan).");

        if (oldImageUrl && oldImageUrl !== publicUrlData.publicUrl) {
          try {
            const oldUrlParts = oldImageUrl.split('/');
            const oldFileNameWithFolder = oldUrlParts.slice(urlParts.indexOf('images') + 1).join('/');
            const { error: deleteFileError } = await supabase.storage
              .from('images')
              .remove([oldFileNameWithFolder]);
            if (deleteFileError) {
              console.warn("Gagal menghapus gambar screensaver lama dari storage:", deleteFileError);
              toast.warning("Gagal menghapus gambar screensaver lama.");
            } else {
              console.log("Gambar screensaver lama berhasil dihapus.");
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

  const onSubmit = async (values: ScreensaverContentFormValues) => {
    const payload = {
      type: values.type,
      title: values.title || null,
      content: values.type === 'image' ? values.content || null : null, // Only save content for images
      display_order: values.display_order,
      is_active: values.is_active,
    };

    if (editingContent) {
      const { error } = await supabase
        .from("screensaver_content")
        .update(payload)
        .eq("id", editingContent.id);

      if (error) {
        console.error("Error updating screensaver content:", error);
        toast.error("Gagal memperbarui konten screensaver.");
      } else {
        toast.success("Konten screensaver berhasil diperbarui!");
        setDialogMode('none');
        fetchContents();
      }
    } else {
      const { error } = await supabase
        .from("screensaver_content")
        .insert(payload);

      if (error) {
        console.error("Error adding screensaver content:", error);
        toast.error("Gagal menambahkan konten screensaver.");
      } else {
        toast.success("Konten screensaver berhasil ditambahkan!");
        setDialogMode('none');
        fetchContents();
      }
    }
  };

  return (
    <Card className="bg-gray-800 text-white border-gray-700 col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-blue-300">Pengaturan Screensaver</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-400 mb-4">Kelola konten yang akan ditampilkan saat screensaver aktif.</p>
        
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <Button onClick={handleAddImageSlide} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
            <PlusCircle className="mr-2 h-4 w-4" /> Tambah Gambar Slide
          </Button>
          <Button 
            onClick={() => {
              const existingFinancial = contents.find(c => c.type === 'financial_summary');
              setEditingContent(existingFinancial || null);
              reset({ 
                id: existingFinancial?.id,
                type: "financial_summary", 
                title: existingFinancial?.title || "Informasi Keuangan", 
                content: null, 
                display_order: existingFinancial?.display_order || 0, 
                is_active: existingFinancial?.is_active ?? true 
              });
              setDialogMode('edit-info');
            }} 
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <DollarSign className="mr-2 h-4 w-4" /> Atur Info Keuangan
          </Button>
          <Button 
            onClick={() => {
              const existingJumuah = contents.find(c => c.type === 'jumuah_schedule');
              setEditingContent(existingJumuah || null);
              reset({ 
                id: existingJumuah?.id,
                type: "jumuah_schedule", 
                title: existingJumuah?.title || "Jadwal Jum'at", 
                content: null, 
                display_order: existingJumuah?.display_order || 0, 
                is_active: existingJumuah?.is_active ?? true 
              });
              setDialogMode('edit-info');
            }} 
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
          >
            <CalendarDays className="mr-2 h-4 w-4" /> Atur Jadwal Jum'at
          </Button>
        </div>

        <div className="space-y-3">
          {contents.length === 0 ? (
            <p className="text-gray-400 text-center">Belum ada konten screensaver. Tambahkan yang pertama!</p>
          ) : (
            contents.map((content) => (
              <div key={content.id} className="flex items-center justify-between bg-gray-700 p-3 rounded-md shadow-sm">
                <div>
                  <p className="font-medium text-lg text-blue-200">
                    {content.type === 'image' ? (
                      <Image className="inline-block mr-2 h-5 w-5" />
                    ) : content.type === 'financial_summary' ? (
                      <DollarSign className="inline-block mr-2 h-5 w-5" />
                    ) : (
                      <CalendarDays className="inline-block mr-2 h-5 w-5" />
                    )}
                    {content.title || (content.type === 'image' ? "Gambar Slide" : content.type === 'financial_summary' ? "Ringkasan Keuangan" : "Jadwal Jum'at")}
                  </p>
                  <p className="text-sm text-gray-300">
                    Tipe: {content.type} | Urutan: {content.display_order} | Aktif: {content.is_active ? "Ya" : "Tidak"}
                  </p>
                  {content.type === 'image' && content.content && (
                    <p className="text-xs text-gray-400 truncate max-w-xs">URL: {content.content}</p>
                  )}
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="icon" onClick={() => handleEditContent(content)} className="text-blue-400 border-blue-400 hover:bg-blue-400 hover:text-white">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleDeleteContent(content)} className="text-red-400 border-red-400 hover:bg-red-400 hover:text-white">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Dialog for Image Slides (Add/Edit) */}
        <Dialog open={dialogMode === 'add-image' || dialogMode === 'edit-image'} onOpenChange={(open) => { if (!open) setDialogMode('none'); }}>
          <DialogContent className="bg-gray-800 text-white border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-blue-300">{dialogMode === 'edit-image' ? "Edit Gambar Screensaver" : "Tambah Gambar Screensaver Baru"}</DialogTitle>
              <DialogDescription>
                {dialogMode === 'edit-image' ? "Perbarui detail gambar slide screensaver ini." : "Unggah gambar baru untuk ditampilkan sebagai slide di screensaver."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <input type="hidden" {...register("type")} value="image" />

              <div>
                <Label htmlFor="imageTitle" className="text-gray-300">Judul (Opsional)</Label>
                <Input
                  id="imageTitle"
                  {...register("title")}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                  placeholder="Judul slide (mis: Pesan Khusus)"
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
                <Label htmlFor="imageDisplayOrder" className="text-gray-300">Urutan Tampilan</Label>
                <Input
                  id="imageDisplayOrder"
                  type="number"
                  {...register("display_order")}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
                {errors.display_order && <p className="text-red-400 text-sm mt-1">{errors.display_order.message}</p>}
              </div>

              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="imageIsActive" className="text-gray-300 text-lg">Aktifkan Slide</Label>
                <Switch
                  id="imageIsActive"
                  checked={watch("is_active")}
                  onCheckedChange={(checked) => setValue("is_active", checked)}
                  className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-600"
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogMode('none')} className="text-gray-300 border-gray-600 hover:bg-gray-700">
                  Batal
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {isSubmitting ? "Menyimpan..." : (dialogMode === 'edit-image' ? "Simpan Perubahan" : "Tambah Slide")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog for Info Content (Financial Summary / Jumuah Schedule) */}
        <Dialog open={dialogMode === 'edit-info'} onOpenChange={(open) => { if (!open) setDialogMode('none'); }}>
          <DialogContent className="bg-gray-800 text-white border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-blue-300">
                {editingContent?.type === 'financial_summary' ? "Atur Informasi Keuangan" : "Atur Jadwal Jum'at"}
              </DialogTitle>
              <DialogDescription>
                {editingContent?.type === 'financial_summary' ? 
                  "Aktifkan atau nonaktifkan tampilan ringkasan keuangan di screensaver." : 
                  "Aktifkan atau nonaktifkan tampilan jadwal Jum'at di screensaver (hanya muncul di hari Jum'at)."
                }
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <input type="hidden" {...register("type")} />
              <input type="hidden" {...register("content")} /> {/* Content is null for these types */}

              <div>
                <Label htmlFor="infoTitle" className="text-gray-300">Judul Tampilan (Opsional)</Label>
                <Input
                  id="infoTitle"
                  {...register("title")}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                  placeholder="Judul untuk tampilan ini"
                />
                {errors.title && <p className="text-red-400 text-sm mt-1">{errors.title.message}</p>}
              </div>

              <div>
                <Label htmlFor="infoDisplayOrder" className="text-gray-300">Urutan Tampilan</Label>
                <Input
                  id="infoDisplayOrder"
                  type="number"
                  {...register("display_order")}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
                {errors.display_order && <p className="text-red-400 text-sm mt-1">{errors.display_order.message}</p>}
              </div>

              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="infoIsActive" className="text-gray-300 text-lg">Aktifkan Tampilan Ini</Label>
                <Switch
                  id="infoIsActive"
                  checked={watch("is_active")}
                  onCheckedChange={(checked) => setValue("is_active", checked)}
                  className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-600"
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogMode('none')} className="text-gray-300 border-gray-600 hover:bg-gray-700">
                  Batal
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {isSubmitting ? "Menyimpan..." : "Simpan Pengaturan"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default ScreensaverContentSettings;