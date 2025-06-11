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
    <div className="bg-gray-800 bg-opacity-70 p-2 rounded-xl shadow-2xl text-center text-lg md:text-xl lg:text-2xl xl:text-3xl font-semibold text-gray-200"> {/* Reduced text size and padding */}
      <p className="text-outline-black">{gregorianDate}</p>
      <p className="text-green-300 text-outline-black">{hijriDate}</p>
      <p className="text-3xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mt-0.5 text-outline-black">{currentTime}</p> {/* Reduced text size and margin */}
    </div>
  );
};

export default HijriCalendarDisplay;