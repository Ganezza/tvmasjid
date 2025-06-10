import React, { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { RealtimeChannel } from "@supabase/supabase-js";

// Define schema for form validation
const formSchema = z.object({
  runningText: z.string().min(1, "Teks berjalan tidak boleh kosong."),
});

type RunningTextSettingsFormValues = z.infer<typeof formSchema>;

const RunningTextSettings: React.FC = () => {
  const form = useForm<RunningTextSettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      runningText: "",
    },
  });

  const { handleSubmit, register, setValue, formState: { isSubmitting, errors } } = form;
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("running_text")
        .eq("id", 1) // Assuming a single row for app settings
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
        console.error("Error fetching running text settings:", error);
        toast.error("Gagal memuat teks berjalan.");
      } else if (data) {
        setValue("runningText", data.running_text || "");
      }
    };
    fetchSettings();

    if (!channelRef.current) {
      channelRef.current = supabase
        .channel('running_text_settings_changes') // Unique channel name
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'id=eq.1' }, (payload) => {
          console.log('Running text settings change received!', payload);
          fetchSettings(); // Re-fetch if settings change
        })
        .subscribe();
      console.log("RunningTextSettings: Subscribed to channel 'running_text_settings_changes'.");
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        console.log("RunningTextSettings: Unsubscribed from channel 'running_text_settings_changes'.");
        channelRef.current = null;
      }
    };
  }, [setValue]);

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