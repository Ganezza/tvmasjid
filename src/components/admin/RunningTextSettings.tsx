import React, { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAppSettings } from "@/contexts/AppSettingsContext"; // Import useAppSettings

// Define schema for form validation
const formSchema = z.object({
  runningText: z.string().min(1, "Teks berjalan tidak boleh kosong."),
});

type RunningTextSettingsFormValues = z.infer<typeof formSchema>;

const RunningTextSettings: React.FC = () => {
  const { settings, isLoadingSettings, refetchSettings } = useAppSettings(); // Use the new hook

  const form = useForm<RunningTextSettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      runningText: "",
    },
  });

  const { handleSubmit, register, setValue, formState: { isSubmitting, errors } } = form;

  useEffect(() => {
    if (!isLoadingSettings && settings) {
      setValue("runningText", settings.running_text || "");
    }
  }, [settings, isLoadingSettings, setValue]);

  const onSubmit = async (values: RunningTextSettingsFormValues) => {
    const { data, error } = await supabase
      .from("app_settings")
      .upsert(
        {
          id: 1, // Always update the same row for global settings
          running_text: values.runningText,
        },
        { onConflict: "id" } // Upsert based on 'id'
      );

    if (error) {
      console.error("Error saving running text:", error);
      toast.error("Gagal menyimpan teks berjalan.");
    } else {
      toast.success("Teks berjalan berhasil disimpan!");
      console.log("Running text saved:", data);
      refetchSettings(); // Manually refetch to ensure context is updated immediately
    }
  };

  return (
    <Card className="bg-gray-800 text-white border-gray-700">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-blue-300">Pengaturan Teks Berjalan</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-400 mb-4">Atur teks yang akan ditampilkan sebagai teks berjalan di bagian bawah layar utama.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="runningText" className="text-gray-300">Teks Berjalan</Label>
            <Textarea
              id="runningText"
              {...register("runningText")}
              className="bg-gray-700 border-gray-600 text-white mt-1 min-h-[100px]"
              placeholder="Masukkan teks berjalan di sini..."
            />
            {errors.runningText && <p className="text-red-400 text-sm mt-1">{errors.runningText.message}</p>}
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            {isSubmitting ? "Menyimpan..." : "Simpan Teks Berjalan"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default RunningTextSettings;