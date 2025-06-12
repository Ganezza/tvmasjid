import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { v4 as uuidv4 } from 'uuid'; // Import uuid for unique file names
import { useAppSettings } from "@/contexts/AppSettingsContext"; // Import useAppSettings

// Define schema for form validation
const formSchema = z.object({
  masjidName: z.string().min(1, "Nama masjid tidak boleh kosong.").max(100, "Nama masjid terlalu panjang.").optional().nullable(),
  masjidLogoUrl: z.string().nullable().optional(), // No longer strictly a URL for input, but will store URL
  masjidAddress: z.string().min(1, "Alamat masjid tidak boleh kosong.").max(255, "Alamat terlalu panjang.").optional().nullable(),
  masjidNameColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Format warna heksadesimal tidak valid (contoh: #RRGGBB atau #RGB).").nullable().optional(),
});

type MasjidInfoSettingsFormValues = z.infer<typeof formSchema>;

const MasjidInfoSettings: React.FC = () => {
  const { settings, isLoadingSettings, refetchSettings } = useAppSettings(); // Use the new hook

  const form = useForm<MasjidInfoSettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      masjidName: "",
      masjidLogoUrl: "",
      masjidAddress: "",
      masjidNameColor: "#34D399", // Default to green-400
    },
  });

  const { handleSubmit, register, setValue, formState: { isSubmitting, errors } } = form;
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoadingSettings && settings) {
      setValue("masjidName", settings.masjid_name || "");
      setValue("masjidLogoUrl", settings.masjid_logo_url || "");
      setCurrentLogoUrl(settings.masjid_logo_url);
      setValue("masjidAddress", settings.masjid_address || "");
      setValue("masjidNameColor", settings.masjid_name_color || "#34D399");
    }
  }, [settings, isLoadingSettings, setValue]);

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const fileExtension = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`; // Generate unique file name
    const filePath = `logos/${fileName}`; // Path inside the bucket

    const uploadToastId = toast.loading("Mengunggah logo masjid: 0%");
    const oldLogoUrl = currentLogoUrl; // Capture current URL before upload

    try {
      const { data, error } = await supabase.storage
        .from('images') // Use 'images' bucket
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: (event: ProgressEvent) => {
            const percent = Math.round((event.loaded * 100) / event.total);
            toast.loading(`Mengunggah logo masjid: ${percent}%`, { id: uploadToastId });
          },
        });

      if (error) {
        throw error;
      }

      const { data: publicUrlData } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      if (publicUrlData?.publicUrl) {
        setValue("masjidLogoUrl", publicUrlData.publicUrl);
        setCurrentLogoUrl(publicUrlData.publicUrl);
        toast.success("Logo masjid berhasil diunggah!", { id: uploadToastId });
        toast.info("Untuk performa terbaik di perangkat rendah, pastikan ukuran file gambar dioptimalkan (misal: format WebP, resolusi sesuai kebutuhan).");

        // Attempt to delete the old logo if it exists and is different
        if (oldLogoUrl && oldLogoUrl !== publicUrlData.publicUrl) {
          try {
            const oldUrlParts = oldLogoUrl.split('/');
            const oldFileNameWithFolder = oldUrlParts.slice(oldUrlParts.indexOf('images') + 1).join('/');
            const { error: deleteError } = await supabase.storage
              .from('images')
              .remove([oldFileNameWithFolder]);
            if (deleteError) {
              console.warn("Gagal menghapus logo masjid lama dari storage:", deleteError);
              toast.warning("Gagal menghapus logo masjid lama.");
            } else {
              console.log("Logo masjid lama berhasil dihapus.");
            }
          } catch (e) {
            console.warn("Error parsing old logo path for deletion:", e);
          }
        }

      } else {
        throw new Error("Gagal mendapatkan URL publik logo.");
      }
    } catch (error: any) {
      console.error("Error uploading logo:", error);
      toast.error(`Gagal mengunggah logo: ${error.message}`, { id: uploadToastId });
    }
  };

  const onSubmit = async (values: MasjidInfoSettingsFormValues) => {
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        {
          id: 1, // Always update the same row for global settings
          masjid_name: values.masjidName || null,
          masjid_logo_url: values.masjidLogoUrl || null,
          masjid_address: values.masjidAddress || null,
          masjid_name_color: values.masjidNameColor || null,
        },
        { onConflict: "id" } // Upsert based on 'id'
      );

    if (error) {
      console.error("Error saving masjid info settings:", error);
      toast.error("Gagal menyimpan informasi masjid.");
    } else {
      toast.success("Informasi masjid berhasil disimpan!");
      refetchSettings(); // Manually refetch to ensure context is updated immediately
    }
  };

  return (
    <Card className="bg-gray-800 text-white border-gray-700">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-blue-300">Pengaturan Informasi Masjid</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-400 mb-4">Atur nama, logo, dan alamat masjid yang akan ditampilkan di layar utama.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="masjidName" className="text-gray-300">Nama Masjid</Label>
            <Input
              id="masjidName"
              {...register("masjidName")}
              className="bg-gray-700 border-gray-600 text-white mt-1"
              placeholder="Contoh: Masjid Agung Al-Falah"
            />
            {errors.masjidName && <p className="text-red-400 text-sm mt-1">{errors.masjidName.message}</p>}
          </div>
          <div>
            <Label htmlFor="masjidLogoUpload" className="text-gray-300">Unggah Logo Masjid (Opsional)</Label>
            <Input
              id="masjidLogoUpload"
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="bg-gray-700 border-gray-600 text-white mt-1 file:text-white file:bg-blue-600 file:hover:bg-blue-700 file:border-none file:rounded-md file:px-3 file:py-1"
            />
            {currentLogoUrl && (
              <div className="mt-2">
                <p className="text-sm text-gray-400 mb-1">Logo saat ini:</p>
                <img src={currentLogoUrl} alt="Current Masjid Logo" className="max-w-full h-24 object-contain rounded-md border border-gray-600" />
              </div>
            )}
            {errors.masjidLogoUrl && <p className="text-red-400 text-sm mt-1">{errors.masjidLogoUrl.message}</p>}
          </div>
          <div>
            <Label htmlFor="masjidAddress" className="text-gray-300">Alamat Masjid</Label>
            <Textarea
              id="masjidAddress"
              {...register("masjidAddress")}
              className="bg-gray-700 border-gray-600 text-white mt-1 min-h-[80px]"
              placeholder="Contoh: Jl. Raya No. 1, Kota Jakarta"
            />
            {errors.masjidAddress && <p className="text-red-400 text-sm mt-1">{errors.masjidAddress.message}</p>}
          </div>
          <div>
            <Label htmlFor="masjidNameColor" className="text-gray-300">Warna Font Nama Masjid (Hex)</Label>
            <Input
              id="masjidNameColor"
              type="text"
              {...register("masjidNameColor")}
              className="bg-gray-700 border-gray-600 text-white mt-1"
              placeholder="Contoh: #FFFFFF atau #34D399"
            />
            {errors.masjidNameColor && <p className="text-red-400 text-sm mt-1">{errors.masjidNameColor.message}</p>}
            {form.watch("masjidNameColor") && (
              <div className="mt-2 flex items-center space-x-2">
                <div
                  className="w-8 h-8 rounded-full border border-gray-600"
                  style={{ backgroundColor: form.watch("masjidNameColor") || "#34D399" }}
                ></div>
                <span className="text-gray-400 text-sm">Pratinjau Warna</span>
              </div>
            )}
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            {isSubmitting ? "Menyimpan..." : "Simpan Informasi Masjid"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default MasjidInfoSettings;