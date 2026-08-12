import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const createVideoRoom = vi.fn();
const inviteToVideoRoom = vi.fn();

vi.mock("@/lib/build/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/build/api")>("@/lib/build/api");
  return {
    ...actual,
    buildApi: {
      createVideoRoom: (...a: unknown[]) => createVideoRoom(...a),
      inviteToVideoRoom: (...a: unknown[]) => inviteToVideoRoom(...a),
    },
  };
});

import { BuildApiError } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";
import { ToastProvider } from "../Toast";
import { VideoCallButton } from "../VideoCallButton";

function mount() {
  return render(
    <ToastProvider>
      <VideoCallButton guestId="peer-1" guestName="Иван" />
    </ToastProvider>,
  );
}

describe("VideoCallButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBuildAuth.setState({ token: "t", user: null });
    // The component opens the room in a new tab on success.
    vi.stubGlobal("open", vi.fn());
  });

  it("tells the user when the backend has no video provider configured", async () => {
    createVideoRoom.mockRejectedValue(new BuildApiError(503, "video_not_configured"));

    mount();
    await userEvent.click(screen.getByRole("button", { name: /Видеозвонок/ }));

    // Before the fix this catch was empty: the button un-spun and nothing else
    // happened, which reads as "the call was set up".
    await waitFor(() =>
      expect(screen.getByText(/Видеозвонки пока не подключены/)).toBeTruthy(),
    );
  });

  it("reports a failed invite instead of opening a room nobody was invited to", async () => {
    createVideoRoom.mockResolvedValue({ id: "r1", roomUrl: "https://x/r1" });
    inviteToVideoRoom.mockRejectedValue(new BuildApiError(403, "only_host_can_invite"));

    mount();
    await userEvent.click(screen.getByRole("button", { name: /Видеозвонок/ }));

    await waitFor(() =>
      expect(screen.getByText(/только её создатель/)).toBeTruthy(),
    );
    expect(window.open).not.toHaveBeenCalled();
  });

  it("confirms success by name and opens the room", async () => {
    createVideoRoom.mockResolvedValue({ id: "r1", roomUrl: "https://x/r1" });
    inviteToVideoRoom.mockResolvedValue({ invited: true });

    mount();
    await userEvent.click(screen.getByRole("button", { name: /Видеозвонок/ }));

    await waitFor(() => expect(screen.getByText(/Иван приглашён/)).toBeTruthy());
    expect(window.open).toHaveBeenCalledWith("https://x/r1", "_blank", "noreferrer");
  });
});
