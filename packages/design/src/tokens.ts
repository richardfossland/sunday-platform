// Brand identity tokens for the Sunday Suite — the *logo/brand* layer.
//
// Source of truth: "Sunday Suite — Brand Sheet" (Merkevaremanual · v1.0).
// The visual reference ships alongside this file as ../brand-sheet.html.
//
// This is intentionally separate from the UI tokens in ./index.ts (PALETTE /
// TYPOGRAPHY / ACCENTS). Those drive in-app chrome; this describes the brand
// itself: the golden cross "thread" and each app's deep jewel icon tone.
//
// Design DNA: five apps, one thread. Each app owns its own deep jewel tone;
// a gold cross is the golden thread that binds the family together.

export type TypeStyle = {
  family: string;
  /** px */
  size: number;
  weight: number;
  /** px letter-spacing (negative tightens) */
  letterSpacing: number;
};

/**
 * The canonical brand identity, mirroring the brand sheet exactly.
 * Frozen literal so consumers get precise types and a single import.
 */
export const BRAND = {
  /** The golden thread — primary accent shared across the whole family. */
  gold: {
    /** Primær · symbol/aksent */
    base: '#EBB84B',
    /** Sekundær · gradient (lys gull) */
    light: '#F2D58A',
    /** Dyp gull · labels/aksent på lyst */
    deep: '#D4A23A',
  },

  /** Neutral ink + paper foundation. */
  ink: '#1A1D24',
  inkSoft: '#2A2F3A',
  paper: '#FAF7F0',
  paperWarm: '#F5EFE3',

  /** Vertical/diagonal gold gradient used on accents and principle icons. */
  goldGradient: 'linear-gradient(135deg, #F2D58A, #EBB84B)',

  /** Font stacks. Playfair for editorial display, system for body, mono for code. */
  fonts: {
    display: "'Playfair Display', Georgia, serif",
    body: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },

  /**
   * Type scale from the brand sheet's typography showcase. Sizes are the
   * documented px values; consumers may clamp for responsive use (the hero, for
   * example, clamps Display XL to `clamp(48px, 8vw, 96px)`).
   */
  type: {
    displayXl: { family: "'Playfair Display', Georgia, serif", size: 56, weight: 900, letterSpacing: -1.5 },
    display: { family: "'Playfair Display', Georgia, serif", size: 36, weight: 700, letterSpacing: 0 },
    heading: { family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", size: 24, weight: 600, letterSpacing: 0 },
    bodyLg: { family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", size: 18, weight: 400, letterSpacing: 0 },
    body: { family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", size: 15, weight: 400, letterSpacing: 0 },
    mono: { family: 'ui-monospace, SFMono-Regular, Menlo, monospace', size: 14, weight: 400, letterSpacing: 0 },
  },

  /** Corner radii (px) used across cards, swatches and app icons. */
  radius: {
    /** swatches, smaller cards */
    sm: 16,
    /** large cards / showcases */
    md: 20,
    /** app icon tile */
    icon: 28,
    /** pills / badges */
    pill: 100,
  },

  /** Soft elevation shadows matching the brand sheet's card system. */
  shadow: {
    card: '0 4px 24px rgba(0,0,0,0.06)',
    cardHover: '0 12px 40px rgba(0,0,0,0.12)',
    icon: '0 8px 24px rgba(0,0,0,0.18)',
  },
} as const satisfies {
  gold: { base: string; light: string; deep: string };
  ink: string;
  inkSoft: string;
  paper: string;
  paperWarm: string;
  goldGradient: string;
  fonts: { display: string; body: string; mono: string };
  type: Record<string, TypeStyle>;
  radius: Record<string, number>;
  shadow: Record<string, string>;
};

export type BrandTypeName = keyof typeof BRAND.type;

export const SUNDAY_BRAND_VERSION = '1.0.0';
