import { parsePlanSignals } from "../../src/lib/qventure/signals";
const C: Array<[string,string,(s:any)=>any,any]> = [
  ["payback годы→месяцы", "Payback period of 2 years.", (s)=>s.paybackMonths, 24],
  ["payback 1.5 года", "Payback period of 1.5 years.", (s)=>s.paybackMonths, 18],
  ["месячная выручка ×12", "Revenue of $1 million per month.", (s)=>s.revenueUsd, 12e6],
  ["мощность ГВт→МВт", "We have deployed 2 GW of capacity.", (s)=>s.capacityDeployedMw, 2000],
  ["кратность 3x→200%", "Revenue grew 3x year over year.", (s)=>s.growthPct, 200],
  ["отток годовой→месячный", "Churn of 20% annually.", (s)=>s.churnMonthlyPct, 1.84],
];
for (const [l,t,read,want] of C) {
  const s = parsePlanSignals(t) as any;
  const v = read(s);
  const ok = typeof want === "number" && typeof v === "number" ? Math.abs(v-want) < 0.02 : v===want;
  console.log(`${ok?"✓":"✗"} ${String(v).padEnd(11)} обещано ${String(want).padEnd(9)} ${l}`);
  const note = s.parseNotes.find((n: string) => /scored as|annualized|recorded as|multiple/i.test(n));
  console.log(`     заметка: ${note ? note.slice(0,95) : "(нет)"}`);
}
