"use client";

import React, { useRef, useEffect, useState } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"; // Import shadcn/ui ScrollArea and ScrollBar
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"; // Import Radix UI primitives
import { cn } from "@/lib/utils";

interface ScrollAreaWithViewportRefProps extends React.ComponentPropsWithoutRef<typeof ScrollArea> {
  viewportRef: React.RefObject<HTMLDivElement>;
}

const ScrollAreaWithViewportRef = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>, // Use ScrollAreaPrimitive.Root for ref type
  ScrollAreaWithViewportRefProps
>(({ className, children, viewportRef, ...props }, ref) => (
  <ScrollAreaPrimitive.Root // Use ScrollAreaPrimitive.Root here
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport ref={viewportRef} className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar orientation="vertical" />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
));
ScrollAreaWithViewportRef.displayName = "ScrollAreaWithViewportRef";

export { ScrollAreaWithViewportRef };