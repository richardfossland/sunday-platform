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

/** A single choosable option in a {@link Select}. */
export interface SelectOption {
  /** The value committed to `onValueChange` when this option is chosen. */
  value: string;
  /** Visible label. Falls back to `value` when omitted. */
  label?: string;
  /** When true the option is shown but cannot be chosen + is skipped by nav. */
  disabled?: boolean;
}

/** Control density, mirroring the other form primitives. */
export type SelectSize = "sm" | "md" | "lg";

export interface SelectProps {
  /** The options to choose from. */
  options: SelectOption[];
  /**
   * Controlled selection. A `string` for single-select, a `string[]` for
   * `multiple`. When set, the component does not own selection.
   */
  value?: string | string[];
  /** Initial selection for the uncontrolled case (shape matches `value`). */
  defaultValue?: string | string[];
  /**
   * Fires with the new selection — a `string` (or `undefined` once cleared) for
   * single-select, the full `string[]` for `multiple`.
   */
  onValueChange?: (value: string | string[] | undefined) => void;
  /** Allow choosing several options (renders a `aria-multiselectable` listbox). */
  multiple?: boolean;
  /** Disables the whole control. */
  disabled?: boolean;
  /** Error tone + `aria-invalid`/`data-invalid`, matching {@link Input}. */
  invalid?: boolean;
  /** Show an inline clear affordance when there is a selection. */
  clearable?: boolean;
  /** Add a type-to-filter text box at the top of the open listbox. */
  filterable?: boolean;
  /** Placeholder shown on the trigger when nothing is selected. */
  placeholder?: string;
  /** Control density. Default `md`. */
  size?: SelectSize;
  /** Accessible name for the control (used on trigger + listbox). */
  ariaLabel?: string;
  /** Forwarded to the trigger button so {@link Field} can label it. */
  id?: string;
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

function toArray(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * An accessible select following the WAI-ARIA listbox pattern: a `role="button"`
 * trigger that opens an inline (non-portal) `role="listbox"` of `role="option"`
 * rows, with single- or `multiple`-select. Keyboard support per the pattern —
 * ArrowUp/ArrowDown move the active option (skipping disabled), Home/End jump to
 * the edges, Enter/Space choose (single closes, multiple toggles), Escape closes
 * and returns focus to the trigger, and a type-ahead matches option labels by
 * prefix. With `filterable` a text box narrows the visible options. Styled from
 * the design tokens; danger tone + `data-invalid` in the error state and a focus
 * ring borrowed from the active app accent. Works controlled (`value` +
 * `onValueChange`) or uncontrolled (`defaultValue`). Pair with {@link Field}
 * and forward the generated id to `id`.
 */
export function Select(props: SelectProps): ReactNode {
  const {
    options,
    value,
    defaultValue,
    onValueChange,
    multiple = false,
    disabled = false,
    invalid = false,
    clearable = false,
    filterable = false,
    placeholder = "Select…",
    size = "md",
    ariaLabel,
    id: idProp,
    style,
    className,
  } = props;

  const accent = useAccent();
  const baseId = useId();
  const triggerId = idProp ?? `${baseId}-trigger`;
  const listId = `${baseId}-list`;

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<string[]>(() => toArray(defaultValue));
  const selected = isControlled ? toArray(value) : internal;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [filter, setFilter] = useState("");

  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  // Buffer + timer for prefix type-ahead when the filter box is absent.
  const typeahead = useRef<{ buffer: string; at: number }>({ buffer: "", at: 0 });

  const visible = useMemo(() => {
    if (!filterable || filter.trim() === "") return options;
    const q = filter.trim().toLowerCase();
    return options.filter((o) => labelOf(o).toLowerCase().includes(q));
  }, [options, filter, filterable]);

  const enabledIndices = useMemo(
    () => visible.map((o, i) => ({ o, i })).filter(({ o }) => !o.disabled).map(({ i }) => i),
    [visible],
  );

  function commit(next: string[]): void {
    if (!isControlled) setInternal(next);
    if (multiple) {
      onValueChange?.(next);
    } else {
      onValueChange?.(next[0]);
    }
  }

  function choose(opt: SelectOption): void {
    if (opt.disabled) return;
    if (multiple) {
      const has = selected.includes(opt.value);
      commit(has ? selected.filter((v) => v !== opt.value) : [...selected, opt.value]);
      // Multiple stays open so several can be toggled in one pass.
    } else {
      commit([opt.value]);
      close(true);
    }
  }

  function clear(): void {
    commit([]);
  }

  function openList(): void {
    if (disabled) return;
    setOpen(true);
    // Land the active option on the first selected (or first enabled) row.
    const firstSelected = visible.findIndex((o) => selected.includes(o.value) && !o.disabled);
    setActiveIndex(firstSelected >= 0 ? firstSelected : (enabledIndices[0] ?? -1));
  }

  function close(focusTrigger: boolean): void {
    setOpen(false);
    setFilter("");
    if (focusTrigger) triggerRef.current?.focus();
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

  function typeAhead(key: string): void {
    const now = Date.now();
    const buf = now - typeahead.current.at > 600 ? key : typeahead.current.buffer + key;
    typeahead.current = { buffer: buf, at: now };
    const match = visible.findIndex(
      (o) => !o.disabled && labelOf(o).toLowerCase().startsWith(buf.toLowerCase()),
    );
    if (match >= 0) setActiveIndex(match);
  }

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>): void {
    if (disabled) return;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openList();
      }
      return;
    }
    onListKeyDown(e.key, e);
  }

  function onListKeyDown(key: string, e: { preventDefault: () => void }): void {
    switch (key) {
      case "ArrowDown":
        e.preventDefault();
        moveActive("next");
        break;
      case "ArrowUp":
        e.preventDefault();
        moveActive("prev");
        break;
      case "Home":
        e.preventDefault();
        moveActive("first");
        break;
      case "End":
        e.preventDefault();
        moveActive("last");
        break;
      case "Enter":
      case " ": {
        // In the filter box, Space types a literal space — only Enter chooses.
        if (key === " " && filterable && document.activeElement === filterRef.current) return;
        e.preventDefault();
        const opt = visible[activeIndex];
        if (opt) choose(opt);
        break;
      }
      case "Escape":
        e.preventDefault();
        close(true);
        break;
      case "Tab":
        // Tabbing away dismisses but lets focus advance naturally.
        close(false);
        break;
      default:
        // Type-ahead only when there is no filter box capturing the keys.
        if (!filterable && key.length === 1) typeAhead(key);
        break;
    }
  }

  // Close on an outside pointer press (the inline listbox has no backdrop).
  useEffect(() => {
    if (!open) return;
    function onDown(ev: MouseEvent): void {
      const root = triggerRef.current?.parentElement;
      if (root && !root.contains(ev.target as Node)) close(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Focus the filter box (else the listbox) when the popup opens.
  useEffect(() => {
    if (!open) return;
    if (filterable) filterRef.current?.focus();
    else listRef.current?.focus();
  }, [open, filterable]);

  // Keep the active option in view as it moves.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = document.getElementById(`${listId}-opt-${activeIndex}`);
    // `scrollIntoView` is a progressive nicety + absent under jsdom.
    el?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeIndex, listId]);

  const selectedOptions = options.filter((o) => selected.includes(o.value));
  const triggerLabel =
    selectedOptions.length === 0
      ? placeholder
      : selectedOptions.map(labelOf).join(", ");
  const hasSelection = selected.length > 0;

  const triggerStyle: CSSProperties = {
    fontFamily: TYPOGRAPHY.fontFamily.sans,
    fontSize: FONT[size],
    lineHeight: TYPOGRAPHY.lineHeight.normal,
    color: hasSelection ? PALETTE.neutral[800] : PALETTE.neutral[500],
    background: disabled ? PALETTE.neutral[100] : PALETTE.surface.light,
    padding: PAD[size],
    border: `1px solid ${invalid ? PALETTE.status.danger : PALETTE.neutral[300]}`,
    borderRadius: RADIUS.md,
    outlineColor: invalid ? PALETTE.status.danger : accent.hex,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    width: "100%",
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING[2],
    textAlign: "left",
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
  const listStyle: CSSProperties = {
    listStyle: "none",
    margin: 0,
    padding: SPACING[1],
    maxHeight: "16rem",
    overflowY: "auto",
    outline: "none",
  };

  return (
    <div
      className={className}
      style={{ position: "relative", width: "100%", ...style }}
      data-sunday-select
      data-invalid={invalid || undefined}
    >
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        data-invalid={invalid || undefined}
        data-placeholder={!hasSelection || undefined}
        disabled={disabled}
        style={triggerStyle}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={onTriggerKeyDown}
      >
        <span data-sunday-select-value>{triggerLabel}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: SPACING[1] }}>
          {clearable && hasSelection && !disabled ? (
            <span
              role="button"
              aria-label="Clear selection"
              tabIndex={-1}
              data-sunday-select-clear
              style={{ color: PALETTE.neutral[500], cursor: "pointer", fontSize: FONT[size] }}
              onClick={(ev) => {
                ev.stopPropagation();
                clear();
              }}
            >
              ×
            </span>
          ) : null}
          <span aria-hidden="true" style={{ color: PALETTE.neutral[500] }}>
            ▾
          </span>
        </span>
      </button>

      {open ? (
        <div style={popupStyle} data-sunday-select-popup>
          {filterable ? (
            <div style={{ padding: SPACING[1], borderBottom: `1px solid ${PALETTE.neutral[100]}` }}>
              <input
                ref={filterRef}
                type="text"
                role="searchbox"
                aria-label="Filter options"
                aria-controls={listId}
                value={filter}
                placeholder="Filter…"
                onChange={(e) => {
                  setFilter(e.target.value);
                  setActiveIndex(enabledIndices[0] ?? -1);
                }}
                onKeyDown={(e) => onListKeyDown(e.key, e)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  fontFamily: TYPOGRAPHY.fontFamily.sans,
                  fontSize: TYPOGRAPHY.fontSize.sm,
                  padding: `${SPACING[1]} ${SPACING[2]}`,
                  border: `1px solid ${PALETTE.neutral[200]}`,
                  borderRadius: RADIUS.sm,
                  outlineColor: accent.hex,
                }}
              />
            </div>
          ) : null}
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            aria-multiselectable={multiple || undefined}
            aria-activedescendant={
              activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
            }
            tabIndex={-1}
            style={listStyle}
            onKeyDown={(e) => onListKeyDown(e.key, e)}
          >
            {visible.length === 0 ? (
              <li
                role="option"
                aria-disabled="true"
                aria-selected="false"
                style={{
                  padding: PAD[size],
                  fontFamily: TYPOGRAPHY.fontFamily.sans,
                  fontSize: TYPOGRAPHY.fontSize.sm,
                  color: PALETTE.neutral[500],
                }}
                data-sunday-select-empty
              >
                No matches
              </li>
            ) : (
              visible.map((opt, index) => {
                const isSelected = selected.includes(opt.value);
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
                    onMouseEnter={() => !opt.disabled && setActiveIndex(index)}
                    onClick={() => choose(opt)}
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
