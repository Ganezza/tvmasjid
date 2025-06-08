import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MadeWithDyad } from "@/components/made-with-dyad";
import HijriCalendarDisplay from "@/components/HijriCalendarDisplay";
import PrayerTimesDisplay from "@/components/PrayerTimesDisplay";
import RunningText from "@/components/RunningText";

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
    <div className="relative min-h-screen w-full bg-gray-950 text-white flex flex-col items-center justify-between overflow-hidden p-4">
      {/* Header Section */}
      <div className="w-full flex justify-between items-center p-4">
        <h1 className="text-4xl md:text-6xl font-extrabold text-green-400 drop-shadow-lg">
          Masjid Digital TV
        </h1>
        <HijriCalendarDisplay />
      </div>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col items-center justify-center w-full max-w-6xl px-4">
        <p className="text-2xl md:text-4xl text-gray-300 mb-8">
          Waktu Sholat & Informasi Masjid
        </p>
        <PrayerTimesDisplay />
        {/* Placeholder for Info Slides - will be added later */}
        <div className="bg-gray-800 bg-opacity-70 p-8 rounded-xl shadow-2xl w-11/12 max-w-4xl text-center mb-8 h-64 flex items-center justify-center">
          <p className="text-2xl text-gray-400">Info Slides (Coming Soon)</p>
        </div>
      </div>

      {/* Footer Section - Running Text and MadeWithDyad */}
      <div className="w-full">
        <RunningText text="Selamat datang di Masjid Agung Al-Falah. Mari tingkatkan iman dan taqwa kita. Jangan lupa matikan ponsel saat sholat. Semoga Allah menerima amal ibadah kita. Aamiin." />
        <MadeWithDyad />
      </div>

      {/* Secret Shortcut Area (Bottom Right Corner) */}
      <div
        className="absolute bottom-0 right-0 w-24 h-24 cursor-pointer z-50"
        onClick={handleSecretShortcutClick}
        aria-label="Secret shortcut to admin panel"
      />
    </div>
  );
};

export default Index;