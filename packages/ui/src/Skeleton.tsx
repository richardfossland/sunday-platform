import { PALETTE, RADIUS } from "@sunday/design";
import { type CSSProperties, type HTMLAttributes, type ReactNode } from "react";

export interface SkeletonProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** Width (number → px, string → as-is). Default `"100%"`. */
  width?: number | string;
  /** Height (number → px, string → as-is). Default `"1em"`. */
  height?: number | string;
  /** `text` (rounded line), `circle` (avatar), or `rect` (block). Default `text`. */
  variant?: "text" | "circle" | "rect";
  /** Turn off the shimmer pulse (e.g. for reduced-motion contexts). Default false. */
  noAnimate?: boolean;
}

/**
 * A content placeholder shown while data loads — a muted, gently pulsing block.
 * Marked `aria-hidden` (it carries no information; pair it with a `role=status`
 * region or a {@link Spinner} for the announced state). The pulse keyframes are
 * injected once into the document head, matching the package's bundler-free,
 * inline-token styling, and skipped under `prefers-reduced-motion`.
 */
export function Skeleton(props: SkeletonProps): ReactNode {
  const { width = "100%", height = "1em", variant = "text", noAnimate = false, style, ...rest } =
    props;
  ensureKeyframes();

  const radius = variant === "circle" ? "9999px" : variant === "rect" ? RADIUS.sm : RADIUS.md;
  const base: CSSProperties = {
    display: "inline-block",
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
    background: PALETTE.neutral[200],
    borderRadius: radius,
    animation: noAnimate ? undefined : "sunday-skeleton-pulse 1.4s ease-in-out infinite",
  };

  return (
    <span
      aria-hidden="true"
      data-sunday-skeleton=""
      data-variant={variant}
      style={{ ...base, ...style }}
      {...rest}
    />
  );
}

let keyframesInjected = false;

function ensureKeyframes(): void {
  if (keyframesInjected || typeof document === "undefined") return;
  const id = "sunday-ui-skeleton-keyframes";
  if (document.getElementById(id)) {
    keyframesInjected = true;
    return;
  }
  const styleEl = document.createElement("style");
  styleEl.id = id;
  styleEl.textContent =
    "@keyframes sunday-skeleton-pulse{0%,100%{opacity:1}50%{opacity:0.45}}" +
    "@media (prefers-reduced-motion: reduce){[data-sunday-skeleton]{animation:none!important}}";
  document.head.appendChild(styleEl);
  keyframesInjected = true;
}
