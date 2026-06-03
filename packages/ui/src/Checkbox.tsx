import { PALETTE, RADIUS, SPACING, TYPOGRAPHY } from "@sunday/design";
import {
  useEffect,
  useRef,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

import { useAccent } from "./accent.js";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Optional inline label rendered to the right of the box. */
  label?: ReactNode;
  /**
   * Mixed state — the box shows a dash and reports `aria-checked="mixed"`. Pure
   * presentation/ARIA: the underlying `checked` is unaffected, so a click still
   * toggles `checked` as usual (the common "select all" pattern).
   */
  indeterminate?: boolean;
}

/**
 * The suite's checkbox: a native `<input type="checkbox">` tinted to the active
 * app accent via `accent-color`, with optional inline label and a tri-state
 * `indeterminate` mode (sets the DOM property + `aria-checked="mixed"`). The
 * native input keeps full keyboard/AT behaviour; only the color is themed.
 */
export function Checkbox(props: CheckboxProps): ReactNode {
  const { label, indeterminate = false, style, disabled, id, ...rest } = props;
  const accent = useAccent();
  const ref = useRef<HTMLInputElement>(null);

  // `indeterminate` is a DOM property with no HTML attribute, so set it imperatively.
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const wrapStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: SPACING[2],
    fontFamily: TYPOGRAPHY.fontFamily.sans,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: PALETTE.neutral[700],
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    ...style,
  };
  const boxStyle: CSSProperties = {
    accentColor: accent.hex,
    width: SPACING[4],
    height: SPACING[4],
    borderRadius: RADIUS.sm,
    cursor: disabled ? "not-allowed" : "pointer",
    margin: 0,
  };

  const box = (
    <input
      ref={ref}
      id={id}
      type="checkbox"
      disabled={disabled}
      aria-checked={indeterminate ? "mixed" : undefined}
      data-indeterminate={indeterminate || undefined}
      style={boxStyle}
      {...rest}
    />
  );

  if (label === undefined) return box;
  return (
    <label htmlFor={id} style={wrapStyle} data-sunday-checkbox>
      {box}
      <span>{label}</span>
    </label>
  );
}
