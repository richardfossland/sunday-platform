/**
 * @sunday/design — the shared design language for the Sunday suite.
 *
 * One palette, one type scale, one spacing rhythm across all seven apps, plus a
 * per-app *accent* so each product still reads as itself (SundayStudio is gold,
 * SundayPaper is copper, SundayEdit is the dark "pro" editor, …). The same tokens
 * are emitted as a Tailwind v4 `@theme` block in `./theme.css` — import that to
 * get the CSS custom properties; import this module for the typed values.
 *
 * This module is intentionally dependency-free (no React, no Tailwind import) so
 * any app — Tauri/React, Next.js, or a plain stylesheet — can consume it.
 */

/**
 * The seven apps of the Sunday suite. Mirrors `SundayApp` in `sunday-contracts`;
 * converge once the platform packages are published (we can't path-depend on a
 * sibling package yet).
 */
export const SUNDAY_APPS = [
  "sundayrec",
  "sundaystage",
  "sundayplan",
  "sundaysong",
  "sundayedit",
  "sundaystudio",
  "sundaypaper",
] as const;
export type SundayApp = (typeof SUNDAY_APPS)[number];

/** A single accent definition — one brand hue plus the foreground it pairs with. */
export interface Accent {
  /** Human label for the accent, for design docs / settings UI. */
  name: string;
  /** Primary brand hue (hex). */
  hex: string;
  /** A lighter tint of the accent (hover/subtle backgrounds). */
  hexSoft: string;
  /** A darker shade (pressed/active borders). */
  hexStrong: string;
  /** Readable text color when placed ON the accent (hex). */
  onAccent: string;
  /**
   * Whether the app's surface defaults to a dark "pro" canvas. SundayEdit and
   * SundayStudio are content-editing tools that run dark by default.
   */
  prefersDark: boolean;
}

/**
 * Per-app accent. Every app in {@link SUNDAY_APPS} has exactly one entry — the
 * `accentMapIsComplete` test guards that. `sundayrec`/`stage`/`plan`/`song` share
 * the suite's signature blue; the desktop creative tools each get a distinct hue.
 */
export const ACCENTS: Record<SundayApp, Accent> = {
  sundayrec: {
    name: "Sunday Blue",
    hex: "#2563eb",
    hexSoft: "#dbeafe",
    hexStrong: "#1d4ed8",
    onAccent: "#ffffff",
    prefersDark: false,
  },
  sundaystage: {
    name: "Stage Indigo",
    hex: "#4f46e5",
    hexSoft: "#e0e7ff",
    hexStrong: "#3730a3",
    onAccent: "#ffffff",
    prefersDark: false,
  },
  sundayplan: {
    name: "Plan Teal",
    hex: "#0d9488",
    hexSoft: "#ccfbf1",
    hexStrong: "#0f766e",
    onAccent: "#ffffff",
    prefersDark: false,
  },
  sundaysong: {
    name: "Song Violet",
    hex: "#7c3aed",
    hexSoft: "#ede9fe",
    hexStrong: "#5b21b6",
    onAccent: "#ffffff",
    prefersDark: false,
  },
  sundayedit: {
    name: "Editor Slate (dark/pro)",
    hex: "#38bdf8",
    hexSoft: "#0e7490",
    hexStrong: "#0ea5e9",
    onAccent: "#0b1120",
    prefersDark: true,
  },
  sundaystudio: {
    name: "Studio Gold",
    hex: "#d4a017",
    hexSoft: "#fef3c7",
    hexStrong: "#a97e0c",
    onAccent: "#1a1505",
    prefersDark: true,
  },
  sundaypaper: {
    name: "Paper Copper",
    hex: "#b87333",
    hexSoft: "#f6e7d7",
    hexStrong: "#8c531f",
    onAccent: "#ffffff",
    prefersDark: false,
  },
};

/** Look up an app's accent. */
export function accentFor(app: SundayApp): Accent {
  return ACCENTS[app];
}

/**
 * The shared, app-agnostic palette: neutrals, surfaces and the semantic status
 * hues. The per-app accent ({@link ACCENTS}) layers on top of these. Light first,
 * dark variants for the "pro" surfaces.
 */
export const PALETTE = {
  /** Neutral ramp (gray), 50 → 900. */
  neutral: {
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
  },
  surface: {
    light: "#ffffff",
    lightMuted: "#f8fafc",
    dark: "#0b1120",
    darkMuted: "#111827",
  },
  status: {
    success: "#16a34a",
    warning: "#d97706",
    danger: "#dc2626",
    info: "#0284c7",
  },
} as const;

/**
 * Type scale. The UI font stack is system-first (fast, no web-font flash); the
 * mono stack is for timecodes, file paths and the lyric/chord editors.
 */
export const TYPOGRAPHY = {
  fontFamily: {
    sans: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    mono: "ui-monospace, 'SF Mono', 'Cascadia Code', 'Fira Code', Menlo, Consolas, monospace",
  },
  /** rem-based modular scale (xs → 3xl). */
  fontSize: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.7,
  },
} as const;

/** 4px-based spacing rhythm (the same scale the `@theme` block emits). */
export const SPACING = {
  0: "0",
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  6: "1.5rem",
  8: "2rem",
  12: "3rem",
  16: "4rem",
} as const;

/** Corner-radius scale. */
export const RADIUS = {
  none: "0",
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  full: "9999px",
} as const;

/*
 * Brand identity layer — the suite's logo/brand language from the
 * "Sunday Suite — Brand Sheet" (see ../brand-sheet.html).
 *
 * This is a separate concern from the UI tokens above: `BRAND` is the golden
 * cross "thread" + editorial display type, and `APP_TONES` are the per-app
 * *icon* jewel tones (kobolt/plomme/smaragd/petrol + the studio light
 * exception). The in-app UI accent stays driven by ACCENTS / PALETTE above.
 */
export * from "./tokens.js";
export * from "./app-tones.js";
export * from "./css.js";
