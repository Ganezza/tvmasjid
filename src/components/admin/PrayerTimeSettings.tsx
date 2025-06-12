import React, { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAppSettings } from "@/contexts/AppSettingsContext"; // Import useAppSettings

// Define schema for form validation
const formSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).default(-6.2088), // Default to Jakarta's approximate latitude
  longitude: z.coerce.number().min(-180).max(180).default(106.8456), // Default to Jakarta's approximate longitude
  calculationMethod: z.string().default("MuslimWorldLeague"),
  fajrOffset: z.coerce.number().int().default(0),
  dhuhrOffset: z.coerce.number().int().default(0),
  asrOffset: z.coerce.number().int().default(0),
  maghribOffset: z.coerce.number().int().default(0),
  ishaOffset: z.coerce.number().int().default(0),
  imsakOffset: z.coerce.number().int().default(0),
});

type PrayerTimeSettingsFormValues = z.infer<typeof formSchema>;

const PRAYER_CALCULATION_METHODS = [
  { value: "MuslimWorldLeague", label: "Muslim World League" },
  { value: "Egyptian", label: "Egyptian General Authority of Survey" },
  { value: "Karachi", label: "University of Islamic Sciences, Karachi" },
  { value: "UmmAlQura", label: "Umm Al-Qura University, Makkah" },
  { value: "Dubai", label: "Dubai" },
  { value: "MoonsightingCommittee", label: "Moonsighting Committee" },
  { value: "NorthAmerica", label: "Islamic Society of North America" },
  { value: "Kuwait", label: "Kuwait" },
  { value: "Qatar", label: "Qatar" },
  { value: "Singapore", label: "Singapore" },
  { value: "Tehran", label: "Institute of Geophysics, University of Tehran" },
  { value: "Turkey", label: "Diyanet İşleri Başkanlığı, Turkey" },
];

const PrayerTimeSettings: React.FC = () => {
  const { settings, isLoadingSettings, refetchSettings } = useAppSettings(); // Use the new hook

  const form = useForm<PrayerTimeSettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      latitude: -6.2088,
      longitude: 106.8456,
      calculationMethod: "MuslimWorldLeague",
      fajrOffset: 0,
      dhuhrOffset: 0,
      asrOffset: 0,
      maghribOffset: 0,
      ishaOffset: 0,
      imsakOffset: 0,
    },
  });

  const { handleSubmit, register, setValue, formState: { isSubmitting, errors } } = form;

  useEffect(() => {
    if (!isLoadingSettings && settings) {
      setValue("latitude", settings.latitude);
      setValue("longitude", settings.longitude);
      setValue("calculationMethod", settings.calculation_method);
      setValue("fajrOffset", settings.fajr_offset ?? 0);
      setValue("dhuhrOffset", settings.dhuhr_offset ?? 0);
      setValue("asrOffset", settings.asr_offset ?? 0);
      setValue("maghribOffset", settings.maghrib_offset ?? 0);
      setValue("ishaOffset", settings.isha_offset ?? 0);
      setValue("imsakOffset", settings.imsak_offset ?? 0);
    }
  }, [settings, isLoadingSettings, setValue]);

  const onSubmit = async (values: PrayerTimeSettingsFormValues) => {
    const { data, error } = await supabase
      .from("app_settings")
      .upsert(
        {
          id: 1, // Always update the same row for global settings
          latitude: values.latitude,
          longitude: values.longitude,
          calculation_method: values.calculationMethod,
          fajr_offset: values.fajrOffset,
          dhuhr_offset: values.dhuhrOffset,
          asr_offset: values.asrOffset,
          maghrib_offset: values.maghribOffset,
          isha_offset: values.ishaOffset,
          imsak_offset: values.imsakOffset,
        },
        { onConflict: "id" } // Upsert based on 'id'
      );

    if (error) {
      console.error("Error saving settings:", error);
      toast.error("Gagal menyimpan pengaturan waktu sholat.");
    } else {
      toast.success("Pengaturan waktu sholat berhasil disimpan!");
      console.log("Settings saved:", data);
      refetchSettings(); // Manually refetch to ensure context is updated immediately
    }
  };

  return (
    <Card className="bg-gray-800 text-white border-gray-700">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-blue-300">Pengaturan Waktu Sholat</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-400 mb-4">Atur lokasi masjid dan metode perhitungan waktu sholat.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="latitude" className="text-gray-300">Lintang (Latitude)</Label>
            <Input
              id="latitude"
              type="number"
              step="any"
              {...register("latitude")}
              className="bg-gray-700 border-gray-600 text-white mt-1"
            />
            {errors.latitude && <p className="text-red-400 text-sm mt-1">{errors.latitude.message}</p>}
          </div>
          <div>
            <Label htmlFor="longitude" className="text-gray-300">Bujur (Longitude)</Label>
            <Input
              id="longitude"
              type="number"
              step="any"
              {...register("longitude")}
              className="bg-gray-700 border-gray-600 text-white mt-1"
            />
            {errors.longitude && <p className="text-red-400 text-sm mt-1">{errors.longitude.message}</p>}
          </div>
          <div>
            <Label htmlFor="calculationMethod" className="text-gray-300">Metode Perhitungan</Label>
            <Select
              onValueChange={(value) => setValue("calculationMethod", value)}
              defaultValue={form.getValues("calculationMethod")}
            >
              <SelectTrigger className="w-full bg-gray-700 border-gray-600 text-white mt-1">
                <SelectValue placeholder="Pilih Metode" />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 text-white border-gray-600">
                {PRAYER_CALCULATION_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.calculationMethod && <p className="text-red-400 text-sm mt-1">{errors.calculationMethod.message}</p>}
          </div>

          <div className="border-t border-gray-700 pt-6 mt-6">
            <h3 className="text-xl font-semibold text-blue-300 mb-4">Koreksi Waktu Sholat (Menit)</h3>
            <p className="text-gray-400 text-sm mb-4">Masukkan nilai positif untuk mempercepat, negatif untuk memperlambat. Contoh: +1 atau -2.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fajrOffset" className="text-gray-300">Subuh</Label>
                <Input
                  id="fajrOffset"
                  type="number"
                  {...register("fajrOffset")}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
                {errors.fajrOffset && <p className="text-red-400 text-sm mt-1">{errors.fajrOffset.message}</p>}
              </div>
              <div>
                <Label htmlFor="imsakOffset" className="text-gray-300">Imsak</Label>
                <Input
                  id="imsakOffset"
                  type="number"
                  {...register("imsakOffset")}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
                {errors.imsakOffset && <p className="text-red-400 text-sm mt-1">{errors.imsakOffset.message}</p>}
              </div>
              <div>
                <Label htmlFor="dhuhrOffset" className="text-gray-300">Dzuhur</Label>
                <Input
                  id="dhuhrOffset"
                  type="number"
                  {...register("dhuhrOffset")}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
                {errors.dhuhrOffset && <p className="text-red-400 text-sm mt-1">{errors.dhuhrOffset.message}</p>}
              </div>
              <div>
                <Label htmlFor="asrOffset" className="text-gray-300">Ashar</Label>
                <Input
                  id="asrOffset"
                  type="number"
                  {...register("asrOffset")}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
                {errors.asrOffset && <p className="text-red-400 text-sm mt-1">{errors.asrOffset.message}</p>}
              </div>
              <div>
                <Label htmlFor="maghribOffset" className="text-gray-300">Maghrib</Label>
                <Input
                  id="maghribOffset"
                  type="number"
                  {...register("maghribOffset")}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
                {errors.maghribOffset && <p className="text-red-400 text-sm mt-1">{errors.maghribOffset.message}</p>}
              </div>
              <div>
                <Label htmlFor="ishaOffset" className="text-gray-300">Isya</Label>
                <Input
                  id="ishaOffset"
                  type="number"
                  {...register("ishaOffset")}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
                {errors.ishaOffset && <p className="text-red-400 text-sm mt-1">{errors.ishaOffset.message}</p>}
              </div>
            </div>
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            {isSubmitting ? "Menyimpan..." : "Simpan Pengaturan"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default PrayerTimeSettings;