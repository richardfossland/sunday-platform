import { PALETTE, RADIUS, SPACING, TYPOGRAPHY } from "@sunday/design";
import { type CSSProperties, type HTMLAttributes, type ReactNode } from "react";

/** Semantic tone of an {@link Alert}, mapping to a status hue. */
export type AlertTone = "info" | "success" | "warning" | "danger";

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  /** Status tone — drives the accent hue + tinted background. Default `info`. */
  tone?: AlertTone;
  /** Optional bold heading shown above the body. */
  title?: string;
  /** Optional leading glyph/icon (rendered aria-hidden). */
  icon?: ReactNode;
  /**
   * When set, renders a dismiss "×" button wired to this callback. The button
   * carries an accessible "Dismiss" label.
   */
  onDismiss?: () => void;
  /** Message body. */
  children?: ReactNode;
}

const TONE_HEX: Record<AlertTone, string> = {
  info: PALETTE.status.info,
  success: PALETTE.status.success,
  warning: PALETTE.status.warning,
  danger: PALETTE.status.danger,
};

// A very light tint of each status hue for the panel background.
const TONE_BG: Record<AlertTone, string> = {
  info: "#eff6ff",
  success: "#f0fdf4",
  warning: "#fffbeb",
  danger: "#fef2f2",
};

/**
 * A status-messaging banner — a {@link Card}-like tinted panel with a semantic
 * tone (info/success/warning/danger), an optional title, leading icon and an
 * optional dismiss control. Carries the correct landmark role for its tone:
 * `role="alert"` (assertive) for `danger`/`warning`, `role="status"` (polite)
 * for `info`/`success`, so screen readers announce errors immediately while
 * confirmations stay non-interruptive. Styled inline from the design tokens with
 * a leading accent border in the tone hue.
 */
export function Alert(props: AlertProps): ReactNode {
  const { tone = "info", title, icon, onDismiss, children, style, ...rest } = props;
  const hue = TONE_HEX[tone];
  const assertive = tone === "danger" || tone === "warning";

  const wrap: CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: SPACING[2],
    padding: SPACING[3],
    borderRadius: RADIUS.md,
    border: `1px solid ${hue}`,
    borderLeft: `3px solid ${hue}`,
    background: TONE_BG[tone],
    color: PALETTE.neutral[800],
    fontFamily: TYPOGRAPHY.fontFamily.sans,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.lineHeight.normal,
  };
  const titleStyle: CSSProperties = {
    margin: 0,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: hue,
  };

  return (
    <div
      role={assertive ? "alert" : "status"}
      aria-live={assertive ? "assertive" : "polite"}
      data-tone={tone}
      style={{ ...wrap, ...style }}
      {...rest}
    >
      {icon ? (
        <span aria-hidden="true" data-sunday-alert-icon="" style={{ color: hue, lineHeight: 1 }}>
          {icon}
        </span>
      ) : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title ? <p style={titleStyle}>{title}</p> : null}
        {children ? <div data-sunday-alert-body="">{children}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          aria-label="Dismiss"
          data-sunday-alert-dismiss=""
          onClick={onDismiss}
          style={{
            appearance: "none",
            background: "transparent",
            border: "none",
            color: PALETTE.neutral[500],
            cursor: "pointer",
            fontSize: TYPOGRAPHY.fontSize.lg,
            lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
