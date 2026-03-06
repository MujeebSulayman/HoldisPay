import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 border-transparent",
  {
    variants: {
      variant: {
        default: "border-teal-400/30 bg-teal-400/10 text-teal-400",
        secondary: "border-gray-700 bg-gray-800 text-gray-300",
        destructive: "border-red-500/30 bg-red-500/10 text-red-400",
        outline: "text-white border-gray-700",
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
