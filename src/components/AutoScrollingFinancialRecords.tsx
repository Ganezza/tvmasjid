"use client";

import React, { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface AutoScrollingFinancialRecordsProps {
  children: React.ReactNode;
  heightClass?: string; // Optional prop for height, defaults to a reasonable value
}

const AutoScrollingFinancialRecords: React.FC<AutoScrollingFinancialRecordsProps> = ({ children, heightClass = "h-48" }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [animationDuration, setAnimationDuration] = useState('0s');
  const scrollSpeedPxPerSecond = 20; // Kecepatan scroll dalam piksel per detik

  useEffect(() => {
    if (contentRef.current && containerRef.current) {
      const originalContentHeight = contentRef.current.scrollHeight / 2; // Since children are duplicated
      const viewportHeight = containerRef.current.clientHeight;

      console.log("AutoScrollingFinancialRecords: Original Content Height:", originalContentHeight);
      console.log("AutoScrollingFinancialRecords: Viewport Height:", viewportHeight);

      if (originalContentHeight > viewportHeight) {
        const durationSeconds = originalContentHeight / scrollSpeedPxPerSecond;
        setAnimationDuration(`${durationSeconds}s`);
        console.log("AutoScrollingFinancialRecords: Auto-scroll active. Duration:", `${durationSeconds}s`);
      } else {
        setAnimationDuration('0s'); // No animation if content does not overflow
        console.log("AutoScrollingFinancialRecords: Auto-scroll inactive (content fits).");
      }
    }
  }, [children, heightClass]); // Recalculate when children or heightClass changes

  return (
    <div ref={containerRef} className={cn("w-full overflow-hidden", heightClass)}>
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
    </div>
  );
};

export default AutoScrollingFinancialRecords;