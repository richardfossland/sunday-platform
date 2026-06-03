import { PALETTE, SPACING, TYPOGRAPHY } from "@sunday/design";
import {
  useEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { useAccent } from "./accent.js";
import { useRadioGroup } from "./RadioGroup.js";

export interface RadioProps {
  /** The value this radio selects within its {@link RadioGroup}. */
  value: string;
  /** Inline label rendered to the right of the control. */
  label?: ReactNode;
  /** Disables just this radio (it is then skipped by arrow navigation). */
  disabled?: boolean;
  style?: CSSProperties;
  className?: string;
}

/**
 * A single radio button. Must be rendered inside a {@link RadioGroup}, which
 * owns selection + keyboard navigation; this component reflects the group's
 * selected value as `checked`/`aria-checked`, participates in the group's
 * roving `tabindex` (only the active radio is tabbable), and forwards
 * arrow/Home/End/Space to the group. The native input is accent-tinted.
 */
export function Radio(props: RadioProps): ReactNode {
  const { value, label, disabled: ownDisabled = false, style, className } = props;
  const accent = useAccent();
  const group = useRadioGroup();
  const ref = useRef<HTMLInputElement>(null);

  // Register with the group so arrow navigation can find + focus this radio.
  const register = group?.register;
  useEffect(() => {
    register?.(value, ref.current);
    return () => register?.(value, null);
  }, [register, value]);

  if (!group) {
    // Standalone fallback: an inert radio so misuse fails loud-but-safe.
    return null;
  }

  const disabled = group.disabled || ownDisabled;
  const checked = group.value === value;
  // Roving tabindex: the selected radio is tabbable; if none selected, the
  // first enabled radio takes the tab stop (handled by leaving it 0 — the group
  // selects-on-arrow so an unselected group still enters via the first radio).
  const tabbable = checked || (group.value === undefined && !disabled);

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (disabled) return;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight":
        e.preventDefault();
        group!.move(value, "next");
        break;
      case "ArrowUp":
      case "ArrowLeft":
        e.preventDefault();
        group!.move(value, "prev");
        break;
      case "Home":
        e.preventDefault();
        group!.move(value, "first");
        break;
      case "End":
        e.preventDefault();
        group!.move(value, "last");
        break;
      case " ":
      case "Enter":
        e.preventDefault();
        group!.select(value);
        break;
      default:
        break;
    }
  }

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
  const dotStyle: CSSProperties = {
    accentColor: accent.hex,
    width: SPACING[4],
    height: SPACING[4],
    cursor: disabled ? "not-allowed" : "pointer",
    margin: 0,
  };

  const input = (
    <input
      ref={ref}
      type="radio"
      name={group.name}
      value={value}
      checked={checked}
      disabled={disabled}
      tabIndex={tabbable ? 0 : -1}
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      data-checked={checked || undefined}
      style={dotStyle}
      onChange={() => group.select(value)}
      onKeyDown={onKeyDown}
    />
  );

  if (label === undefined) return input;
  return (
    <label className={className} style={wrapStyle} data-sunday-radio>
      {input}
      <span>{label}</span>
    </label>
  );
}
