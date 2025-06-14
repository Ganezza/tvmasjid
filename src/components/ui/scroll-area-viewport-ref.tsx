"use client";

import React, { useRef, useEffect, useState } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"; // Corrected import path
import { cn } from "@/lib/utils";

interface ScrollAreaWithViewportRefProps extends React.ComponentPropsWithoutRef<typeof ScrollArea> {
  viewportRef: React.RefObject<HTMLDivElement>;
}

const ScrollAreaWithViewportRef = React.forwardRef<
  React.ElementRef<typeof ScrollArea>,
  ScrollAreaWithViewportRefProps
>(({ className, children, viewportRef, ...props }, ref) => (
  <ScrollArea
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    <ScrollArea.Viewport ref={viewportRef} className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollArea.Viewport>
    <ScrollBar orientation="vertical" />
    <ScrollArea.Corner />
  </ScrollArea>
));
ScrollAreaWithViewportRef.displayName = "ScrollAreaWithViewportRef";

export { ScrollAreaWithViewportRef };