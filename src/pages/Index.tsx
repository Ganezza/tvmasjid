import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MadeWithDyad } from "@/components/made-with-dyad";

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
    <div className="relative min-h-screen w-full bg-gray-950 text-white flex flex-col items-center justify-center overflow-hidden">
      {/* Main Display Content */}
      <div className="flex-grow flex flex-col items-center justify-center p-4 w-full">
        <h1 className="text-6xl md:text-8xl font-extrabold mb-8 text-green-400 drop-shadow-lg">
          Masjid Digital TV
        </h1>
        <p className="text-2xl md:text-4xl text-gray-300 mb-12">
          Waktu Sholat & Informasi Masjid
        </p>

        {/* Placeholder for Prayer Times and Countdown */}
        <div className="bg-gray-800 bg-opacity-70 p-8 rounded-xl shadow-2xl w-11/12 max-w-4xl text-center mb-8">
          <h2 className="text-4xl font-bold mb-4 text-blue-300">Jadwal Sholat</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xl md:text-2xl">
            <div>Subuh: 04:30</div>
            <div>Dzuhur: 12:00</div>
            <div>Ashar: 15:30</div>
            <div>Maghrib: 18:00</div>
            <div>Isya: 19:15</div>
            <div className="col-span-2 md:col-span-1 text-yellow-300 font-semibold">
              Next Sholat: Dzuhur (Countdown: 00:15:30)
            </div>
          </div>
        </div>

        {/* Placeholder for Running Text */}
        <div className="w-full bg-gray-800 bg-opacity-70 p-4 rounded-lg shadow-xl mt-auto">
          <p className="text-xl md:text-2xl text-gray-200 animate-pulse">
            Selamat datang di Masjid Agung Al-Falah. Mari tingkatkan iman dan taqwa kita.
          </p>
        </div>
      </div>

      {/* Secret Shortcut Area (Bottom Right Corner) */}
      <div
        className="absolute bottom-0 right-0 w-24 h-24 cursor-pointer z-50"
        onClick={handleSecretShortcutClick}
        aria-label="Secret shortcut to admin panel"
      />

      <MadeWithDyad />
    </div>
  );
};

export default Index;