import React, { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAppSettings } from "@/contexts/AppSettingsContext"; // Import useAppSettings

const RamadanModeSettings: React.FC = () => {
  const { settings, isLoadingSettings, refetchSettings } = useAppSettings(); // Use the new hook
  const [isRamadanModeActive, setIsRamadanModeActive] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  useEffect(() => {
    if (!isLoadingSettings && settings) {
      setIsRamadanModeActive(settings.is_ramadan_mode_active);
      setIsLoading(false);
    } else if (!isLoadingSettings && !settings) {
      // Handle case where settings might not be loaded (e.g., initial empty DB)
      setIsRamadanModeActive(false);
      setIsLoading(false);
    }
  }, [settings, isLoadingSettings]);

  const handleToggleRamadanMode = async (checked: boolean) => {
    setIsRamadanModeActive(checked);
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        {
          id: 1, // Always update the same row for global settings
          is_ramadan_mode_active: checked,
        },
        { onConflict: "id" }
      );

    if (error) {
      console.error("Error saving Ramadan mode setting:", error);
      toast.error("Gagal menyimpan pengaturan mode Ramadan.");
      setIsRamadanModeActive(!checked); // Revert on error
    } else {
      toast.success(`Mode Ramadan ${checked ? "diaktifkan" : "dinonaktifkan"}.`);
      refetchSettings(); // Manually refetch to ensure context is updated immediately
    }
  };

  return (
    <Card className="bg-gray-800 text-white border-gray-700">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-blue-300">Pengaturan Mode Ramadan</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-400 mb-4">Aktifkan mode Ramadan untuk menampilkan waktu Imsak.</p>
        <div className="flex items-center justify-between space-x-2">
          <Label htmlFor="ramadan-mode" className="text-gray-300 text-lg">Aktifkan Mode Ramadan</Label>
          {isLoading ? (
            <div className="w-12 h-6 bg-gray-700 rounded-full animate-pulse"></div>
          ) : (
            <Switch
              id="ramadan-mode"
              checked={isRamadanModeActive}
              onCheckedChange={handleToggleRamadanMode}
              className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-600"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RamadanModeSettings;