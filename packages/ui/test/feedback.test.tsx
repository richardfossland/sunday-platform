import { ACCENTS } from "@sunday/design";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AppAccentProvider,
  Button,
  EmptyState,
  Modal,
  Skeleton,
  Spinner,
  Tabs,
  ToastProvider,
  Tooltip,
  useToast,
  type TabItem,
} from "../src/index.js";

afterEach(cleanup);

describe("Spinner", () => {
  it("exposes a status role with a default label", () => {
    render(<Spinner />);
    const el = screen.getByRole("status");
    expect(el.getAttribute("aria-label")).toBe("Loading");
    expect(el.getAttribute("data-size")).toBe("md");
  });

  it("honors a custom label and size, and injects the keyframes once", () => {
    render(
      <>
        <Spinner size="lg" label="Saving" />
        <Spinner size="sm" />
      </>,
    );
    expect(screen.getByLabelText("Saving").getAttribute("data-size")).toBe(
      "lg",
    );
    // The keyframes <style> is injected exactly once regardless of spinner count.
    expect(
      document.querySelectorAll("#sunday-ui-spinner-keyframes").length,
    ).toBe(1);
  });

  it("suppresses the label when given an empty string", () => {
    const { container } = render(<Spinner label="" />);
    const el = container.querySelector("[data-sunday-spinner]") as HTMLElement;
    expect(el.getAttribute("aria-label")).toBeNull();
  });
});

describe("Skeleton", () => {
  it("is aria-hidden and carries its variant", () => {
    const { container } = render(
      <Skeleton variant="circle" width={40} height={40} />,
    );
    const el = container.querySelector("[data-sunday-skeleton]") as HTMLElement;
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.getAttribute("data-variant")).toBe("circle");
    expect(el.style.width).toBe("40px");
  });

  it("drops the animation when noAnimate is set", () => {
    const { container } = render(<Skeleton noAnimate />);
    const el = container.querySelector("[data-sunday-skeleton]") as HTMLElement;
    expect(el.style.animation).toBe("");
  });
});

describe("EmptyState", () => {
  it("renders title, description and a CTA child", () => {
    render(
      <EmptyState
        title="No recordings yet"
        description="Start a service to capture one."
        action={<Button>New recording</Button>}
      />,
    );
    expect(screen.getByText("No recordings yet")).toBeTruthy();
    expect(screen.getByText("Start a service to capture one.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "New recording" })).toBeTruthy();
  });

  it("marks the icon decorative", () => {
    const { container } = render(
      <EmptyState title="Empty" icon={<span>🎬</span>} />,
    );
    const icon = container.querySelector(
      "[data-sunday-empty-icon]",
    ) as HTMLElement;
    expect(icon.getAttribute("aria-hidden")).toBe("true");
  });

  it("stays silent (no role) by default so first-load placeholders don't announce", () => {
    render(<EmptyState title="No recordings yet" />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("exposes role=status as a live region when status is set (empty search result)", () => {
    render(
      <EmptyState status title="No matches" description="Try another term." />,
    );
    const region = screen.getByRole("status");
    expect(region.textContent).toContain("No matches");
    expect(region.textContent).toContain("Try another term.");
  });

  it("lets an explicit role override the status default", () => {
    render(<EmptyState status role="alert" title="Nothing here" />);
    expect(screen.getByRole("alert").textContent).toContain("Nothing here");
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("Tabs", () => {
  const items: TabItem[] = [
    { id: "a", label: "First", content: <p>panel a</p> },
    { id: "b", label: "Second", content: <p>panel b</p> },
    { id: "c", label: "Third", content: <p>panel c</p>, disabled: true },
  ];

  it("wires the ARIA tabs pattern with roving tabindex", () => {
    render(<Tabs items={items} ariaLabel="Sections" />);
    const tablist = screen.getByRole("tablist", { name: "Sections" });
    expect(tablist).toBeTruthy();
    const first = screen.getByRole("tab", { name: "First" });
    const second = screen.getByRole("tab", { name: "Second" });
    expect(first.getAttribute("aria-selected")).toBe("true");
    expect(first.getAttribute("tabindex")).toBe("0");
    expect(second.getAttribute("tabindex")).toBe("-1");
    // Only the active panel is visible.
    expect(screen.getByText("panel a")).toBeTruthy();
    expect(screen.queryByText("panel b")).toBeNull();
  });

  it("activates on click and updates the visible panel", () => {
    const onChange = vi.fn();
    render(<Tabs items={items} onValueChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Second" }));
    expect(onChange).toHaveBeenCalledWith("b");
    expect(screen.getByText("panel b")).toBeTruthy();
    expect(screen.queryByText("panel a")).toBeNull();
  });

  it("moves selection with ArrowRight, skipping disabled tabs", () => {
    render(<Tabs items={items} />);
    const first = screen.getByRole("tab", { name: "First" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(
      screen.getByRole("tab", { name: "Second" }).getAttribute("aria-selected"),
    ).toBe("true");
    // ArrowRight again wraps past the disabled "Third" back to "First".
    fireEvent.keyDown(screen.getByRole("tab", { name: "Second" }), {
      key: "ArrowRight",
    });
    expect(
      screen.getByRole("tab", { name: "First" }).getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("respects a controlled value", () => {
    render(<Tabs items={items} value="b" />);
    expect(
      screen.getByRole("tab", { name: "Second" }).getAttribute("aria-selected"),
    ).toBe("true");
    // Clicking does not change the rendered selection without a parent update.
    fireEvent.click(screen.getByRole("tab", { name: "First" }));
    expect(
      screen.getByRole("tab", { name: "Second" }).getAttribute("aria-selected"),
    ).toBe("true");
  });
});

describe("Tooltip", () => {
  it("shows on focus and links via aria-describedby, hides on Escape", () => {
    render(
      <Tooltip label="More info">
        <button type="button">Help</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Help" });
    const tip = screen.getByRole("tooltip", { hidden: true });
    expect(tip.hidden).toBe(true);
    expect(trigger.getAttribute("aria-describedby")).toBeNull();

    fireEvent.focus(trigger);
    expect(tip.hidden).toBe(false);
    expect(trigger.getAttribute("aria-describedby")).toBe(tip.id);

    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(tip.hidden).toBe(true);
  });

  it("shows on hover and hides on mouse leave", () => {
    render(
      <Tooltip label="Hover text" placement="bottom">
        <button type="button">Trigger</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Trigger" });
    fireEvent.mouseEnter(trigger);
    const tip = screen.getByRole("tooltip");
    expect(tip.hidden).toBe(false);
    expect(tip.getAttribute("data-placement")).toBe("bottom");
    fireEvent.mouseLeave(trigger);
    expect(tip.hidden).toBe(true);
  });

  it("preserves the trigger's own handlers", () => {
    const onFocus = vi.fn();
    render(
      <Tooltip label="x">
        <button type="button" onFocus={onFocus}>
          T
        </button>
      </Tooltip>,
    );
    fireEvent.focus(screen.getByRole("button", { name: "T" }));
    expect(onFocus).toHaveBeenCalledTimes(1);
  });
});

describe("Modal", () => {
  it("renders nothing when closed", () => {
    render(
      <Modal open={false} onClose={() => {}} title="Hidden">
        body
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("wires dialog semantics and labels when open", () => {
    render(
      <Modal
        open
        onClose={() => {}}
        title="Confirm delete"
        description="This cannot be undone."
      >
        <p>body</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const titleId = dialog.getAttribute("aria-labelledby")!;
    const descId = dialog.getAttribute("aria-describedby")!;
    expect(document.getElementById(titleId)!.textContent).toBe(
      "Confirm delete",
    );
    expect(document.getElementById(descId)!.textContent).toBe(
      "This cannot be undone.",
    );
  });

  it("closes on Escape, the close button, and backdrop click", () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open onClose={onClose} title="T">
        <button type="button">inside</button>
      </Modal>,
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    const backdrop = container.querySelector(
      "[data-sunday-modal-backdrop]",
    ) as HTMLElement;
    fireEvent.mouseDown(backdrop);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("does not close on a click inside the panel", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="T">
        <button type="button">inside</button>
      </Modal>,
    );
    fireEvent.mouseDown(screen.getByRole("button", { name: "inside" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("moves focus into the dialog on open and restores it on close", () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            open
          </button>
          <Modal open={open} onClose={() => setOpen(false)} title="T">
            <button type="button">inside</button>
          </Modal>
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "open" });
    opener.focus();
    act(() => {
      fireEvent.click(opener);
    });
    // Focus moved into the dialog — onto its first focusable (the Close button,
    // which precedes the body in DOM order).
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Close" }),
    );
  });
});

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  function Trigger({ tone }: { tone?: "danger" }) {
    const toast = useToast();
    return (
      <button
        type="button"
        onClick={() => toast.show("Saved", tone ? { tone } : undefined)}
      >
        fire
      </button>
    );
  }

  it("shows a toast in a polite live region and auto-dismisses", () => {
    render(
      <ToastProvider defaultDurationMs={3000}>
        <Trigger />
      </ToastProvider>,
    );
    const region = screen.getByRole("region", { name: "Notifications" });
    expect(region.getAttribute("aria-live")).toBe("polite");
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "fire" }));
    });
    expect(screen.getByText("Saved")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText("Saved")).toBeNull();
  });

  it("uses role=alert for the danger tone", () => {
    render(
      <ToastProvider>
        <Trigger tone="danger" />
      </ToastProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "fire" }));
    });
    expect(screen.getByRole("alert").textContent).toContain("Saved");
  });

  it("dismisses manually via the close button", () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "fire" }));
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    });
    expect(screen.queryByText("Saved")).toBeNull();
  });

  it("throws when useToast is used outside a provider", () => {
    function Bare() {
      useToast();
      return null;
    }
    expect(() => render(<Bare />)).toThrow(/ToastProvider/);
  });
});

describe("accent integration", () => {
  it("feeds the active accent to a Spinner's arc color", () => {
    const { container } = render(
      <AppAccentProvider app="sundaystudio">
        <Spinner />
      </AppAccentProvider>,
    );
    const el = container.querySelector("[data-sunday-spinner]") as HTMLElement;
    // jsdom normalizes hex → rgb; assert the border-top is non-empty (accent applied).
    expect(el.style.borderTopColor).not.toBe("");
    expect(ACCENTS.sundaystudio.hex).toBe("#d4a017");
  });
});
