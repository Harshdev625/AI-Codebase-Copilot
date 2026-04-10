import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-primary/10 text-primary border border-primary/20",
        secondary:
          "bg-secondary text-secondary-foreground border border-border/40",
        destructive:
          "bg-destructive/10 text-destructive border border-destructive/20",
        outline:
          "border border-border text-foreground bg-transparent",
        success:
          "bg-success/10 text-success border border-success/20",
        warning:
          "bg-warning/10 text-warning border border-warning/20",
        error:
          "bg-error/10 text-error border border-error/20",
        ai:
          "bg-gradient-to-r from-primary/10 to-indigo-500/10 text-primary border border-primary/20 shadow-glow-sm",
        muted:
          "bg-muted text-muted-foreground border border-border/20",
        live:
          "bg-success/10 text-success border border-success/20 animate-pulse-slow",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
