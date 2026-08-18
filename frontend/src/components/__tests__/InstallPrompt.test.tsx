import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { InstallPrompt } from "../InstallPrompt";

beforeEach(() => {
  try { localStorage.clear() } catch {}
});

describe("InstallPrompt", () => {
  it("renders nothing without beforeinstallprompt", () => {
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders prompt UI after beforeinstallprompt event", () => {
    render(<InstallPrompt />);
    const event: Event & { prompt?: () => Promise<void>; userChoice?: Promise<{ outcome: "accepted" | "dismissed" }> } =
      new Event("beforeinstallprompt", { cancelable: true });
    event.prompt = async () => {};
    event.userChoice = Promise.resolve({ outcome: "accepted" as const });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(screen.getByText(/Установить AEVION/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Install" })).toBeInTheDocument();
  });

  // The AI Agent launcher is anchored bottom-right on every page. When this
  // prompt sat there too, the pair covered the right edge of page content —
  // on /qventure/batch that was the ranking table's per-deal "Report →" links.
  it("anchors bottom-left, clear of the bottom-right agent launcher", () => {
    render(<InstallPrompt />);
    const event: Event & { prompt?: () => Promise<void>; userChoice?: Promise<{ outcome: "accepted" | "dismissed" }> } =
      new Event("beforeinstallprompt", { cancelable: true });
    event.prompt = async () => {};
    event.userChoice = Promise.resolve({ outcome: "accepted" as const });
    act(() => {
      window.dispatchEvent(event);
    });
    const region = screen.getByRole("region", { name: "PWA install prompt" });
    expect(region.style.left).toBe("16px");
    expect(region.style.right).toBe("");
  });

  // Any fixed banner covers a strip of the page while it is up. Moving it only
  // changes which content it sits on, so it retires itself instead.
  it("retires itself so it does not sit over page content indefinitely", () => {
    vi.useFakeTimers();
    try {
      render(<InstallPrompt />);
      const event: Event & { prompt?: () => Promise<void>; userChoice?: Promise<{ outcome: "accepted" | "dismissed" }> } =
        new Event("beforeinstallprompt", { cancelable: true });
      event.prompt = async () => {};
      event.userChoice = Promise.resolve({ outcome: "accepted" as const });
      act(() => { window.dispatchEvent(event); });
      expect(screen.queryByRole("region", { name: "PWA install prompt" })).toBeInTheDocument();
      act(() => { vi.advanceTimersByTime(12_000); });
      expect(screen.queryByRole("region", { name: "PWA install prompt" })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("hides itself when localStorage flag is set", () => {
    localStorage.setItem("aevion_install_dismissed_v1", "1");
    const { container } = render(<InstallPrompt />);
    const event: Event & { prompt?: () => Promise<void>; userChoice?: Promise<{ outcome: "accepted" | "dismissed" }> } =
      new Event("beforeinstallprompt", { cancelable: true });
    event.prompt = async () => {};
    event.userChoice = Promise.resolve({ outcome: "accepted" as const });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("hides after appinstalled event fires", () => {
    render(<InstallPrompt />);
    const promptEvent: Event & { prompt?: () => Promise<void>; userChoice?: Promise<{ outcome: "accepted" | "dismissed" }> } =
      new Event("beforeinstallprompt", { cancelable: true });
    promptEvent.prompt = async () => {};
    promptEvent.userChoice = Promise.resolve({ outcome: "accepted" as const });
    act(() => {
      window.dispatchEvent(promptEvent);
    });
    expect(screen.getByRole("button", { name: "Install" })).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(screen.queryByRole("button", { name: "Install" })).not.toBeInTheDocument();
  });
});
