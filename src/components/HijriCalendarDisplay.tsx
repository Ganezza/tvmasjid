import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
// import hijri from "dayjs-plugin-hijri"; // Mengimpor langsung dari paket dayjs-plugin-hijri

// dayjs.extend(hijri); // Baris ini dinonaktifkan karena masalah instalasi plugin

const HijriCalendarDisplay: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(dayjs());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(dayjs());
    }, 1000); // Update every second to keep time accurate

    return () => clearInterval(timer);
  }, []);

  // Karena plugin hijri tidak dapat dimuat, kita akan menampilkan tanggal Gregorian saja
  // atau placeholder untuk tanggal Hijriah.
  const gregorianDate = currentDate.format("dddd, DD MMMM YYYY");
  const hijriDate = "Kalender Hijriah tidak tersedia"; // Placeholder

  return (
    <div className="text-center text-xl md:text-3xl font-semibold text-gray-200 mb-4">
      <p>{gregorianDate}</p>
      <p className="text-green-300">{hijriDate}</p>
    </div>
  );
};

export default HijriCalendarDisplay;