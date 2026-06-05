// Per-app icon jewel tones — the "Adobe-pakke" model: every app owns its own
// deep jewel icon background, unified by the shared gold cross.
//
// Source: "Sunday Suite — Brand Sheet" palette + logo family. These describe the
// square *app-icon* backgrounds, not the in-app UI accent (see ACCENTS in
// ./index.ts). The brand sheet originally assigned tones to five apps;
// SundayStudio is the documented exception (light tile, not a jewel tone).
// `song` and `paper` are suite-extension tones added when the suite grew to
// seven apps, following the same DNA (deep jewel + shared gold cross).

import { BRAND } from './tokens.js';

/** Apps that carry an official icon tone (five brand-sheet apps + two extensions). */
export type BrandedAppId = 'rec' | 'edit' | 'plan' | 'stage' | 'studio' | 'song' | 'paper';

/** A two-stop diagonal jewel gradient (light top-left → dark bottom-right). */
export type JewelTone = {
  kind: 'jewel';
  /** Norwegian tone name as printed in the palette. */
  toneName: string;
  /** Gradient start (lighter). */
  from: string;
  /** Gradient end (darker). */
  to: string;
};

/**
 * SundayStudio breaks the jewel-tone rule: a light tile with a beige arc and a
 * navy symbol carrying the cross, with gold reserved for the thread.
 */
export type LightTone = {
  kind: 'light';
  toneName: string;
  background: string;
  arc: string;
  symbol: string;
};

export type AppTone = JewelTone | LightTone;

export const APP_TONES: Record<BrandedAppId, AppTone> = {
  rec: { kind: 'jewel', toneName: 'Kobolt', from: '#2A4E92', to: '#172F5E' },
  edit: { kind: 'jewel', toneName: 'Plomme', from: '#7A3E86', to: '#451F54' },
  plan: { kind: 'jewel', toneName: 'Smaragd', from: '#1F7A55', to: '#114A34' },
  stage: { kind: 'jewel', toneName: 'Petrol', from: '#1E6E86', to: '#0F3E50' },
  studio: {
    kind: 'light',
    toneName: 'Gull (unntak)',
    background: '#FFFFFF',
    arc: '#EAD7B4',
    symbol: '#28304A',
  },
  // Suite extensions (icons authored in the same DNA, reusing the traced cross).
  song: { kind: 'jewel', toneName: 'Rubin', from: '#A8392E', to: '#4E1820' },
  paper: { kind: 'jewel', toneName: 'Kobber', from: '#A56A33', to: '#4A2A12' },
};

export const BRANDED_APP_IDS = Object.keys(APP_TONES) as BrandedAppId[];

/**
 * CSS background for an app's icon tile / hero surface. Jewel apps get their
 * diagonal gradient; the studio exception gets its flat light background.
 */
export function appToneBackground(id: BrandedAppId): string {
  const tone = APP_TONES[id];
  return tone.kind === 'jewel'
    ? `linear-gradient(135deg, ${tone.from}, ${tone.to})`
    : tone.background;
}

/** The gold cross / thread colour. Shared by every app, including studio. */
export const APP_THREAD_COLOR = BRAND.gold.base;
