// Adapted from Magic UI: https://magicui.design/r/interactive-hover-button.json
// MIT license in ./LICENSE. Native links, keyboard focus and reduced motion added.
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

function HoverContent({ children }: { children: ReactNode }) {
  return (
    <>
      <span className="magic-hover-base">
        <span className="magic-hover-dot" aria-hidden="true" />
        <span className="magic-hover-label">{children}</span>
      </span>
      <span className="magic-hover-active" aria-hidden="true">
        <span>{children}</span>
        <ArrowRight size={18} />
      </span>
    </>
  );
}

export function InteractiveHoverButton({
  children,
  className,
  type = "button",
  ...props
}: ComponentProps<"button">) {
  return (
    <button className={cn("magic-hover", className)} type={type} {...props}>
      <HoverContent>{children}</HoverContent>
    </button>
  );
}

export function InteractiveHoverLink({
  children,
  className,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link className={cn("magic-hover", className)} {...props}>
      <HoverContent>{children}</HoverContent>
    </Link>
  );
}
