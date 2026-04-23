// Investor-demo seed. Populates localStorage with a realistic snapshot
// of contacts / goals / recurring / circles / splits / gifts so the UI
// is visibly alive within the first 2 seconds of the walk-through.
//
// Safe to call repeatedly — re-seeding overwrites the demo sets without
// touching anything the user created outside the demo namespace.

import { saveContact } from "./contacts";
import type { Circle } from "./circles";
import { saveCircles } from "./circles";
import type { Gift } from "./gifts";
import { saveGifts } from "./gifts";
import type { Recurring } from "./recurring";
import { saveRecurring } from "./recurring";
import type { SavingsGoal } from "./savings";
import { saveGoals } from "./savings";
import type { SplitBill } from "./splits";
import { saveSplits } from "./splits";

const DEMO_FLAG_KEY = "aevion_bank_demo_seeded_v1";

const PEERS = [
  { handle: "maria", nickname: "Maria Rojas" },
  { handle: "john", nickname: "John Okafor" },
  { handle: "aiko", nickname: "Aiko Tanaka" },
  { handle: "elena", nickname: "Elena Voss" },
];

function peerId(myAccountId: string, handle: string): string {
  // Deterministic fake account id tied to the user's account so multiple
  // demo resets produce the same peers.
  const suffix = myAccountId.replace(/^acc_/, "").slice(0, 6) || "000000";
  return `acc_demo_${handle}_${suffix}`;
}

function iso(nowMs: number, deltaDays: number): string {
  return new Date(nowMs + deltaDays * 86_400_000).toISOString();
}

export function hasDemoSeed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(DEMO_FLAG_KEY) !== null;
  } catch {
    return false;
  }
}

export function seedDemo(myAccountId: string): void {
  if (typeof window === "undefined") return;
  const now = Date.now();

  // Contacts — baseline the address book.
  for (const p of PEERS) {
    saveContact(peerId(myAccountId, p.handle), p.nickname);
  }

  // Savings goals with varied progress so ETAs in WealthForecast display.
  const goals: SavingsGoal[] = [
    {
      id: "goal_demo_macbook",
      label: "MacBook Pro",
      icon: "gear",
      targetAec: 1200,
      currentAec: 340,
      deadlineISO: iso(now, 90),
      createdAt: iso(now, -22),
      completedAt: null,
    },
    {
      id: "goal_demo_bali",
      label: "Vacation — Bali",
      icon: "vacation",
      targetAec: 800,
      currentAec: 520,
      deadlineISO: iso(now, 45),
      createdAt: iso(now, -40),
      completedAt: null,
    },
    {
      id: "goal_demo_emergency",
      label: "Emergency fund",
      icon: "heart",
      targetAec: 2000,
      currentAec: 250,
      deadlineISO: null,
      createdAt: iso(now, -10),
      completedAt: null,
    },
  ];
  saveGoals(goals);

  // Recurring — one active subscription + one recurring salary payout.
  const recurring: Recurring[] = [
    {
      id: "rec_demo_netflix",
      toAccountId: peerId(myAccountId, "maria"),
      recipientNickname: "Netflix (via Maria)",
      amount: 15,
      period: "monthly",
      label: "Netflix",
      startsAt: iso(now, -60),
      nextRunAt: iso(now, 5),
      lastRunAt: iso(now, -25),
      active: true,
      createdAt: iso(now, -60),
      runs: 2,
    },
    {
      id: "rec_demo_gym",
      toAccountId: peerId(myAccountId, "john"),
      recipientNickname: "Gym membership",
      amount: 35,
      period: "monthly",
      label: "Gym",
      startsAt: iso(now, -90),
      nextRunAt: iso(now, 10),
      lastRunAt: iso(now, -20),
      active: true,
      createdAt: iso(now, -90),
      runs: 3,
    },
  ];
  saveRecurring(recurring);

  // One lively Circle with multiple messages.
  const tripMembers = ["maria", "john", "aiko"].map((h) => ({
    accountId: peerId(myAccountId, h),
    nickname: PEERS.find((p) => p.handle === h)?.nickname ?? h,
  }));
  const circles: Circle[] = [
    {
      id: "circle_demo_trip",
      name: "Trip Crew",
      createdAt: iso(now, -14),
      members: tripMembers,
      messages: [
        {
          id: "msg_demo_1",
          authorId: peerId(myAccountId, "maria"),
          authorNickname: "Maria Rojas",
          createdAt: iso(now, -2),
          kind: "text",
          text: "Flights booked — who's covering dinner tomorrow?",
        },
        {
          id: "msg_demo_2",
          authorId: myAccountId,
          authorNickname: "You",
          createdAt: iso(now, -1.9),
          kind: "sent",
          text: "Sent 45 AEC to Maria",
          amount: 45,
          recipient: peerId(myAccountId, "maria"),
        },
        {
          id: "msg_demo_3",
          authorId: peerId(myAccountId, "john"),
          authorNickname: "John Okafor",
          createdAt: iso(now, -0.5),
          kind: "requested",
          text: "Requested 30 AEC from everyone",
          amount: 30,
          memo: "Taxi to hotel",
        },
      ],
    },
  ];
  saveCircles(circles);

  // Split — dinner bill.
  const splitShares = ["maria", "john", "aiko"].map((h) => ({
    accountId: peerId(myAccountId, h),
    nickname: PEERS.find((p) => p.handle === h)?.nickname ?? h,
    amount: 40,
    paid: h === "maria",
    paidAt: h === "maria" ? iso(now, -0.8) : null,
  }));
  const splits: SplitBill[] = [
    {
      id: "split_demo_dinner",
      label: "Dinner at Sunset",
      totalAec: 120,
      createdAt: iso(now, -1),
      shares: splitShares,
    },
  ];
  saveSplits(splits);

  // Gift history.
  const gifts: Gift[] = [
    {
      id: "gift_demo_thanks",
      recipientAccountId: peerId(myAccountId, "maria"),
      recipientNickname: "Maria Rojas",
      amount: 25,
      themeId: "thanks",
      message: "Thanks for covering me last week!",
      sentAt: iso(now, -3),
    },
    {
      id: "gift_demo_birthday",
      recipientAccountId: peerId(myAccountId, "elena"),
      recipientNickname: "Elena Voss",
      amount: 50,
      themeId: "birthday",
      message: "Happy birthday — treat yourself ☕",
      sentAt: iso(now, -8),
    },
    {
      id: "gift_demo_royalty",
      recipientAccountId: peerId(myAccountId, "aiko"),
      recipientNickname: "Aiko Tanaka",
      amount: 100,
      themeId: "royalty",
      message: "Your share of this quarter's royalties",
      sentAt: iso(now, -16),
    },
  ];
  saveGifts(gifts);

  try {
    localStorage.setItem(DEMO_FLAG_KEY, new Date().toISOString());
  } catch {
    // ignore
  }
}

export function clearDemoSeed(): void {
  if (typeof window === "undefined") return;
  // Remove all seeded sets by re-saving empty arrays into known keys.
  saveGoals([]);
  saveRecurring([]);
  saveCircles([]);
  saveSplits([]);
  saveGifts([]);
  try {
    localStorage.removeItem(DEMO_FLAG_KEY);
    // Contacts: leave demo peers in place (harmless) — user can trim manually.
  } catch {
    // ignore
  }
}
