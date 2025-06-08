import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import hijri from "dayjs-plugin-hijri"; // Corrected import path

dayjs.extend(hijri);

const HijriCalendarDisplay: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(dayjs());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(dayjs());
    }, 1000); // Update every second to keep time accurate

    return () => clearInterval(timer);
  }, []);

  const gregorianDate = currentDate.format("dddd, DD MMMM YYYY");
  const hijriDate = currentDate.format("iD iMMMM iYYYY"); // iD for Hijri day, iMMMM for Hijri month name, iYYYY for Hijri year

  return (
    <div className="text-center text-xl md:text-3xl font-semibold text-gray-200 mb-4">
      <p>{gregorianDate}</p>
      <p className="text-green-300">{hijriDate} H</p>
    </div>
  );
};

export default HijriCalendarDisplay;