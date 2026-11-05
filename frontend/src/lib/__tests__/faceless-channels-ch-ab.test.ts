// 4.11.2026, решение Оркестратора: метки безликих YouTube-каналов A и B (?c=ch-a-NN, ?c=ch-b-NN)
// — канал youtube, сырая метка доезжает до цен. На проде 7e10f6979 было channel=unknown.
import { describe, it, expect } from "vitest";
import { channelFrom, postFrom, keepChannel, channelParam, сМодулем, PRICING_TERMS } from "../products";

describe("метки ch-a-*/ch-b-* — канал youtube", () => {
  it("канал и пост узнаются", () => {
    expect(channelFrom("ch-b-01")).toBe("youtube");
    expect(channelFrom("ch-a-03")).toBe("youtube");
    expect(channelFrom("ch-b")).toBe("youtube");
    expect(postFrom("ch-b-02")).toBe("02");
    expect(channelFrom("ch-c-01")).toBeNull();
  });
  it("короткий ключ youtube остаётся yt", () => {
    expect(channelParam("youtube")).toBe("yt");
  });
  it("сырая метка не теряется на переходе к ценам", () => {
    expect(keepChannel(сМодулем(PRICING_TERMS, "devhub"), "youtube", "ch-b-01")).toBe("/pricing?module=devhub&c=ch-b-01#planet-buy");
  });
});
