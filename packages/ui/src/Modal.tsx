import { PALETTE, RADIUS, SPACING, TYPOGRAPHY } from "@sunday/design";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

export interface ModalProps {
  /** Whether the modal is shown. When false, nothing renders. */
  open: boolean;
  /** Called on Escape, backdrop click, or the close button. */
  onClose: () => void;
  /** Accessible dialog title (rendered as the heading and wired to `aria-labelledby`). */
  title: ReactNode;
  /** Optional supporting description, wired to `aria-describedby`. */
  description?: ReactNode;
  /** Body content. */
  children?: ReactNode;
  /** Optional footer (action buttons). */
  footer?: ReactNode;
  /** Close when the backdrop is clicked. Default true. */
  closeOnBackdrop?: boolean;
  /** Show the "×" close affordance in the header. Default true. */
  showCloseButton?: boolean;
  /** Use the dark "pro" surface (SundayEdit/Studio). Default false. */
  dark?: boolean;
  style?: CSSProperties;
  className?: string;
}

const FOCUSABLE =
  'a[href],area[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * An accessible modal dialog following the WAI-ARIA dialog pattern:
 * `role="dialog"` + `aria-modal`, `aria-labelledby`/`aria-describedby` wired to
 * its title/description, Escape to close, a click-outside backdrop, a focus trap
 * (Tab/Shift+Tab cycle within), initial focus moved into the dialog on open, and
 * focus restored to the previously-focused element on close. Rendered inline
 * (no portal) so it stays bundler-free; callers place it at a top level so the
 * fixed-position backdrop covers the viewport.
 */
export function Modal(props: ModalProps): ReactNode {
  const {
    open,
    onClose,
    title,
    description,
    children,
    footer,
    closeOnBackdrop = true,
    showCloseButton = true,
    dark = false,
    style,
    className,
  } = props;
  const baseId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // Remember focus on open; restore it on close/unmount.
  useEffect(() => {
    if (!open) return;
    restoreRef.current = (document.activeElement as HTMLElement) ?? null;
    // Move focus into the dialog (first focusable, else the dialog itself).
    const node = dialogRef.current;
    const first = node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();
    return () => {
      restoreRef.current?.focus?.();
    };
  }, [open]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const node = dialogRef.current;
      if (!node) return;
      const focusable = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusable.length === 0) {
        e.preventDefault();
        node.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const activeEl = document.activeElement;
      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  if (!open) return null;

  const titleId = `${baseId}-title`;
  const descId = description ? `${baseId}-desc` : undefined;

  const backdrop: CSSProperties = {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(15,23,42,0.5)",
    padding: SPACING[4],
    zIndex: 1000,
  };
  const panel: CSSProperties = {
    width: "min(32rem, 100%)",
    maxHeight: "calc(100vh - 2rem)",
    overflow: "auto",
    background: dark ? PALETTE.surface.dark : PALETTE.surface.light,
    color: dark ? PALETTE.neutral[100] : PALETTE.neutral[900],
    border: `1px solid ${dark ? PALETTE.neutral[700] : PALETTE.neutral[200]}`,
    borderRadius: RADIUS.lg,
    boxShadow: "0 10px 40px rgba(15,23,42,0.35)",
    fontFamily: TYPOGRAPHY.fontFamily.sans,
    ...style,
  };

  function onBackdropClick(e: MouseEvent<HTMLDivElement>): void {
    if (closeOnBackdrop && e.target === e.currentTarget) onClose();
  }

  return (
    <div data-sunday-modal-backdrop="" style={backdrop} onMouseDown={onBackdropClick}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className={className}
        style={panel}
        onKeyDown={onKeyDown}
      >
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: SPACING[2],
            padding: `${SPACING[4]} ${SPACING[4]} 0`,
          }}
        >
          <h2 id={titleId} style={{ margin: 0, fontSize: TYPOGRAPHY.fontSize.lg, fontWeight: TYPOGRAPHY.fontWeight.semibold }}>
            {title}
          </h2>
          {showCloseButton ? (
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              style={{
                appearance: "none",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: TYPOGRAPHY.fontSize.xl,
                lineHeight: 1,
                color: dark ? PALETTE.neutral[400] : PALETTE.neutral[500],
                padding: SPACING[1],
              }}
            >
              {"×"}
            </button>
          ) : null}
        </header>
        {description ? (
          <p id={descId} style={{ margin: 0, padding: `${SPACING[1]} ${SPACING[4]} 0`, fontSize: TYPOGRAPHY.fontSize.sm, color: dark ? PALETTE.neutral[300] : PALETTE.neutral[600] }}>
            {description}
          </p>
        ) : null}
        <div style={{ padding: SPACING[4] }}>{children}</div>
        {footer ? (
          <footer
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: SPACING[2],
              padding: `0 ${SPACING[4]} ${SPACING[4]}`,
            }}
          >
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
