import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MadeWithDyad } from "@/components/made-with-dyad";
import HijriCalendarDisplay from "@/components/HijriCalendarDisplay";
import PrayerTimesDisplay from "@/components/PrayerTimesDisplay";
import RunningText from "@/components/RunningText";
import InfoSlides from "@/components/InfoSlides";
import ImamMuezzinDisplay from "@/components/ImamMuezzinDisplay";
import NotificationStudyDisplay from "@/components/NotificationStudyDisplay";
import FinancialDisplay from "@/components/FinancialDisplay";
import TarawihScheduleDisplay from "@/components/TarawihScheduleDisplay";
import AudioDisplay from "@/components/AudioDisplay";
import AppBackground from "@/components/AppBackground";

const Index = () => {
  const navigate = useNavigate();
  const [clickCount, setClickCount] = useState(0);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (clickCount >= 5) {
      navigate("/admin");
      setClickCount(0); // Reset count after navigation
    }

    if (clickCount > 0) {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
      clickTimerRef.current = setTimeout(() => {
        setClickCount(0); // Reset count if clicks are too slow
      }, 1000); // 1 second window for 5 clicks
    }

    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
    };
  }, [clickCount, navigate]);

  const handleSecretShortcutClick = () => {
    setClickCount((prev) => prev + 1);
  };

  return (
    <AppBackground>
      {/* Header Section */}
      <div className="w-full flex justify-between items-center p-4">
        <h1 className="text-4xl md:text-6xl font-extrabold text-green-400 drop-shadow-lg">
          Masjid Digital TV
        </h1>
        <HijriCalendarDisplay />
      </div>

      {/* Main Content Area - Using Grid for better layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full px-4 py-8 md:py-12">
        {/* Prayer Times - always prominent, full width, placed inside the grid for consistent padding */}
        <div className="col-span-full">
          <PrayerTimesDisplay />
        </div>

        {/* Left Column for Notification/Study and Imam/Muezzin Schedules */}
        <div className="flex flex-col gap-6">
          <NotificationStudyDisplay />
          <ImamMuezzinDisplay />
          <TarawihScheduleDisplay />
        </div>

        {/* Right Column for Info Slides, Financial Info, and Audio Controls */}
        <div className="flex flex-col gap-6">
          <InfoSlides />
          <FinancialDisplay />
          <AudioDisplay />
        </div>
      </div>

      {/* Footer Section - Running Text and MadeWithDyad */}
      <div className="w-full">
        <RunningText />
        <MadeWithDyad />
      </div>

      {/* Secret Shortcut Area (Bottom Right Corner) */}
      <div
        className="absolute bottom-0 right-0 w-24 h-24 cursor-pointer z-50"
        onClick={handleSecretShortcutClick}
        aria-label="Secret shortcut to admin panel"
      />
    </AppBackground>
  );
};

export default Index;