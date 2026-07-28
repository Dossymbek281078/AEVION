import { describe, it, expect } from "vitest";
import { isInstallDismissed } from "../PwaInstall";

/* На странице два баннера установки: шахматный (PwaInstall) и платформенный
   (components/InstallPrompt). Оба слушают один `beforeinstallprompt` и предлагают
   поставить одно и то же приложение, но помнили отказ каждый в своём ключе.

   На живом прогоне 28.07 они висели одновременно — человек закрывает одно
   предложение и продолжает видеть второе про ту же установку. Теперь отказ общий
   в обе стороны, и эти тесты держат именно это свойство. */

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

describe("общий отказ от установки", () => {
  it("закрыт платформенный баннер — наш молчит", () => {
    expect(isInstallDismissed(NOW, null, "1")).toBe(true);
  });

  it("платформенный флаг перевешивает даже свежий свой отказ", () => {
    expect(isInstallDismissed(NOW, String(NOW), "1")).toBe(true);
  });

  it("никто ничего не закрывал — баннер показывается", () => {
    expect(isInstallDismissed(NOW, null, null)).toBe(false);
  });

  it("свой отказ действует, пока не истёк срок", () => {
    expect(isInstallDismissed(NOW, String(NOW - 3 * DAY), null)).toBe(true);
  });

  it("свой отказ по истечении срока перестаёт действовать", () => {
    expect(isInstallDismissed(NOW, String(NOW - 400 * DAY), null)).toBe(false);
  });

  it("мусор вместо метки времени не считается отказом", () => {
    for (const junk of ["вчера", "", "NaN", "{}"]) {
      expect(isInstallDismissed(NOW, junk, null)).toBe(false);
    }
  });

  it("посторонние значения платформенного флага не считаются отказом", () => {
    // флаг ставится строго "1"; всё прочее — не отказ, а мусор в хранилище
    expect(isInstallDismissed(NOW, null, "0")).toBe(false);
    expect(isInstallDismissed(NOW, null, "true")).toBe(false);
  });
});
