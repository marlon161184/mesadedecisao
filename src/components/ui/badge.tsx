import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/** Etiqueta retangular em DM Mono caixa alta. */
const badgeVariants = cva(
  "inline-flex items-center rounded-none border px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.12em] leading-5",
  {
    variants: {
      variant: {
        default: "border-primary bg-primary text-primary-foreground",
        outline: "border-line-strong text-foreground",
        secondary: "border-line bg-secondary text-secondary-foreground",
        destructive: "border-destructive bg-destructive text-destructive-foreground",
        terracota: "border-terracota bg-terracota text-preto",
        flamboyant: "border-flamboyant bg-flamboyant text-luz",
        ipe: "border-ipe bg-ipe text-luz",
        "terra-vermelha": "border-terra-vermelha bg-terra-vermelha text-luz",
        fase2: "border-line-strong bg-transparent text-foreground",
      },
    },
    defaultVariants: {
      variant: "outline",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
