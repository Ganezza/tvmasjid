import React, { useState, useEffect } from "react";
import dayjs from "dayjs";

const HijriCalendarDisplay: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [hijriDate, setHijriDate] = useState<string>("Memuat...");
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateDatesAndTimes = () => {
      const now = dayjs();
      setCurrentDate(now);
      setCurrentTime(now.format("HH:mm:ss")); // Format jam, menit, detik

      // Menggunakan Intl.DateTimeFormat untuk mendapatkan tanggal Hijriah
      try {
        const hijriFormatter = new Intl.DateTimeFormat("id-ID-u-ca-islamic", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        setHijriDate(hijriFormatter.format(now.toDate()));
      } catch (error) {
        console.error("Error formatting Hijri date:", error);
        setHijriDate("Kalender Hijriah tidak tersedia");
      }
    };

    const timer = setInterval(updateDatesAndTimes, 1000); // Update every second to keep time accurate
    updateDatesAndTimes(); // Initial call

    return () => clearInterval(timer);
  }, []);

  const gregorianDate = currentDate.format("dddd, DD MMMM YYYY");

  return (
    <div className="text-center text-2xl md:text-4xl lg:text-5xl xl:text-6xl font-semibold text-gray-200 mb-4">
      <p className="text-outline-black">{gregorianDate}</p>
      <p className="text-green-300 text-outline-black">{hijriDate}</p>
      <p className="text-5xl md:text-7xl lg:text-8xl xl:text-9xl font-bold mt-2 text-outline-black">{currentTime}</p>
    </div>
  );
};

export default HijriCalendarDisplay;