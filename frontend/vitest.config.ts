import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
    css: false,
    // Тот же предел, что и у бэкенда, но по более скромным основаниям — говорю
    // как есть. Ядер 32, vitest по умолчанию берёт почти все, а на машине живут
    // несколько сессий. Замер 10.08.2026: по умолчанию 27 с, с пределом 21 с,
    // оба прогона зелёные — то есть выигрыш во времени небольшой, и сам по себе
    // он правки не стоил бы.
    //
    // Стоит её другое: за этот день дважды на ОДИНОЧНОМ файле прогон падал с
    // «[vitest-pool-runner]: Timeout waiting for worker to respond» — воркер не
    // успевал ответить за 60 с, хотя тесты в файле идут доли секунды. Это то же
    // голодание, что на бэкенде превращало 2-секундные файлы в таймауты. Предел
    // делает такие срывы менее вероятными.
    maxWorkers: 4,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
