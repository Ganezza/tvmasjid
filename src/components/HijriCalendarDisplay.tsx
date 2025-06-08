import React, { useState, useEffect } from "react";
import dayjs from "dayjs";

const HijriCalendarDisplay: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [hijriDate, setHijriDate] = useState<string>("Memuat...");

  useEffect(() => {
    const updateDates = () => {
      const now = dayjs();
      setCurrentDate(now);

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

    const timer = setInterval(updateDates, 1000); // Update every second to keep time accurate
    updateDates(); // Initial call

    return () => clearInterval(timer);
  }, []);

  const gregorianDate = currentDate.format("dddd, DD MMMM YYYY");

  return (
    <div className="text-center text-xl md:text-3xl font-semibold text-gray-200 mb-4">
      <p>{gregorianDate}</p>
      <p className="text-green-300">{hijriDate}</p>
    </div>
  );
};

export default HijriCalendarDisplay;