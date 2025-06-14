"use client";

import * as React from "react";
import { Root, Viewport, ScrollBar, Thumb, Corner } from "@radix-ui/react-scroll-area"; // Mengubah cara impor
import { cn } from "@/lib/utils";

interface ScrollAreaWithViewportRefProps extends React.ComponentPropsWithoutRef<typeof Root> {
  viewportRef: React.RefObject<HTMLDivElement>;
}

const ScrollAreaWithViewportRef = React.forwardRef<
  HTMLDivElement,
  ScrollAreaWithViewportRefProps
>(({ className, children, viewportRef, ...props }, ref) => (
  <Root
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    <Viewport ref={viewportRef} className="h-full w-full rounded-[inherit]">
      {children}
    </Viewport>
    <ScrollBar className="flex touch-none select-none transition-colors">
      <Thumb className="relative flex-1 rounded-full bg-border" />
    </ScrollBar>
    <Corner />
  </Root>
));
ScrollAreaWithViewportRef.displayName = Root.displayName;

export { ScrollAreaWithViewportRef };