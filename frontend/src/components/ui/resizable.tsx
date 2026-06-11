"use client"

import * as React from "react"
import { GripVertical } from "lucide-react"
import * as ResizablePrimitive from "react-resizable-panels"

import { cn } from "@/lib/utils"

const ResizablePanelGroup = ({
  className,
  direction,
  ...props
}: Omit<React.ComponentProps<typeof ResizablePrimitive.Group>, "orientation"> & {
  direction?: "horizontal" | "vertical"
}) => (
  <ResizablePrimitive.Group
    orientation={direction}
    className={cn(
      "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
      className
    )}
    {...props}
  />
)

const ResizablePanel = ({
  onCollapse,
  onResize,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Panel> & {
  onCollapse?: () => void
}) => {
  const handleResize = (size: any, id: any, prevSize: any) => {
    if (onResize) {
      onResize(size, id, prevSize);
    }
    if (onCollapse && size.asPercentage === 0 && prevSize && prevSize.asPercentage > 0) {
      onCollapse();
    }
  };

  return (
    <ResizablePrimitive.Panel
      onResize={handleResize}
      {...props}
    />
  );
};
ResizablePanel.displayName = "ResizablePanel";

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Separator> & {
  withHandle?: boolean
}) => (
  <ResizablePrimitive.Separator
    className={cn(
      "relative flex w-1 items-center justify-center bg-border/40 after:absolute after:inset-y-0 after:left-1/2 after:w-[3px] after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90 hover:bg-primary/20 hover:w-1.5 transition-all",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border shadow-sm">
        <GripVertical className="h-2.5 w-2.5 text-muted-foreground" />
      </div>
    )}
  </ResizablePrimitive.Separator>
)

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
