import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
const variants = cva(
  "inline-flex cursor-pointer motion-reduce:transition-none items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:pointer-events-none disabled:opacity-50 min-h-11 px-5 py-3",
  {
    variants: {
      variant: {
        default: "bg-[#233B8F] text-white shadow-[0_8px_22px_rgba(35,59,143,0.15)] hover:bg-[#1b317b]",
        outline:
          "glass-button-outline text-[#233B8F]",
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
