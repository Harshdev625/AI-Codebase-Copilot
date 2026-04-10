import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center whitespace-nowrap rounded-lg",
    "text-sm font-semibold transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
    "select-none",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md hover:shadow-primary/20",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-border bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground",
        link:
          "text-primary underline-offset-4 hover:underline",
        premium:
          "bg-gradient-to-b from-primary/10 to-primary/20 border border-primary/20 text-primary hover:bg-primary/20 shadow-sm",
        ai:
          "bg-gradient-to-r from-primary via-blue-500 to-indigo-500 text-white shadow-ai hover:shadow-glow-sm hover:opacity-90",
        success:
          "bg-success text-success-foreground shadow-sm hover:bg-success/90",
        glass:
          "bg-white/8 backdrop-blur-md border border-white/10 text-foreground hover:bg-white/12",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm:      "h-8 rounded-md px-3 text-xs",
        lg:      "h-12 rounded-xl px-8 text-base",
        xl:      "h-14 rounded-xl px-10 text-base font-bold",
        icon:    "h-10 w-10",
        "icon-sm": "h-8 w-8 rounded-md",
        "icon-xs": "h-6 w-6 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild: _asChild, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
