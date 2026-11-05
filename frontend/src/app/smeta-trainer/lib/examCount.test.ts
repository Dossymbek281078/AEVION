import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { EXAM_TASK_COUNT } from "./examCount";
import { EXAM_TASKS } from "./examTasks";

const read = (rel: string) => readFileSync(join(__dirname, "..", rel), "utf8");

describe("число экзаменов на витрине", () => {
  it("совпадает с банком", () => {
    expect(EXAM_TASK_COUNT).toBe(EXAM_TASKS.length);
    expect(EXAM_TASK_COUNT).toBeGreaterThan(5); // контроль: старые «5» и «15» не проходят как верные
  });
  it("в видимом тексте главной и страницы банка нет вписанных «5 заданий» / «15 экзаменов»", () => {
    for (const f of ["_client.tsx", "components/LevelHome.tsx", "exam/page.tsx"]) {
      const s = read(f);
      expect(s, f).not.toMatch(/(?<![\d])(5|15) (заданий|экзамен)/);
    }
  });
  it("главная берёт число из EXAM_TASK_COUNT", () => {
    expect(read("_client.tsx")).toContain("EXAM_TASK_COUNT");
    expect(read("components/LevelHome.tsx")).toContain("EXAM_TASK_COUNT");
  });
});
