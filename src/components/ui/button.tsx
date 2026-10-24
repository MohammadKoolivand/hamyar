import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
const variants = cva(
  "inline-flex cursor-pointer motion-reduce:transition-none items-center justify-center gap-2 rounded-[15px] text-sm font-semibold transition-all duration-200 focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-[#285BB0] disabled:pointer-events-none disabled:opacity-50 min-h-11 px-5 py-3",
  {
    variants: {
      variant: {
        default: "hy-button-primary",
        outline:
          "glass-button-outline text-[#1F3F97]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);
export function Button({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof variants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={twMerge(clsx(variants({ variant }), className))}
      {...props}
    />
  );
}
