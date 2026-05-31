import { PALETTE, RADIUS, SPACING, TYPOGRAPHY } from "@sunday/design";
import { type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";

import { useAccent } from "./accent.js";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual emphasis. `primary` uses the current app accent. Default `primary`. */
  variant?: ButtonVariant;
  /** `sm` (compact) or `md` (default). */
  size?: ButtonSize;
  children?: ReactNode;
}

/**
 * The suite's button primitive. `primary`/`danger` are filled; `secondary` is a
 * neutral outline; `ghost` is text-only. `primary` pulls its fill from the
 * active app accent (via {@link useAccent}) so the same component reads as
 * Studio gold, Paper copper, etc. without per-app code.
 */
export function Button(props: ButtonProps): ReactNode {
  const { variant = "primary", size = "md", style, disabled, ...rest } = props;
  const accent = useAccent();

  const base: CSSProperties = {
    fontFamily: TYPOGRAPHY.fontFamily.sans,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    fontSize: size === "sm" ? TYPOGRAPHY.fontSize.sm : TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.lineHeight.tight,
    padding: size === "sm" ? `${SPACING[1]} ${SPACING[3]}` : `${SPACING[2]} ${SPACING[4]}`,
    borderRadius: RADIUS.md,
    border: "1px solid transparent",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };

  const byVariant: Record<ButtonVariant, CSSProperties> = {
    primary: { background: accent.hex, color: accent.onAccent, borderColor: accent.hexStrong },
    danger: { background: PALETTE.status.danger, color: "#ffffff", borderColor: PALETTE.status.danger },
    secondary: {
      background: "transparent",
      color: PALETTE.neutral[700],
      borderColor: PALETTE.neutral[300],
    },
    ghost: { background: "transparent", color: accent.hexStrong, borderColor: "transparent" },
  };

  return (
    <button
      type="button"
      data-variant={variant}
      disabled={disabled}
      style={{ ...base, ...byVariant[variant], ...style }}
      {...rest}
    />
  );
}
