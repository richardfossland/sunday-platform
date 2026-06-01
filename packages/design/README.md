# @sunday/design

Canonical design tokens for the **Sunday Suite** — the single source of truth
for the shared brand, consumed by every app in the suite.

Derived from _Sunday Suite — Brand Sheet_ (Merkevaremanual · 2026). The original
visual reference ships alongside the code as [`brand-sheet.html`](./brand-sheet.html).

## Design DNA

> Five apps, one thread. Each app owns its own deep jewel tone; the gold cross
> is the golden thread that binds the family together.

- **Gold (the thread):** `#EBB84B`, light `#F2D58A`, deep `#D4A23A`
- **Ink / paper foundation:** ink `#1A1D24`, paper `#FAF7F0` (+ soft/warm variants)
- **Typography:** Playfair Display for editorial display, system font for body
- **App jewel tones:** Kobolt (Rec), Plomme (Edit), Smaragd (Plan), Petrol (Stage)
- **Studio is the exception:** a light tile (white bg + beige arc + navy symbol),
  not a jewel tone.

## Usage

```ts
import {
  colors,
  typography,
  APP_TONES,
  appToneBackground,
  cssVariablesBlock,
} from '@sunday/design';

// Accent
const gold = colors.gold; // '#EBB84B'

// An app's icon-tile background
appToneBackground('rec');    // 'linear-gradient(135deg, #2A4E92, #172F5E)'
appToneBackground('studio'); // '#FFFFFF'  (the light exception)

// Drop the whole palette into a stylesheet as CSS custom properties,
// using the exact variable names from the brand sheet (--gold, --rec-1, …).
const css = cssVariablesBlock(); // ':root { --gold: #EBB84B; … }'
```

## Modules

| Module          | Exports                                                             |
| --------------- | ------------------------------------------------------------------ |
| `tokens.ts`     | `gold`, `neutrals`, `colors`, `goldGradient`, `fonts`, `typography`, `radius`, `shadow`, `SUNDAY_DESIGN_TOKENS_VERSION` |
| `app-tones.ts`  | `APP_TONES`, `BRANDED_APP_IDS`, `appToneBackground`, `APP_THREAD_COLOR` |
| `css.ts`        | `cssVariables`, `cssVariablesBlock`                                 |

## Note on the prototype

In the exported `brand-sheet.html`, the SundayStudio logo card reuses the petrol
gradient — a copy/paste artefact of the prototype. The tokens follow the
**documented spec** (palette + design DNA): Studio is the light exception, modelled
as a `LightTone` in `app-tones.ts`.

## Develop

```sh
pnpm --filter @sunday/design test       # vitest
pnpm --filter @sunday/design typecheck  # tsc --noEmit
```
