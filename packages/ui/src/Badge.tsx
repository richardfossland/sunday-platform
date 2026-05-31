import { PALETTE, RADIUS, SPACING, TYPOGRAPHY } from "@sunday/design";
import { type CSSProperties, type HTMLAttributes, type ReactNode } from "react";

import { useAccent } from "./accent.js";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Semantic tone. `accent` uses the active app accent. Default `neutral`. */
  tone?: BadgeTone;
  children?: ReactNode;
}

/**
 * A small status pill — e.g. the "✓ CCLI + TONO" / "⚠ Check TONO" licensing
 * markers, recording state, sync status. Tones map to the shared semantic hues;
 * `accent` adopts the active app accent.
 */
export function Badge(props: BadgeProps): ReactNode {
  const { tone = "neutral", style, ...rest } = props;
  const accent = useAccent();

  const toneStyle: Record<BadgeTone, CSSProperties> = {
    neutral: { background: PALETTE.neutral[100], color: PALETTE.neutral[700] },
    accent: { background: accent.hexSoft, color: accent.hexStrong },
    success: { background: "#dcfce7", color: PALETTE.status.success },
    warning: { background: "#fef3c7", color: PALETTE.status.warning },
    danger: { background: "#fee2e2", color: PALETTE.status.danger },
    info: { background: "#e0f2fe", color: PALETTE.status.info },
  };

  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: SPACING[1],
    fontFamily: TYPOGRAPHY.fontFamily.sans,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    lineHeight: TYPOGRAPHY.lineHeight.tight,
    padding: `${SPACING[1]} ${SPACING[2]}`,
    borderRadius: RADIUS.full,
  };

  return <span data-tone={tone} style={{ ...base, ...toneStyle[tone], ...style }} {...rest} />;
}
