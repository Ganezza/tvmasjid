import React, { useState, useEffect, useRef } from "react";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { cn } from "@/lib/utils";

dayjs.extend(duration);

interface ImsakOverlayProps {
  imsakTime: dayjs.Dayjs | null;
  onClose: () => void;
}

const IMSAK_OVERLAY_DURATION_SECONDS = 10; // Durasi overlay Imsak (10 detik)

const ImsakOverlay: React.FC<ImsakOverlayProps> = ({ imsakTime, onClose }) => {
  const [displayPhase, setDisplayPhase] = useState<"imsak" | "hidden">("hidden");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!imsakTime) {
      setDisplayPhase("hidden");
      if (intervalRef.current) clearInterval(intervalRef.current);
      onClose();
      return;
    }

    const imsakEndTime = imsakTime.add(IMSAK_OVERLAY_DURATION_SECONDS, 'second');

    const updatePhase = () => {
      const now = dayjs();

      if (now.isBetween(imsakTime, imsakEndTime, null, '[)')) {
        setDisplayPhase("imsak");
      } else if (now.isAfter(imsakEndTime)) {
        setDisplayPhase("hidden");
        onClose();
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      } else {
        setDisplayPhase("hidden");
      }
    };

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(updatePhase, 1000);
    updatePhase(); // Initial call

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [imsakTime, onClose]);

  if (displayPhase === "hidden") {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-50 text-white">
      <h2 className={cn("text-6xl md:text-8xl lg:text-9xl font-bold mb-8 text-outline-black text-yellow-300")}>
        WAKTU IMSAK
      </h2>
      <p className={cn("text-8xl md:text-9xl lg:text-[10rem] font-extrabold text-outline-black text-green-400")}>
        {imsakTime?.format("HH:mm")}
      </p>
      <p className="text-3xl md:text-4xl lg:text-5xl font-semibold mt-8 text-red-400 text-outline-black text-center">
        Waktu Berhenti Makan dan Minum
      </p>
    </div>
  );
};

export default ImsakOverlay;