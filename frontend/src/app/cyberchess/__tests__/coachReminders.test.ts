import { describe, it, expect, beforeEach } from "vitest";
import {
  markFirstStudy,
  dismissReminder,
  getDueReminders,
  ldReminderState,
  findEntryById,
  entriesByDifficulty,
} from "../coachKnowledge";

/* The banner tells the player how many topics are due, counting the rows this
   function returns. It used to emit one row per milestone reached, so a card studied
   a week ago counted three times and five cards read as fifteen topics. */

const DAY = 86_400_000;

/** Rewrite the stored study date so a card looks N days old. */
function ageCard(entryId: string, days: number) {
  const raw = JSON.parse(localStorage.getItem("aevion_coach_reminders_v1") ?? "{}");
  const state = raw.entries ? raw : ldReminderState();
  state.entries[entryId].firstStudyAt = new Date(Date.now() - days * DAY).toISOString();
  localStorage.setItem("aevion_coach_reminders_v1", JSON.stringify(state));
}

beforeEach(() => localStorage.clear());

describe("spaced-repetition reminders", () => {
  it("says nothing before the first milestone", () => {
    markFirstStudy("a");
    expect(getDueReminders()).toEqual([]);
  });

  it("counts a card once, not once per milestone reached", () => {
    markFirstStudy("a");
    ageCard("a", 8);
    const due = getDueReminders();
    expect(due).toHaveLength(1);
    expect(due[0].milestone).toBe(7);
  });

  it("counts five week-old cards as five topics", () => {
    for (const id of ["a", "b", "c", "d", "e"]) markFirstStudy(id);
    for (const id of ["a", "b", "c", "d", "e"]) ageCard(id, 9);
    expect(getDueReminders()).toHaveLength(5);
  });

  it("walks the milestones in order as time passes", () => {
    markFirstStudy("a");

    ageCard("a", 1.2);
    expect(getDueReminders()[0].milestone).toBe(1);

    ageCard("a", 3.5);
    expect(getDueReminders()[0].milestone).toBe(3);

    ageCard("a", 30);
    expect(getDueReminders()[0].milestone).toBe(7);
  });

  it("does not resurface a milestone once dismissed", () => {
    markFirstStudy("a");
    ageCard("a", 2);
    dismissReminder("a", 1);
    expect(getDueReminders()).toEqual([]);
  });

  /* Dismissing the seven-day prompt has to bury the one- and three-day ones too.
     Otherwise a player who returns after a fortnight dismisses the card and finds
     the older milestones waiting on the next visit. */
  it("buries the earlier milestones when a later one is dismissed", () => {
    markFirstStudy("a");
    ageCard("a", 14);
    dismissReminder("a", 7);
    expect(getDueReminders()).toEqual([]);
    expect(ldReminderState().entries.a.dismissed.sort()).toEqual([1, 3, 7]);
  });

  it("still shows a later milestone after an earlier one was dismissed", () => {
    markFirstStudy("a");
    ageCard("a", 1.5);
    dismissReminder("a", 1);
    ageCard("a", 4);
    expect(getDueReminders()[0].milestone).toBe(3);
  });

  it("keeps the first study date on a repeat call", () => {
    const first = markFirstStudy("a");
    const stamp = first.entries.a.firstStudyAt;
    markFirstStudy("a");
    expect(ldReminderState().entries.a.firstStudyAt).toBe(stamp);
  });

  it("reports how old the card is", () => {
    markFirstStudy("a");
    ageCard("a", 9.7);
    expect(getDueReminders()[0].daysSinceStudy).toBe(9);
  });
});

describe("knowledge entries", () => {
  it("finds an entry by id and returns nothing for an unknown one", () => {
    expect(findEntryById("definitely-not-an-entry")).toBeUndefined();
  });

  it("groups by difficulty without losing entries", () => {
    const all = (["easy", "medium", "hard"] as const).flatMap((d) => entriesByDifficulty(d));
    expect(all.length).toBeGreaterThan(0);
    expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
  });
});
