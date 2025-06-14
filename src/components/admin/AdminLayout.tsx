import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { signOutAndClearSession } from "@/lib/auth";

// Import all settings components
import MasjidInfoSettings from "@/components/admin/MasjidInfoSettings";
import PrayerTimeSettings from "@/components/admin/PrayerTimeSettings";
import RunningTextSettings from "@/components/admin/RunningTextSettings";
import InfoSlideSettings from "@/components/admin/InfoSlideSettings";
import ImamMuezzinScheduleSettings from "@/components/admin/ImamMuezzinScheduleSettings";
import NotificationStudySettings from "@/components/admin/NotificationStudySettings";
import FinancialSettings from "@/components/admin/FinancialSettings";
import RamadanModeSettings from "@/components/admin/RamadanModeSettings";
import DisplaySettings from "@/components/admin/DisplaySettings";
import AudioSettings from "@/components/admin/AudioSettings";
import IslamicHolidaySettings from "@/components/admin/IslamicHolidaySettings";
import MediaPlayerSettings from "@/components/admin/MediaPlayerSettings";

interface AdminSection {
  id: string;
  title: string;
  component: React.FC;
}

const adminSections: AdminSection[] = [
  { id: "masjid-info", title: "Informasi Masjid", component: MasjidInfoSettings },
  { id: "prayer-time", title: "Waktu Sholat", component: PrayerTimeSettings },
  { id: "audio", title: "Audio & Iqomah", component: AudioSettings },
  { id: "ramadan-mode", title: "Mode Ramadan", component: RamadanModeSettings },
  { id: "display", title: "Tampilan", component: DisplaySettings },
  { id: "info-slides", title: "Slide Informasi", component: InfoSlideSettings },
  { id: "media-player", title: "Media Player", component: MediaPlayerSettings },
  { id: "running-text", title: "Teks Berjalan", component: RunningTextSettings },
  { id: "imam-muezzin", title: "Jadwal Imam & Muadzin", component: ImamMuezzinScheduleSettings },
  { id: "notifications-studies", title: "Notifikasi & Kajian", component: NotificationStudySettings },
  { id: "financial", title: "Keuangan", component: FinancialSettings },
  { id: "islamic-holidays", title: "Hari Besar Islam", component: IslamicHolidaySettings },
];

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<string>(adminSections[0].id);

  const ActiveComponent = adminSections.find(
    (section) => section.id === activeSection
  )?.component;

  const handleLogout = async () => {
    await signOutAndClearSession();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-blue-300">Admin Panel</h2>
        </div>
        <ScrollArea className="flex-grow py-4">
          <nav className="space-y-1 px-4">
            {adminSections.map((section) => (
              <Button
                key={section.id}
                variant="ghost"
                className={cn(
                  "w-full justify-start text-lg py-2 px-3 rounded-md",
                  activeSection === section.id
                    ? "bg-blue-700 text-white hover:bg-blue-600"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                )}
                onClick={() => setActiveSection(section.id)}
              >
                {section.title}
              </Button>
            ))}
          </nav>
        </ScrollArea>
        <div className="p-4 border-t border-gray-700 space-y-2">
          <Button
            onClick={() => navigate("/")}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            Kembali ke Display
          </Button>
          <Button
            onClick={handleLogout}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8">
        {ActiveComponent ? (
          <ActiveComponent />
        ) : (
          <div className="text-center text-gray-400 text-xl">
            Pilih bagian dari sidebar untuk mengelola pengaturan.
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminLayout;