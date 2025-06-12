import React, { useState, useEffect, useRef } from "react";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { cn } from "@/lib/utils";

dayjs.extend(duration);

interface PrayerCountdownOverlayProps {
  nextPrayerName: string | null;
  nextPrayerTime: dayjs.Dayjs | null;
  iqomahCountdownDuration: number; // in seconds
  onClose: () => void; // Callback to notify parent to close the overlay
  isJumuah: boolean; // New prop to disable for Jumuah
  adhanDurationSeconds: number; // New prop for Adhan duration
}

const PRE_ADHAN_COUNTDOWN_SECONDS = 30;

const PrayerCountdownOverlay: React.FC<PrayerCountdownOverlayProps> = ({
  nextPrayerName,
  nextPrayerTime,
  iqomahCountdownDuration,
  onClose,
  isJumuah,
  adhanDurationSeconds, // Destructure new prop
}) => {
  const [displayPhase, setDisplayPhase] = useState<"pre-adhan" | "adhan" | "pre-iqomah" | "iqomah" | "hidden">("hidden");
  const [countdownText, setCountdownText] = useState<string>("");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!nextPrayerTime || !nextPrayerName || nextPrayerName === "Syuruq" || isJumuah) {
      setDisplayPhase("hidden");
      setCountdownText("");
      if (intervalRef.current) clearInterval(intervalRef.current);
      onClose(); // Ensure parent knows to close
      return;
    }

    const adhanTime = nextPrayerTime;
    const preAdhanTime = adhanTime.subtract(PRE_ADHAN_COUNTDOWN_SECONDS, 'second');
    const adhanEndTime = adhanTime.add(adhanDurationSeconds, 'second'); // Use adhanDurationSeconds
    const iqomahTime = adhanEndTime; // Iqomah starts right after Adhan ends
    const iqomahEndTime = iqomahTime.add(iqomahCountdownDuration, 'second');

    const updatePhaseAndCountdown = () => {
      const now = dayjs();

      if (now.isBefore(preAdhanTime)) {
        setDisplayPhase("hidden");
        setCountdownText("");
        return;
      }

      if (now.isBetween(preAdhanTime, adhanTime, null, '[)')) {
        setDisplayPhase("pre-adhan");
        const diff = adhanTime.diff(now);
        const durationRemaining = dayjs.duration(diff);
        setCountdownText(`${String(durationRemaining.minutes()).padStart(2, '0')}:${String(durationRemaining.seconds()).padStart(2, '0')}`);
      } else if (now.isBetween(adhanTime, adhanEndTime, null, '[)')) {
        setDisplayPhase("adhan");
        setCountdownText(""); // No countdown during adhan
      } else if (now.isBetween(iqomahTime, iqomahEndTime, null, '[)')) {
        setDisplayPhase("iqomah");
        const diff = iqomahEndTime.diff(now);
        const durationRemaining = dayjs.duration(diff);
        setCountdownText(`${String(durationRemaining.minutes()).padStart(2, '0')}:${String(durationRemaining.seconds()).padStart(2, '0')}`);
      } else if (now.isAfter(iqomahEndTime)) {
        // After iqomah, hide the overlay
        setDisplayPhase("hidden");
        setCountdownText("");
        onClose(); // Notify parent to close
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }
    };

    // Clear any existing interval before setting a new one
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(updatePhaseAndCountdown, 1000);
    updatePhaseAndCountdown(); // Initial call

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [nextPrayerTime, nextPrayerName, iqomahCountdownDuration, onClose, isJumuah, adhanDurationSeconds]); // Add adhanDurationSeconds to dependencies

  if (displayPhase === "hidden") {
    return null;
  }

  let titleText = "";
  let countdownDisplay = countdownText;
  let titleClass = "text-yellow-300";
  let countdownClass = "text-green-400";

  if (nextPrayerName === "Maghrib") {
    if (displayPhase === "pre-adhan") {
      titleText = "Menunggu Adzan Maghrib";
    } else if (displayPhase === "adhan") {
      titleText = "Adzan Maghrib";
      countdownDisplay = ""; // No countdown during adhan
      titleClass = "text-red-400"; // Change color for Adhan
    } else if (displayPhase === "iqomah") {
      titleText = "Menunggu Iqomah";
    }
  } else {
    // For other prayers
    if (displayPhase === "pre-adhan") {
      titleText = `Menunggu Adzan ${nextPrayerName}`;
    } else if (displayPhase === "adhan") {
      titleText = `Adzan ${nextPrayerName}`;
      countdownDisplay = "";
      titleClass = "text-red-400";
    } else if (displayPhase === "iqomah") {
      titleText = "Menunggu Iqomah";
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-50 text-white">
      <h2 className={cn("text-6xl md:text-8xl lg:text-9xl font-bold mb-8 text-outline-black", titleClass)}>
        {titleText}
      </h2>
      {countdownDisplay && (
        <p className={cn("text-8xl md:text-9xl lg:text-[10rem] font-extrabold text-outline-black", countdownClass)}>
          {countdownDisplay}
        </p>
      )}
      {displayPhase === "iqomah" && (
        <p className="text-3xl md:text-4xl lg:text-5xl font-semibold mt-8 text-red-400 text-outline-black text-center">
          GUNAKAN WAKTU INI UNTUK BERDO'A DAN SHOLAT SUNNAH
        </p>
      )}
    </div>
  );
};

export default PrayerCountdownOverlay;