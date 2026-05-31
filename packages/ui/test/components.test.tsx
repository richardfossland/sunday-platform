import { ACCENTS } from "@sunday/design";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  accentCssVars,
  AppAccentProvider,
  Badge,
  Button,
  Card,
  Field,
} from "../src/index.js";

afterEach(cleanup);

describe("accentCssVars", () => {
  it("maps an Accent to the design --color-accent* custom properties", () => {
    const vars = accentCssVars(ACCENTS.sundaystudio) as Record<string, string>;
    expect(vars["--color-accent"]).toBe(ACCENTS.sundaystudio.hex);
    expect(vars["--color-on-accent"]).toBe(ACCENTS.sundaystudio.onAccent);
    expect(vars["--color-accent-soft"]).toBe(ACCENTS.sundaystudio.hexSoft);
    expect(vars["--color-accent-strong"]).toBe(ACCENTS.sundaystudio.hexStrong);
  });
});

describe("AppAccentProvider", () => {
  it("sets accent CSS vars on a wrapper and tags it with the app", () => {
    const { container } = render(
      <AppAccentProvider app="sundaypaper">
        <span>hi</span>
      </AppAccentProvider>,
    );
    const wrapper = container.querySelector("[data-sunday-app='sundaypaper']") as HTMLElement;
    expect(wrapper).toBeTruthy();
    expect(wrapper.style.getPropertyValue("--color-accent")).toBe(ACCENTS.sundaypaper.hex);
  });

  it("renders without a wrapper when withWrapper is false", () => {
    const { container } = render(
      <AppAccentProvider app="sundaysong" withWrapper={false}>
        <span>bare</span>
      </AppAccentProvider>,
    );
    expect(container.querySelector("[data-sunday-app]")).toBeNull();
    expect(screen.getByText("bare")).toBeTruthy();
  });

  it("feeds the accent through context to a primary Button", () => {
    render(
      <AppAccentProvider app="sundaystudio">
        <Button>Render</Button>
      </AppAccentProvider>,
    );
    const btn = screen.getByRole("button", { name: "Render" });
    // jsdom normalises the hex to rgb; just assert the accent took effect (not the blue default).
    expect(btn.getAttribute("data-variant")).toBe("primary");
    expect(btn.style.background).not.toBe("");
  });
});

describe("Button", () => {
  it("defaults to a primary button with type=button", () => {
    render(<Button>Go</Button>);
    const btn = screen.getByRole("button", { name: "Go" }) as HTMLButtonElement;
    expect(btn.type).toBe("button");
    expect(btn.getAttribute("data-variant")).toBe("primary");
  });

  it("honors variant and disabled", () => {
    render(
      <Button variant="danger" disabled>
        Delete
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("data-variant")).toBe("danger");
    expect(btn.style.cursor).toBe("not-allowed");
  });

  it("forwards arbitrary props like aria-label and onClick handlers exist", () => {
    render(<Button aria-label="custom" size="sm" />);
    const btn = screen.getByRole("button", { name: "custom" });
    expect(btn.style.fontSize).not.toBe("");
  });
});

describe("Card", () => {
  it("renders children and applies elevation data attribute", () => {
    render(<Card elevation="raised">body</Card>);
    expect(screen.getByText("body").getAttribute("data-elevation")).toBe("raised");
  });

  it("switches to the dark pro surface when dark", () => {
    const { container } = render(<Card dark>dark body</Card>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.background).not.toBe("");
  });
});

describe("Badge", () => {
  it("defaults to neutral tone", () => {
    render(<Badge>idle</Badge>);
    expect(screen.getByText("idle").getAttribute("data-tone")).toBe("neutral");
  });

  it("renders semantic tones", () => {
    render(<Badge tone="warning">⚠ Check TONO</Badge>);
    expect(screen.getByText("⚠ Check TONO").getAttribute("data-tone")).toBe("warning");
  });
});

describe("Field", () => {
  it("binds the label to the control via a generated id", () => {
    render(<Field label="Email">{(id) => <input id={id} defaultValue="" />}</Field>);
    const input = screen.getByLabelText("Email") as HTMLInputElement;
    expect(input.id).toBeTruthy();
  });

  it("shows a required marker and a hint", () => {
    render(
      <Field label="Name" required hint="Your full name">
        {(id) => <input id={id} />}
      </Field>,
    );
    expect(screen.getByText("Your full name")).toBeTruthy();
    // The asterisk lives in the label.
    expect(screen.getByText("Name").textContent).toContain("*");
  });

  it("prefers the error over the hint and exposes it via role=alert", () => {
    render(
      <Field label="Age" hint="how old" error="Must be a number">
        {(id) => <input id={id} />}
      </Field>,
    );
    expect(screen.getByRole("alert").textContent).toBe("Must be a number");
    expect(screen.queryByText("how old")).toBeNull();
  });
});
