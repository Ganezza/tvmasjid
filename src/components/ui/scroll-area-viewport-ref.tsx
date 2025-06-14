"use client";

import React from "react";
import { ScrollAreaViewport, ScrollBar } from "@/components/ui/scroll-area"; // Perbaikan import
import { cn } from "@/lib/utils";

interface ScrollAreaWithViewportRefProps extends React.ComponentPropsWithoutRef<typeof ScrollAreaViewport> {
  viewportRef: React.RefObject<HTMLDivElement>;
}

const ScrollAreaWithViewportRef = React.forwardRef<
  HTMLDivElement,
  ScrollAreaWithViewportRefProps
>(({ className, children, viewportRef, ...props }, ref) => (
  <div className={cn("relative overflow-hidden", className)} ref={ref}>
    <ScrollAreaViewport ref={viewportRef} className="h-full w-full rounded-[inherit]" {...props}>
      {children}
    </ScrollAreaViewport>
    <ScrollBar />
  </div>
));
ScrollAreaWithViewportRef.displayName = "ScrollAreaWithViewportRef";

export { ScrollAreaWithViewportRef };