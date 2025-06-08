import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import isBetween from "dayjs/plugin/isBetween";

dayjs.extend(duration);
dayjs.extend(isBetween);

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
  const [currentPrayerName, setCurrentPrayerName] = useState<string | null>(null);

  useEffect(() => {
    const updateTimes = () => {
      const now = dayjs();
      setCurrentTime(now);

      let foundNextPrayer: PrayerTime | null = null;
      let minDiff = Infinity;
      let currentPrayer: PrayerTime | null = null;

      const sortedPrayerTimes = PRAYER_TIMES.map(prayer => {
        const [hour, minute] = prayer.time.split(":").map(Number);
        return {
          ...prayer,
          dateTimeToday: now.hour(hour).minute(minute).second(0).millisecond(0)
        };
      }).sort((a, b) => a.dateTimeToday.diff(b.dateTimeToday));

      for (let i = 0; i < sortedPrayerTimes.length; i++) {
        const prayer = sortedPrayerTimes[i];
        let prayerDateTime = prayer.dateTimeToday;

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

      // Determine current prayer based on time intervals
      for (let i = 0; i < sortedPrayerTimes.length; i++) {
        const prayer = sortedPrayerTimes[i];
        const nextIndex = (i + 1) % sortedPrayerTimes.length;
        const nextPrayerInList = sortedPrayerTimes[nextIndex];

        let startOfInterval = prayer.dateTimeToday;
        let endOfInterval = nextPrayerInList.dateTimeToday;

        // Handle midnight wrap-around for intervals
        if (endOfInterval.isBefore(startOfInterval)) {
          endOfInterval = endOfInterval.add(1, 'day');
        }

        // If current time is between two prayer times
        if (now.isBetween(startOfInterval, endOfInterval, null, '[)')) { // [) means inclusive start, exclusive end
          currentPrayer = prayer;
          break;
        }
      }

      // If no prayer is found in an interval (e.g., after Isya until Subuh),
      // the current prayer is the last one (Isya)
      if (!currentPrayer && sortedPrayerTimes.length > 0) {
        const lastPrayerToday = sortedPrayerTimes[sortedPrayerTimes.length - 1].dateTimeToday;
        const firstPrayerTomorrow = sortedPrayerTimes[0].dateTimeToday.add(1, 'day');
        if (now.isBetween(lastPrayerToday, firstPrayerTomorrow, null, '[)')) {
          currentPrayer = sortedPrayerTimes[sortedPrayerTimes.length - 1];
        }
      }


      setNextPrayer(foundNextPrayer);
      setCurrentPrayerName(currentPrayer ? currentPrayer.name : null);

      if (foundNextPrayer) {
        const [hour, minute] = foundNextPrayer.time.split(":").map(Number);
        let nextPrayerDateTime = now.hour(hour).minute(minute).second(0);
        if (nextPrayerDateTime.isBefore(now)) {
          nextPrayerDateTime = nextPrayerDateTime.add(1, "day");
        }

        const durationRemaining = dayjs.duration(nextPrayerDateTime.diff(now));
        const hours = String(durationRemaining.hours()).padStart(2, "0");
        const minutes = String(durationRemaining.minutes()).padStart(2, "0");
        const seconds = String(durationRemaining.seconds()).padStart(2, "0");
        setCountdown(`${hours}:${minutes}:${seconds}`);
      } else {
        setCountdown("N/A");
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
          <div
            key={prayer.name}
            className={`p-2 rounded-md ${
              nextPrayer?.name === prayer.name
                ? "bg-blue-600 text-white font-bold scale-105 transition-all duration-300"
                : currentPrayerName === prayer.name
                ? "bg-green-700 text-white font-bold"
                : "bg-gray-700 text-gray-200"
            }`}
          >
            {prayer.name}: {prayer.time}
          </div>
        ))}
      </div>
      <div className="mt-6 text-yellow-300 font-semibold text-2xl md:text-3xl">
        {nextPrayer ? (
          <>
            Waktu Sholat Berikutnya:{" "}
            <span className="text-blue-400">{nextPrayer.name}</span>
            <br />
            Hitung Mundur: <span className="text-red-400">{countdown}</span>
          </>
        ) : (
          "Mencari waktu sholat berikutnya..."
        )}
      </div>
    </div>
  );
};

export default PrayerTimesDisplay;