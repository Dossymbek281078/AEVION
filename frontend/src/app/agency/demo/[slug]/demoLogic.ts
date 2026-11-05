// Личное демо агентства (/agency/demo/<slug>): чистая логика без DOM. Ничего никуда не отправляется.
// Правило: только факты с сайта компании. Нет цены — не выдумываем; свободное время в демо условное.

export type DemoService = { name: string; price: string | null };
export type Demo = {
  slug: string;
  n: number; // номер метки agency-demo-N
  company: string;
  city: string;
  niche: string;
  site: string;
  hours: string | null;
  services: DemoService[];
  weakFact: string;
  firstOffer: "site" | "bot" | "ai";
  sample: string;
};

const STOP = new Set(["и", "в", "на", "с", "по", "для", "от", "до", "или", "у", "из", "за"]);

export function stems(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .split(/[^a-zа-я0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => w.slice(0, Math.max(4, w.length - 2)));
}

/** Услуга, у которой больше всего общих основ с текстом; при равенстве — null, чтобы уточнить, а не угадывать. */
export function findService(text: string, services: DemoService[]): DemoService | null {
  const words = stems(text);
  let best: DemoService | null = null;
  let bestScore = 0;
  let tie = false;
  for (const svc of services) {
    const score = stems(svc.name).filter((st) => words.some((w) => w.startsWith(st) || st.startsWith(w))).length;
    if (score > bestScore) {
      best = svc;
      bestScore = score;
      tie = false;
    } else if (score === bestScore && score > 0) tie = true;
  }
  return tie ? null : best;
}

export function findDay(t: string): string {
  const m = t.match(/послезавтра|сегодня|завтра|понедельник|вторник|сред[уа]|четверг|пятниц[уа]|суббот[уа]|воскресень[ея]/);
  return m ? m[0] : "";
}

export function findTime(t: string): string {
  const m = t.match(/после\s*(\d{1,2})|в\s*(\d{1,2})(?::(\d{2}))?|(утр[а-яё]*|вечер[а-яё]*|днём|днем)/);
  if (!m) return "";
  if (m[1]) {
    const h = +m[1];
    return "после " + (h < 8 ? h + 12 : h) + ":00";
  }
  if (m[2]) {
    const h = +m[2];
    return (h < 8 ? h + 12 : h) + ":" + (m[3] || "00");
  }
  return m[4];
}

export function findName(original: string): string {
  const m = original.match(/(?:меня зовут|я\s*[-—])\s+([а-яё]{2,20})/i);
  return m ? m[1][0].toUpperCase() + m[1].slice(1).toLowerCase() : "";
}

export function priceText(svc: DemoService): string {
  return svc.price ?? "цена по запросу";
}

export function buildDraft(raw: string, demo: Demo) {
  const original = raw.slice(0, 1000);
  const t = original.toLowerCase();
  const service = findService(t, demo.services);
  const day = findDay(t);
  const time = findTime(t);
  const name = findName(original);
  const asksPrice = /сколько|стоим|цен|прайс/.test(t);
  const card: Array<[string, string]> = [
    ["Услуга", service ? service.name : "не названа — уточнить"],
    ["День", day || "не назван — уточнить"],
    ["Время", time || "не названо — уточнить"],
    ["Имя", name || "не назвал"],
    ["Спрашивает цену", asksPrice ? "да" : "нет"],
  ];
  const lines = ["Здравствуйте" + (name ? ", " + name : "") + "!"];
  if (service) {
    lines.push(
      service.price
        ? service.name + " — " + service.price + (service.price.endsWith(".") ? "" : ".")
        : service.name + ": стоимость подскажет администратор после уточнения деталей.",
    );
  } else {
    lines.push("Подскажите, пожалуйста, какая услуга нужна: " + demo.services.slice(0, 3).map((x) => x.name).join(", ") + "?");
  }
  if (day && time) lines.push("Проверю " + day + " " + time + " и сразу подтвержу запись.");
  else if (day) lines.push("В какое время " + day + " вам удобно?");
  else lines.push("На какой день и время вас записать?");
  lines.push("", demo.company);
  return { card, draft: lines.join("\n") };
}

export const DAY_NAMES = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
export const HOURS = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

/** Условная занятость для показа; настоящее расписание компании демо не знает. */
export function busyHours(offset: number): Set<string> {
  const out = new Set<string>();
  HOURS.forEach((h, i) => {
    if ((i * 7 + offset * 3) % 5 < 2) out.add(h);
  });
  return out;
}

export function demoHref(demo: Demo): string {
  return "https://aevion.app/agency/demo/" + demo.slug + "?c=agency-demo-" + demo.n;
}
