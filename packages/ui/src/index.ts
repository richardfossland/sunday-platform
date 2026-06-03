/**
 * @sunday/ui — shared React primitives for the Sunday suite (web + desktop).
 *
 * Accent-aware building blocks — Button, Card, Badge, Field, the form inputs
 * (Input, TextArea, Checkbox, Radio, RadioGroup, Select), plus feedback + overlay
 * primitives (Spinner, Skeleton, EmptyState, Tabs, Tooltip, Modal, Toast) —
 * bound to a per-app accent from `@sunday/design`'s `ACCENTS` map via
 * {@link AppAccentProvider}, both as React context (for these primitives) and as
 * `--color-accent*` CSS custom properties for plain CSS / Tailwind. Styling is
 * inline-from-tokens, so the package is buildable via `tsc` with no bundler and
 * no CSS pipeline. The overlay/feedback components are a11y-correct
 * (roles/aria/focus management per the WAI-ARIA patterns).
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
export { Input } from "./Input.js";
export type { InputProps, InputType } from "./Input.js";
export { TextArea } from "./TextArea.js";
export type { TextAreaProps, TextAreaResize } from "./TextArea.js";
export { Checkbox } from "./Checkbox.js";
export type { CheckboxProps } from "./Checkbox.js";
export { Radio } from "./Radio.js";
export type { RadioProps } from "./Radio.js";
export { RadioGroup, useRadioGroup } from "./RadioGroup.js";
export type { RadioGroupContextValue, RadioGroupProps } from "./RadioGroup.js";
export { Select } from "./Select.js";
export type { SelectOption, SelectProps, SelectSize } from "./Select.js";
export { Spinner } from "./Spinner.js";
export type { SpinnerProps, SpinnerSize } from "./Spinner.js";
export { Skeleton } from "./Skeleton.js";
export type { SkeletonProps } from "./Skeleton.js";
export { EmptyState } from "./EmptyState.js";
export type { EmptyStateProps } from "./EmptyState.js";
export { Tabs } from "./Tabs.js";
export type { TabItem, TabsProps } from "./Tabs.js";
export { Tooltip } from "./Tooltip.js";
export type { TooltipPlacement, TooltipProps } from "./Tooltip.js";
export { Modal } from "./Modal.js";
export type { ModalProps } from "./Modal.js";
export { ToastProvider, useToast } from "./Toast.js";
export type { Toast, ToastApi, ToastOptions, ToastProviderProps, ToastTone } from "./Toast.js";
