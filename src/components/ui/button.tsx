import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none font-mono text-xs uppercase tracking-[0.12em] cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border border-primary hover:bg-terracota hover:border-terracota",
        secondary: "border border-line-strong bg-transparent text-foreground hover:bg-accent",
        outline: "border border-line-strong bg-transparent text-foreground hover:bg-accent",
        destructive: "bg-destructive text-destructive-foreground border border-destructive hover:opacity-90",
        ghost: "text-foreground hover:bg-accent",
        link: "text-foreground underline underline-offset-4 decoration-1 hover:decoration-2 px-0",
      },
      size: {
        default: "h-11 px-5 lg:h-10",
        sm: "h-11 px-3 lg:h-8",
        lg: "h-12 px-7 text-sm",
        icon: "size-11 lg:size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
