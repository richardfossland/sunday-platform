import { PALETTE, SPACING, TYPOGRAPHY } from "@sunday/design";
import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/**
 * Shared state for a {@link RadioGroup}/{@link Radio} pair. `Radio` reads the
 * current selection + the group name, and registers its value so the group can
 * implement roving tabindex + arrow-key navigation across the enabled radios.
 */
export interface RadioGroupContextValue {
  /** Generated `name` so the radios form one native group. */
  name: string;
  /** Currently-selected value (controlled or internal). */
  value: string | undefined;
  /** Selects a value (no-op when disabled at the group level). */
  select: (value: string) => void;
  /** Whether the whole group is disabled. */
  disabled: boolean;
  /** Registers a radio's value + DOM node so the group can navigate it. */
  register: (value: string, el: HTMLElement | null) => void;
  /** Moves selection + focus to the next/previous/edge enabled radio. */
  move: (from: string, dir: "next" | "prev" | "first" | "last") => void;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

/** Read the enclosing {@link RadioGroup} context (null when used standalone). */
export function useRadioGroup(): RadioGroupContextValue | null {
  return useContext(RadioGroupContext);
}

export interface RadioGroupProps {
  /** Controlled selected value. When set, the group does not own selection. */
  value?: string;
  /** Initial selected value for the uncontrolled case. */
  defaultValue?: string;
  /** Fires with the newly-selected value. */
  onValueChange?: (value: string) => void;
  /** Disables every radio in the group. */
  disabled?: boolean;
  /** Accessible name for the group (`aria-label`). */
  ariaLabel?: string;
  /** {@link Radio} children. */
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

/**
 * An accessible radio group following the WAI-ARIA radio-group pattern:
 * `role="radiogroup"` wrapping {@link Radio} children, with roving `tabindex`
 * (only the selected — or, when none, the first — enabled radio is tabbable),
 * arrow-key navigation that wraps and skips disabled radios (Up/Left =
 * previous, Down/Right = next, Home/End = edges), and Space/Enter to select.
 * Works controlled (`value` + `onValueChange`) or uncontrolled (`defaultValue`).
 */
export function RadioGroup(props: RadioGroupProps): ReactNode {
  const {
    value,
    defaultValue,
    onValueChange,
    disabled = false,
    ariaLabel,
    children,
    style,
    className,
  } = props;
  const baseId = useId();
  const [internal, setInternal] = useState<string | undefined>(defaultValue);
  const current = value ?? internal;

  // Registration preserves DOM order so arrow navigation matches visual order.
  const order = useRef<{ value: string; el: HTMLElement | null }[]>([]);

  const register = useCallback<RadioGroupContextValue["register"]>((val, el) => {
    const existing = order.current.find((r) => r.value === val);
    if (existing) {
      existing.el = el;
    } else if (el) {
      order.current.push({ value: val, el });
    }
    if (el === null) {
      order.current = order.current.filter((r) => r.value !== val);
    }
  }, []);

  const select = useCallback<RadioGroupContextValue["select"]>(
    (val) => {
      if (disabled) return;
      if (value === undefined) setInternal(val);
      onValueChange?.(val);
    },
    [disabled, value, onValueChange],
  );

  const move = useCallback<RadioGroupContextValue["move"]>(
    (from, dir) => {
      // Only enabled (non-disabled) radios participate in navigation.
      const enabled = order.current.filter((r) => r.el && r.el.getAttribute("aria-disabled") !== "true");
      if (enabled.length === 0) return;
      const pos = enabled.findIndex((r) => r.value === from);
      let next = pos;
      switch (dir) {
        case "next":
          next = (pos + 1) % enabled.length;
          break;
        case "prev":
          next = (pos - 1 + enabled.length) % enabled.length;
          break;
        case "first":
          next = 0;
          break;
        case "last":
          next = enabled.length - 1;
          break;
      }
      const target = enabled[next];
      if (!target) return;
      // Selection follows focus, per the radio-group pattern.
      select(target.value);
      target.el?.focus();
    },
    [select],
  );

  const ctx = useMemo<RadioGroupContextValue>(
    () => ({ name: baseId, value: current, select, disabled, register, move }),
    [baseId, current, select, disabled, register, move],
  );

  const wrapStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: SPACING[2],
    fontFamily: TYPOGRAPHY.fontFamily.sans,
    color: PALETTE.neutral[700],
    ...style,
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={className}
      style={wrapStyle}
    >
      <RadioGroupContext.Provider value={ctx}>{children}</RadioGroupContext.Provider>
    </div>
  );
}
