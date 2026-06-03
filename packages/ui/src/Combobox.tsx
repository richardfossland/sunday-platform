import { PALETTE, RADIUS, SPACING, TYPOGRAPHY } from "@sunday/design";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { useAccent } from "./accent.js";
import type { SelectOption, SelectSize } from "./Select.js";

export interface ComboboxProps {
  /** The options to choose from (same shape as {@link Select}). */
  options: SelectOption[];
  /** Controlled selected value (the option `value`, or `undefined` when empty). */
  value?: string;
  /** Initial selected value for the uncontrolled case. */
  defaultValue?: string;
  /** Fires with the chosen option value (`undefined` once cleared). */
  onValueChange?: (value: string | undefined) => void;
  /**
   * Controlled text in the input box. When set, the caller owns the query — pair
   * with `onInputChange` (used for async/server-driven option lists).
   */
  inputValue?: string;
  /** Fires on every keystroke with the current input text. */
  onInputChange?: (text: string) => void;
  /**
   * `list` (default) filters the given `options` by the typed text; `none`
   * leaves filtering to the caller (it owns `options` via `onInputChange`).
   */
  filterMode?: "list" | "none";
  /**
   * Allow committing free text that matches no option. When true, Enter on an
   * unmatched query fires `onValueChange` with the raw text. Default false
   * (autocomplete-style: only listed options can be chosen).
   */
  allowCustomValue?: boolean;
  /** Disables the control. */
  disabled?: boolean;
  /** Error tone + `aria-invalid`/`data-invalid`, matching {@link Input}. */
  invalid?: boolean;
  /** Placeholder for the input box. */
  placeholder?: string;
  /** Control density. Default `md`. */
  size?: SelectSize;
  /** Accessible name (applied to the input + listbox). */
  ariaLabel?: string;
  /** Forwarded to the input so {@link Field} can label it. */
  id?: string;
  /** Text for the empty-results row. Default "No matches". */
  emptyLabel?: string;
  style?: CSSProperties;
  className?: string;
}

const PAD: Record<SelectSize, string> = {
  sm: `${SPACING[1]} ${SPACING[2]}`,
  md: `${SPACING[2]} ${SPACING[3]}`,
  lg: `${SPACING[3]} ${SPACING[4]}`,
};
const FONT: Record<SelectSize, string> = {
  sm: TYPOGRAPHY.fontSize.sm,
  md: TYPOGRAPHY.fontSize.base,
  lg: TYPOGRAPHY.fontSize.lg,
};

function labelOf(opt: SelectOption): string {
  return opt.label ?? opt.value;
}

/**
 * An editable combobox following the WAI-ARIA editable-combobox + listbox
 * pattern: a text `<input role="combobox">` with `aria-expanded`,
 * `aria-controls` and `aria-activedescendant` pointing into a `role="listbox"`
 * of `role="option"` rows. Typing filters the options (`filterMode="list"`) or
 * defers to the caller for async/server-side search (`filterMode="none"` +
 * `onInputChange`). ArrowDown/Up move the active option (skipping disabled),
 * Home/End jump to the edges, Enter chooses the active option (or commits free
 * text when `allowCustomValue`), Escape closes and clears the active option.
 * Styled inline from the design tokens with the app-accent focus ring + active
 * row; danger tone in the error state. Controlled (`value`/`inputValue`) or
 * uncontrolled. Pair with {@link Field} via `id`.
 */
export function Combobox(props: ComboboxProps): ReactNode {
  const {
    options,
    value,
    defaultValue,
    onValueChange,
    inputValue,
    onInputChange,
    filterMode = "list",
    allowCustomValue = false,
    disabled = false,
    invalid = false,
    placeholder = "Search…",
    size = "md",
    ariaLabel,
    id: idProp,
    emptyLabel = "No matches",
    style,
    className,
  } = props;

  const accent = useAccent();
  const baseId = useId();
  const inputId = idProp ?? `${baseId}-input`;
  const listId = `${baseId}-list`;

  const valueControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState<string | undefined>(defaultValue);
  const selected = valueControlled ? value : internalValue;

  const selectedLabel = useMemo(() => {
    const opt = options.find((o) => o.value === selected);
    return opt ? labelOf(opt) : (selected ?? "");
  }, [options, selected]);

  const textControlled = inputValue !== undefined;
  const [internalText, setInternalText] = useState<string>(selectedLabel);
  const text = textControlled ? inputValue : internalText;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Keep the uncontrolled input text in sync when the selection changes externally.
  useEffect(() => {
    if (!textControlled && !open) setInternalText(selectedLabel);
  }, [selectedLabel, textControlled, open]);

  const visible = useMemo(() => {
    if (filterMode === "none") return options;
    const q = text.trim().toLowerCase();
    if (q === "") return options;
    return options.filter((o) => labelOf(o).toLowerCase().includes(q));
  }, [options, text, filterMode]);

  const enabledIndices = useMemo(
    () => visible.map((o, i) => ({ o, i })).filter(({ o }) => !o.disabled).map(({ i }) => i),
    [visible],
  );

  function setText(next: string): void {
    if (!textControlled) setInternalText(next);
    onInputChange?.(next);
  }

  function commit(opt: SelectOption): void {
    if (opt.disabled) return;
    if (!valueControlled) setInternalValue(opt.value);
    onValueChange?.(opt.value);
    setText(labelOf(opt));
    close();
  }

  function commitCustom(): void {
    const raw = text.trim();
    if (raw === "") return;
    if (!valueControlled) setInternalValue(raw);
    onValueChange?.(raw);
    close();
  }

  function open_(): void {
    if (disabled) return;
    setOpen(true);
    setActiveIndex(enabledIndices[0] ?? -1);
  }

  function close(): void {
    setOpen(false);
    setActiveIndex(-1);
  }

  function moveActive(dir: "next" | "prev" | "first" | "last"): void {
    if (enabledIndices.length === 0) return;
    const pos = enabledIndices.indexOf(activeIndex);
    let nextPos: number;
    switch (dir) {
      case "next":
        nextPos = pos < 0 ? 0 : (pos + 1) % enabledIndices.length;
        break;
      case "prev":
        nextPos = pos < 0 ? enabledIndices.length - 1 : (pos - 1 + enabledIndices.length) % enabledIndices.length;
        break;
      case "first":
        nextPos = 0;
        break;
      case "last":
        nextPos = enabledIndices.length - 1;
        break;
    }
    setActiveIndex(enabledIndices[nextPos]!);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (disabled) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) open_();
        else moveActive("next");
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) open_();
        else moveActive("prev");
        break;
      case "Home":
        if (open) {
          e.preventDefault();
          moveActive("first");
        }
        break;
      case "End":
        if (open) {
          e.preventDefault();
          moveActive("last");
        }
        break;
      case "Enter": {
        if (!open) return;
        e.preventDefault();
        const opt = visible[activeIndex];
        if (opt) commit(opt);
        else if (allowCustomValue) commitCustom();
        break;
      }
      case "Escape":
        if (open) {
          e.preventDefault();
          close();
        }
        break;
      case "Tab":
        close();
        break;
      default:
        break;
    }
  }

  // Close on an outside pointer press.
  useEffect(() => {
    if (!open) return;
    function onDown(ev: MouseEvent): void {
      const root = inputRef.current?.closest("[data-sunday-combobox]");
      if (root && !root.contains(ev.target as Node)) close();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Keep the active option in view as it moves.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    document.getElementById(`${listId}-opt-${activeIndex}`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeIndex, listId]);

  const inputStyle: CSSProperties = {
    fontFamily: TYPOGRAPHY.fontFamily.sans,
    fontSize: FONT[size],
    lineHeight: TYPOGRAPHY.lineHeight.normal,
    color: PALETTE.neutral[800],
    background: disabled ? PALETTE.neutral[100] : PALETTE.surface.light,
    padding: PAD[size],
    border: `1px solid ${invalid ? PALETTE.status.danger : PALETTE.neutral[300]}`,
    borderRadius: RADIUS.md,
    outlineColor: invalid ? PALETTE.status.danger : accent.hex,
    cursor: disabled ? "not-allowed" : "text",
    opacity: disabled ? 0.6 : 1,
    width: "100%",
    boxSizing: "border-box",
  };
  const popupStyle: CSSProperties = {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    right: 0,
    zIndex: 50,
    background: PALETTE.surface.light,
    border: `1px solid ${PALETTE.neutral[200]}`,
    borderRadius: RADIUS.md,
    boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
    overflow: "hidden",
  };

  return (
    <div
      className={className}
      style={{ position: "relative", width: "100%", ...style }}
      data-sunday-combobox
      data-invalid={invalid || undefined}
    >
      <input
        ref={inputRef}
        type="text"
        id={inputId}
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        aria-activedescendant={open && activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
        data-invalid={invalid || undefined}
        disabled={disabled}
        placeholder={placeholder}
        value={text}
        style={inputStyle}
        onChange={(e) => {
          setText(e.target.value);
          if (!open) setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => !open && open_()}
        onClick={() => !open && open_()}
        onKeyDown={onKeyDown}
      />
      {open ? (
        <div style={popupStyle} data-sunday-combobox-popup>
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            style={{ listStyle: "none", margin: 0, padding: SPACING[1], maxHeight: "16rem", overflowY: "auto" }}
          >
            {visible.length === 0 ? (
              <li
                role="option"
                aria-disabled="true"
                aria-selected="false"
                data-sunday-combobox-empty
                style={{
                  padding: PAD[size],
                  fontFamily: TYPOGRAPHY.fontFamily.sans,
                  fontSize: TYPOGRAPHY.fontSize.sm,
                  color: PALETTE.neutral[500],
                }}
              >
                {emptyLabel}
              </li>
            ) : (
              visible.map((opt, index) => {
                const isSelected = opt.value === selected;
                const isActive = index === activeIndex;
                const optStyle: CSSProperties = {
                  padding: PAD[size],
                  fontFamily: TYPOGRAPHY.fontFamily.sans,
                  fontSize: FONT[size],
                  borderRadius: RADIUS.sm,
                  color: opt.disabled
                    ? PALETTE.neutral[400]
                    : isSelected
                      ? accent.hexStrong
                      : PALETTE.neutral[800],
                  background: isActive && !opt.disabled ? accent.hexSoft : "transparent",
                  fontWeight: isSelected
                    ? TYPOGRAPHY.fontWeight.semibold
                    : TYPOGRAPHY.fontWeight.normal,
                  cursor: opt.disabled ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: SPACING[2],
                };
                return (
                  <li
                    key={opt.value}
                    id={`${listId}-opt-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled || undefined}
                    data-active={isActive || undefined}
                    data-selected={isSelected || undefined}
                    style={optStyle}
                    // mousedown (not click) so the input does not blur-close first.
                    onMouseDown={(ev) => {
                      ev.preventDefault();
                      commit(opt);
                    }}
                    onMouseEnter={() => !opt.disabled && setActiveIndex(index)}
                  >
                    <span>{labelOf(opt)}</span>
                    {isSelected ? (
                      <span aria-hidden="true" style={{ color: accent.hexStrong }}>
                        ✓
                      </span>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
