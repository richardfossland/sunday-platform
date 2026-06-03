import { PALETTE, RADIUS, SPACING, TYPOGRAPHY } from "@sunday/design";
import {
  useState,
  type CSSProperties,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

import { useAccent } from "./accent.js";

/** How the textarea may be resized by the user. Maps to CSS `resize`. */
export type TextAreaResize = "none" | "vertical" | "horizontal" | "both";

export interface TextAreaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "style"> {
  /** When true the field renders in the danger tone and sets `data-invalid`. */
  invalid?: boolean;
  /** User-resize affordance. Default `vertical`. */
  resize?: TextAreaResize;
  /**
   * When set, renders a character counter under the field. Combined with
   * `maxLength` the counter reads `n / max` and turns danger once over.
   */
  showCount?: boolean;
  style?: CSSProperties;
}

/**
 * The multiline counterpart to {@link Input}: a bordered `<textarea>` with the
 * same token styling, danger error state and accent focus ring, plus a
 * configurable user-resize affordance and an optional character counter. Works
 * controlled or uncontrolled; the counter tracks whichever the caller uses.
 * Pair with {@link Field} for a label — pass the generated id through to `id`.
 */
export function TextArea(props: TextAreaProps): ReactNode {
  const {
    invalid = false,
    resize = "vertical",
    showCount = false,
    style,
    disabled,
    readOnly,
    maxLength,
    value,
    defaultValue,
    onChange,
    ...rest
  } = props;
  const accent = useAccent();

  // Track length for the counter. Mirrors the controlled value when present,
  // otherwise keeps its own count seeded from defaultValue (uncontrolled).
  const controlled = value !== undefined;
  const [internalLen, setInternalLen] = useState<number>(String(defaultValue ?? "").length);
  const count = controlled ? String(value).length : internalLen;
  const overLimit = maxLength !== undefined && count > maxLength;

  const textareaStyle: CSSProperties = {
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
    resize,
    width: "100%",
    minHeight: SPACING[16],
    boxSizing: "border-box",
    ...style,
  };
  const counterStyle: CSSProperties = {
    marginTop: SPACING[1],
    fontFamily: TYPOGRAPHY.fontFamily.sans,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: overLimit ? PALETTE.status.danger : PALETTE.neutral[500],
    textAlign: "right",
  };

  return (
    <div data-sunday-textarea>
      <textarea
        disabled={disabled}
        readOnly={readOnly}
        maxLength={maxLength}
        value={value}
        defaultValue={defaultValue}
        aria-invalid={invalid || undefined}
        data-invalid={invalid || undefined}
        data-resize={resize}
        style={textareaStyle}
        onChange={(e) => {
          if (!controlled) setInternalLen(e.target.value.length);
          onChange?.(e);
        }}
        {...rest}
      />
      {showCount ? (
        <div style={counterStyle} data-sunday-textarea-count aria-hidden="true">
          {maxLength !== undefined ? `${count} / ${maxLength}` : count}
        </div>
      ) : null}
    </div>
  );
}
