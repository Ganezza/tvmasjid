import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { RealtimeChannel } from "@supabase/supabase-js";

interface AppSettings {
  id: number;
  latitude: number;
  longitude: number;
  calculation_method: string;
  is_ramadan_mode_active: boolean;
  fajr_offset: number;
  dhuhr_offset: number;
  asr_offset: number;
  maghrib_offset: number;
  isha_offset: number;
  imsak_offset: number;
  running_text: string;
  background_image_url: string | null;
  background_color: string;
  murottal_active: boolean;
  tarhim_active: boolean;
  iqomah_countdown_duration: number;
  murottal_pre_adhan_duration: number;
  tarhim_pre_adhan_duration: number;
  murottal_audio_url_fajr: string | null;
  murottal_audio_url_dhuhr: string | null;
  murottal_audio_url_asr: string | null;
  murottal_audio_url_maghrib: string | null;
  murottal_audio_url_isha: string | null;
  murottal_audio_url_imsak: string | null;
  tarhim_audio_url: string | null;
  khutbah_duration_minutes: number;
  is_master_audio_active: boolean;
  adhan_beep_audio_url: string | null;
  iqomah_beep_audio_url: string | null;
  imsak_beep_audio_url: string | null;
  masjid_name: string | null;
  masjid_logo_url: string | null;
  masjid_address: string | null;
  masjid_name_color: string | null;
  active_media_id: string | null;
  // NEW FIELDS FOR PER-PRAYER MUROTTAL SETTINGS
  murottal_active_fajr: boolean;
  murottal_active_dhuhr: boolean;
  murottal_active_asr: boolean;
  murottal_active_maghrib: boolean;
  murottal_active_isha: boolean;
  murottal_active_imsak: boolean;
  murottal_pre_adhan_duration_fajr: number;
  murottal_pre_adhan_duration_dhuhr: number;
  murottal_pre_adhan_duration_asr: number;
  murottal_pre_adhan_duration_maghrib: number;
  murottal_pre_adhan_duration_isha: number;
  murottal_pre_adhan_duration_imsak: number;
}

interface AppSettingsContextType {
  settings: AppSettings | null;
  isLoadingSettings: boolean;
  refetchSettings: () => void; // Function to manually refetch settings
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    try {
      console.log("AppSettingsProvider: Fetching app settings...");
      const { data, error } = await supabase
        .from("app_settings")
        .select("*") // Select all columns
        .eq("id", 1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("AppSettingsProvider: Error fetching app settings:", error);
        toast.error("Gagal memuat pengaturan aplikasi.");
        setSettings(null);
      } else if (data) {
        setSettings(data as AppSettings);
        console.log("AppSettingsProvider: Settings loaded:", data);
      } else {
        // If no settings found, initialize with defaults
        console.log("AppSettingsProvider: No settings found, initializing with defaults.");
        const defaultSettings: AppSettings = {
          id: 1,
          latitude: -6.2088,
          longitude: 106.8456,
          calculation_method: "MuslimWorldLeague",
          is_ramadan_mode_active: false,
          fajr_offset: 0,
          dhuhr_offset: 0,
          asr_offset: 0,
          maghrib_offset: 0,
          isha_offset: 0,
          imsak_offset: 0,
          running_text: "Selamat datang di Masjid Agung Al-Falah. Mari tingkatkan iman dan taqwa kita. Jangan lupa matikan ponsel saat sholat. Semoga Allah menerima amal ibadah kita. Aamiin.",
          background_image_url: null,
          background_color: "#0A0A0A",
          murottal_active: false,
          tarhim_active: false,
          iqomah_countdown_duration: 300,
          murottal_pre_adhan_duration: 10,
          tarhim_pre_adhan_duration: 300,
          murottal_audio_url_fajr: null,
          murottal_audio_url_dhuhr: null,
          murottal_audio_url_asr: null,
          murottal_audio_url_maghrib: null,
          murottal_audio_url_isha: null,
          murottal_audio_url_imsak: null,
          tarhim_audio_url: null,
          khutbah_duration_minutes: 45,
          is_master_audio_active: true,
          adhan_beep_audio_url: null,
          iqomah_beep_audio_url: null,
          imsak_beep_audio_url: null,
          masjid_name: "",
          masjid_logo_url: null,
          masjid_address: null,
          masjid_name_color: "#34D399",
          active_media_id: null,
          // Default values for new fields
          murottal_active_fajr: false,
          murottal_active_dhuhr: false,
          murottal_active_asr: false,
          murottal_active_maghrib: false,
          murottal_active_isha: false,
          murottal_active_imsak: false,
          murottal_pre_adhan_duration_fajr: 10,
          murottal_pre_adhan_duration_dhuhr: 10,
          murottal_pre_adhan_duration_asr: 10,
          murottal_pre_adhan_duration_maghrib: 10,
          murottal_pre_adhan_duration_isha: 10,
          murottal_pre_adhan_duration_imsak: 10,
        };
        setSettings(defaultSettings);
        // Optionally, upsert default settings to DB if they don't exist
        const { error: upsertError } = await supabase
          .from("app_settings")
          .upsert(defaultSettings, { onConflict: "id" });
        if (upsertError) {
          console.error("AppSettingsProvider: Error upserting default settings:", upsertError);
          toast.error("Gagal menyimpan pengaturan default.");
        }
      }
    } catch (err) {
      console.error("AppSettingsProvider: Unexpected error in fetchSettings:", err);
      toast.error("Terjadi kesalahan saat memuat pengaturan aplikasi.");
      setSettings(null);
    } finally {
      setIsLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();

    if (!channelRef.current) {
      channelRef.current = supabase
        .channel('global_app_settings_channel') // Unique channel name for global settings
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'id=eq.1' }, (payload) => {
          console.log('AppSettingsProvider: Realtime update received for app_settings!', payload);
          setSettings(payload.new as AppSettings);
        })
        .subscribe();
      console.log("AppSettingsProvider: Subscribed to global_app_settings_channel.");
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        console.log("AppSettingsProvider: Unsubscribed from global_app_settings_channel.");
        channelRef.current = null;
      }
    };
  }, [fetchSettings]);

  return (
    <AppSettingsContext.Provider value={{ settings, isLoadingSettings, refetchSettings: fetchSettings }}>
      {children}
    </AppSettingsContext.Provider>
  );
};

export const useAppSettings = () => {
  const context = useContext(AppSettingsContext);
  if (context === undefined) {
    throw new Error("useAppSettings must be used within an AppSettingsProvider");
  }
  return context;
};