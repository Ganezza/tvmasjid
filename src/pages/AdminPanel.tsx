import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import PrayerTimeSettings from "@/components/admin/PrayerTimeSettings";
import RunningTextSettings from "@/components/admin/RunningTextSettings";
import InfoSlideSettings from "@/components/admin/InfoSlideSettings";
import ImamMuezzinScheduleSettings from "@/components/admin/ImamMuezzinScheduleSettings";
import NotificationStudySettings from "@/components/admin/NotificationStudySettings";
import FinancialSettings from "@/components/admin/FinancialSettings";
import RamadanModeSettings from "@/components/admin/RamadanModeSettings";
import DisplaySettings from "@/components/admin/DisplaySettings";
import AudioSettings from "@/components/admin/AudioSettings";
import MasjidInfoSettings from "@/components/admin/MasjidInfoSettings"; // Import the new component

const AdminPanel = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Admin Panel Masjid TV</h1>
        <Button onClick={() => navigate("/")} className="bg-blue-600 hover:bg-blue-700 text-white">
          Kembali ke Display
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Masjid Info Settings - New component */}
        <MasjidInfoSettings />

        {/* Prayer Time Settings */}
        <PrayerTimeSettings />

        {/* Running Text Settings */}
        <RunningTextSettings />

        {/* Info Slide Settings */}
        <InfoSlideSettings />

        {/* Imam & Muezzin Schedule Settings */}
        <ImamMuezzinScheduleSettings />

        {/* Notification & Study Settings */}
        <NotificationStudySettings />

        {/* Financial Settings */}
        <FinancialSettings />

        {/* Ramadan Mode Settings */}
        <RamadanModeSettings />

        {/* Display Settings */}
        <DisplaySettings />

        {/* Audio Settings */}
        <AudioSettings />
      </div>
    </div>
  );
};

export default AdminPanel;