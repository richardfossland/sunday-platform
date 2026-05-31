/**
 * @sunday/ui — shared React primitives for the Sunday suite (web + desktop).
 *
 * A handful of accent-aware building blocks (Button, Card, Badge, Field) plus
 * the {@link AppAccentProvider} that binds a per-app accent from
 * `@sunday/design`'s `ACCENTS` map — both as React context (for these
 * primitives) and as `--color-accent*` CSS custom properties for plain CSS /
 * Tailwind. Styling is inline-from-tokens, so the package is buildable via
 * `tsc` with no bundler and no CSS pipeline.
 *
 * Web + desktop (Tauri/React, Next.js) only — there is no React Native target.
 * React is a peer dependency.
 */
export { AppAccentProvider, accentCssVars, useAccent } from "./accent.js";
export type { AppAccentProviderProps } from "./accent.js";
export { Button } from "./Button.js";
export type { ButtonProps, ButtonSize, ButtonVariant } from "./Button.js";
export { Card } from "./Card.js";
export type { CardProps } from "./Card.js";
export { Badge } from "./Badge.js";
export type { BadgeProps, BadgeTone } from "./Badge.js";
export { Field } from "./Field.js";
export type { FieldProps } from "./Field.js";
