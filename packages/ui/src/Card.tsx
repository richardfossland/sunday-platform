import { PALETTE, RADIUS, SPACING } from "@sunday/design";
import { type CSSProperties, type HTMLAttributes, type ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** `flat` (border only) or `raised` (subtle shadow). Default `flat`. */
  elevation?: "flat" | "raised";
  /** Use the dark "pro" surface (SundayEdit/Studio). Default false. */
  dark?: boolean;
  children?: ReactNode;
}

/**
 * A surface container — the panel/section primitive every app builds its
 * layout from. Light by default; `dark` switches to the pro canvas used by the
 * creative tools.
 *
 * Renders a plain `<div>` by default (no implicit landmark). When a card *is* a
 * meaningful section of the page — a sidebar panel, a named region — pass
 * `role="region"` with an `aria-label`/`aria-labelledby` to expose it as a
 * landmark to assistive tech; both forward straight through to the element.
 */
export function Card(props: CardProps): ReactNode {
  const { elevation = "flat", dark = false, style, ...rest } = props;

  const base: CSSProperties = {
    background: dark ? PALETTE.surface.dark : PALETTE.surface.light,
    color: dark ? PALETTE.neutral[100] : PALETTE.neutral[900],
    border: `1px solid ${dark ? PALETTE.neutral[700] : PALETTE.neutral[200]}`,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
    boxShadow:
      elevation === "raised" ? "0 1px 3px rgba(15,23,42,0.12)" : "none",
  };

  return (
    <div data-elevation={elevation} style={{ ...base, ...style }} {...rest} />
  );
}
