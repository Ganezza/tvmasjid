import React, { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const formSchema = z.object({
  murottalActive: z.boolean().default(false),
  tarhimActive: z.boolean().default(false),
  iqomahCountdownDuration: z.coerce.number().int().min(0, "Durasi harus non-negatif.").default(300), // in seconds
});

type AudioSettingsFormValues = z.infer<typeof formSchema>;

const AudioSettings: React.FC = () => {
  const form = useForm<AudioSettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      murottalActive: false,
      tarhimActive: false,
      iqomahCountdownDuration: 300,
    },
  });

  const { handleSubmit, register, setValue, formState: { isSubmitting, errors } } = form;

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("murottal_active, tarhim_active, iqomah_countdown_duration")
        .eq("id", 1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching audio settings:", error);
        toast.error("Gagal memuat pengaturan audio.");
      } else if (data) {
        setValue("murottalActive", data.murottal_active);
        setValue("tarhimActive", data.tarhim_active);
        setValue("iqomahCountdownDuration", data.iqomah_countdown_duration);
      }
    };
    fetchSettings();
  }, [setValue]);

  const onSubmit = async (values: AudioSettingsFormValues) => {
    const { data, error } = await supabase
      .from("app_settings")
      .upsert(
        {
          id: 1,
          murottal_active: values.murottalActive,
          tarhim_active: values.tarhimActive,
          iqomah_countdown_duration: values.iqomahCountdownDuration,
        },
        { onConflict: "id" }
      );

    if (error) {
      console.error("Error saving audio settings:", error);
      toast.error("Gagal menyimpan pengaturan audio.");
    } else {
      toast.success("Pengaturan audio berhasil disimpan!");
      console.log("Audio settings saved:", data);
    }
  };

  return (
    <Card className="bg-gray-800 text-white border-gray-700">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-blue-300">Pengaturan Audio & Iqomah</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-400 mb-4">Atur status audio dan durasi hitung mundur Iqomah.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="murottal-active" className="text-gray-300 text-lg">Aktifkan Murottal</Label>
            <Switch
              id="murottal-active"
              checked={form.watch("murottalActive")}
              onCheckedChange={(checked) => setValue("murottalActive", checked)}
              className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-600"
            />
          </div>
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="tarhim-active" className="text-gray-300 text-lg">Aktifkan Tarhim</Label>
            <Switch
              id="tarhim-active"
              checked={form.watch("tarhimActive")}
              onCheckedChange={(checked) => setValue("tarhimActive", checked)}
              className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-600"
            />
          </div>
          <div>
            <Label htmlFor="iqomahCountdownDuration" className="text-gray-300">Durasi Hitung Mundur Iqomah (detik)</Label>
            <Input
              id="iqomahCountdownDuration"
              type="number"
              {...register("iqomahCountdownDuration")}
              className="bg-gray-700 border-gray-600 text-white mt-1"
              placeholder="Contoh: 300 (untuk 5 menit)"
            />
            {errors.iqomahCountdownDuration && <p className="text-red-400 text-sm mt-1">{errors.iqomahCountdownDuration.message}</p>}
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            {isSubmitting ? "Menyimpan..." : "Simpan Pengaturan Audio"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default AudioSettings;