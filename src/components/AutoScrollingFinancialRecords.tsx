"use client";

import React, { useRef, useEffect } from "react";
import { ScrollAreaWithViewportRef } from "@/components/ui/scroll-area-viewport-ref";
import { cn } from "@/lib/utils";

interface AutoScrollingFinancialRecordsProps {
  children: React.ReactNode;
  heightClass?: string; // e.g., "h-48 md:h-64"
}

const AutoScrollingFinancialRecords: React.FC<AutoScrollingFinancialRecordsProps> = ({ children, heightClass }) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const scrollSpeed = 1; // pixels per interval
  const intervalTime = 50; // ms per interval (20 frames per second)
  const pauseAtEnds = 3000; // ms to pause at top/bottom

  const startAutoScroll = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    // Clear any existing interval
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
    }

    // Only scroll if content is actually larger than viewport
    if (viewport.scrollHeight <= viewport.clientHeight) {
      return;
    }

    scrollIntervalRef.current = setInterval(() => {
      if (viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight) {
        // Reached bottom, pause then reset to top
        clearInterval(scrollIntervalRef.current!);
        scrollIntervalRef.current = null;
        setTimeout(() => {
          viewport.scrollTop = 0; // Reset to top
          startAutoScroll(); // Start scrolling again from top
        }, pauseAtEnds); // Pause for 3 seconds at bottom
      } else {
        // Scroll down
        viewport.scrollTop += scrollSpeed;
      }
    }, intervalTime);
  };

  useEffect(() => {
    // Reset scroll position and restart scrolling when children change (e.g., new data)
    if (viewportRef.current) {
      viewportRef.current.scrollTop = 0;
    }
    startAutoScroll();

    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, [children]); // Dependency on children to restart scroll if content changes

  return (
    <ScrollAreaWithViewportRef viewportRef={viewportRef} className={cn(heightClass, "w-full pr-4")}>
      {children}
    </ScrollAreaWithViewportRef>
  );
};

export default AutoScrollingFinancialRecords;