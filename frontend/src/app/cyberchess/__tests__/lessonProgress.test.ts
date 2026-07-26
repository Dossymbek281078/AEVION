import { describe, it, expect, beforeEach } from "vitest";
import {
  LESSONS,
  loadLessons,
  saveLessons,
  isLessonComplete,
  lessonProgress,
  totalCompleted,
  type LessonsState,
} from "../coachLessons";

/* The course shows a percentage per lesson and a count of finished ones. These come
   out of localStorage, so the interesting cases are the ones where what is stored does
   not match what is shipped: a lesson that was removed, a step count that grew, a store
   written by an older build. */

const first = LESSONS[0];

const state = (byId: LessonsState["byId"] = {}): LessonsState => ({ v: 1, byId });
const started = (id: string, steps: number) => ({ id, startedAt: 1, stepsCompleted: steps });

beforeEach(() => localStorage.clear());

describe("lessonProgress", () => {
  it("is nothing for a lesson never opened", () => {
    expect(lessonProgress(state(), first.id)).toBe(0);
  });

  it("counts the steps done against the steps there are", () => {
    const half = Math.floor(first.steps.length / 2);
    const pct = lessonProgress(state({ [first.id]: started(first.id, half) }), first.id);
    expect(pct).toBe(Math.round((half / first.steps.length) * 100));
  });

  it("is a hundred once the lesson is finished, whatever the step count says", () => {
    const s = state({ [first.id]: { id: first.id, startedAt: 1, completedAt: 2, stepsCompleted: 0 } });
    expect(lessonProgress(s, first.id)).toBe(100);
  });

  /* A stored record for a lesson that no longer ships would otherwise divide by the
     length of `undefined.steps`. */
  it("returns nothing for a lesson that is no longer in the course", () => {
    expect(lessonProgress(state({ ghost: started("ghost", 3) }), "ghost")).toBe(0);
  });

  /* If a lesson loses a step between builds, the stored count is larger than the
     number of steps that now exist and the bar would draw past its own end. */
  it("does not report more than a hundred if the stored count ran ahead", () => {
    const s = state({ [first.id]: started(first.id, first.steps.length + 5) });
    expect(lessonProgress(s, first.id)).toBe(100);
  });
});

describe("isLessonComplete", () => {
  it("is false until there is a completion time", () => {
    expect(isLessonComplete(state({ [first.id]: started(first.id, 2) }), first.id)).toBe(false);
  });

  it("is true once there is one", () => {
    const s = state({ [first.id]: { ...started(first.id, 2), completedAt: 99 } });
    expect(isLessonComplete(s, first.id)).toBe(true);
  });

  it("is false for a lesson with no record at all", () => {
    expect(isLessonComplete(state(), "no-such-lesson")).toBe(false);
  });
});

describe("totalCompleted", () => {
  it("counts only the finished ones", () => {
    const s = state({
      a: { id: "a", startedAt: 1, completedAt: 2, stepsCompleted: 4 },
      b: { id: "b", startedAt: 1, stepsCompleted: 4 },
      c: { id: "c", startedAt: 1, completedAt: 3, stepsCompleted: 1 },
    });
    expect(totalCompleted(s)).toBe(2);
  });

  it("is zero on a fresh install", () => {
    expect(totalCompleted(loadLessons())).toBe(0);
  });
});

describe("the store", () => {
  it("survives a round trip", () => {
    const s = state({ [first.id]: started(first.id, 3) });
    saveLessons(s);
    expect(loadLessons().byId[first.id].stepsCompleted).toBe(3);
  });

  it("reads junk as a fresh start rather than throwing", () => {
    localStorage.setItem("aevion_coach_lessons_v1", "{not json");
    expect(loadLessons().byId).toEqual({});
  });

  /* A store written by an older build carries a different `v`; taking it at face value
     would mean reading fields that may not be there. */
  it("ignores a store from another version", () => {
    localStorage.setItem("aevion_coach_lessons_v1", JSON.stringify({ v: 0, byId: { x: 1 } }));
    expect(loadLessons().byId).toEqual({});
  });
});
