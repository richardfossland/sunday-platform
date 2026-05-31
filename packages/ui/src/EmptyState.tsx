import { PALETTE, SPACING, TYPOGRAPHY } from "@sunday/design";
import { type CSSProperties, type HTMLAttributes, type ReactNode } from "react";

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  /** Headline (e.g. "No recordings yet"). */
  title: string;
  /** Optional supporting sentence under the title. */
  description?: string;
  /** Optional decorative glyph/icon shown above the title (rendered aria-hidden). */
  icon?: ReactNode;
  /** Optional call-to-action area (typically a {@link Button}). */
  action?: ReactNode;
  /** Use the dark "pro" surface text colors (SundayEdit/Studio). Default false. */
  dark?: boolean;
}

/**
 * The "nothing here yet" placeholder — a centered title, optional description,
 * icon and a call-to-action. Used for empty lists (no recordings, no songs in a
 * setlist, an empty search). The CTA stays a real child so callers wire any
 * action; the block is just layout + the shared type/spacing tokens.
 */
export function EmptyState(props: EmptyStateProps): ReactNode {
  const { title, description, icon, action, dark = false, style, ...rest } = props;

  const wrap: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: SPACING[2],
    padding: SPACING[8],
    fontFamily: TYPOGRAPHY.fontFamily.sans,
    color: dark ? PALETTE.neutral[300] : PALETTE.neutral[500],
  };
  const titleStyle: CSSProperties = {
    margin: 0,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: dark ? PALETTE.neutral[100] : PALETTE.neutral[800],
  };
  const descStyle: CSSProperties = {
    margin: 0,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.lineHeight.normal,
    maxWidth: "42ch",
  };

  return (
    <div style={{ ...wrap, ...style }} {...rest}>
      {icon ? (
        <span aria-hidden="true" data-sunday-empty-icon="" style={{ fontSize: TYPOGRAPHY.fontSize["2xl"] }}>
          {icon}
        </span>
      ) : null}
      <p style={titleStyle}>{title}</p>
      {description ? <p style={descStyle}>{description}</p> : null}
      {action ? <div style={{ marginTop: SPACING[2] }}>{action}</div> : null}
    </div>
  );
}
