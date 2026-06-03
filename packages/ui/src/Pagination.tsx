import { PALETTE, RADIUS, SPACING, TYPOGRAPHY } from "@sunday/design";
import { type CSSProperties, type ReactNode } from "react";

import { useAccent } from "./accent.js";

export interface PaginationProps {
  /** 1-based index of the current page. */
  page: number;
  /** Total number of pages (>= 1). */
  pageCount: number;
  /** Fires with the requested 1-based page (already clamped to `[1, pageCount]`). */
  onPageChange: (page: number) => void;
  /**
   * How many numbered buttons to show around the current page (each side).
   * Default `1` → e.g. `1 … 4 [5] 6 … 20`. Set `0` to show only the current.
   */
  siblingCount?: number;
  /** Accessible name for the navigation landmark. Default "Pagination". */
  ariaLabel?: string;
  /** Disables the whole control. */
  disabled?: boolean;
  style?: CSSProperties;
  className?: string;
}

const ELLIPSIS = "ellipsis" as const;
type PageToken = number | typeof ELLIPSIS;

/**
 * Build the visible page tokens: always the first + last page, a window of
 * `siblingCount` around the current page, and `ellipsis` gaps where pages are
 * collapsed. Pure + exported for unit testing the windowing logic in isolation.
 */
export function paginationRange(
  page: number,
  pageCount: number,
  siblingCount = 1,
): PageToken[] {
  const total = Math.max(1, pageCount);
  const current = Math.min(Math.max(1, page), total);
  // first + last + current + 2 siblings + 2 ellipses → if everything fits, list all.
  const slots = siblingCount * 2 + 5;
  if (total <= slots) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const left = Math.max(current - siblingCount, 1);
  const right = Math.min(current + siblingCount, total);
  const showLeftGap = left > 2;
  const showRightGap = right < total - 1;

  const tokens: PageToken[] = [1];
  if (showLeftGap) tokens.push(ELLIPSIS);
  else for (let p = 2; p < left; p++) tokens.push(p);
  for (let p = left; p <= right; p++) if (p !== 1 && p !== total) tokens.push(p);
  if (showRightGap) tokens.push(ELLIPSIS);
  else for (let p = right + 1; p < total; p++) tokens.push(p);
  tokens.push(total);
  return tokens;
}

/**
 * A page navigator following the WAI-ARIA pattern: a `<nav>` landmark wrapping a
 * group of page buttons with Previous/Next controls. The current page carries
 * `aria-current="page"`; Previous/Next disable at the edges; collapsed ranges
 * render an inert `…`. The active page borrows the app accent. State is owned by
 * the caller (`page` + `onPageChange`) — every request is clamped to the valid
 * range before it fires.
 */
export function Pagination(props: PaginationProps): ReactNode {
  const {
    page,
    pageCount,
    onPageChange,
    siblingCount = 1,
    ariaLabel = "Pagination",
    disabled = false,
    style,
    className,
  } = props;
  const accent = useAccent();

  const total = Math.max(1, pageCount);
  const current = Math.min(Math.max(1, page), total);
  const tokens = paginationRange(current, total, siblingCount);

  function go(target: number): void {
    if (disabled) return;
    const clamped = Math.min(Math.max(1, target), total);
    if (clamped !== current) onPageChange(clamped);
  }

  const baseBtn: CSSProperties = {
    appearance: "none",
    minWidth: "2rem",
    height: "2rem",
    padding: `0 ${SPACING[2]}`,
    border: `1px solid ${PALETTE.neutral[300]}`,
    borderRadius: RADIUS.md,
    background: PALETTE.surface.light,
    color: PALETTE.neutral[700],
    fontFamily: TYPOGRAPHY.fontFamily.sans,
    fontSize: TYPOGRAPHY.fontSize.sm,
    cursor: "pointer",
  };
  const disabledBtn: CSSProperties = { opacity: 0.5, cursor: "not-allowed" };

  const atStart = current <= 1;
  const atEnd = current >= total;

  return (
    <nav
      aria-label={ariaLabel}
      className={className}
      data-sunday-pagination=""
      style={{ display: "flex", alignItems: "center", gap: SPACING[1], ...style }}
    >
      <button
        type="button"
        aria-label="Previous page"
        data-sunday-pagination-prev=""
        disabled={disabled || atStart}
        style={{ ...baseBtn, ...(disabled || atStart ? disabledBtn : {}) }}
        onClick={() => go(current - 1)}
      >
        ‹
      </button>
      {tokens.map((tok, i) => {
        if (tok === ELLIPSIS) {
          return (
            <span
              key={`gap-${i}`}
              aria-hidden="true"
              data-sunday-pagination-ellipsis=""
              style={{
                minWidth: "2rem",
                textAlign: "center",
                color: PALETTE.neutral[400],
                fontFamily: TYPOGRAPHY.fontFamily.sans,
                fontSize: TYPOGRAPHY.fontSize.sm,
              }}
            >
              …
            </span>
          );
        }
        const isCurrent = tok === current;
        const pageStyle: CSSProperties = isCurrent
          ? {
              ...baseBtn,
              // Full shorthand (not borderColor) so React doesn't warn about
              // mixing shorthand + longhand for the same property on rerender.
              border: `1px solid ${accent.hex}`,
              background: accent.hex,
              color: accent.onAccent,
              fontWeight: TYPOGRAPHY.fontWeight.semibold,
            }
          : { ...baseBtn, ...(disabled ? disabledBtn : {}) };
        return (
          <button
            key={tok}
            type="button"
            aria-label={`Page ${tok}`}
            aria-current={isCurrent ? "page" : undefined}
            data-active={isCurrent || undefined}
            disabled={disabled}
            style={pageStyle}
            onClick={() => go(tok)}
          >
            {tok}
          </button>
        );
      })}
      <button
        type="button"
        aria-label="Next page"
        data-sunday-pagination-next=""
        disabled={disabled || atEnd}
        style={{ ...baseBtn, ...(disabled || atEnd ? disabledBtn : {}) }}
        onClick={() => go(current + 1)}
      >
        ›
      </button>
    </nav>
  );
}
