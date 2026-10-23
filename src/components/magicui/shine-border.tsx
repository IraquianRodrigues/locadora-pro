// Adapted from Magic UI: https://magicui.design/r/shine-border.json
// MIT license in ./LICENSE. CSS-only, one interaction-driven cycle, no client JS.
import type { CSSProperties } from "react";

export function ShineBorder({
  borderWidth = 1,
  duration = 4,
  shineColor = ["#941b30", "#e9a3b2", "#fff"],
}: {
  borderWidth?: number;
  duration?: number;
  shineColor?: string | string[];
}) {
  return (
    <div
      aria-hidden="true"
      className="magic-shine"
      style={
        {
          "--border-width": `${borderWidth}px`,
          "--shine-duration": `${duration}s`,
          backgroundImage: `radial-gradient(transparent, transparent, ${Array.isArray(shineColor) ? shineColor.join(",") : shineColor}, transparent, transparent)`,
          backgroundSize: "300% 300%",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          padding: "var(--border-width)",
        } as CSSProperties
      }
    />
  );
}
