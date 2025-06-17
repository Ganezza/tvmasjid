import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { v4 as uuidv4 } from 'uuid';
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { Upload } from "lucide-react";

interface MediaFile {
  id: string;
  title: string | null;
  file_path: string; // This is the path in the bucket, not the public URL
  file_type: "audio" | "video";
  source_type: "upload" | "youtube";
}

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
  isMasterAudioActive: z.boolean().default(true),
  adhanBeepAudioUrl: z.string().nullable().optional(),
  iqomahBeepAudioUrl: z.string().nullable().optional(),
  imsakBeepAudioUrl: z.string().nullable().optional(),
});

type AudioSettingsFormValues = z.infer<typeof formSchema>;

const uploadAudioFormSchema = z.object({
  title: z.string().max(100, "Judul terlalu panjang.").nullable().optional(),
  file: z.instanceof(FileList).refine(file => file.length > 0, "File audio harus diunggah."),
});

type UploadAudioFormValues = z.infer<typeof uploadAudioFormSchema>;

const PRAYER_AUDIO_FIELDS = [
  { name: "murottalAudioUrlFajr", label: "Audio Murottal Subuh" },
  { name: "murottalAudioUrlDhuhr", label: "Audio Murottal Dzuhur" },
  { name: "murottalAudioUrlAsr", label: "Audio Murottal Ashar" },
  { name: "murottalAudioUrlMaghrib", label: "Audio Murottal Maghrib" },
  { name: "murottalAudioUrlIsha", label: "Audio Murottal Isya" },
  { name: "murottalAudioUrlImsak", label: "Audio Murottal Imsak (Mode Ramadan)" },
];

const fieldNameToDbColumnMap: Record<keyof AudioSettingsFormValues, string> = {
  murottalActive: "murottal_active",
  tarhimActive: "tarhim_active",
  iqomahCountdownDuration: "iqomah_countdown_duration",
  murottalPreAdhanDuration: "murottal_pre_adhan_duration",
  tarhimPreAdhanDuration: "tarhim_pre_adhan_duration",
  murottalAudioUrlFajr: "murottal_audio_url_fajr",
  murottalAudioUrlDhuhr: "murottal_audio_url_dhuhr",
  murottalAudioUrlAsr: "murottal_audio_url_asr",
  murottalAudioUrlMaghrib: "murottal_audio_url_maghrib",
  murottalAudioUrlIsha: "murottal_audio_url_isha",
  murottalAudioUrlImsak: "murottal_audio_url_imsak",
  tarhimAudioUrl: "tarhim_audio_url",
  khutbahDurationMinutes: "khutbah_duration_minutes",
  isMasterAudioActive: "is_master_audio_active",
  adhanBeepAudioUrl: "adhan_beep_audio_url",
  iqomahBeepAudioUrl: "iqomah_beep_audio_url",
  imsakBeepAudioUrl: "imsak_beep_audio_url",
};
const AudioSettings: React.FC = () => {
  const { settings, isLoadingSettings, refetchSettings } = useAppSettings();
  const [availableAudioFiles, setAvailableAudioFiles] = useState<MediaFile[]>([]);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

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
      isMasterAudioActive: true,
      adhanBeepAudioUrl: null,
      iqomahBeepAudioUrl: null,
      imsakBeepAudioUrl: null,
    },
  });

  const uploadForm = useForm<UploadAudioFormValues>({
    resolver: zodResolver(uploadAudioFormSchema),
    defaultValues: {
      title: "",
      file: undefined,
    },
  });

  const { handleSubmit, register, setValue, formState: { isSubmitting, errors } } = form;
  const { handleSubmit: handleUploadSubmit, register: registerUpload, reset: resetUploadForm, formState: { isSubmitting: isUploading, errors: uploadErrors } } = uploadForm;

  const fetchAvailableAudioFiles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("media_files")
        .select("id, title, file_path, file_type, source_type")
        .eq("file_type", "audio")
        .eq("source_type", "upload")
        .order("title", { ascending: true });

      if (error) {
        console.error("Error fetching available audio files:", error);
        toast.error("Gagal memuat daftar audio.");
      } else {
        setAvailableAudioFiles(data || []);
      }
    } catch (err) {
      console.error("Unexpected error fetching available audio files:", err);
      toast.error("Terjadi kesalahan saat memuat daftar audio.");
    }
  }, []);

  useEffect(() => {
    fetchAvailableAudioFiles(); // Initial fetch of available audio files

    if (!isLoadingSettings && settings) {
      setValue("murottalActive", settings.murottal_active);
      setValue("tarhimActive", settings.tarhim_active);
      setValue("iqomahCountdownDuration", settings.iqomah_countdown_duration);
      setValue("murottalPreAdhanDuration", settings.murottal_pre_adhan_duration || 10);
      setValue("tarhimPreAdhanDuration", settings.tarhim_pre_adhan_duration || 300);
      setValue("murottalAudioUrlFajr", settings.murottal_audio_url_fajr);
      setValue("murottalAudioUrlDhuhr", settings.murottal_audio_url_dhuhr);
      setValue("murottalAudioUrlAsr", settings.murottal_audio_url_asr);
      setValue("murottalAudioUrlMaghrib", settings.murottal_audio_url_maghrib);
      setValue("murottalAudioUrlIsha", settings.murottal_audio_url_isha);
      setValue("murottalAudioUrlImsak", settings.murottal_audio_url_imsak);
      setValue("tarhimAudioUrl", settings.tarhim_audio_url);
      setValue("khutbahDurationMinutes", settings.khutbah_duration_minutes || 45);
      setValue("isMasterAudioActive", settings.is_master_audio_active ?? true);
      setValue("adhanBeepAudioUrl", settings.adhan_beep_audio_url);
      setValue("iqomahBeepAudioUrl", settings.iqomah_beep_audio_url);
      setValue("imsakBeepAudioUrl", settings.imsak_beep_audio_url);
    }
  }, [settings, isLoadingSettings, setValue, fetchAvailableAudioFiles]);

  const handleUploadNewAudio = async (values: UploadAudioFormValues) => {
    const file = values.file[0];
    const fileExtension = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    const filePath = `audio/${fileName}`;

    const uploadToastId = toast.loading(`Mengunggah audio: 0%`);

    try {
      const { data, error } = await supabase.storage
        .from('audio')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: (event: ProgressEvent) => {
            const percent = Math.round((event.loaded * 100) / event.total);
            toast.loading(`Mengunggah audio: ${percent}%`, { id: uploadToastId });
          },
        });

      if (error) {
        throw error;
      }

      const { data: publicUrlData } = supabase.storage
        .from('audio')
        .getPublicUrl(filePath);

      if (publicUrlData?.publicUrl) {
        // Insert into media_files table
        const { error: insertError } = await supabase
          .from('media_files')
          .insert({
            title: values.title || file.name,
            file_path: filePath, // Store the internal path
            file_type: 'audio',
            source_type: 'upload',
            display_order: 0, // Default, can be changed later in MediaPlayerSettings
          });

        if (insertError) {
          // If DB insert fails, try to remove the uploaded file from storage
          await supabase.storage.from('audio').remove([filePath]);
          throw insertError;
        }

        toast.loading("Mengunggah audio: 100%", { id: uploadToastId });
        toast.success("Audio berhasil diunggah dan ditambahkan ke daftar!", { id: uploadToastId });
        toast.info("Untuk performa terbaik di perangkat rendah, pastikan ukuran file audio dioptimalkan (misal: format MP3, bitrate rendah).");
        
        setIsUploadDialogOpen(false);
        resetUploadForm();
        fetchAvailableAudioFiles(); // Refresh the list of available audio files
      } else {
        throw new Error("Gagal mendapatkan URL publik audio.");
      }
    } catch (error: any) {
      console.error("Error uploading audio:", error);
      toast.error(`Gagal mengunggah audio: ${error.message}`, { id: uploadToastId });
    }
  };
  const handleRemoveAudioLink = async (fieldName: keyof AudioSettingsFormValues) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus tautan audio ini dari pengaturan? File audio tidak akan dihapus dari penyimpanan.")) {
      return;
    }

    const deleteToastId = toast.loading("Menghapus tautan audio...");

    try {
      const payload: Partial<AudioSettingsFormValues> & { id: number } = { id: 1 };
      const dbColumnName = fieldNameToDbColumnMap[fieldName];
      if (!dbColumnName) {
        throw new Error(`Unknown field name: ${fieldName}`);
      }
      (payload as any)[dbColumnName] = null;

      const { error: dbError } = await supabase
        .from("app_settings")
        .upsert(payload, { onConflict: "id" });

      if (dbError) {
        throw dbError;
      }

      setValue(fieldName, null as any);
      toast.success("Tautan audio berhasil dihapus!", { id: deleteToastId });
      refetchSettings();
    } catch (error: any) {
      console.error("Caught error during audio link removal process:", error);
      toast.error(`Gagal menghapus tautan audio: ${error.message}`, { id: deleteToastId });
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
          is_master_audio_active: values.isMasterAudioActive,
          adhan_beep_audio_url: values.adhanBeepAudioUrl,
          iqomah_beep_audio_url: values.iqomahBeepAudioUrl,
          imsak_beep_audio_url: values.imsakBeepAudioUrl,
        },
        { onConflict: "id" }
      );

    if (error) {
      console.error("Error saving audio settings:", error);
      toast.error("Gagal menyimpan pengaturan audio.");
    } else {
      toast.success("Pengaturan audio berhasil disimpan!");
      console.log("Audio settings saved:", data);
      refetchSettings();
    }
  };

  return (
    <Card className="bg-gray-800 text-white border-gray-700">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-blue-300">Pengaturan Audio & Iqomah</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-400 mb-4">Atur status audio, durasi hitung mundur Iqomah, dan audio murottal per waktu sholat.</p>
        <Button onClick={() => setIsUploadDialogOpen(true)} className="w-full bg-blue-600 hover:bg-blue-700 text-white mb-4">
          <Upload className="mr-2 h-4 w-4" /> Unggah Audio Baru
        </Button>
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
                  <div className="flex items-center space-x-2 mt-1">
                    <Select
                      onValueChange={(value) => setValue(field.name as keyof AudioSettingsFormValues, value === "null" ? null : value as any)}
                      value={form.watch(field.name as keyof AudioSettingsFormValues) || "null"}
                    >
                      <SelectTrigger className="w-full bg-gray-700 border-gray-600 text-white">
                        <SelectValue placeholder="Pilih Audio Murottal" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-700 text-white border-gray-600">
                        <SelectItem value="null">Tidak Ada</SelectItem>
                        {availableAudioFiles.map((audio) => (
                          <SelectItem key={audio.id} value={supabase.storage.from('audio').getPublicUrl(audio.file_path).data?.publicUrl || ""}>
                            {audio.title || audio.file_path.split('/').pop()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.watch(field.name as keyof AudioSettingsFormValues) && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveAudioLink(field.name as keyof AudioSettingsFormValues)}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        Hapus
                      </Button>
                    )}
                  </div>
                  {form.watch(field.name as keyof AudioSettingsFormValues) && (
                    <div className="mt-2">
                      <audio controls src={form.watch(field.name as keyof AudioSettingsFormValues) as string} className="w-full max-w-xs" />
                    </div>
                  )}
                  {errors[field.name as keyof AudioSettingsFormValues] && <p className="text-red-400 text-sm mt-1">{(errors[field.name as keyof AudioSettingsFormValues] as any).message}</p>}
                </div>
              ))}

              {/* Tarhim Audio Select Field */}
              <div>
                <Label htmlFor="tarhimAudioUrl" className="text-gray-300">Audio Tarhim (Opsional)</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Select
                    onValueChange={(value) => setValue("tarhimAudioUrl", value === "null" ? null : value)}
                    value={form.watch("tarhimAudioUrl") || "null"}
                  >
                    <SelectTrigger className="w-full bg-gray-700 border-gray-600 text-white">
                      <SelectValue placeholder="Pilih Audio Tarhim" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-700 text-white border-gray-600">
                      <SelectItem value="null">Tidak Ada</SelectItem>
                      {availableAudioFiles.map((audio) => (
                        <SelectItem key={audio.id} value={supabase.storage.from('audio').getPublicUrl(audio.file_path).data?.publicUrl || ""}>
                          {audio.title || audio.file_path.split('/').pop()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.watch("tarhimAudioUrl") && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemoveAudioLink("tarhimAudioUrl")}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Hapus
                    </Button>
                  )}
                </div>
                {form.watch("tarhimAudioUrl") && (
                  <div className="mt-2">
                    <audio controls src={form.watch("tarhimAudioUrl") as string} className="w-full max-w-xs" />
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
              <div className="flex items-center space-x-2 mt-1">
                <Select
                  onValueChange={(value) => setValue("imsakBeepAudioUrl", value === "null" ? null : value)}
                  value={form.watch("imsakBeepAudioUrl") || "null"}
                >
                  <SelectTrigger className="w-full bg-gray-700 border-gray-600 text-white">
                    <SelectValue placeholder="Pilih Audio Beep Imsak" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 text-white border-gray-600">
                    <SelectItem value="null">Tidak Ada</SelectItem>
                    {availableAudioFiles.map((audio) => (
                      <SelectItem key={audio.id} value={supabase.storage.from('audio').getPublicUrl(audio.file_path).data?.publicUrl || ""}>
                        {audio.title || audio.file_path.split('/').pop()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.watch("imsakBeepAudioUrl") && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemoveAudioLink("imsakBeepAudioUrl")}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Hapus
                  </Button>
                )}
              </div>
              {form.watch("imsakBeepAudioUrl") && (
                <div className="mt-2">
                  <audio controls src={form.watch("imsakBeepAudioUrl") as string} className="w-full max-w-xs" />
                </div>
              )}
              {errors.imsakBeepAudioUrl && <p className="text-red-400 text-sm mt-1">{errors.imsakBeepAudioUrl.message}</p>}
            </div>
            <div className="mt-4">
              <Label htmlFor="adhanBeepAudioUrl" className="text-gray-300">Audio Beep Adzan (Opsional)</Label>
              <div className="flex items-center space-x-2 mt-1">
                <Select
                  onValueChange={(value) => setValue("adhanBeepAudioUrl", value === "null" ? null : value)}
                  value={form.watch("adhanBeepAudioUrl") || "null"}
                >
                  <SelectTrigger className="w-full bg-gray-700 border-gray-600 text-white">
                    <SelectValue placeholder="Pilih Audio Beep Adzan" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 text-white border-gray-600">
                    <SelectItem value="null">Tidak Ada</SelectItem>
                    {availableAudioFiles.map((audio) => (
                      <SelectItem key={audio.id} value={supabase.storage.from('audio').getPublicUrl(audio.file_path).data?.publicUrl || ""}>
                        {audio.title || audio.file_path.split('/').pop()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.watch("adhanBeepAudioUrl") && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemoveAudioLink("adhanBeepAudioUrl")}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Hapus
                  </Button>
                )}
              </div>
              {form.watch("adhanBeepAudioUrl") && (
                <div className="mt-2">
                  <audio controls src={form.watch("adhanBeepAudioUrl") as string} className="w-full max-w-xs" />
                </div>
              )}
              {errors.adhanBeepAudioUrl && <p className="text-red-400 text-sm mt-1">{errors.adhanBeepAudioUrl.message}</p>}
            </div>
            <div className="mt-4">
              <Label htmlFor="iqomahBeepAudioUrl" className="text-gray-300">Audio Beep Iqomah (Opsional)</Label>
              <div className="flex items-center space-x-2 mt-1">
                <Select
                  onValueChange={(value) => setValue("iqomahBeepAudioUrl", value === "null" ? null : value)}
                  value={form.watch("iqomahBeepAudioUrl") || "null"}
                >
                  <SelectTrigger className="w-full bg-gray-700 border-gray-600 text-white">
                    <SelectValue placeholder="Pilih Audio Beep Iqomah" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 text-white border-gray-600">
                    <SelectItem value="null">Tidak Ada</SelectItem>
                    {availableAudioFiles.map((audio) => (
                      <SelectItem key={audio.id} value={supabase.storage.from('audio').getPublicUrl(audio.file_path).data?.publicUrl || ""}>
                        {audio.title || audio.file_path.split('/').pop()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.watch("iqomahBeepAudioUrl") && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemoveAudioLink("iqomahBeepAudioUrl")}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Hapus
                  </Button>
                )}
              </div>
              {form.watch("iqomahBeepAudioUrl") && (
                <div className="mt-2">
                  <audio controls src={form.watch("iqomahBeepAudioUrl") as string} className="w-full max-w-xs" />
                </div>
              )}
              {errors.iqomahBeepAudioUrl && <p className="text-red-400 text-sm mt-1">{errors.iqomahBeepAudioUrl.message}</p>}
            </div>
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            {isSubmitting ? "Menyimpan..." : "Simpan Pengaturan"}
          </Button>
        </form>

        {/* Dialog for Upload New Audio */}
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogContent className="bg-gray-800 text-white border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-blue-300">Unggah Audio Baru</DialogTitle>
              <DialogDescription>
                Unggah file audio baru untuk digunakan dalam pengaturan murottal, tarhim, atau beep.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUploadSubmit(handleUploadNewAudio)} className="space-y-4">
              <div>
                <Label htmlFor="uploadAudioTitle" className="text-gray-300">Judul Audio (Opsional)</Label>
                <Input
                  id="uploadAudioTitle"
                  {...registerUpload("title")}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                  placeholder="Contoh: Murottal Al-Fatihah"
                />
                {uploadErrors.title && <p className="text-red-400 text-sm mt-1">{uploadErrors.title.message}</p>}
              </div>
              <div>
                <Label htmlFor="uploadAudioFile" className="text-gray-300">Pilih File Audio</Label>
                <Input
                  id="uploadAudioFile"
                  type="file"
                  accept="audio/*"
                  {...registerUpload("file")}
                  className="bg-gray-700 border-gray-600 text-white mt-1 file:text-white file:bg-blue-600 file:hover:bg-blue-700 file:border-none file:rounded-md file:px-3 file:py-1"
                />
                {uploadErrors.file && <p className="text-red-400 text-sm mt-1">{uploadErrors.file.message as string}</p>}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsUploadDialogOpen(false)} className="text-gray-300 border-gray-600 hover:bg-gray-700">
                  Batal
                </Button>
                <Button type="submit" disabled={isUploading} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {isUploading ? "Mengunggah..." : "Unggah Audio"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default AudioSettings;