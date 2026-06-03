import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  Checkbox,
  Field,
  Input,
  Radio,
  RadioGroup,
  TextArea,
} from "../src/index.js";

afterEach(cleanup);

describe("Input", () => {
  it("passes the type through and renders text by default", () => {
    const { container } = render(<Input type="email" placeholder="you@host" />);
    const el = container.querySelector("input") as HTMLInputElement;
    expect(el.getAttribute("type")).toBe("email");
    expect(el.getAttribute("placeholder")).toBe("you@host");
  });

  it("reflects disabled and readonly states", () => {
    const { container } = render(<Input readOnly defaultValue="locked" />);
    const el = container.querySelector("input") as HTMLInputElement;
    expect(el.readOnly).toBe(true);
    expect(el.disabled).toBe(false);
  });

  it("marks the error state with aria-invalid + data-invalid", () => {
    const { container } = render(<Input invalid />);
    const el = container.querySelector("input") as HTMLInputElement;
    expect(el.getAttribute("aria-invalid")).toBe("true");
    expect(el.getAttribute("data-invalid")).toBe("true");
  });

  it("fires onChange and onBlur", () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    const { container } = render(<Input onChange={onChange} onBlur={onBlur} />);
    const el = container.querySelector("input") as HTMLInputElement;
    fireEvent.change(el, { target: { value: "hi" } });
    fireEvent.blur(el);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("renders an aria-hidden suffix slot in a positioned shell", () => {
    const { container } = render(<Input suffix={<span>kg</span>} />);
    const shell = container.querySelector("[data-sunday-input-shell]");
    const suffix = container.querySelector("[data-sunday-input-suffix]") as HTMLElement;
    expect(shell).toBeTruthy();
    expect(suffix.getAttribute("aria-hidden")).toBe("true");
    expect(suffix.textContent).toBe("kg");
  });

  it("binds to a Field label via the generated id", () => {
    render(
      <Field label="Email">{(id) => <Input id={id} type="email" />}</Field>,
    );
    const el = screen.getByLabelText("Email") as HTMLInputElement;
    expect(el.tagName).toBe("INPUT");
    expect(el.getAttribute("type")).toBe("email");
  });
});

describe("TextArea", () => {
  it("renders a textarea with the requested resize affordance", () => {
    const { container } = render(<TextArea resize="none" />);
    const el = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(el.getAttribute("data-resize")).toBe("none");
    expect(el.style.resize).toBe("none");
  });

  it("marks the error state with aria-invalid + data-invalid", () => {
    const { container } = render(<TextArea invalid />);
    const el = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(el.getAttribute("aria-invalid")).toBe("true");
    expect(el.getAttribute("data-invalid")).toBe("true");
  });

  it("shows a character counter that tracks typing (uncontrolled)", () => {
    const { container } = render(<TextArea showCount maxLength={10} defaultValue="ab" />);
    const counter = container.querySelector("[data-sunday-textarea-count]") as HTMLElement;
    expect(counter.textContent).toBe("2 / 10");
    fireEvent.change(container.querySelector("textarea")!, { target: { value: "abcd" } });
    expect(counter.textContent).toBe("4 / 10");
  });

  it("omits the counter when showCount is unset", () => {
    const { container } = render(<TextArea defaultValue="x" />);
    expect(container.querySelector("[data-sunday-textarea-count]")).toBeNull();
  });
});

describe("Checkbox", () => {
  it("toggles checked and fires onChange", () => {
    const onChange = vi.fn();
    const { container } = render(<Checkbox label="Agree" onChange={onChange} />);
    const el = container.querySelector("input") as HTMLInputElement;
    expect(el.getAttribute("type")).toBe("checkbox");
    fireEvent.click(el);
    expect(el.checked).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("reflects the indeterminate state via DOM property + aria-checked=mixed", () => {
    const { container } = render(<Checkbox indeterminate />);
    const el = container.querySelector("input") as HTMLInputElement;
    expect(el.indeterminate).toBe(true);
    expect(el.getAttribute("aria-checked")).toBe("mixed");
    expect(el.getAttribute("data-indeterminate")).toBe("true");
  });

  it("applies the accent color and a disabled appearance", () => {
    const { container } = render(<Checkbox label="X" disabled />);
    const el = container.querySelector("input") as HTMLInputElement;
    expect(el.disabled).toBe(true);
    expect(el.style.accentColor).toBeTruthy();
  });

  it("binds an inline label to the box via htmlFor/id", () => {
    render(<Checkbox id="cb1" label="Subscribe" />);
    const el = screen.getByLabelText("Subscribe") as HTMLInputElement;
    expect(el.getAttribute("type")).toBe("checkbox");
  });
});

describe("RadioGroup + Radio", () => {
  function Group(props: { value?: string; onValueChange?: (v: string) => void }) {
    return (
      <RadioGroup
        ariaLabel="Plan"
        defaultValue="m"
        value={props.value}
        onValueChange={props.onValueChange}
      >
        <Radio value="s" label="Small" />
        <Radio value="m" label="Medium" />
        <Radio value="l" label="Large" disabled />
        <Radio value="x" label="X-Large" />
      </RadioGroup>
    );
  }

  it("exposes a radiogroup with the defaultValue selected and roving tabindex", () => {
    render(<Group />);
    expect(screen.getByRole("radiogroup", { name: "Plan" })).toBeTruthy();
    const medium = screen.getByRole("radio", { name: "Medium" });
    const small = screen.getByRole("radio", { name: "Small" });
    expect(medium.getAttribute("aria-checked")).toBe("true");
    expect(medium.getAttribute("tabindex")).toBe("0");
    expect(small.getAttribute("tabindex")).toBe("-1");
  });

  it("selects on click", () => {
    render(<Group />);
    fireEvent.click(screen.getByRole("radio", { name: "Small" }));
    expect(screen.getByRole("radio", { name: "Small" }).getAttribute("aria-checked")).toBe("true");
  });

  it("navigates with ArrowDown/ArrowUp, wrapping and skipping disabled radios", () => {
    render(<Group />);
    const medium = screen.getByRole("radio", { name: "Medium" });
    medium.focus();
    // Down from Medium skips the disabled Large to land on X-Large.
    fireEvent.keyDown(medium, { key: "ArrowDown" });
    expect(screen.getByRole("radio", { name: "X-Large" }).getAttribute("aria-checked")).toBe("true");
    // Down again wraps to the first enabled radio (Small).
    fireEvent.keyDown(screen.getByRole("radio", { name: "X-Large" }), { key: "ArrowDown" });
    expect(screen.getByRole("radio", { name: "Small" }).getAttribute("aria-checked")).toBe("true");
    // Up from Small wraps back to X-Large (skipping disabled Large).
    fireEvent.keyDown(screen.getByRole("radio", { name: "Small" }), { key: "ArrowUp" });
    expect(screen.getByRole("radio", { name: "X-Large" }).getAttribute("aria-checked")).toBe("true");
  });

  it("jumps to the first/last enabled radio with Home/End", () => {
    render(<Group />);
    const medium = screen.getByRole("radio", { name: "Medium" });
    medium.focus();
    fireEvent.keyDown(medium, { key: "End" });
    expect(screen.getByRole("radio", { name: "X-Large" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(screen.getByRole("radio", { name: "X-Large" }), { key: "Home" });
    expect(screen.getByRole("radio", { name: "Small" }).getAttribute("aria-checked")).toBe("true");
  });

  it("marks disabled radios aria-disabled and skips them in the tab order", () => {
    render(<Group />);
    const large = screen.getByRole("radio", { name: "Large" });
    expect(large.getAttribute("aria-disabled")).toBe("true");
    expect((large as HTMLInputElement).disabled).toBe(true);
    expect(large.getAttribute("tabindex")).toBe("-1");
  });

  it("respects a controlled value (no internal selection change)", () => {
    const onValueChange = vi.fn();
    render(<Group value="s" onValueChange={onValueChange} />);
    expect(screen.getByRole("radio", { name: "Small" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "Medium" }));
    expect(onValueChange).toHaveBeenCalledWith("m");
    // Without a parent state update the selection stays put.
    expect(screen.getByRole("radio", { name: "Small" }).getAttribute("aria-checked")).toBe("true");
  });

  it("works as a controlled component when the parent owns state", () => {
    function Controlled() {
      const [v, setV] = useState("s");
      return <Group value={v} onValueChange={setV} />;
    }
    render(<Controlled />);
    fireEvent.click(screen.getByRole("radio", { name: "Medium" }));
    expect(screen.getByRole("radio", { name: "Medium" }).getAttribute("aria-checked")).toBe("true");
  });

  it("renders nothing for a Radio used outside a RadioGroup", () => {
    const { container } = render(<Radio value="orphan" label="Orphan" />);
    expect(container.querySelector("input")).toBeNull();
  });
});
