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
import { v4 as uuidv4 } from 'uuid'; // Import uuid for unique file names

const formSchema = z.object({
  murottalActive: z.boolean().default(false),
  tarhimActive: z.boolean().default(false),
  iqomahCountdownDuration: z.coerce.number().int().min(0, "Durasi harus non-negatif.").default(300), // in seconds
  murottalPreAdhanDuration: z.coerce.number().int().min(0, "Durasi harus non-negatif.").default(10), // in minutes
  tarhimPreAdhanDuration: z.coerce.number().int().min(0, "Durasi harus non-negatif.").default(300), // Changed default to 300 seconds (5 minutes)
  murottalAudioUrlFajr: z.string().nullable().optional(),
  murottalAudioUrlDhuhr: z.string().nullable().optional(),
  murottalAudioUrlAsr: z.string().nullable().optional(),
  murottalAudioUrlMaghrib: z.string().nullable().optional(),
  murottalAudioUrlIsha: z.string().nullable().optional(),
  murottalAudioUrlImsak: z.string().nullable().optional(),
  tarhimAudioUrl: z.string().nullable().optional(),
  khutbahDurationMinutes: z.coerce.number().int().min(1, "Durasi khutbah harus lebih dari 0 menit.").default(45),
  isMasterAudioActive: z.boolean().default(true), // New field for master audio switch
  adhanBeepAudioUrl: z.string().nullable().optional(), // New field for Adhan beep
  iqomahBeepAudioUrl: z.string().nullable().optional(), // New field for Iqomah beep
  imsakBeepAudioUrl: z.string().nullable().optional(), // NEW FIELD FOR IMSAK BEEP
});

type AudioSettingsFormValues = z.infer<typeof formSchema>;

const PRAYER_AUDIO_FIELDS = [
  { name: "murottalAudioUrlFajr", label: "Audio Murottal Subuh" },
  { name: "murottalAudioUrlDhuhr", label: "Audio Murottal Dzuhur" },
  { name: "murottalAudioUrlAsr", label: "Audio Murottal Ashar" },
  { name: "murottalAudioUrlMaghrib", label: "Audio Murottal Maghrib" },
  { name: "murottalAudioUrlIsha", label: "Audio Murottal Isya" },
  { name: "murottalAudioUrlImsak", label: "Audio Murottal Imsak (Mode Ramadan)" },
];

const AudioSettings: React.FC = () => {
  const form = useForm<AudioSettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      murottalActive: false,
      tarhimActive: false,
      iqomahCountdownDuration: 300,
      murottalPreAdhanDuration: 10,
      tarhimPreAdhanDuration: 300,
      murottalAudioUrlFajr: null,
      murottalAudioUrlDhuhr: null,
      murottalAudioUrlAsr: null,
      murottalAudioUrlMaghrib: null,
      murottalAudioUrlIsha: null,
      murottalAudioUrlImsak: null,
      tarhimAudioUrl: null,
      khutbahDurationMinutes: 45,
      isMasterAudioActive: true, // Default to true
      adhanBeepAudioUrl: null, // Default for new field
      iqomahBeepAudioUrl: null, // Default for new field
      imsakBeepAudioUrl: null, // Default for new field
    },
  });

  const { handleSubmit, register, setValue, formState: { isSubmitting, errors } } = form;

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("murottal_active, tarhim_active, iqomah_countdown_duration, murottal_pre_adhan_duration, tarhim_pre_adhan_duration, murottal_audio_url_fajr, murottal_audio_url_dhuhr, murottal_audio_url_asr, murottal_audio_url_maghrib, murottal_audio_url_isha, murottal_audio_url_imsak, tarhim_audio_url, khutbah_duration_minutes, is_master_audio_active, adhan_beep_audio_url, iqomah_beep_audio_url, imsak_beep_audio_url")
        .eq("id", 1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching audio settings:", error);
        toast.error("Gagal memuat pengaturan audio.");
      } else if (data) {
        setValue("murottalActive", data.murottal_active);
        setValue("tarhimActive", data.tarhim_active);
        setValue("iqomahCountdownDuration", data.iqomah_countdown_duration);
        setValue("murottalPreAdhanDuration", data.murottal_pre_adhan_duration || 10);
        setValue("tarhimPreAdhanDuration", data.tarhim_pre_adhan_duration || 300);
        setValue("murottalAudioUrlFajr", data.murottal_audio_url_fajr);
        setValue("murottalAudioUrlDhuhr", data.murottal_audio_url_dhuhr);
        setValue("murottalAudioUrlAsr", data.murottal_audio_url_asr);
        setValue("murottalAudioUrlMaghrib", data.murottal_audio_url_maghrib);
        setValue("murottalAudioUrlIsha", data.murottal_audio_url_isha);
        setValue("murottalAudioUrlImsak", data.murottal_audio_url_imsak);
        setValue("tarhimAudioUrl", data.tarhim_audio_url);
        setValue("khutbahDurationMinutes", data.khutbah_duration_minutes || 45);
        setValue("isMasterAudioActive", data.is_master_audio_active ?? true); // Set new field, default to true if null
        setValue("adhanBeepAudioUrl", data.adhan_beep_audio_url); // Set new field
        setValue("iqomahBeepAudioUrl", data.iqomah_beep_audio_url); // Set new field
        setValue("imsakBeepAudioUrl", data.imsak_beep_audio_url); // SET NEW FIELD
      }
    };
    fetchSettings();
  }, [setValue]);

  const handleAudioUpload = async (event: React.ChangeEvent<HTMLInputElement>, fieldName: keyof AudioSettingsFormValues) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const fileExtension = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    const filePath = `audio/${fileName}`; // Path inside the 'audio' bucket

    const uploadToastId = toast.loading(`Mengunggah audio untuk ${fieldName.replace('murottalAudioUrl', '').replace('tarhimAudioUrl', 'Tarhim').replace('adhanBeepAudioUrl', 'Adzan Beep').replace('iqomahBeepAudioUrl', 'Iqomah Beep').replace('imsakBeepAudioUrl', 'Imsak Beep')}...`);

    try {
      const { data, error } = await supabase.storage
        .from('audio') // Use 'audio' bucket
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw error;
      }

      const { data: publicUrlData } = supabase.storage
        .from('audio')
        .getPublicUrl(filePath);

      if (publicUrlData?.publicUrl) {
        setValue(fieldName, publicUrlData.publicUrl as any); // Cast to any because fieldName is dynamic
        toast.success("Audio berhasil diunggah!", { id: uploadToastId });
      } else {
        throw new Error("Gagal mendapatkan URL publik audio.");
      }
    } catch (error: any) {
      console.error("Error uploading audio:", error);
      toast.error(`Gagal mengunggah audio: ${error.message}`, { id: uploadToastId });
    }
  };

  const handleRemoveAudio = async (fieldName: keyof AudioSettingsFormValues) => {
    const currentUrl = form.getValues(fieldName);
    if (!currentUrl) return;

    if (!window.confirm("Apakah Anda yakin ingin menghapus audio ini?")) {
      return;
    }

    const deleteToastId = toast.loading("Menghapus audio...");

    try {
      const urlParts = (currentUrl as string).split('/');
      const fileNameWithFolder = urlParts.slice(urlParts.indexOf('audio') + 1).join('/');
      
      const { error } = await supabase.storage
        .from('audio')
        .remove([fileNameWithFolder]);

      if (error) {
        throw error;
      }

      setValue(fieldName, null as any); // Clear the URL in the form
      toast.success("Audio berhasil dihapus!", { id: deleteToastId });
    } catch (error: any) {
      console.error("Error removing audio:", error);
      toast.error(`Gagal menghapus audio: ${error.message}`, { id: deleteToastId });
    }
  };

  const onSubmit = async (values: AudioSettingsFormValues) => {
    const { data, error } = await supabase
      .from("app_settings")
      .upsert(
        {
          id: 1,
          murottal_active: values.murottalActive,
          tarhim_active: values.tarhimActive,
          iqomah_countdown_duration: values.iqomahCountdownDuration,
          murottal_pre_adhan_duration: values.murottalPreAdhanDuration,
          tarhim_pre_adhan_duration: values.tarhimPreAdhanDuration,
          murottal_audio_url_fajr: values.murottalAudioUrlFajr,
          murottal_audio_url_dhuhr: values.murottalAudioUrlDhuhr,
          murottal_audio_url_asr: values.murottalAudioUrlAsr,
          murottal_audio_url_maghrib: values.murottalAudioUrlMaghrib,
          murottal_audio_url_isha: values.murottalAudioUrlIsha,
          murottal_audio_url_imsak: values.murottalAudioUrlImsak,
          tarhim_audio_url: values.tarhimAudioUrl,
          khutbah_duration_minutes: values.khutbahDurationMinutes,
          is_master_audio_active: values.isMasterAudioActive, // Save new field
          adhan_beep_audio_url: values.adhanBeepAudioUrl, // Save new field
          iqomah_beep_audio_url: values.iqomahBeepAudioUrl, // Save new field
          imsak_beep_audio_url: values.imsakBeepAudioUrl, // SAVE NEW FIELD
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
        <p className="text-gray-400 mb-4">Atur status audio, durasi hitung mundur Iqomah, dan audio murottal per waktu sholat.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Master Audio Switch */}
          <div className="flex items-center justify-between space-x-2 border-b border-gray-700 pb-6 mb-6">
            <Label htmlFor="master-audio-active" className="text-gray-300 text-lg font-bold">Aktifkan Semua Audio (Master Switch)</Label>
            <Switch
              id="master-audio-active"
              checked={form.watch("isMasterAudioActive")}
              onCheckedChange={(checked) => setValue("isMasterAudioActive", checked)}
              className="data-[state=checked]:bg-purple-600 data-[state=unchecked]:bg-gray-600"
            />
          </div>

          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="murottal-active" className="text-gray-300 text-lg">Aktifkan Murottal Otomatis</Label>
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
          
          <div className="border-t border-gray-700 pt-6">
            <h3 className="text-xl font-semibold text-blue-300 mb-4">Pengaturan Murottal Otomatis</h3>
            <div>
              <Label htmlFor="murottalPreAdhanDuration" className="text-gray-300">Putar Murottal Sebelum Adzan (menit)</Label>
              <Input
                id="murottalPreAdhanDuration"
                type="number"
                {...register("murottalPreAdhanDuration")}
                className="bg-gray-700 border-gray-600 text-white mt-1"
                placeholder="Contoh: 10 (untuk 10 menit sebelum adzan)"
              />
              {errors.murottalPreAdhanDuration && <p className="text-red-400 text-sm mt-1">{errors.murottalPreAdhanDuration.message}</p>}
            </div>

            <div className="space-y-4 mt-4">
              {PRAYER_AUDIO_FIELDS.map((field) => (
                <div key={field.name}>
                  <Label htmlFor={field.name} className="text-gray-300">{field.label}</Label>
                  <Input
                    id={field.name}
                    type="file"
                    accept="audio/*"
                    onChange={(e) => handleAudioUpload(e, field.name as keyof AudioSettingsFormValues)}
                    className="bg-gray-700 border-gray-600 text-white mt-1 file:text-white file:bg-blue-600 file:hover:bg-blue-700 file:border-none file:rounded-md file:px-3 file:py-1"
                  />
                  {form.watch(field.name as keyof AudioSettingsFormValues) && (
                    <div className="mt-2 flex items-center space-x-2">
                      <audio controls src={form.watch(field.name as keyof AudioSettingsFormValues) as string} className="w-full max-w-xs" />
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => handleRemoveAudio(field.name as keyof AudioSettingsFormValues)}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        Hapus
                      </Button>
                    </div>
                  )}
                  {errors[field.name as keyof AudioSettingsFormValues] && <p className="text-red-400 text-sm mt-1">{(errors[field.name as keyof AudioSettingsFormValues] as any).message}</p>}
                </div>
              ))}

              {/* Tarhim Audio Upload Field */}
              <div>
                <Label htmlFor="tarhimAudioUrl" className="text-gray-300">Audio Tarhim (Opsional)</Label>
                <Input
                  id="tarhimAudioUrl"
                  type="file"
                  accept="audio/*"
                  onChange={(e) => handleAudioUpload(e, "tarhimAudioUrl")}
                  className="bg-gray-700 border-gray-600 text-white mt-1 file:text-white file:bg-blue-600 file:hover:bg-blue-700 file:border-none file:rounded-md file:px-3 file:py-1"
                />
                {form.watch("tarhimAudioUrl") && (
                  <div className="mt-2 flex items-center space-x-2">
                    <audio controls src={form.watch("tarhimAudioUrl") as string} className="w-full max-w-xs" />
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => handleRemoveAudio("tarhimAudioUrl")}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Hapus
                    </Button>
                  </div>
                )}
                {errors.tarhimAudioUrl && <p className="text-red-400 text-sm mt-1">{errors.tarhimAudioUrl.message}</p>}
              </div>
            </div>
          </div>

          {/* New Tarhim Duration Setting */}
          <div className="border-t border-gray-700 pt-6">
            <h3 className="text-xl font-semibold text-blue-300 mb-4">Pengaturan Tarhim</h3>
            <div>
              <Label htmlFor="tarhimPreAdhanDuration" className="text-gray-300">Putar Tarhim Sebelum Adzan (detik)</Label>
              <Input
                id="tarhimPreAdhanDuration"
                type="number"
                {...register("tarhimPreAdhanDuration")}
                className="bg-gray-700 border-gray-600 text-white mt-1"
                placeholder="Contoh: 314 (untuk 5 menit 14 detik)"
              />
              {errors.tarhimPreAdhanDuration && <p className="text-red-400 text-sm mt-1">{errors.tarhimPreAdhanDuration.message}</p>}
            </div>
          </div>

          {/* Khutbah Duration Setting */}
          <div className="border-t border-gray-700 pt-6">
            <h3 className="text-xl font-semibold text-blue-300 mb-4">Pengaturan Khutbah Jumat</h3>
            <div>
              <Label htmlFor="khutbahDurationMinutes" className="text-gray-300">Durasi Khutbah Jumat (menit)</Label>
              <Input
                id="khutbahDurationMinutes"
                type="number"
                {...register("khutbahDurationMinutes")}
                className="bg-gray-700 border-gray-600 text-white mt-1"
                placeholder="Contoh: 45"
              />
              {errors.khutbahDurationMinutes && <p className="text-red-400 text-sm mt-1">{errors.khutbahDurationMinutes.message}</p>}
            </div>
          </div>

          {/* New Beep Audio Settings */}
          <div className="border-t border-gray-700 pt-6">
            <h3 className="text-xl font-semibold text-blue-300 mb-4">Pengaturan Audio Beep</h3>
            <div>
              <Label htmlFor="imsakBeepAudioUrl" className="text-gray-300">Audio Beep Imsak (Opsional)</Label>
              <Input
                id="imsakBeepAudioUrl"
                type="file"
                accept="audio/*"
                onChange={(e) => handleAudioUpload(e, "imsakBeepAudioUrl")}
                className="bg-gray-700 border-gray-600 text-white mt-1 file:text-white file:bg-blue-600 file:hover:bg-blue-700 file:border-none file:rounded-md file:px-3 file:py-1"
              />
              {form.watch("imsakBeepAudioUrl") && (
                <div className="mt-2 flex items-center space-x-2">
                  <audio controls src={form.watch("imsakBeepAudioUrl") as string} className="w-full max-w-xs" />
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => handleRemoveAudio("imsakBeepAudioUrl")}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Hapus
                  </Button>
                </div>
              )}
              {errors.imsakBeepAudioUrl && <p className="text-red-400 text-sm mt-1">{errors.imsakBeepAudioUrl.message}</p>}
            </div>
            <div className="mt-4">
              <Label htmlFor="adhanBeepAudioUrl" className="text-gray-300">Audio Beep Adzan (Opsional)</Label>
              <Input
                id="adhanBeepAudioUrl"
                type="file"
                accept="audio/*"
                onChange={(e) => handleAudioUpload(e, "adhanBeepAudioUrl")}
                className="bg-gray-700 border-gray-600 text-white mt-1 file:text-white file:bg-blue-600 file:hover:bg-blue-700 file:border-none file:rounded-md file:px-3 file:py-1"
              />
              {form.watch("adhanBeepAudioUrl") && (
                <div className="mt-2 flex items-center space-x-2">
                  <audio controls src={form.watch("adhanBeepAudioUrl") as string} className="w-full max-w-xs" />
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => handleRemoveAudio("adhanBeepAudioUrl")}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Hapus
                  </Button>
                </div>
              )}
              {errors.adhanBeepAudioUrl && <p className="text-red-400 text-sm mt-1">{errors.adhanBeepAudioUrl.message}</p>}
            </div>
            <div className="mt-4">
              <Label htmlFor="iqomahBeepAudioUrl" className="text-gray-300">Audio Beep Iqomah (Opsional)</Label>
              <Input
                id="iqomahBeepAudioUrl"
                type="file"
                accept="audio/*"
                onChange={(e) => handleAudioUpload(e, "iqomahBeepAudioUrl")}
                className="bg-gray-700 border-gray-600 text-white mt-1 file:text-white file:bg-blue-600 file:hover:bg-blue-700 file:border-none file:rounded-md file:px-3 file:py-1"
              />
              {form.watch("iqomahBeepAudioUrl") && (
                <div className="mt-2 flex items-center space-x-2">
                  <audio controls src={form.watch("iqomahBeepAudioUrl") as string} className="w-full max-w-xs" />
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => handleRemoveAudio("iqomahBeepAudioUrl")}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Hapus
                  </Button>
                </div>
              )}
              {errors.iqomahBeepAudioUrl && <p className="text-red-400 text-sm mt-1">{errors.iqomahBeepAudioUrl.message}</p>}
            </div>
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