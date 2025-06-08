import React, { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const formSchema = z.object({
  backgroundImageUrl: z.string().url("URL gambar tidak valid.").nullable().optional(),
  backgroundColor: z.string().min(1, "Warna latar belakang tidak boleh kosong.").default("#0A0A0A"),
});

type DisplaySettingsFormValues = z.infer<typeof formSchema>;

const DisplaySettings: React.FC = () => {
  const form = useForm<DisplaySettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      backgroundImageUrl: null,
      backgroundColor: "#0A0A0A",
    },
  });

  const { handleSubmit, register, setValue, formState: { isSubmitting, errors } } = form;

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("background_image_url, background_color")
        .eq("id", 1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching display settings:", error);
        toast.error("Gagal memuat pengaturan tampilan.");
      } else if (data) {
        setValue("backgroundImageUrl", data.background_image_url);
        setValue("backgroundColor", data.background_color || "#0A0A0A");
      }
    };
    fetchSettings();
  }, [setValue]);

  const onSubmit = async (values: DisplaySettingsFormValues) => {
    const { data, error } = await supabase
      .from("app_settings")
      .upsert(
        {
          id: 1,
          background_image_url: values.backgroundImageUrl || null,
          background_color: values.backgroundColor,
        },
        { onConflict: "id" }
      );

    if (error) {
      console.error("Error saving display settings:", error);
      toast.error("Gagal menyimpan pengaturan tampilan.");
    } else {
      toast.success("Pengaturan tampilan berhasil disimpan!");
      console.log("Display settings saved:", data);
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
            <Label htmlFor="backgroundImageUrl" className="text-gray-300">URL Gambar Latar Belakang (Opsional)</Label>
            <Input
              id="backgroundImageUrl"
              type="url"
              {...register("backgroundImageUrl")}
              className="bg-gray-700 border-gray-600 text-white mt-1"
              placeholder="Contoh: https://example.com/masjid.jpg"
            />
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
          <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            {isSubmitting ? "Menyimpan..." : "Simpan Pengaturan Tampilan"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default DisplaySettings;