import { PALETTE, RADIUS, SPACING, TYPOGRAPHY } from "@sunday/design";
import {
  cloneElement,
  useId,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  /** The tooltip text/content. */
  label: ReactNode;
  /** Where to place the bubble relative to the trigger. Default `top`. */
  placement?: TooltipPlacement;
  /**
   * The single interactive trigger element. Cloned with hover/focus handlers and
   * `aria-describedby` pointing at the tooltip so screen readers announce it.
   */
  children: ReactElement<{
    onMouseEnter?: (e: MouseEvent) => void;
    onMouseLeave?: (e: MouseEvent) => void;
    onFocus?: (e: FocusEvent) => void;
    onBlur?: (e: FocusEvent) => void;
    onKeyDown?: (e: KeyboardEvent) => void;
    "aria-describedby"?: string;
  }>;
  style?: CSSProperties;
  className?: string;
}

/**
 * An accessible tooltip: shows on hover AND keyboard focus (never hover-only),
 * dismisses on Escape, and links the bubble to its trigger via
 * `aria-describedby` + `role="tooltip"`. The trigger stays the caller's own
 * element (cloned, not wrapped, so layout/semantics are preserved). Positioning
 * is a simple absolute offset — fine for the short labels these are used for; a
 * collision-aware popover is out of scope (and would need a bundler).
 */
export function Tooltip(props: TooltipProps): ReactNode {
  const { label, placement = "top", children, style, className } = props;
  const id = useId();
  const [open, setOpen] = useState(false);

  const child = children;
  const trigger = cloneElement(child, {
    "aria-describedby": open ? id : child.props["aria-describedby"],
    onMouseEnter: (e: MouseEvent) => {
      child.props.onMouseEnter?.(e);
      setOpen(true);
    },
    onMouseLeave: (e: MouseEvent) => {
      child.props.onMouseLeave?.(e);
      setOpen(false);
    },
    onFocus: (e: FocusEvent) => {
      child.props.onFocus?.(e);
      setOpen(true);
    },
    onBlur: (e: FocusEvent) => {
      child.props.onBlur?.(e);
      setOpen(false);
    },
    onKeyDown: (e: KeyboardEvent) => {
      child.props.onKeyDown?.(e);
      if (e.key === "Escape") setOpen(false);
    },
  });

  const wrap: CSSProperties = {
    position: "relative",
    display: "inline-flex",
    ...style,
  };
  const bubble: CSSProperties = {
    position: "absolute",
    zIndex: 50,
    whiteSpace: "nowrap",
    background: PALETTE.neutral[900],
    color: PALETTE.neutral[50],
    fontFamily: TYPOGRAPHY.fontFamily.sans,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    lineHeight: TYPOGRAPHY.lineHeight.tight,
    padding: `${SPACING[1]} ${SPACING[2]}`,
    borderRadius: RADIUS.sm,
    pointerEvents: "none",
    ...placementStyle(placement),
  };

  return (
    <span className={className} style={wrap}>
      {trigger}
      <span role="tooltip" id={id} hidden={!open} data-placement={placement} style={bubble}>
        {label}
      </span>
    </span>
  );
}

function placementStyle(placement: TooltipPlacement): CSSProperties {
  const gap = SPACING[1];
  switch (placement) {
    case "bottom":
      return { top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: gap };
    case "left":
      return { right: "100%", top: "50%", transform: "translateY(-50%)", marginRight: gap };
    case "right":
      return { left: "100%", top: "50%", transform: "translateY(-50%)", marginLeft: gap };
    case "top":
    default:
      return { bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: gap };
  }
}
