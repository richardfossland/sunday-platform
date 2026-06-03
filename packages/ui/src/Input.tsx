import { PALETTE, RADIUS, SPACING, TYPOGRAPHY } from "@sunday/design";
import { type CSSProperties, type InputHTMLAttributes, type ReactNode } from "react";

import { useAccent } from "./accent.js";

/** The text-like input types this primitive supports. */
export type InputType = "text" | "password" | "email" | "number" | "url" | "tel" | "search";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  /** The input type. Default `text`. */
  type?: InputType;
  /** When true the field renders in the danger tone and sets `data-invalid`. */
  invalid?: boolean;
  /**
   * Optional element rendered at the trailing edge (e.g. a unit, search or
   * clear icon). Purely decorative — give interactive content its own label.
   */
  suffix?: ReactNode;
}

/**
 * The suite's text input. A bordered `<input>` styled from the design tokens,
 * with a danger border + `data-invalid` in the error state and a focus ring
 * borrowed from the active app accent. Disabled/readonly are honored visually.
 * Pair with {@link Field} for a label/hint/error wrapper — pass the generated
 * id through to `id`.
 */
export function Input(props: InputProps): ReactNode {
  const { type = "text", invalid = false, suffix, style, disabled, readOnly, ...rest } = props;
  const accent = useAccent();

  const inputStyle: CSSProperties = {
    fontFamily: TYPOGRAPHY.fontFamily.sans,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.lineHeight.normal,
    color: PALETTE.neutral[800],
    background: disabled || readOnly ? PALETTE.neutral[100] : PALETTE.surface.light,
    padding: `${SPACING[2]} ${SPACING[3]}`,
    border: `1px solid ${invalid ? PALETTE.status.danger : PALETTE.neutral[300]}`,
    borderRadius: RADIUS.md,
    outlineColor: invalid ? PALETTE.status.danger : accent.hex,
    cursor: disabled ? "not-allowed" : "text",
    opacity: disabled ? 0.6 : 1,
    width: "100%",
    boxSizing: "border-box",
  };

  if (!suffix) {
    return (
      <input
        type={type}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={invalid || undefined}
        data-invalid={invalid || undefined}
        style={{ ...inputStyle, ...style }}
        {...rest}
      />
    );
  }

  // With a suffix we wrap in a relatively-positioned shell so the icon floats
  // over the trailing padding; the outer style/className target the shell.
  const shellStyle: CSSProperties = {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    width: "100%",
    ...style,
  };
  const suffixStyle: CSSProperties = {
    position: "absolute",
    right: SPACING[3],
    display: "inline-flex",
    alignItems: "center",
    color: PALETTE.neutral[500],
    pointerEvents: "none",
  };
  return (
    <span style={shellStyle} data-sunday-input-shell>
      <input
        type={type}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={invalid || undefined}
        data-invalid={invalid || undefined}
        style={{ ...inputStyle, paddingRight: SPACING[8] }}
        {...rest}
      />
      <span style={suffixStyle} data-sunday-input-suffix aria-hidden="true">
        {suffix}
      </span>
    </span>
  );
}
