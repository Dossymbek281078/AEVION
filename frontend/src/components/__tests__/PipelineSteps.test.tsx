import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipelineSteps } from "../PipelineSteps";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

describe("PipelineSteps", () => {
  it("renders all 5 step labels", () => {
    render(<PipelineSteps current="auth" />);
    for (const label of ["Auth", "QRight", "QSign", "Bureau", "Planet"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("uses sequence numbers for upcoming steps", () => {
    render(<PipelineSteps current="auth" />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("marks completed steps with ✓ when current is mid-pipeline", () => {
    render(<PipelineSteps current="bureau" />);
    const checks = screen.getAllByText("✓");
    expect(checks.length).toBeGreaterThanOrEqual(2);
  });

  it("renders 5 anchors with hrefs to correct routes", () => {
    const { container } = render(<PipelineSteps current="qright" />);
    const anchors = container.querySelectorAll("a");
    expect(anchors).toHaveLength(5);
    expect(anchors[0].getAttribute("href")).toBe("/auth");
    expect(anchors[4].getAttribute("href")).toBe("/planet");
  });
});
