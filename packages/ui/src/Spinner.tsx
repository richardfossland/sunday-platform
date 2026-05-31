import { type CSSProperties, type HTMLAttributes, type ReactNode } from "react";

import { useAccent } from "./accent.js";

export type SpinnerSize = "sm" | "md" | "lg";

const SIZE_PX: Record<SpinnerSize, number> = { sm: 16, md: 24, lg: 40 };

export interface SpinnerProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** Diameter preset. Default `md`. */
  size?: SpinnerSize;
  /**
   * Accessible label announced to assistive tech (the spinner has
   * `role="status"`). Default `"Loading"`. Pass `""` to suppress (e.g. when an
   * adjacent visible label already conveys the state).
   */
  label?: string;
}

/**
 * An indeterminate loading indicator — a ring that borrows the active app
 * accent for its moving arc. `role="status"` + `aria-label` make the busy state
 * audible; the visual spin is a CSS `@keyframes` injected once into the document
 * head (no bundler/CSS pipeline needed, matching the package's inline-token
 * styling). Honors `prefers-reduced-motion` by skipping the animation.
 */
export function Spinner(props: SpinnerProps): ReactNode {
  const { size = "md", label = "Loading", style, ...rest } = props;
  const accent = useAccent();
  ensureKeyframes();

  const px = SIZE_PX[size];
  const border = Math.max(2, Math.round(px / 8));
  const base: CSSProperties = {
    display: "inline-block",
    width: px,
    height: px,
    boxSizing: "border-box",
    border: `${border}px solid ${accent.hexSoft}`,
    borderTopColor: accent.hex,
    borderRadius: "9999px",
    animation: `sunday-spin 0.7s linear infinite`,
  };

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label || undefined}
      data-sunday-spinner=""
      data-size={size}
      style={{ ...base, ...style }}
      {...rest}
    />
  );
}

let keyframesInjected = false;

/**
 * Inject the spin keyframes once. Guarded so repeated mounts don't add multiple
 * `<style>` nodes; a no-op when there's no `document` (SSR) — the spinner still
 * renders, just without the named animation until hydration runs this on the
 * client.
 */
function ensureKeyframes(): void {
  if (keyframesInjected || typeof document === "undefined") return;
  const id = "sunday-ui-spinner-keyframes";
  if (document.getElementById(id)) {
    keyframesInjected = true;
    return;
  }
  const styleEl = document.createElement("style");
  styleEl.id = id;
  styleEl.textContent =
    "@keyframes sunday-spin{to{transform:rotate(360deg)}}" +
    "@media (prefers-reduced-motion: reduce){[data-sunday-spinner]{animation:none!important}}";
  document.head.appendChild(styleEl);
  keyframesInjected = true;
}
