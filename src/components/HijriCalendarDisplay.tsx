import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import "dayjs/locale/id"; // Import Indonesian locale

const HijriCalendarDisplay: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [hijriDate, setHijriDate] = useState<string>("Memuat...");
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateDatesAndTimes = () => {
      const now = dayjs();
      setCurrentDate(now);
      setCurrentTime(now.format("HH:mm:ss")); // Format jam, menit, detik

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

    const timer = setInterval(updateDatesAndTimes, 1000);
    updateDatesAndTimes();

    return () => clearInterval(timer);
  }, []);

  const gregorianDate = currentDate.locale('id').format("dddd, DD MMMM YYYY").replace('Minggu', 'Ahad');

  return (
    <div className="bg-gray-800 bg-opacity-70 p-3 rounded-xl shadow-2xl text-center text-xl md:text-3xl lg:text-4xl xl:text-5xl font-semibold text-gray-200">
      <p className="text-outline-black">{gregorianDate}</p>
      <p className="text-green-300 text-outline-black">{hijriDate}</p>
      <p className="text-4xl md:text-6xl lg:text-7xl xl:text-8xl font-bold mt-1 text-outline-black">{currentTime}</p>
    </div>
  );
};

export default HijriCalendarDisplay;