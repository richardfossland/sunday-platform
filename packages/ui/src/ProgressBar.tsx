import { PALETTE, RADIUS, SPACING, TYPOGRAPHY } from "@sunday/design";
import { type CSSProperties, type ReactNode } from "react";

import { useAccent } from "./accent.js";

export interface ProgressBarProps {
  /**
   * Current value. When omitted (or `null`) the bar is *indeterminate* — it
   * renders a pulsing fill and reports no `aria-valuenow`.
   */
  value?: number | null;
  /** Lower bound of the scale. Default `0`. */
  min?: number;
  /** Upper bound of the scale. Default `100`. */
  max?: number;
  /** Track thickness. Default `md`. */
  size?: "sm" | "md" | "lg";
  /** Accessible name for the progress bar (`aria-label`). */
  ariaLabel?: string;
  /** Show the percentage as text alongside the bar. */
  showValue?: boolean;
  style?: CSSProperties;
  className?: string;
}

const HEIGHT: Record<NonNullable<ProgressBarProps["size"]>, string> = {
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * A CSS-fill progress indicator following the WAI-ARIA progressbar pattern:
 * `role="progressbar"` with `aria-valuemin`/`aria-valuemax`/`aria-valuenow` for
 * the determinate case, and no `aria-valuenow` when indeterminate (a pulsing
 * fill). The fill borrows the app accent. Use it for uploads, exports, render
 * progress and multi-step completion. `showValue` renders the percentage as a
 * trailing label.
 */
export function ProgressBar(props: ProgressBarProps): ReactNode {
  const {
    value,
    min = 0,
    max = 100,
    size = "md",
    ariaLabel,
    showValue = false,
    style,
    className,
  } = props;
  const accent = useAccent();

  const indeterminate = value === undefined || value === null;
  const clamped = indeterminate ? min : clamp(value, min, max);
  const span = max - min;
  const ratio = span > 0 ? (clamped - min) / span : 0;
  const pct = Math.round(ratio * 100);

  const track: CSSProperties = {
    position: "relative",
    width: "100%",
    height: HEIGHT[size],
    background: PALETTE.neutral[200],
    borderRadius: RADIUS.full,
    overflow: "hidden",
  };
  const fill: CSSProperties = {
    height: "100%",
    width: indeterminate ? "40%" : `${ratio * 100}%`,
    background: accent.hex,
    borderRadius: RADIUS.full,
    transition: "width 200ms ease",
    ...(indeterminate ? { opacity: 0.7 } : {}),
  };

  return (
    <div
      className={className}
      style={{ display: "flex", alignItems: "center", gap: SPACING[2], width: "100%", ...style }}
      data-sunday-progress=""
    >
      <div
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={indeterminate ? undefined : clamped}
        data-indeterminate={indeterminate || undefined}
        style={track}
      >
        <div data-sunday-progress-fill="" style={fill} />
      </div>
      {showValue ? (
        <span
          aria-hidden="true"
          style={{
            fontFamily: TYPOGRAPHY.fontFamily.sans,
            fontSize: TYPOGRAPHY.fontSize.xs,
            color: PALETTE.neutral[600],
            minWidth: "3ch",
            textAlign: "right",
          }}
        >
          {indeterminate ? "…" : `${pct}%`}
        </span>
      ) : null}
    </div>
  );
}
