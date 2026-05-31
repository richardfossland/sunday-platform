import { PALETTE, SPACING, TYPOGRAPHY } from "@sunday/design";
import {
  useId,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { useAccent } from "./accent.js";

export interface TabItem {
  /** Stable key identifying the tab + its panel. */
  id: string;
  /** Visible tab label. */
  label: ReactNode;
  /** Panel content, rendered when the tab is active. */
  content: ReactNode;
  /** When true the tab is shown but cannot be selected. */
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  /** Controlled active tab id. When set, the component does not own selection. */
  value?: string;
  /** Initial active tab id for the uncontrolled case. Defaults to the first item. */
  defaultValue?: string;
  /** Fires with the newly-selected tab id. */
  onValueChange?: (id: string) => void;
  /** Accessible name for the tab list (`aria-label`). */
  ariaLabel?: string;
  style?: CSSProperties;
  className?: string;
}

/**
 * An accessible tab set following the WAI-ARIA tabs pattern: `role="tablist"`
 * with roving `tabindex` (only the active tab is in the tab order), arrow-key
 * navigation (Left/Right + Home/End, skipping disabled tabs), and each tab
 * `aria-controls`-linked to its `role="tabpanel"`. The active underline borrows
 * the app accent. Works controlled (`value` + `onValueChange`) or uncontrolled.
 */
export function Tabs(props: TabsProps): ReactNode {
  const { items, value, defaultValue, onValueChange, ariaLabel, style, className } = props;
  const accent = useAccent();
  const baseId = useId();

  const firstEnabled = items.find((t) => !t.disabled)?.id ?? items[0]?.id ?? "";
  const [internal, setInternal] = useState<string>(defaultValue ?? firstEnabled);
  const active = value ?? internal;

  function select(id: string): void {
    if (value === undefined) setInternal(id);
    onValueChange?.(id);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number): void {
    const enabled = items.map((t, i) => ({ t, i })).filter(({ t }) => !t.disabled);
    if (enabled.length === 0) return;
    const pos = enabled.findIndex(({ i }) => i === index);
    let nextPos = pos;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextPos = (pos + 1) % enabled.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextPos = (pos - 1 + enabled.length) % enabled.length;
        break;
      case "Home":
        nextPos = 0;
        break;
      case "End":
        nextPos = enabled.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const target = enabled[nextPos]!;
    select(target.t.id);
    // Move DOM focus to follow the selection (automatic-activation pattern).
    const el = document.getElementById(`${baseId}-tab-${target.t.id}`);
    el?.focus();
  }

  const listStyle: CSSProperties = {
    display: "flex",
    gap: SPACING[1],
    borderBottom: `1px solid ${PALETTE.neutral[200]}`,
    fontFamily: TYPOGRAPHY.fontFamily.sans,
  };

  return (
    <div className={className} style={style}>
      <div role="tablist" aria-label={ariaLabel} style={listStyle}>
        {items.map((tab, index) => {
          const isActive = tab.id === active;
          const tabStyle: CSSProperties = {
            appearance: "none",
            background: "transparent",
            border: "none",
            borderBottom: `2px solid ${isActive ? accent.hex : "transparent"}`,
            padding: `${SPACING[2]} ${SPACING[3]}`,
            marginBottom: "-1px",
            fontSize: TYPOGRAPHY.fontSize.sm,
            fontWeight: isActive ? TYPOGRAPHY.fontWeight.semibold : TYPOGRAPHY.fontWeight.medium,
            color: tab.disabled
              ? PALETTE.neutral[400]
              : isActive
                ? accent.hexStrong
                : PALETTE.neutral[600],
            cursor: tab.disabled ? "not-allowed" : "pointer",
          };
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`${baseId}-panel-${tab.id}`}
              aria-disabled={tab.disabled || undefined}
              tabIndex={isActive ? 0 : -1}
              disabled={tab.disabled}
              data-active={isActive || undefined}
              style={tabStyle}
              onClick={() => !tab.disabled && select(tab.id)}
              onKeyDown={(e) => onKeyDown(e, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {items.map((tab) => {
        const isActive = tab.id === active;
        return (
          <div
            key={tab.id}
            role="tabpanel"
            id={`${baseId}-panel-${tab.id}`}
            aria-labelledby={`${baseId}-tab-${tab.id}`}
            hidden={!isActive}
            tabIndex={0}
            style={{ paddingTop: SPACING[3] }}
          >
            {isActive ? tab.content : null}
          </div>
        );
      })}
    </div>
  );
}
