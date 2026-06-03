import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  Alert,
  Autocomplete,
  Combobox,
  Field,
  Grid,
  Pagination,
  paginationRange,
  ProgressBar,
  Stack,
  Stepper,
  stepStatuses,
  type SelectOption,
  type StepItem,
} from "../src/index.js";

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Layout helpers — Stack + Grid
// ---------------------------------------------------------------------------

describe("Stack", () => {
  it("renders a flex column by default with a token gap", () => {
    const { container } = render(
      <Stack>
        <span>a</span>
        <span>b</span>
      </Stack>,
    );
    const el = container.querySelector("[data-sunday-stack]") as HTMLElement;
    expect(el.getAttribute("data-direction")).toBe("vertical");
    expect(el.style.display).toBe("flex");
    expect(el.style.flexDirection).toBe("column");
    // gap=4 → 1rem from the spacing scale.
    expect(el.style.gap).toBe("1rem");
    expect(el.childElementCount).toBe(2);
  });

  it("switches to a horizontal row and applies align/justify/wrap", () => {
    const { container } = render(
      <Stack direction="horizontal" gap={2} align="center" justify="space-between" wrap inline>
        <span>a</span>
      </Stack>,
    );
    const el = container.querySelector("[data-sunday-stack]") as HTMLElement;
    expect(el.getAttribute("data-direction")).toBe("horizontal");
    expect(el.style.display).toBe("inline-flex");
    expect(el.style.flexDirection).toBe("row");
    expect(el.style.gap).toBe("0.5rem");
    expect(el.style.alignItems).toBe("center");
    expect(el.style.justifyContent).toBe("space-between");
    expect(el.style.flexWrap).toBe("wrap");
  });

  it("passes className + style through and merges over the computed styles", () => {
    const { container } = render(<Stack className="toolbar" style={{ gap: "2rem" }} />);
    const el = container.querySelector("[data-sunday-stack]") as HTMLElement;
    expect(el.className).toBe("toolbar");
    // Caller style wins on conflict.
    expect(el.style.gap).toBe("2rem");
  });
});

describe("Grid", () => {
  it("expands a numeric column count into equal minmax tracks", () => {
    const { container } = render(
      <Grid columns={3}>
        <span>a</span>
      </Grid>,
    );
    const el = container.querySelector("[data-sunday-grid]") as HTMLElement;
    expect(el.style.display).toBe("grid");
    expect(el.style.gridTemplateColumns).toBe("repeat(3, minmax(0, 1fr))");
    expect(el.style.gap).toBe("1rem");
  });

  it("accepts a raw template string and separate row/column gaps", () => {
    const { container } = render(
      <Grid columns="200px 1fr" columnGap={2} rowGap={6} align="start" justify="stretch" />,
    );
    const el = container.querySelector("[data-sunday-grid]") as HTMLElement;
    expect(el.style.gridTemplateColumns).toBe("200px 1fr");
    expect(el.style.columnGap).toBe("0.5rem");
    expect(el.style.rowGap).toBe("1.5rem");
    expect(el.style.alignItems).toBe("start");
    expect(el.style.justifyItems).toBe("stretch");
  });
});

// ---------------------------------------------------------------------------
// Alert
// ---------------------------------------------------------------------------

describe("Alert", () => {
  it("uses role=status (polite) for info/success", () => {
    render(<Alert tone="success">Saved</Alert>);
    const el = screen.getByRole("status");
    expect(el.getAttribute("aria-live")).toBe("polite");
    expect(el.getAttribute("data-tone")).toBe("success");
    expect(el.textContent).toContain("Saved");
  });

  it("uses role=alert (assertive) for danger/warning", () => {
    render(<Alert tone="danger" title="Upload failed">Try again</Alert>);
    const el = screen.getByRole("alert");
    expect(el.getAttribute("aria-live")).toBe("assertive");
    expect(within(el).getByText("Upload failed")).toBeTruthy();
  });

  it("renders a dismiss button wired to the callback when onDismiss is set", () => {
    const onDismiss = vi.fn();
    render(<Alert onDismiss={onDismiss}>Heads up</Alert>);
    const btn = screen.getByRole("button", { name: "Dismiss" });
    fireEvent.click(btn);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("omits the dismiss control by default", () => {
    render(<Alert>Heads up</Alert>);
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
  });

  it("hides a decorative icon from the accessibility tree", () => {
    const { container } = render(<Alert icon="!">Boom</Alert>);
    const icon = container.querySelector("[data-sunday-alert-icon]") as HTMLElement;
    expect(icon.getAttribute("aria-hidden")).toBe("true");
  });
});

// ---------------------------------------------------------------------------
// ProgressBar
// ---------------------------------------------------------------------------

describe("ProgressBar", () => {
  it("reports the WAI-ARIA progressbar value attributes", () => {
    render(<ProgressBar value={40} ariaLabel="Upload" />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-label")).toBe("Upload");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
    expect(bar.getAttribute("aria-valuenow")).toBe("40");
  });

  it("clamps the value into [min, max] and fills proportionally", () => {
    const { container } = render(<ProgressBar value={150} min={0} max={100} ariaLabel="x" />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("100");
    const fill = container.querySelector("[data-sunday-progress-fill]") as HTMLElement;
    expect(fill.style.width).toBe("100%");
  });

  it("respects a custom min/max scale", () => {
    render(<ProgressBar value={5} min={0} max={10} ariaLabel="steps" showValue />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("5");
    // 5 of 10 → 50%.
    expect(screen.getByText("50%")).toBeTruthy();
  });

  it("drops aria-valuenow when indeterminate", () => {
    render(<ProgressBar value={null} ariaLabel="working" />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBeNull();
    expect(bar.getAttribute("data-indeterminate")).toBe("true");
  });
});

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

describe("paginationRange (windowing)", () => {
  it("lists every page when they fit in the window", () => {
    expect(paginationRange(1, 5, 1)).toEqual([1, 2, 3, 4, 5]);
  });

  it("collapses both sides around a middle page", () => {
    expect(paginationRange(10, 20, 1)).toEqual([1, "ellipsis", 9, 10, 11, "ellipsis", 20]);
  });

  it("only collapses the far side near the start", () => {
    expect(paginationRange(2, 20, 1)).toEqual([1, 2, 3, "ellipsis", 20]);
  });

  it("clamps an out-of-range page before windowing", () => {
    expect(paginationRange(99, 5, 1)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("Pagination", () => {
  const OPTS = { page: 3, pageCount: 10, siblingCount: 1 };

  it("is a labelled navigation landmark with the current page marked", () => {
    render(<Pagination {...OPTS} onPageChange={() => {}} />);
    const nav = screen.getByRole("navigation", { name: "Pagination" });
    const current = within(nav).getByRole("button", { name: "Page 3" });
    expect(current.getAttribute("aria-current")).toBe("page");
  });

  it("requests the neighbouring page from Previous/Next", () => {
    const onPageChange = vi.fn();
    render(<Pagination {...OPTS} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenLastCalledWith(4);
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onPageChange).toHaveBeenLastCalledWith(2);
  });

  it("disables Previous on the first page and Next on the last", () => {
    const { rerender } = render(<Pagination page={1} pageCount={10} onPageChange={() => {}} />);
    expect((screen.getByRole("button", { name: "Previous page" }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<Pagination page={10} pageCount={10} onPageChange={() => {}} />);
    expect((screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("jumps to a clicked page number", () => {
    const onPageChange = vi.fn();
    render(<Pagination {...OPTS} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Page 1" }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("does not fire when clicking the already-current page", () => {
    const onPageChange = vi.fn();
    render(<Pagination {...OPTS} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Page 3" }));
    expect(onPageChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------

const STEPS: StepItem[] = [
  { id: "details", label: "Details" },
  { id: "schedule", label: "Schedule", description: "Pick a date" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done", disabled: true },
];

describe("stepStatuses (state machine)", () => {
  it("derives complete / current / upcoming from the active step", () => {
    expect(stepStatuses(STEPS, "schedule")).toEqual([
      "complete",
      "current",
      "upcoming",
      "upcoming",
    ]);
  });

  it("treats an unknown current id as the first step", () => {
    expect(stepStatuses(STEPS, "nope")[0]).toBe("current");
  });
});

describe("Stepper", () => {
  it("marks the active step with aria-current=step", () => {
    render(<Stepper steps={STEPS} current="schedule" ariaLabel="Wizard" />);
    const current = screen.getByRole("button", { name: /Schedule/ });
    expect(current.getAttribute("aria-current")).toBe("step");
    expect(current.getAttribute("tabindex")).toBe("0");
  });

  it("lets a user jump back to a completed step (linear)", () => {
    const onStepChange = vi.fn();
    render(<Stepper steps={STEPS} current="review" onStepChange={onStepChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Details/ }));
    expect(onStepChange).toHaveBeenCalledWith("details");
  });

  it("keeps upcoming steps inert in a linear flow", () => {
    const onStepChange = vi.fn();
    render(<Stepper steps={STEPS} current="details" onStepChange={onStepChange} />);
    const review = screen.getByRole("button", { name: /Review/ });
    expect(review.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(review);
    expect(onStepChange).not.toHaveBeenCalled();
  });

  it("opens every non-disabled step when linear is false", () => {
    const onStepChange = vi.fn();
    render(<Stepper steps={STEPS} current="details" linear={false} onStepChange={onStepChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Review/ }));
    expect(onStepChange).toHaveBeenCalledWith("review");
    // A disabled step stays inert even when non-linear.
    const done = screen.getByRole("button", { name: /Done/ });
    expect(done.getAttribute("aria-disabled")).toBe("true");
  });

  it("moves focus across navigable steps with arrow keys, Home and End", () => {
    // A non-linear stepper keeps every non-disabled step navigable regardless of
    // the active one, so the arrow/Home/End windowing is exercised cleanly. With
    // current="schedule" the edge steps (Details / Review) are non-current, so
    // Home/End land on them and fire onStepChange.
    const onStepChange = vi.fn();
    render(<Stepper steps={STEPS} current="schedule" linear={false} onStepChange={onStepChange} />);
    // Navigable = Details(0), Schedule(1), Review(2) — Done(3) is disabled.
    const schedule = screen.getByRole("button", { name: /Schedule/ });
    schedule.focus();
    // ArrowRight from Schedule(1) → Review(2).
    fireEvent.keyDown(schedule, { key: "ArrowRight" });
    expect(onStepChange).toHaveBeenLastCalledWith("review");
    // ArrowLeft from Schedule(1) → Details(0).
    fireEvent.keyDown(schedule, { key: "ArrowLeft" });
    expect(onStepChange).toHaveBeenLastCalledWith("details");
    // Home jumps to the first navigable step (Details).
    fireEvent.keyDown(schedule, { key: "Home" });
    expect(onStepChange).toHaveBeenLastCalledWith("details");
    // End jumps to the last navigable step (Review — Done is skipped as disabled).
    fireEvent.keyDown(schedule, { key: "End" });
    expect(onStepChange).toHaveBeenLastCalledWith("review");
  });
});

// ---------------------------------------------------------------------------
// Combobox
// ---------------------------------------------------------------------------

const SONGS: SelectOption[] = [
  { value: "amazing", label: "Amazing Grace" },
  { value: "how-great", label: "How Great Thou Art" },
  { value: "blessed", label: "Blessed Assurance", disabled: true },
  { value: "be-thou", label: "Be Thou My Vision" },
];

function combo(): HTMLInputElement {
  return screen.getByRole("combobox") as HTMLInputElement;
}

describe("Combobox — structure + a11y", () => {
  it("is an editable combobox wired to a listbox", () => {
    render(<Combobox options={SONGS} ariaLabel="Song" />);
    const input = combo();
    expect(input.getAttribute("aria-autocomplete")).toBe("list");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    fireEvent.focus(input);
    expect(input.getAttribute("aria-expanded")).toBe("true");
    const list = screen.getByRole("listbox");
    expect(input.getAttribute("aria-controls")).toBe(list.getAttribute("id"));
  });

  it("marks the error state with aria-invalid", () => {
    render(<Combobox options={SONGS} invalid ariaLabel="Song" />);
    expect(combo().getAttribute("aria-invalid")).toBe("true");
  });

  it("binds to a Field label via the forwarded id", () => {
    render(<Field label="Song">{(id) => <Combobox id={id} options={SONGS} />}</Field>);
    const input = screen.getByLabelText("Song");
    expect(input.getAttribute("role")).toBe("combobox");
  });

  it("does not open when disabled", () => {
    render(<Combobox options={SONGS} disabled ariaLabel="Song" />);
    fireEvent.focus(combo());
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("Combobox — filtering + selection", () => {
  it("filters options by the typed text and shows an empty row", () => {
    render(<Combobox options={SONGS} ariaLabel="Song" />);
    const input = combo();
    fireEvent.change(input, { target: { value: "great" } });
    const opts = screen.getAllByRole("option");
    expect(opts.map((o) => o.textContent)).toEqual([expect.stringContaining("How Great Thou Art")]);
    fireEvent.change(input, { target: { value: "zzz" } });
    expect(within(screen.getByRole("listbox")).getByText("No matches")).toBeTruthy();
  });

  it("chooses an option, fills the input and closes (uncontrolled)", () => {
    const onValueChange = vi.fn();
    render(<Combobox options={SONGS} ariaLabel="Song" onValueChange={onValueChange} />);
    fireEvent.focus(combo());
    const opt = screen.getAllByRole("option").find((o) => o.textContent?.includes("Be Thou"))!;
    fireEvent.mouseDown(opt);
    expect(onValueChange).toHaveBeenCalledWith("be-thou");
    expect(combo().value).toBe("Be Thou My Vision");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("navigates with ArrowDown skipping disabled and chooses with Enter", () => {
    const onValueChange = vi.fn();
    render(<Combobox options={SONGS} ariaLabel="Song" onValueChange={onValueChange} />);
    const input = combo();
    fireEvent.focus(input);
    const list = screen.getByRole("listbox");
    expect(list.getAttribute("id")).toBeTruthy();
    expect(input.getAttribute("aria-activedescendant")).toMatch(/-opt-0$/);
    fireEvent.keyDown(input, { key: "ArrowDown" }); // how-great (1)
    expect(input.getAttribute("aria-activedescendant")).toMatch(/-opt-1$/);
    fireEvent.keyDown(input, { key: "ArrowDown" }); // skip blessed(2,disabled) -> be-thou(3)
    expect(input.getAttribute("aria-activedescendant")).toMatch(/-opt-3$/);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onValueChange).toHaveBeenCalledWith("be-thou");
  });

  it("jumps to first/last with Home/End and closes on Escape", () => {
    render(<Combobox options={SONGS} ariaLabel="Song" />);
    const input = combo();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "End" }); // be-thou (3)
    expect(input.getAttribute("aria-activedescendant")).toMatch(/-opt-3$/);
    fireEvent.keyDown(input, { key: "Home" }); // amazing (0)
    expect(input.getAttribute("aria-activedescendant")).toMatch(/-opt-0$/);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("does not choose a disabled option", () => {
    const onValueChange = vi.fn();
    render(<Combobox options={SONGS} ariaLabel="Song" onValueChange={onValueChange} />);
    fireEvent.focus(combo());
    const blessed = screen.getAllByRole("option").find((o) => o.textContent?.includes("Blessed"))!;
    expect(blessed.getAttribute("aria-disabled")).toBe("true");
    fireEvent.mouseDown(blessed);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("commits free text on Enter only when allowCustomValue is set", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <Combobox options={SONGS} ariaLabel="Song" onValueChange={onValueChange} />,
    );
    fireEvent.change(combo(), { target: { value: "Brand New Hymn" } });
    fireEvent.keyDown(combo(), { key: "Enter" }); // no match, custom off → nothing
    expect(onValueChange).not.toHaveBeenCalled();

    rerender(
      <Combobox options={SONGS} ariaLabel="Song" allowCustomValue onValueChange={onValueChange} />,
    );
    fireEvent.change(combo(), { target: { value: "Brand New Hymn" } });
    fireEvent.keyDown(combo(), { key: "Enter" });
    expect(onValueChange).toHaveBeenCalledWith("Brand New Hymn");
  });
});

// ---------------------------------------------------------------------------
// Autocomplete
// ---------------------------------------------------------------------------

describe("Autocomplete", () => {
  it("debounces onSearch and respects minChars", () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    render(<Autocomplete options={[]} onSearch={onSearch} debounceMs={200} minChars={2} ariaLabel="Find" />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.change(input, { target: { value: "am" } });
    expect(onSearch).not.toHaveBeenCalled(); // still inside the debounce window
    vi.advanceTimersByTime(200);
    expect(onSearch).toHaveBeenCalledExactlyOnceWith("am");
    vi.useRealTimers();
  });

  it("emits an empty query below minChars so callers can reset", () => {
    const onSearch = vi.fn();
    render(<Autocomplete options={[]} onSearch={onSearch} debounceMs={0} minChars={3} ariaLabel="Find" />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "ab" } });
    expect(onSearch).toHaveBeenLastCalledWith("");
  });

  it("shows caller-provided options verbatim (no local filtering) and selects one", () => {
    function Host() {
      const [opts, setOpts] = useState<SelectOption[]>([]);
      const [picked, setPicked] = useState<string>();
      return (
        <>
          <Autocomplete
            options={opts}
            onSearch={() => setOpts([{ value: "ps23", label: "Psalm 23" }])}
            onValueChange={setPicked}
            debounceMs={0}
            ariaLabel="Scripture"
          />
          <span data-testid="picked">{picked ?? ""}</span>
        </>
      );
    }
    render(<Host />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "ps" } });
    const opt = screen.getByRole("option", { name: /Psalm 23/ });
    fireEvent.mouseDown(opt);
    expect(screen.getByTestId("picked").textContent).toBe("ps23");
  });

  it("renders a Searching… status row while loading", () => {
    render(<Autocomplete options={[]} onSearch={() => {}} loading ariaLabel="Find" />);
    fireEvent.focus(screen.getByRole("combobox"));
    const loadingRow = screen.getByRole("option", { name: /Searching/ });
    expect(loadingRow.getAttribute("aria-disabled")).toBe("true");
  });
});
