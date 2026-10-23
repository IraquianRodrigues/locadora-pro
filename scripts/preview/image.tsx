import type { ComponentProps } from "react";
// Local preview only: preserves dimensions/fill without Next's image runtime.
export default function PreviewImage({
  src,
  alt,
  fill,
  priority,
  unoptimized,
  sizes,
  ...props
}: Omit<ComponentProps<"img">, "src"> & {
  src: string;
  fill?: boolean;
  priority?: boolean;
  unoptimized?: boolean;
}) {
  void unoptimized;
  return (
    <img
      {...props}
      src={src}
      alt={alt ?? ""}
      sizes={sizes}
      fetchPriority={priority ? "high" : undefined}
      style={
        fill
          ? {
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              ...props.style,
            }
          : props.style
      }
    />
  );
}
