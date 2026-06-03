import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Field, Select, type SelectOption } from "../src/index.js";

afterEach(cleanup);

const OPTIONS: SelectOption[] = [
  { value: "matt", label: "Matthew" },
  { value: "mark", label: "Mark" },
  { value: "luke", label: "Luke", disabled: true },
  { value: "john", label: "John" },
];

function trigger(): HTMLElement {
  return screen.getByRole("combobox");
}

function openOptions(): HTMLElement[] {
  fireEvent.click(trigger());
  return screen.getAllByRole("option");
}

describe("Select — trigger + structure", () => {
  it("shows the placeholder when nothing is selected and marks it", () => {
    render(<Select options={OPTIONS} placeholder="Pick a gospel" ariaLabel="Gospel" />);
    const t = trigger();
    expect(t.textContent).toContain("Pick a gospel");
    expect(t.getAttribute("data-placeholder")).toBe("true");
    expect(t.getAttribute("aria-expanded")).toBe("false");
    expect(t.getAttribute("aria-haspopup")).toBe("listbox");
  });

  it("opens an aria-controlled listbox on click and closes again", () => {
    render(<Select options={OPTIONS} ariaLabel="Gospel" />);
    const t = trigger();
    fireEvent.click(t);
    expect(t.getAttribute("aria-expanded")).toBe("true");
    const list = screen.getByRole("listbox");
    expect(t.getAttribute("aria-controls")).toBe(list.getAttribute("id"));
    fireEvent.click(t);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("marks the error state with aria-invalid + data-invalid", () => {
    render(<Select options={OPTIONS} invalid ariaLabel="Gospel" />);
    const t = trigger();
    expect(t.getAttribute("aria-invalid")).toBe("true");
    expect(t.getAttribute("data-invalid")).toBe("true");
  });

  it("does not open when disabled", () => {
    render(<Select options={OPTIONS} disabled ariaLabel="Gospel" />);
    fireEvent.click(trigger());
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("binds to a Field label via the forwarded id", () => {
    render(
      <Field label="Gospel">{(id) => <Select id={id} options={OPTIONS} />}</Field>,
    );
    const t = screen.getByLabelText("Gospel");
    expect(t.getAttribute("role")).toBe("combobox");
  });
});

describe("Select — single selection", () => {
  it("chooses an option, updates the trigger and closes (uncontrolled)", () => {
    const onValueChange = vi.fn();
    render(<Select options={OPTIONS} ariaLabel="Gospel" onValueChange={onValueChange} />);
    const opts = openOptions();
    fireEvent.click(opts[1]!); // Mark
    expect(onValueChange).toHaveBeenCalledWith("mark");
    expect(trigger().textContent).toContain("Mark");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("reflects aria-selected on the chosen option", () => {
    render(<Select options={OPTIONS} defaultValue="john" ariaLabel="Gospel" />);
    const opts = openOptions();
    const john = opts.find((o) => o.textContent?.includes("John"))!;
    expect(john.getAttribute("aria-selected")).toBe("true");
    expect(opts[0]!.getAttribute("aria-selected")).toBe("false");
  });

  it("does not choose a disabled option", () => {
    const onValueChange = vi.fn();
    render(<Select options={OPTIONS} ariaLabel="Gospel" onValueChange={onValueChange} />);
    const opts = openOptions();
    const luke = opts.find((o) => o.textContent?.includes("Luke"))!;
    expect(luke.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(luke);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  it("respects a controlled value (no internal change without a parent update)", () => {
    const onValueChange = vi.fn();
    render(<Select options={OPTIONS} value="matt" ariaLabel="Gospel" onValueChange={onValueChange} />);
    expect(trigger().textContent).toContain("Matthew");
    const opts = openOptions();
    fireEvent.click(opts[1]!);
    expect(onValueChange).toHaveBeenCalledWith("mark");
    expect(trigger().textContent).toContain("Matthew"); // unchanged
  });

  it("works fully controlled when the parent owns state", () => {
    function Controlled() {
      const [v, setV] = useState<string | string[] | undefined>("matt");
      return <Select options={OPTIONS} value={v} ariaLabel="Gospel" onValueChange={setV} />;
    }
    render(<Controlled />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getAllByRole("option")[3]!); // John
    expect(trigger().textContent).toContain("John");
  });
});

describe("Select — multiple selection", () => {
  it("toggles several options and stays open", () => {
    const onValueChange = vi.fn();
    render(<Select options={OPTIONS} multiple ariaLabel="Gospels" onValueChange={onValueChange} />);
    const list = screen.queryByRole("listbox");
    expect(list).toBeNull();
    const opts = openOptions();
    expect(screen.getByRole("listbox").getAttribute("aria-multiselectable")).toBe("true");
    fireEvent.click(opts[0]!); // Matthew
    expect(onValueChange).toHaveBeenLastCalledWith(["matt"]);
    fireEvent.click(screen.getAllByRole("option")[1]!); // Mark
    expect(onValueChange).toHaveBeenLastCalledWith(["matt", "mark"]);
    // Still open after multiple toggles.
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(trigger().textContent).toContain("Matthew, Mark");
  });

  it("deselects an already-selected option", () => {
    const onValueChange = vi.fn();
    render(
      <Select
        options={OPTIONS}
        multiple
        defaultValue={["matt", "mark"]}
        ariaLabel="Gospels"
        onValueChange={onValueChange}
      />,
    );
    const opts = openOptions();
    fireEvent.click(opts[0]!); // remove Matthew
    expect(onValueChange).toHaveBeenLastCalledWith(["mark"]);
  });
});

describe("Select — keyboard navigation", () => {
  it("opens with ArrowDown from the trigger", () => {
    render(<Select options={OPTIONS} ariaLabel="Gospel" />);
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  it("moves the active option with ArrowDown/ArrowUp, skipping disabled", () => {
    render(<Select options={OPTIONS} ariaLabel="Gospel" />);
    fireEvent.click(trigger());
    const list = screen.getByRole("listbox");
    // Active starts on the first enabled option (Matthew, index 0).
    expect(list.getAttribute("aria-activedescendant")).toMatch(/-opt-0$/);
    fireEvent.keyDown(list, { key: "ArrowDown" }); // Mark (1)
    expect(list.getAttribute("aria-activedescendant")).toMatch(/-opt-1$/);
    fireEvent.keyDown(list, { key: "ArrowDown" }); // skip Luke(2, disabled) -> John(3)
    expect(list.getAttribute("aria-activedescendant")).toMatch(/-opt-3$/);
    fireEvent.keyDown(list, { key: "ArrowDown" }); // wraps to Matthew (0)
    expect(list.getAttribute("aria-activedescendant")).toMatch(/-opt-0$/);
    fireEvent.keyDown(list, { key: "ArrowUp" }); // wraps back to John (3)
    expect(list.getAttribute("aria-activedescendant")).toMatch(/-opt-3$/);
  });

  it("jumps to the first/last enabled option with Home/End", () => {
    render(<Select options={OPTIONS} ariaLabel="Gospel" />);
    fireEvent.click(trigger());
    const list = screen.getByRole("listbox");
    fireEvent.keyDown(list, { key: "End" }); // John (3)
    expect(list.getAttribute("aria-activedescendant")).toMatch(/-opt-3$/);
    fireEvent.keyDown(list, { key: "Home" }); // Matthew (0)
    expect(list.getAttribute("aria-activedescendant")).toMatch(/-opt-0$/);
  });

  it("chooses the active option with Enter", () => {
    const onValueChange = vi.fn();
    render(<Select options={OPTIONS} ariaLabel="Gospel" onValueChange={onValueChange} />);
    fireEvent.click(trigger());
    const list = screen.getByRole("listbox");
    fireEvent.keyDown(list, { key: "ArrowDown" }); // Mark
    fireEvent.keyDown(list, { key: "Enter" });
    expect(onValueChange).toHaveBeenCalledWith("mark");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes on Escape and returns focus to the trigger", () => {
    render(<Select options={OPTIONS} ariaLabel="Gospel" />);
    fireEvent.click(trigger());
    const list = screen.getByRole("listbox");
    fireEvent.keyDown(list, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("type-ahead matches an option label by prefix", () => {
    render(<Select options={OPTIONS} ariaLabel="Gospel" />);
    fireEvent.click(trigger());
    const list = screen.getByRole("listbox");
    fireEvent.keyDown(list, { key: "j" }); // John (3)
    expect(list.getAttribute("aria-activedescendant")).toMatch(/-opt-3$/);
  });
});

describe("Select — filtering", () => {
  it("narrows the options via the filter box and shows an empty state", () => {
    render(<Select options={OPTIONS} filterable ariaLabel="Gospel" />);
    fireEvent.click(trigger());
    const box = screen.getByRole("searchbox");
    fireEvent.change(box, { target: { value: "ma" } });
    const opts = screen.getAllByRole("option");
    // Matthew + Mark match "ma".
    expect(opts.map((o) => o.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("Matthew"), expect.stringContaining("Mark")]),
    );
    expect(opts.some((o) => o.textContent?.includes("John"))).toBe(false);

    fireEvent.change(box, { target: { value: "zzz" } });
    const list = screen.getByRole("listbox");
    expect(within(list).getByText("No matches")).toBeTruthy();
  });

  it("Space types a literal space in the filter box rather than choosing", () => {
    const onValueChange = vi.fn();
    render(<Select options={OPTIONS} filterable ariaLabel="Gospel" onValueChange={onValueChange} />);
    fireEvent.click(trigger());
    const box = screen.getByRole("searchbox") as HTMLInputElement;
    box.focus();
    fireEvent.keyDown(box, { key: " " });
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("Select — clearable", () => {
  it("renders a clear affordance only when there is a selection and resets it", () => {
    const onValueChange = vi.fn();
    function Controlled() {
      const [v, setV] = useState<string | string[] | undefined>("matt");
      return (
        <Select
          options={OPTIONS}
          clearable
          value={v}
          ariaLabel="Gospel"
          onValueChange={(next) => {
            setV(next);
            onValueChange(next);
          }}
        />
      );
    }
    const { container } = render(<Controlled />);
    const clear = container.querySelector("[data-sunday-select-clear]") as HTMLElement;
    expect(clear).toBeTruthy();
    fireEvent.click(clear);
    expect(onValueChange).toHaveBeenCalledWith(undefined);
    expect(container.querySelector("[data-sunday-select-clear]")).toBeNull();
  });
});
