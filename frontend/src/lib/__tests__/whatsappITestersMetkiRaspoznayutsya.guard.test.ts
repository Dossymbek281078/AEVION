import { describe, test, expect } from "vitest";
import { channelFrom, postFrom, CHANNELS } from "../products";

/*
 * 🔴 18.10.2026 (оркестратор): метки wa-school-<город> (письма школам в WhatsApp) и testers-yt / testers-club-<страна> /
 * testers-uni (тестировщики шахмат; 13 описаний роликов и 19 писем уже разосланы) падали в byUnknownTag воронки и
 * давали только визиты без канала и поста. Канал ставит фронт (channelFrom) в момент захода; бэкенд второго списка
 * не ведёт (урок 30.09–05.10). Уже записанные события остаются в byUnknownTag — не теряются; новые ложатся в
 * byChannel whatsapp / testers и byPost по остатку метки.
 */
describe("метки WhatsApp и тестировщиков распознаются каналом и постом", () => {
  test("🔴 wa-school-almaty → канал whatsapp, пост school-almaty", () => {
    expect(CHANNELS.wa).toBe("whatsapp");
    expect(channelFrom("wa-school-almaty")).toBe("whatsapp");
    expect(postFrom("wa-school-almaty")).toBe("school-almaty");
    expect(channelFrom("WA-School-Astana"), "регистр не важен").toBe("whatsapp");
  });
  test("🔴 testers-club-au → канал testers, пост club-au; testers-yt и testers-uni — тот же канал", () => {
    expect(CHANNELS.testers).toBe("testers");
    expect(channelFrom("testers-club-au")).toBe("testers");
    expect(postFrom("testers-club-au")).toBe("club-au");
    expect(channelFrom("testers-yt")).toBe("testers");
    expect(postFrom("testers-yt")).toBe("yt");
    expect(channelFrom("testers-uni")).toBe("testers");
    expect(postFrom("testers-uni")).toBe("uni");
  });
  test("КОНТРОЛЬ: похожие, но чужие префиксы по-прежнему не канал", () => {
    for (const метка of ["ws-school-almaty", "tester-club-au", "whatsapp-school"]) {
      expect(channelFrom(метка), `«${метка}» принято за канал`).toBeNull();
    }
  });
  test("значения каналов не дублируются: channelParam берёт первый ключ по значению", () => {
    const значения = Object.values(CHANNELS);
    expect(значения.filter((v) => v === "whatsapp")).toHaveLength(1);
    expect(значения.filter((v) => v === "testers")).toHaveLength(1);
  });
});
