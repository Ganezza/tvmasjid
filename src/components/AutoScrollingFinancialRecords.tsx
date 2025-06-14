"use client";

import React, { useRef, useEffect, useState } from "react";
import { ScrollAreaWithViewportRef } from "@/components/ui/scroll-area-viewport-ref";
import { cn } from "@/lib/utils";

interface AutoScrollingFinancialRecordsProps {
  children: React.ReactNode;
  className?: string; // Allow passing additional classes
  viewportRef: React.RefObject<HTMLDivElement>; // Explicitly require viewportRef
}

const AutoScrollingFinancialRecords: React.FC<AutoScrollingFinancialRecordsProps> = ({ children, className, viewportRef }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [animationDuration, setAnimationDuration] = useState('0s');
  const scrollSpeedPxPerSecond = 20; // Kecepatan scroll dalam piksel per detik

  useEffect(() => {
    if (contentRef.current && viewportRef.current) {
      const totalContentHeight = contentRef.current.scrollHeight;
      const originalContentHeight = totalContentHeight / 2; // Assuming content is duplicated
      const viewportHeight = viewportRef.current.clientHeight;

      console.log("AutoScrollingFinancialRecords Debug:");
      console.log("  totalContentHeight (duplicated):", totalContentHeight);
      console.log("  originalContentHeight:", originalContentHeight);
      console.log("  viewportHeight:", viewportHeight);

      if (originalContentHeight > viewportHeight && viewportHeight > 0) {
        const durationSeconds = originalContentHeight / scrollSpeedPxPerSecond;
        setAnimationDuration(`${durationSeconds}s`);
        console.log("  Animation will run. Calculated Duration:", `${durationSeconds}s`);
      } else {
        setAnimationDuration('0s');
        console.log("  Animation will NOT run (content fits or viewport is 0). Current animationDuration:", animationDuration);
      }
    } else {
      console.log("AutoScrollingFinancialRecords Debug: contentRef or viewportRef not ready.");
    }
  }, [children, viewportRef, animationDuration]); // Re-run when children, viewportRef, or animationDuration changes

  return (
    <ScrollAreaWithViewportRef className={cn("w-full pr-4 flex-grow", className)} viewportRef={viewportRef}>
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