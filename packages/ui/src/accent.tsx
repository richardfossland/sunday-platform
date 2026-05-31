import { ACCENTS, type Accent, type SundayApp } from "@sunday/design";
import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from "react";

/**
 * Maps a {@link Accent} to the CSS custom properties the `@sunday/design`
 * `@theme` block expects (`--color-accent*`, `--color-on-accent`). Apps usually
 * set these in their root stylesheet; {@link AppAccentProvider} sets them
 * inline on a wrapper so a subtree can adopt a different app's accent (e.g. a
 * Stage panel embedded in Plan) without a global override.
 */
export function accentCssVars(accent: Accent): CSSProperties {
  return {
    // The leading "--" keys are valid CSS custom properties; React passes them through.
    ["--color-accent" as string]: accent.hex,
    ["--color-accent-soft" as string]: accent.hexSoft,
    ["--color-accent-strong" as string]: accent.hexStrong,
    ["--color-on-accent" as string]: accent.onAccent,
  };
}

const AccentContext = createContext<Accent>(ACCENTS.sundayrec);

/** Read the current accent from the nearest {@link AppAccentProvider}. */
export function useAccent(): Accent {
  return useContext(AccentContext);
}

export interface AppAccentProviderProps {
  /** Which app's accent to apply to the subtree. */
  app: SundayApp;
  /** Render a wrapping element that sets the accent CSS vars inline. Default true. */
  withWrapper?: boolean;
  /** Extra inline styles merged onto the wrapper (when `withWrapper`). */
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
}

/**
 * Provides a per-app accent to its subtree, both as React context (for the
 * primitives in this package via {@link useAccent}) and — when `withWrapper` —
 * as the `--color-accent*` CSS custom properties on a wrapping `<div>` so plain
 * CSS / Tailwind utilities resolve to the right hue too.
 */
export function AppAccentProvider(props: AppAccentProviderProps): ReactNode {
  const { app, withWrapper = true, style, className, children } = props;
  const accent = ACCENTS[app];
  const mergedStyle = useMemo<CSSProperties>(
    () => ({ ...accentCssVars(accent), ...style }),
    [accent, style],
  );

  const inner = <AccentContext.Provider value={accent}>{children}</AccentContext.Provider>;
  if (!withWrapper) return inner;
  return (
    <div data-sunday-app={app} className={className} style={mergedStyle}>
      {inner}
    </div>
  );
}
