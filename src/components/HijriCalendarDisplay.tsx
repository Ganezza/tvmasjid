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
    <div className="text-center text-2xl md:text-4xl font-semibold text-gray-200 mb-4">
      <p>{gregorianDate}</p>
      <p className="text-green-300 text-3xl md:text-5xl">{hijriDate}</p>
      <p className="text-blue-400 text-6xl md:text-8xl font-bold mt-2">{currentTime}</p> {/* Menampilkan jam */}
    </div>
  );
};

export default HijriCalendarDisplay;