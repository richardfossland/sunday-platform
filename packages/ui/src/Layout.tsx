import { SPACING } from "@sunday/design";
import { type CSSProperties, type HTMLAttributes, type ReactNode } from "react";

/** A key into the shared 4px spacing scale (used for `gap`/`padding`). */
export type SpaceToken = keyof typeof SPACING;

function space(token: SpaceToken | undefined): string | undefined {
  return token === undefined ? undefined : SPACING[token];
}

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  /** Main axis. `vertical` (default) stacks children top-to-bottom. */
  direction?: "vertical" | "horizontal";
  /** Gap between children, as a spacing-scale token. Default `4`. */
  gap?: SpaceToken;
  /** `align-items`. */
  align?: CSSProperties["alignItems"];
  /** `justify-content`. */
  justify?: CSSProperties["justifyContent"];
  /** Allow children to wrap onto multiple lines. */
  wrap?: boolean;
  /** Inline vs. block flex container. Default block (`flex`). */
  inline?: boolean;
  children?: ReactNode;
}

/**
 * A flexbox stack — the one-dimensional layout helper every screen reaches for
 * (toolbars, forms, button rows, sidebars). Gap is a {@link SpaceToken} so
 * spacing stays on the shared rhythm. Renders a plain `<div>` with inline flex
 * styles (no class names, no CSS pipeline); extra props/`style` pass through and
 * merge over the computed styles.
 */
export function Stack(props: StackProps): ReactNode {
  const {
    direction = "vertical",
    gap = 4,
    align,
    justify,
    wrap = false,
    inline = false,
    style,
    ...rest
  } = props;

  const base: CSSProperties = {
    display: inline ? "inline-flex" : "flex",
    flexDirection: direction === "vertical" ? "column" : "row",
    gap: space(gap),
    alignItems: align,
    justifyContent: justify,
    flexWrap: wrap ? "wrap" : undefined,
  };

  return <div data-sunday-stack="" data-direction={direction} style={{ ...base, ...style }} {...rest} />;
}

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Number of equal columns (→ `repeat(n, minmax(0, 1fr))`), or a raw
   * `grid-template-columns` string for bespoke tracks. Default `1`.
   */
  columns?: number | string;
  /** Gap between cells, as a spacing-scale token. Default `4`. */
  gap?: SpaceToken;
  /** Separate column gap (overrides `gap` on the inline axis). */
  columnGap?: SpaceToken;
  /** Separate row gap (overrides `gap` on the block axis). */
  rowGap?: SpaceToken;
  /** `align-items`. */
  align?: CSSProperties["alignItems"];
  /** `justify-items`. */
  justify?: CSSProperties["justifyItems"];
  children?: ReactNode;
}

/**
 * A CSS-grid helper — the two-dimensional layout primitive (card galleries,
 * dashboards, form grids). `columns` takes a count (equal `minmax(0,1fr)`
 * tracks) or a raw template string for asymmetric layouts; gaps come from the
 * shared spacing scale. Renders a plain `<div>` with inline grid styles;
 * props/`style` pass through.
 */
export function Grid(props: GridProps): ReactNode {
  const {
    columns = 1,
    gap = 4,
    columnGap,
    rowGap,
    align,
    justify,
    style,
    ...rest
  } = props;

  const template =
    typeof columns === "number" ? `repeat(${columns}, minmax(0, 1fr))` : columns;

  const base: CSSProperties = {
    display: "grid",
    gridTemplateColumns: template,
    gap: space(gap),
    columnGap: space(columnGap),
    rowGap: space(rowGap),
    alignItems: align,
    justifyItems: justify,
  };

  return <div data-sunday-grid="" style={{ ...base, ...style }} {...rest} />;
}
