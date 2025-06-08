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

// Define schema for form validation
const formSchema = z.object({
  masjidName: z.string().min(1, "Nama masjid tidak boleh kosong.").max(100, "Nama masjid terlalu panjang.").optional().nullable(),
  masjidLogoUrl: z.string().nullable().optional(), // No longer strictly a URL for input, but will store URL
  masjidAddress: z.string().min(1, "Alamat masjid tidak boleh kosong.").max(255, "Alamat terlalu panjang.").optional().nullable(),
});

type MasjidInfoSettingsFormValues = z.infer<typeof formSchema>;

const MasjidInfoSettings: React.FC = () => {
  const form = useForm<MasjidInfoSettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      masjidName: "",
      masjidLogoUrl: "",
      masjidAddress: "",
    },
  });

  const { handleSubmit, register, setValue, formState: { isSubmitting, errors } } = form;
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("masjid_name, masjid_logo_url, masjid_address")
        .eq("id", 1) // Assuming a single row for app settings
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
        console.error("Error fetching masjid info settings:", error);
        toast.error("Gagal memuat pengaturan informasi masjid.");
      } else if (data) {
        setValue("masjidName", data.masjid_name || "");
        setValue("masjidLogoUrl", data.masjid_logo_url || "");
        setCurrentLogoUrl(data.masjid_logo_url);
        setValue("masjidAddress", data.masjid_address || "");
      }
    };
    fetchSettings();
  }, [setValue]);

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const fileExtension = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`; // Generate unique file name
    const filePath = `logos/${fileName}`; // Path inside the bucket

    const uploadToastId = toast.loading("Mengunggah logo masjid...");

    try {
      const { data, error } = await supabase.storage
        .from('images') // Use 'images' bucket
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
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
        },
        { onConflict: "id" } // Upsert based on 'id'
      );

    if (error) {
      console.error("Error saving masjid info settings:", error);
      toast.error("Gagal menyimpan informasi masjid.");
    } else {
      toast.success("Informasi masjid berhasil disimpan!");
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
          <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            {isSubmitting ? "Menyimpan..." : "Simpan Informasi Masjid"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default MasjidInfoSettings;