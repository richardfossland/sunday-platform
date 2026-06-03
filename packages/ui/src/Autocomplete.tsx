import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { Combobox } from "./Combobox.js";
import type { SelectOption, SelectSize } from "./Select.js";

export interface AutocompleteProps {
  /**
   * Current suggestion list, owned by the caller and (re)populated in response
   * to {@link AutocompleteProps.onSearch}. The component does *not* filter these
   * locally — it shows exactly what you give it.
   */
  options: SelectOption[];
  /**
   * Fires (debounced) with the trimmed query whenever the user types. Wire this
   * to your search backend, then push results into `options`. Fires with `""`
   * when the box is cleared so you can reset.
   */
  onSearch: (query: string) => void;
  /** Controlled selected value (an option `value`, or `undefined`). */
  value?: string;
  /** Initial selected value for the uncontrolled case. */
  defaultValue?: string;
  /** Fires with the chosen option value (`undefined` once cleared). */
  onValueChange?: (value: string | undefined) => void;
  /** Debounce for `onSearch`, in ms. Default `200`. Set `0` to fire eagerly. */
  debounceMs?: number;
  /** Minimum query length before `onSearch` fires. Default `1`. */
  minChars?: number;
  /** Show a "Searching…" row while a request is in flight. */
  loading?: boolean;
  /** Disables the control. */
  disabled?: boolean;
  /** Error tone + `aria-invalid`. */
  invalid?: boolean;
  /** Placeholder for the input box. */
  placeholder?: string;
  /** Control density. Default `md`. */
  size?: SelectSize;
  /** Accessible name (input + listbox). */
  ariaLabel?: string;
  /** Forwarded to the input so {@link Field} can label it. */
  id?: string;
  /** Text for the empty-results row. Default "No matches". */
  emptyLabel?: string;
  style?: CSSProperties;
  className?: string;
}

/**
 * A search-as-you-type field for *server-driven* suggestion lists — an
 * {@link Combobox} wired for async lookups. It owns the input text, debounces
 * keystrokes and calls {@link AutocompleteProps.onSearch} once the query reaches
 * `minChars`; the caller fetches and feeds back `options`. The listbox is shown
 * verbatim (no local filtering, `filterMode="none"`), so result ordering /
 * highlighting stays with the backend. Shares the Combobox a11y contract
 * (`role="combobox"` + listbox, arrow/Home/End/Enter/Escape, app-accent active
 * row). A `loading` flag swaps the empty row for a "Searching…" status. Use it
 * for song search, member pickers, scripture lookups — anywhere the candidate
 * set is too large to ship inline.
 */
export function Autocomplete(props: AutocompleteProps): ReactNode {
  const {
    options,
    onSearch,
    value,
    defaultValue,
    onValueChange,
    debounceMs = 200,
    minChars = 1,
    loading = false,
    disabled = false,
    invalid = false,
    placeholder = "Search…",
    size = "md",
    ariaLabel,
    id,
    emptyLabel = "No matches",
    style,
    className,
  } = props;

  const [query, setQuery] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce the search callback; clear any pending timer on unmount / re-type.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function handleInputChange(text: string): void {
    setQuery(text);
    if (timer.current) clearTimeout(timer.current);
    const trimmed = text.trim();
    const fire = (): void => {
      // Below the threshold we still emit "" so the caller can clear results.
      onSearch(trimmed.length >= minChars ? trimmed : "");
    };
    if (debounceMs <= 0) fire();
    else timer.current = setTimeout(fire, debounceMs);
  }

  // While loading we show a single, non-selectable status row in place of the
  // (likely stale/empty) options.
  const shown = useMemo<SelectOption[]>(() => {
    if (loading) return [{ value: "__loading__", label: "Searching…", disabled: true }];
    return options;
  }, [loading, options]);

  return (
    <Combobox
      options={shown}
      filterMode="none"
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      inputValue={value !== undefined ? undefined : query}
      onInputChange={handleInputChange}
      disabled={disabled}
      invalid={invalid}
      placeholder={placeholder}
      size={size}
      ariaLabel={ariaLabel}
      id={id}
      emptyLabel={emptyLabel}
      style={style}
      className={className}
    />
  );
}
