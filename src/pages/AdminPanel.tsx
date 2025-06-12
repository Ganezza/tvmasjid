import React, { useState } from "react";
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
import MasjidInfoSettings from "@/components/admin/MasjidInfoSettings";
import IslamicHolidaySettings from "@/components/admin/IslamicHolidaySettings";
import MediaPlayerSettings from "@/components/admin/MediaPlayerSettings";
import { signOutAndClearSession } from "@/lib/auth";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils"; // Import cn utility

interface AdminMenuItem {
  id: string;
  label: string;
  component: React.ComponentType;
}

const adminMenuItems: AdminMenuItem[] = [
  { id: "masjid-info", label: "Informasi Masjid", component: MasjidInfoSettings },
  { id: "prayer-time", label: "Waktu Sholat", component: PrayerTimeSettings },
  { id: "audio", label: "Audio & Iqomah", component: AudioSettings },
  { id: "display", label: "Tampilan", component: DisplaySettings },
  { id: "ramadan-mode", label: "Mode Ramadan", component: RamadanModeSettings },
  { id: "running-text", label: "Teks Berjalan", component: RunningTextSettings },
  { id: "info-slides", label: "Slide Informasi", component: InfoSlideSettings },
  { id: "media-player", label: "Media Player", component: MediaPlayerSettings },
  { id: "imam-muezzin", label: "Jadwal Imam & Muadzin", component: ImamMuezzinScheduleSettings },
  { id: "notifications-studies", label: "Notifikasi & Kajian", component: NotificationStudySettings },
  { id: "financial", label: "Keuangan Masjid", component: FinancialSettings },
  { id: "islamic-holidays", label: "Hari Besar Islam", component: IslamicHolidaySettings },
];

const AdminPanel = () => {
  const navigate = useNavigate();
  const [activeMenuItem, setActiveMenuItem] = useState<string>(adminMenuItems[0].id);

  const handleLogout = async () => {
    await signOutAndClearSession();
    navigate("/login");
  };

  const ActiveComponent = adminMenuItems.find(item => item.id === activeMenuItem)?.component;

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      <div className="flex justify-between items-center p-4 border-b border-gray-700">
        <h1 className="text-3xl font-bold text-blue-300">Admin Panel Masjid TV</h1>
        <div className="flex space-x-3">
          <Button onClick={() => navigate("/")} className="bg-blue-600 hover:bg-blue-700 text-white">
            Kembali ke Display
          </Button>
          <Button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 text-white">
            Logout
          </Button>
        </div>
      </div>

      <ResizablePanelGroup direction="horizontal" className="flex-grow">
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="bg-gray-800 border-r border-gray-700">
          <ScrollArea className="h-full p-4">
            <nav className="flex flex-col space-y-2">
              {adminMenuItems.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  onClick={() => setActiveMenuItem(item.id)}
                  className={cn(
                    "justify-start text-left px-4 py-2 rounded-md text-lg",
                    activeMenuItem === item.id
                      ? "bg-blue-700 text-white hover:bg-blue-600"
                      : "text-gray-300 hover:bg-gray-700 hover:text-white"
                  )}
                >
                  {item.label}
                </Button>
              ))}
            </nav>
          </ScrollArea>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={80} className="bg-gray-900">
          <ScrollArea className="h-full p-6">
            {ActiveComponent ? <ActiveComponent /> : (
              <div className="text-center text-gray-400 text-xl mt-10">
                Pilih menu dari sisi kiri untuk mengelola pengaturan.
              </div>
            )}
          </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default AdminPanel;