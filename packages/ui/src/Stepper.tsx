import { PALETTE, RADIUS, SPACING, TYPOGRAPHY } from "@sunday/design";
import { type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

import { useAccent } from "./accent.js";

export interface StepItem {
  /** Stable key identifying the step. */
  id: string;
  /** Visible step label. */
  label: ReactNode;
  /** Optional one-line description under the label. */
  description?: string;
  /** When true the step is shown but cannot be activated by the user. */
  disabled?: boolean;
}

/** Derived status of a step relative to the active one. */
export type StepStatus = "complete" | "current" | "upcoming";

export interface StepperProps {
  steps: StepItem[];
  /** Id of the active step. Defaults to the first step. */
  current: string;
  /**
   * Fires when a user activates a *navigable* step (a completed step or the
   * current one — upcoming steps are inert unless `linear` is false).
   */
  onStepChange?: (id: string) => void;
  /**
   * Linear flow (default): only completed steps + the current step are
   * clickable. Set `false` to allow jumping to any non-disabled step (a wizard
   * with a free-form review screen).
   */
  linear?: boolean;
  /** Lay the steps out vertically instead of the default horizontal row. */
  orientation?: "horizontal" | "vertical";
  /** Accessible name for the step list (`aria-label`). */
  ariaLabel?: string;
  style?: CSSProperties;
  className?: string;
}

/**
 * Resolve each step's status from its position relative to `current`. Pure +
 * exported so the multi-step state machine can be unit-tested without a render.
 */
export function stepStatuses(steps: StepItem[], current: string): StepStatus[] {
  const idx = steps.findIndex((s) => s.id === current);
  const activeIndex = idx >= 0 ? idx : 0;
  return steps.map((_, i) =>
    i < activeIndex ? "complete" : i === activeIndex ? "current" : "upcoming",
  );
}

/**
 * A multi-step progress indicator + navigator (the wizard primitive). Renders an
 * ordered sequence of steps with a derived status each (complete / current /
 * upcoming) — completed steps show a check, the current step the app accent. The
 * list is an `aria-label`-named group; each step is a button carrying
 * `aria-current="step"` when active and `aria-disabled` when not navigable.
 * Left/Right (horizontal) or Up/Down (vertical) plus Home/End move focus across
 * navigable steps. Linear by default (only past + current steps are clickable);
 * `linear={false}` opens every non-disabled step. State is caller-owned
 * (`current` + `onStepChange`).
 */
export function Stepper(props: StepperProps): ReactNode {
  const {
    steps,
    current,
    onStepChange,
    linear = true,
    orientation = "horizontal",
    ariaLabel,
    style,
    className,
  } = props;
  const accent = useAccent();
  const statuses = stepStatuses(steps, current);
  const vertical = orientation === "vertical";

  function navigable(index: number): boolean {
    const step = steps[index];
    if (!step || step.disabled) return false;
    if (!linear) return true;
    // Linear: only completed steps + the current one are reachable.
    return statuses[index] !== "upcoming";
  }

  function activate(index: number): void {
    if (!navigable(index)) return;
    const step = steps[index]!;
    if (step.id !== current) onStepChange?.(step.id);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number): void {
    const nav = steps.map((_, i) => i).filter((i) => navigable(i));
    if (nav.length === 0) return;
    const fwd = vertical ? "ArrowDown" : "ArrowRight";
    const back = vertical ? "ArrowUp" : "ArrowLeft";
    const pos = nav.indexOf(index);
    let nextPos = pos;
    switch (e.key) {
      case fwd:
        nextPos = pos < 0 ? 0 : (pos + 1) % nav.length;
        break;
      case back:
        nextPos = pos < 0 ? nav.length - 1 : (pos - 1 + nav.length) % nav.length;
        break;
      case "Home":
        nextPos = 0;
        break;
      case "End":
        nextPos = nav.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const target = nav[nextPos]!;
    activate(target);
    document.getElementById(`${listId(props)}-step-${steps[target]!.id}`)?.focus();
  }

  const listStyle: CSSProperties = {
    display: "flex",
    flexDirection: vertical ? "column" : "row",
    gap: vertical ? SPACING[2] : SPACING[3],
    listStyle: "none",
    margin: 0,
    padding: 0,
    fontFamily: TYPOGRAPHY.fontFamily.sans,
  };

  const lid = listId(props);

  return (
    <ol
      aria-label={ariaLabel}
      className={className}
      data-sunday-stepper=""
      data-orientation={orientation}
      style={{ ...listStyle, ...style }}
    >
      {steps.map((step, index) => {
        const status = statuses[index]!;
        const canNav = navigable(index);
        const isCurrent = status === "current";
        const markerBg =
          status === "complete"
            ? accent.hex
            : isCurrent
              ? accent.hexSoft
              : PALETTE.neutral[100];
        const markerColor =
          status === "complete"
            ? accent.onAccent
            : isCurrent
              ? accent.hexStrong
              : PALETTE.neutral[500];
        const marker: CSSProperties = {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "1.75rem",
          height: "1.75rem",
          borderRadius: RADIUS.full,
          background: markerBg,
          color: markerColor,
          border: isCurrent ? `2px solid ${accent.hex}` : "none",
          fontSize: TYPOGRAPHY.fontSize.sm,
          fontWeight: TYPOGRAPHY.fontWeight.semibold,
          flexShrink: 0,
        };
        const btn: CSSProperties = {
          appearance: "none",
          background: "transparent",
          border: "none",
          display: "flex",
          alignItems: "center",
          gap: SPACING[2],
          padding: 0,
          textAlign: "left",
          cursor: canNav && !isCurrent ? "pointer" : "default",
          color: step.disabled ? PALETTE.neutral[400] : PALETTE.neutral[800],
        };
        return (
          <li key={step.id} data-status={status} style={{ flex: vertical ? undefined : 1 }}>
            <button
              type="button"
              id={`${lid}-step-${step.id}`}
              aria-current={isCurrent ? "step" : undefined}
              aria-disabled={!canNav || undefined}
              data-status={status}
              data-active={isCurrent || undefined}
              tabIndex={isCurrent ? 0 : -1}
              style={btn}
              onClick={() => activate(index)}
              onKeyDown={(e) => onKeyDown(e, index)}
            >
              <span aria-hidden="true" style={marker}>
                {status === "complete" ? "✓" : index + 1}
              </span>
              <span style={{ display: "flex", flexDirection: "column" }}>
                <span
                  style={{
                    fontSize: TYPOGRAPHY.fontSize.sm,
                    fontWeight: isCurrent
                      ? TYPOGRAPHY.fontWeight.semibold
                      : TYPOGRAPHY.fontWeight.medium,
                    color: isCurrent ? accent.hexStrong : "inherit",
                  }}
                >
                  {step.label}
                </span>
                {step.description ? (
                  <span style={{ fontSize: TYPOGRAPHY.fontSize.xs, color: PALETTE.neutral[500] }}>
                    {step.description}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// A stable-per-call id prefix derived from the step ids — Stepper renders a
// single instance per wizard so the ids only need to be unique within it.
function listId(props: StepperProps): string {
  return `stepper-${props.steps.map((s) => s.id).join("-").slice(0, 32)}`;
}
