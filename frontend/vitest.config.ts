import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
    css: false,
    // Лимит задан ЯВНО: без него действует дефолт vitest — 5 с, и для jsdom это
    // мало. Замер 27.07: `PaywallModal.test.tsx` упал с «Test timed out in
    // 5000ms» при длительности 5614 мс — колбэк синхронный, тяжёлой работы нет,
    // время съел setup окружения при полном параллельном прогоне. Тогда я
    // поставил лимит двум файлам поимённо; обход 28.07 показал, что рендерящих
    // тестов семь, а лимит есть у трёх — то есть четыре ждут своей очереди
    // покраснеть.
    //
    // `hookTimeout` отдельно, потому что у vitest это НЕЗАВИСИМЫЙ лимит:
    // `testTimeout` на хуки не распространяется. В бэкенде на этом уже попался
    // мой `beforeAll` — падал весь файл с «Hook timed out in 10000ms».
    //
    // Смысл таймаута — поймать зависание; 20 с для этого не хуже 5, зато
    // исчезает целый класс ложной красноты, из-за которой CI краснеет на
    // исправном коде и мерж блокируется.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
