import { describe, it, expect } from "vitest";
import { otmetitPervyyHod, klyuchPervogoHoda } from "../pervyyHod";

type Sobytie = Parameters<typeof otmetitPervyyHod>[3] extends (e: infer E) => unknown ? E : never;

function sbornik() {
  const list: Sobytie[] = [];
  const otpravit = ((e: Sobytie) => { list.push(e); }) as unknown as NonNullable<Parameters<typeof otmetitPervyyHod>[3]>;
  return { list, otpravit };
}

describe("событие «первый ход сделан»", () => {
  it("🔴 на одну задачу уходит РОВНО одно событие, сколько бы ходов ни было", () => {
    const { list, otpravit } = sbornik();
    const pamyat = { current: "" };
    expect(otmetitPervyyHod(pamyat, "puzzle", "li_075iw", otpravit)).toBe(true);
    expect(otmetitPervyyHod(pamyat, "puzzle", "li_075iw", otpravit)).toBe(false);
    expect(otmetitPervyyHod(pamyat, "puzzle", "li_075iw", otpravit)).toBe(false);
    expect(list.length).toBe(1);
  });

  it("другая задача — новое событие; возврат к прежней после другой — тоже (ключ один, а не множество)", () => {
    const { list, otpravit } = sbornik();
    const pamyat = { current: "" };
    otmetitPervyyHod(pamyat, "puzzle", "a", otpravit);
    otmetitPervyyHod(pamyat, "puzzle", "b", otpravit);
    expect(list.length).toBe(2);
  });

  it("партия: один раз до сброса, после сброса (newG) — снова", () => {
    const { list, otpravit } = sbornik();
    const pamyat = { current: "" };
    expect(otmetitPervyyHod(pamyat, "game", null, otpravit)).toBe(true);
    expect(otmetitPervyyHod(pamyat, "game", null, otpravit)).toBe(false);
    pamyat.current = ""; // то, что делает newG
    expect(otmetitPervyyHod(pamyat, "game", null, otpravit)).toBe(true);
    expect(list.length).toBe(2);
  });

  it("тело события — то, что разрез byFeature сложит в строку cyberchess/board|first_move", () => {
    const { list, otpravit } = sbornik();
    otmetitPervyyHod({ current: "" }, "puzzle", "x", otpravit);
    const e = list[0] as unknown as { type: string; source: string; meta: Record<string, unknown> };
    expect(e.type).toBe("feature_use");
    expect(e.source).toBe("cyberchess/board");
    expect(e.meta.feature).toBe("first_move");
    expect(e.meta.app).toBe("cyberchess");
    expect(e.meta.kontekst).toBe("puzzle");
    // id задачи в событие НЕ кладём: разрез по задачам не нужен, а ключ
    // байтами длиннее — цена журналу без читателя
    expect("puzzle" in e.meta).toBe(false);
  });

  it("ключи различают контексты и задачи", () => {
    expect(klyuchPervogoHoda("puzzle", "q1")).toBe("pz:q1");
    expect(klyuchPervogoHoda("game")).toBe("game");
    expect(klyuchPervogoHoda("puzzle", "q1")).not.toBe(klyuchPervogoHoda("puzzle", "q2"));
  });
});
