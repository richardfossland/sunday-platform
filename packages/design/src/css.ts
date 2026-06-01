// CSS custom-property bridge for the brand layer.
//
// Emits the exact `:root` variable names the brand sheet uses, so any app in the
// suite can drop the shared brand tokens straight into its stylesheet and stay
// pixel-aligned with the Merkevaremanual.

import { BRAND } from './tokens.js';
import { APP_TONES, type BrandedAppId } from './app-tones.js';

/**
 * The canonical brand token → CSS-variable map, matching the brand sheet `:root`.
 * Keys include the leading `--`.
 */
export function cssVariables(): Record<string, string> {
  const vars: Record<string, string> = {
    '--gold': BRAND.gold.base,
    '--gold-light': BRAND.gold.light,
    '--gold-deep': BRAND.gold.deep,

    '--ink': BRAND.ink,
    '--ink-soft': BRAND.inkSoft,
    '--paper': BRAND.paper,
    '--paper-warm': BRAND.paperWarm,

    '--font-display': BRAND.fonts.display,
    '--font-body': BRAND.fonts.body,
  };

  for (const id of Object.keys(APP_TONES) as BrandedAppId[]) {
    const tone = APP_TONES[id];
    if (tone.kind === 'jewel') {
      vars[`--${id}-1`] = tone.from;
      vars[`--${id}-2`] = tone.to;
    } else {
      vars[`--${id}-bg`] = tone.background;
      vars[`--${id}-arc`] = tone.arc;
      vars[`--${id}-symbol`] = tone.symbol;
    }
  }

  return vars;
}

/**
 * Render the brand variables as a ready-to-inject CSS block.
 * @param selector CSS selector to scope the variables to (default `:root`).
 */
export function cssVariablesBlock(selector = ':root'): string {
  const body = Object.entries(cssVariables())
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');
  return `${selector} {\n${body}\n}`;
}
