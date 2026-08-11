import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
    css: false,
    // Явные 30 секунд вместо умолчания в 5. Причина та же, по которой их
    // подняли в бэкенде (см. aevion-globus-backend/vitest.config.ts): падения
    // здесь тоже не про логику, а про время. 11.08.2026 полный прогон уронил
    // `abVariantDeps.guard` с «Test timed out in 5000ms» — это сторож, который
    // обходит все страницы по файловой системе, и на машине с чужими сборками
    // рядом он в пять секунд не укладывается.
    //
    // Тест, падающий от занятости ноутбука, вреден вдвойне: он ничего не
    // ловит и приучает списывать красное на среду. Настоящее зависание при
    // 30 секундах всё равно упадёт, просто позже.
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
