import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The layout's other children pull in a service worker and the translation
// observer; neither has anything to do with toasts.
vi.mock("@/components/build/ServiceWorkerRegister", () => ({
  ServiceWorkerRegister: () => null,
}));
vi.mock("@/components/AutoTranslate", () => ({
  AutoTranslate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import BuildLayout from "../layout";
import { useToast } from "@/components/build/Toast";

function Shouter() {
  const toast = useToast();
  return <button onClick={() => toast.success("Link copied")}>share</button>;
}

describe("/build layout", () => {
  it("gives every page a toast provider, shell or no shell", async () => {
    // 15 pages under /build render without BuildShell — public profiles, the
    // guides, the leaderboard. They mount ProfileShareQR and BookmarkButton,
    // which call useToast(); with no provider those calls hit the silent
    // no-op fallback and the user gets no feedback at all.
    render(<BuildLayout>{<Shouter />}</BuildLayout>);

    await userEvent.click(screen.getByRole("button", { name: "share" }));

    await waitFor(() => expect(screen.getByText("Link copied")).toBeTruthy());
  });
});
