import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipelineSteps } from "../PipelineSteps";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

describe("PipelineSteps", () => {
  it("renders all 6 step labels", () => {
    render(<PipelineSteps current="auth" />);
    // 20.10.2026: ярлыки из словаря navI18n.ts; вне провайдера язык — ru (как было до словаря).
    for (const label of ["Авторизация", "QRight", "QSign", "Щит", "Бюро", "Планета"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("uses sequence numbers for upcoming steps", () => {
    render(<PipelineSteps current="auth" />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("marks completed steps with ✓ for a signed-in visitor mid-pipeline", () => {
    window.localStorage.setItem("aevion_auth_token_v1", "t");
    try {
      render(<PipelineSteps current="bureau" />);
      const checks = screen.getAllByText("✓");
      expect(checks.length).toBeGreaterThanOrEqual(2);
    } finally {
      window.localStorage.removeItem("aevion_auth_token_v1");
    }
  });

  it("shows no ✓ to a guest: steps before the current one are numbers, not done", () => {
    window.localStorage.removeItem("aevion_auth_token_v1");
    render(<PipelineSteps current="qsign" />);
    expect(screen.queryByText("✓")).toBeNull();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders 6 anchors with hrefs to correct routes", () => {
    const { container } = render(<PipelineSteps current="qright" />);
    const anchors = container.querySelectorAll("a");
    expect(anchors).toHaveLength(6);
    // 2.11.2026: шаг «Авторизация» несёт возврат и метку канала — /auth?next=…
    expect(anchors[0].getAttribute("href")).toMatch(/^\/auth\?next=/);
    expect(anchors[3].getAttribute("href")).toBe("/quantum-shield");
    expect(anchors[5].getAttribute("href")).toBe("/planet");
  });
});
