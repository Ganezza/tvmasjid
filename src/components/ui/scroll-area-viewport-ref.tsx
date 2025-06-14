"use client";

import React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"; // Import Radix Primitive secara langsung
import { ScrollBar } from "@/components/ui/scroll-area"; // Tetap impor ScrollBar dari shadcn/ui
import { cn } from "@/lib/utils";

interface ScrollAreaWithViewportRefProps extends React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> {
  viewportRef: React.RefObject<HTMLDivElement>; // Ref ini khusus untuk Viewport internal
}

const ScrollAreaWithViewportRef = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>, // Ref untuk komponen ini adalah untuk Root
  ScrollAreaWithViewportRefProps
>(({ className, children, viewportRef, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref} // Meneruskan ref ke ScrollAreaPrimitive.Root
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport
      ref={viewportRef} // Meneruskan viewportRef ke ScrollAreaPrimitive.Viewport
      className="h-full w-full rounded-[inherit]"
    >
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar /> {/* ScrollBar tetap dari shadcn/ui */}
    <ScrollAreaPrimitive.Corner /> {/* Menambahkan Corner untuk kelengkapan */}
  </ScrollAreaPrimitive.Root>
));
ScrollAreaWithViewportRef.displayName = "ScrollAreaWithViewportRef";

export { ScrollAreaWithViewportRef };