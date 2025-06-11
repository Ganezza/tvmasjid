"use client";

import React, { useRef, useEffect, useState } from "react";
import { ScrollAreaWithViewportRef } from "@/components/ui/scroll-area-viewport-ref";
import { cn } from "@/lib/utils";

interface AutoScrollingFinancialRecordsProps {
  children: React.ReactNode;
}

const AutoScrollingFinancialRecords: React.FC<AutoScrollingFinancialRecordsProps> = ({ children }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [animationDuration, setAnimationDuration] = useState('0s');
  const scrollSpeedPxPerSecond = 20; // Kecepatan scroll dalam piksel per detik

  useEffect(() => {
    if (contentRef.current) {
      // Mengukur tinggi total konten (termasuk duplikasi)
      const totalContentHeight = contentRef.current.scrollHeight;
      // Tinggi satu set konten asli
      const originalContentHeight = totalContentHeight / 2; 
      const viewportHeight = contentRef.current.parentElement?.clientHeight || 0;

      if (originalContentHeight > viewportHeight) {
        // Hitung durasi animasi berdasarkan tinggi konten asli dan kecepatan scroll
        const durationSeconds = originalContentHeight / scrollSpeedPxPerSecond;
        setAnimationDuration(`${durationSeconds}s`);
      } else {
        setAnimationDuration('0s'); // Tidak ada animasi jika konten tidak meluap
      }
    }
  }, [children]); // Hitung ulang saat konten anak berubah

  return (
    <ScrollAreaWithViewportRef className={cn("w-full pr-4 flex-grow")}>
      <div
        ref={contentRef}
        className="auto-scroll-content"
        style={{
          animationDuration: animationDuration,
          animationPlayState: animationDuration === '0s' ? 'paused' : 'running',
        }}
      >
        {children}
        {children} {/* Duplikasi konten untuk loop yang mulus */}
      </div>
    </ScrollAreaWithViewportRef>
  );
};

export default AutoScrollingFinancialRecords;