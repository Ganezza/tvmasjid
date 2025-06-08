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

// Define schema for form validation
const formSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).default(-6.2088), // Default to Jakarta's approximate latitude
  longitude: z.coerce.number().min(-180).max(180).default(106.8456), // Default to Jakarta's approximate longitude
  calculationMethod: z.string().default("MuslimWorldLeague"),
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
  const form = useForm<PrayerTimeSettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      latitude: -6.2088,
      longitude: 106.8456,
      calculationMethod: "MuslimWorldLeague",
    },
  });

  const { handleSubmit, register, setValue, formState: { isSubmitting, errors } } = form;

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("latitude, longitude, calculation_method")
        .eq("id", 1) // Assuming a single row for app settings
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
        console.error("Error fetching settings:", error);
        toast.error("Gagal memuat pengaturan waktu sholat.");
      } else if (data) {
        setValue("latitude", data.latitude);
        setValue("longitude", data.longitude);
        setValue("calculationMethod", data.calculation_method);
      }
    };
    fetchSettings();
  }, [setValue]);

  const onSubmit = async (values: PrayerTimeSettingsFormValues) => {
    const { data, error } = await supabase
      .from("app_settings")
      .upsert(
        {
          id: 1, // Always update the same row for global settings
          latitude: values.latitude,
          longitude: values.longitude,
          calculation_method: values.calculationMethod,
        },
        { onConflict: "id" } // Upsert based on 'id'
      );

    if (error) {
      console.error("Error saving settings:", error);
      toast.error("Gagal menyimpan pengaturan waktu sholat.");
    } else {
      toast.success("Pengaturan waktu sholat berhasil disimpan!");
      console.log("Settings saved:", data);
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
          <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            {isSubmitting ? "Menyimpan..." : "Simpan Pengaturan"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default PrayerTimeSettings;