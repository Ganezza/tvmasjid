"use client";

import React, { useRef, useEffect, useState } from "react";
import { ScrollAreaWithViewportRef } from "@/components/ui/scroll-area-viewport-ref";
import { cn } from "@/lib/utils";

interface AutoScrollingFinancialRecordsProps {
  children: React.ReactNode;
  heightClass?: string; // New prop for height control
  className?: string; // Allow passing additional classes
}

const AutoScrollingFinancialRecords: React.FC<AutoScrollingFinancialRecordsProps> = ({ children, heightClass, className }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [animationDuration, setAnimationDuration] = useState('0s');
  const scrollSpeedPxPerSecond = 20; // Kecepatan scroll dalam piksel per detik

  useEffect(() => {
    if (contentRef.current) {
      // Mengukur tinggi total konten (termasuk duplikasi)
      const totalContentHeight = contentRef.current.scrollHeight;
      // Tinggi satu set konten asli
      const originalContentHeight = totalContentHeight / 2;
      // Cari elemen viewport yang sebenarnya dari ScrollArea
      const viewportElement = contentRef.current.closest('.radix-scroll-area-viewport');
      const viewportHeight = viewportElement?.clientHeight || 0;

      console.log("AutoScrollingFinancialRecords: originalContentHeight", originalContentHeight, "viewportHeight", viewportHeight);

      // Hanya aktifkan animasi jika konten meluap dan viewport memiliki tinggi yang valid
      if (originalContentHeight > viewportHeight && viewportHeight > 0) {
        // Hitung durasi animasi berdasarkan tinggi konten asli dan kecepatan scroll
        const durationSeconds = originalContentHeight / scrollSpeedPxPerSecond;
        setAnimationDuration(`${durationSeconds}s`);
      } else {
        setAnimationDuration('0s'); // Tidak ada animasi jika konten tidak meluap
      }
    }
  }, [children, heightClass]); // Hitung ulang saat konten anak atau heightClass berubah

  return (
    <ScrollAreaWithViewportRef className={cn("w-full pr-4 flex-grow", heightClass, className)}>
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