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
import {
  Home, Clock, Volume2, Monitor, Moon, ScrollText, Image, PlaySquare,
  Users, Bell, Banknote, CalendarDays, ChevronLeft, ChevronRight
} from "lucide-react"; // Import icons

interface AdminMenuItem {
  id: string;
  label: string;
  component: React.ComponentType;
  icon: React.ElementType; // Add icon property
}

const adminMenuItems: AdminMenuItem[] = [
  { id: "masjid-info", label: "Informasi Masjid", component: MasjidInfoSettings, icon: Home },
  { id: "prayer-time", label: "Waktu Sholat", component: PrayerTimeSettings, icon: Clock },
  { id: "audio", label: "Audio & Iqomah", component: AudioSettings, icon: Volume2 },
  { id: "display", label: "Tampilan", component: DisplaySettings, icon: Monitor },
  { id: "ramadan-mode", label: "Mode Ramadan", component: RamadanModeSettings, icon: Moon },
  { id: "running-text", label: "Teks Berjalan", component: RunningTextSettings, icon: ScrollText },
  { id: "info-slides", label: "Slide Informasi", component: InfoSlideSettings, icon: Image },
  { id: "media-player", label: "Media Player", component: MediaPlayerSettings, icon: PlaySquare },
  { id: "imam-muezzin", label: "Jadwal Imam & Muadzin", component: ImamMuezzinScheduleSettings, icon: Users },
  { id: "notifications-studies", label: "Notifikasi & Kajian", component: NotificationStudySettings, icon: Bell },
  { id: "financial", label: "Keuangan Masjid", component: FinancialSettings, icon: Banknote },
  { id: "islamic-holidays", label: "Hari Besar Islam", component: IslamicHolidaySettings, icon: CalendarDays },
];

const AdminPanel = () => {
  const navigate = useNavigate();
  const [activeMenuItem, setActiveMenuItem] = useState<string>(adminMenuItems[0].id);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
        <ResizablePanel
          defaultSize={20}
          minSize={isSidebarCollapsed ? 4 : 15} // Adjust minSize based on collapsed state
          maxSize={30}
          collapsible={true}
          collapsedSize={4}
          onCollapse={() => setIsSidebarCollapsed(true)}
          onExpand={() => setIsSidebarCollapsed(false)}
          className={cn(
            "bg-gray-800 border-r border-gray-700 transition-all duration-300 ease-in-out",
            isSidebarCollapsed && "min-w-[50px]" // Ensure it's small enough to just show icons
          )}
        >
          <ScrollArea className="h-full p-4">
            <nav className="flex flex-col space-y-2">
              {adminMenuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.id}
                    variant="ghost"
                    onClick={() => setActiveMenuItem(item.id)}
                    className={cn(
                      "justify-start text-left px-4 py-2 rounded-md text-lg flex items-center",
                      activeMenuItem === item.id
                        ? "bg-blue-700 text-white hover:bg-blue-600"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white",
                      isSidebarCollapsed ? "w-10 h-10 p-0 justify-center" : "w-full" // Adjust size for collapsed state
                    )}
                  >
                    <Icon className={cn("h-5 w-5", !isSidebarCollapsed && "mr-3")} />
                    {!isSidebarCollapsed && item.label}
                  </Button>
                );
              })}
            </nav>
          </ScrollArea>
        </ResizablePanel>
        <ResizableHandle withHandle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarCollapsed(prev => !prev)}
            className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 bg-gray-700 hover:bg-gray-600 text-white rounded-full p-1.5 z-10"
            aria-label={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </ResizableHandle>
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