import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { v4 as uuidv4 } from 'uuid'; // Import uuid for unique file names
import { useAppSettings } from "@/contexts/AppSettingsContext"; // Import useAppSettings

const formSchema = z.object({
  backgroundImageUrl: z.string().nullable().optional(), // No longer strictly a URL for input, but will store URL
  backgroundColor: z.string().min(1, "Warna latar belakang tidak boleh kosong.").default("#0A0A0A"),
  screensaverIdleMinutes: z.coerce.number().int().min(1, "Durasi screensaver harus minimal 1 menit.").default(5), // Keep for now, will be moved
  screensaverSlideDuration: z.coerce.number().int().min(1000, "Durasi slide harus minimal 1 detik (1000ms).").default(10000), // NEW FIELD
});

type DisplaySettingsFormValues = z.infer<typeof formSchema>;

const DisplaySettings: React.FC = () => {
  const { settings, isLoadingSettings, refetchSettings } = useAppSettings(); // Use the new hook

  const form = useForm<DisplaySettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      backgroundImageUrl: null,
      backgroundColor: "#0A0A0A",
      screensaverIdleMinutes: 5, // Default value
      screensaverSlideDuration: 10000, // Default value
    },
  });

  const { handleSubmit, register, setValue, formState: { isSubmitting, errors } } = form;
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoadingSettings && settings) {
      setValue("backgroundImageUrl", settings.background_image_url);
      setCurrentImageUrl(settings.background_image_url);
      setValue("backgroundColor", settings.background_color || "#0A0A0A");
      setValue("screensaverIdleMinutes", settings.screensaver_idle_minutes || 5);
      setValue("screensaverSlideDuration", settings.screensaver_slide_duration || 10000); // Set new field
    }
  }, [settings, isLoadingSettings, setValue]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const fileExtension = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`; // Generate unique file name
    const filePath = `backgrounds/${fileName}`; // Path inside the bucket

    const uploadToastId = toast.loading("Mengunggah gambar latar belakang: 0%");
    const oldImageUrl = currentImageUrl; // Capture current URL before upload

    try {
      const { data, error } = await supabase.storage
        .from('images') // Use 'images' bucket
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false, // Do not upsert, create new file
          onUploadProgress: (event: ProgressEvent) => {
            const percent = Math.round((event.loaded * 100) / event.total);
            toast.loading(`Mengunggah gambar latar belakang: ${percent}%`, { id: uploadToastId });
          },
        });

      if (error) {
        throw error;
      }

      const { data: publicUrlData } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      if (publicUrlData?.publicUrl) {
        setValue("backgroundImageUrl", publicUrlData.publicUrl);
        setCurrentImageUrl(publicUrlData.publicUrl);
        // Explicitly update to 100% before success
        toast.loading("Mengunggah gambar latar belakang: 100%", { id: uploadToastId });
        toast.success("Gambar latar belakang berhasil diunggah!", { id: uploadToastId });
        toast.info("Untuk performa terbaik di perangkat rendah, pastikan ukuran file gambar dioptimalkan (misal: format WebP, resolusi sesuai kebutuhan).");

        // Attempt to delete the old image if it exists and is different
        if (oldImageUrl && oldImageUrl !== publicUrlData.publicUrl) {
          try {
            const oldUrlParts = oldImageUrl.split('/');
            const oldFileNameWithFolder = oldUrlParts.slice(oldUrlParts.indexOf('images') + 1).join('/');
            const { error: deleteError } = await supabase.storage
              .from('images')
              .remove([oldFileNameWithFolder]);
            if (deleteError) {
              console.warn("Gagal menghapus gambar latar belakang lama dari storage:", deleteError);
              toast.warning("Gagal menghapus gambar latar belakang lama.");
            } else {
              console.log("Gambar latar belakang lama berhasil dihapus.");
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

  const onSubmit = async (values: DisplaySettingsFormValues) => {
    const { data, error } = await supabase
      .from("app_settings")
      .upsert(
        {
          id: 1,
          background_image_url: values.backgroundImageUrl || null,
          background_color: values.backgroundColor,
          screensaver_idle_minutes: values.screensaverIdleMinutes,
          screensaver_slide_duration: values.screensaverSlideDuration, // Save new field
        },
        { onConflict: "id" }
      );

    if (error) {
      console.error("Error saving display settings:", error);
      toast.error("Gagal menyimpan pengaturan tampilan.");
    } else {
      toast.success("Pengaturan tampilan berhasil disimpan!");
      console.log("Display settings saved:", data);
      refetchSettings(); // Manually refetch to ensure context is updated immediately
    }
  };

  return (
    <Card className="bg-gray-800 text-white border-gray-700">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-blue-300">Pengaturan Tampilan</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-400 mb-4">Atur gambar atau warna latar belakang untuk tampilan utama.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="backgroundImageUpload" className="text-gray-300">Unggah Gambar Latar Belakang (Opsional)</Label>
            <Input
              id="backgroundImageUpload"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="bg-gray-700 border-gray-600 text-white mt-1 file:text-white file:bg-blue-600 file:hover:bg-blue-700 file:border-none file:rounded-md file:px-3 file:py-1"
            />
            {currentImageUrl && (
              <div className="mt-2">
                <p className="text-sm text-gray-400 mb-1">Gambar saat ini:</p>
                <img src={currentImageUrl} alt="Current Background" className="max-w-full h-32 object-contain rounded-md border border-gray-600" />
              </div>
            )}
            {errors.backgroundImageUrl && <p className="text-red-400 text-sm mt-1">{errors.backgroundImageUrl.message}</p>}
          </div>
          <div>
            <Label htmlFor="backgroundColor" className="text-gray-300">Warna Latar Belakang (Hex atau Nama Warna)</Label>
            <Input
              id="backgroundColor"
              type="text"
              {...register("backgroundColor")}
              className="bg-gray-700 border-gray-600 text-white mt-1"
              placeholder="Contoh: #0A0A0A atau black"
            />
            {errors.backgroundColor && <p className="text-red-400 text-sm mt-1">{errors.backgroundColor.message}</p>}
          </div>
          <div>
            <Label htmlFor="screensaverIdleMinutes" className="text-gray-300">Durasi Idle Screensaver (menit)</Label>
            <Input
              id="screensaverIdleMinutes"
              type="number"
              {...register("screensaverIdleMinutes")}
              className="bg-gray-700 border-gray-600 text-white mt-1"
              placeholder="Contoh: 5"
            />
            {errors.screensaverIdleMinutes && <p className="text-red-400 text-sm mt-1">{errors.screensaverIdleMinutes.message}</p>}
          </div>
          <div>
            <Label htmlFor="screensaverSlideDuration" className="text-gray-300">Durasi Pergantian Slide Screensaver (milidetik)</Label>
            <Input
              id="screensaverSlideDuration"
              type="number"
              {...register("screensaverSlideDuration")}
              className="bg-gray-700 border-gray-600 text-white mt-1"
              placeholder="Contoh: 10000 (untuk 10 detik)"
            />
            {errors.screensaverSlideDuration && <p className="text-red-400 text-sm mt-1">{errors.screensaverSlideDuration.message}</p>}
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            {isSubmitting ? "Menyimpan..." : "Simpan Pengaturan Tampilan"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default DisplaySettings;