import { PALETTE, SPACING, TYPOGRAPHY } from "@sunday/design";
import { useId, type CSSProperties, type ReactNode } from "react";

export interface FieldProps {
  /** Visible label text. */
  label: string;
  /** Optional helper text shown under the control. */
  hint?: string;
  /** Error message — when set, the field renders in the danger tone. */
  error?: string;
  /** Marks the field required (adds an asterisk to the label). */
  required?: boolean;
  /**
   * The control to label. Receives the generated `id` so the label's `htmlFor`
   * binds to it — render it as `(id) => <input id={id} … />`.
   */
  children: (id: string) => ReactNode;
  style?: CSSProperties;
  className?: string;
}

/**
 * A labelled form field wrapper: a `<label>` bound to its control via a
 * generated id, plus optional hint/error text. Accessible-by-construction (the
 * label always references the control); the render-prop hands the caller the id
 * so any input/select/textarea can be wrapped.
 */
export function Field(props: FieldProps): ReactNode {
  const { label, hint, error, required = false, children, style, className } = props;
  const id = useId();
  const hasError = Boolean(error);

  const wrap: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: SPACING[1],
    fontFamily: TYPOGRAPHY.fontFamily.sans,
    ...style,
  };
  const labelStyle: CSSProperties = {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: PALETTE.neutral[700],
  };
  const subStyle: CSSProperties = {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: hasError ? PALETTE.status.danger : PALETTE.neutral[500],
  };

  return (
    <div className={className} style={wrap} data-invalid={hasError || undefined}>
      <label htmlFor={id} style={labelStyle}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children(id)}
      {error ? (
        <span role="alert" style={subStyle}>
          {error}
        </span>
      ) : hint ? (
        <span style={subStyle}>{hint}</span>
      ) : null}
    </div>
  );
}
