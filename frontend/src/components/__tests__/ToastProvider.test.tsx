import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ToastProvider, useToast } from "../ToastProvider";

function Caller({ message, variant }: { message: string; variant?: "success" | "error" | "info" }) {
  const { showToast } = useToast();
  return (
    <button onClick={() => showToast(message, variant)}>fire</button>
  );
}

describe("ToastProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders children", () => {
    render(
      <ToastProvider>
        <span>hello</span>
      </ToastProvider>,
    );
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("shows toast on showToast() call", () => {
    render(
      <ToastProvider>
        <Caller message="kaboom" variant="success" />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText("fire").click();
    });
    expect(screen.getByText("kaboom")).toBeInTheDocument();
  });

  it("auto-dismisses after duration", () => {
    render(
      <ToastProvider>
        <Caller message="byebye" variant="info" />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText("fire").click();
    });
    expect(screen.getByText("byebye")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.queryByText("byebye")).not.toBeInTheDocument();
  });

  it("supports stacking multiple toasts", () => {
    render(
      <ToastProvider>
        <Caller message="alpha" />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText("fire").click();
      screen.getByText("fire").click();
      screen.getByText("fire").click();
    });
    expect(screen.getAllByText("alpha")).toHaveLength(3);
  });

  it("useToast throws outside provider", () => {
    const Bad = () => {
      const { showToast } = useToast();
      return <button onClick={() => showToast("x")}>x</button>;
    };
    const orig = console.error;
    console.error = () => {};
    expect(() => render(<Bad />)).toThrow(/ToastProvider/);
    console.error = orig;
  });
});
