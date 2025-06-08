import React, { useState, useEffect } from "react";
import dayjs from "dayjs";

interface PrayerTime {
  name: string;
  time: string; // e.g., "04:30"
}

const PRAYER_TIMES: PrayerTime[] = [
  { name: "Subuh", time: "04:30" },
  { name: "Dzuhur", time: "12:00" },
  { name: "Ashar", time: "15:30" },
  { name: "Maghrib", time: "18:00" },
  { name: "Isya", time: "19:15" },
];

const PrayerTimesDisplay: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(dayjs());
  const [nextPrayer, setNextPrayer] = useState<PrayerTime | null>(null);
  const [countdown, setCountdown] = useState<string>("");

  useEffect(() => {
    const updateTimes = () => {
      const now = dayjs();
      setCurrentTime(now);

      let foundNextPrayer: PrayerTime | null = null;
      let minDiff = Infinity;

      for (const prayer of PRAYER_TIMES) {
        const [hour, minute] = prayer.time.split(":").map(Number);
        let prayerDateTime = now.hour(hour).minute(minute).second(0);

        // If prayer time has passed today, consider it for tomorrow
        if (prayerDateTime.isBefore(now)) {
          prayerDateTime = prayerDateTime.add(1, "day");
        }

        const diff = prayerDateTime.diff(now);
        if (diff > 0 && diff < minDiff) {
          minDiff = diff;
          foundNextPrayer = prayer;
        }
      }

      setNextPrayer(foundNextPrayer);

      if (foundNextPrayer) {
        const [hour, minute] = foundNextPrayer.time.split(":").map(Number);
        let nextPrayerDateTime = now.hour(hour).minute(minute).second(0);
        if (nextPrayerDateTime.isBefore(now)) {
          nextPrayerDateTime = nextPrayerDateTime.add(1, "day");
        }

        const duration = dayjs.duration(nextPrayerDateTime.diff(now));
        const hours = String(duration.hours()).padStart(2, "0");
        const minutes = String(duration.minutes()).padStart(2, "0");
        const seconds = String(duration.seconds()).padStart(2, "0");
        setCountdown(`${hours}:${minutes}:${seconds}`);
      } else {
        setCountdown("N/A"); // Should not happen if prayer times cover 24h
      }
    };

    const interval = setInterval(updateTimes, 1000);
    updateTimes(); // Initial call

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-gray-800 bg-opacity-70 p-8 rounded-xl shadow-2xl w-11/12 max-w-4xl text-center mb-8">
      <h2 className="text-4xl font-bold mb-4 text-blue-300">Jadwal Sholat</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xl md:text-2xl">
        {PRAYER_TIMES.map((prayer) => (
          <div key={prayer.name}>
            {prayer.name}: {prayer.time}
          </div>
        ))}
        <div className="col-span-2 md:col-span-1 text-yellow-300 font-semibold">
          {nextPrayer ? `Next Sholat: ${nextPrayer.name} (Countdown: ${countdown})` : "Mencari waktu sholat berikutnya..."}
        </div>
      </div>
    </div>
  );
};

export default PrayerTimesDisplay;