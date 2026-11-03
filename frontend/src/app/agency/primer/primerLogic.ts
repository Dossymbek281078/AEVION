// Пример агентства (/agency/primer): чистая логика без DOM.
// Перенос 1:1 из aevion-agency-site/primer.html. Ничего никуда не отправляется.
// Регулярки по кириллице: \w кириллицу не ловит, поэтому [а-яё] (текст приводится к нижнему регистру).

export const SERVICES: Record<string, number> = {
  "Мужская стрижка": 6000,
  "Стрижка + борода": 9000,
  "Детская стрижка": 4000,
  "Оформление бороды": 4000,
};

export function formatTenge(n: number): string {
  return n.toLocaleString("ru-RU").replace(/ | /g, " ") + " ₸";
}

export function findService(t: string): string {
  if (/сын|доч|реб[её]н|детск|\d+\s*лет/.test(t)) return "Детская стрижка";
  const beard = /бород/.test(t);
  const cut = /стрич|стриж|подстри/.test(t);
  if (beard && cut) return "Стрижка + борода";
  if (beard) return "Оформление бороды";
  if (cut) return "Мужская стрижка";
  return "";
}

export function findDay(t: string): string {
  const m = t.match(
    /сегодня|завтра|послезавтра|понедельник|вторник|сред[уа]|четверг|пятниц[уа]|суббот[уа]|воскресень[ея]/,
  );
  return m ? m[0] : "";
}

export function findTime(t: string): string {
  const m = t.match(/после\s*(\d{1,2})|в\s*(\d{1,2})(?::(\d{2}))?|(утр[а-яё]*|вечер[а-яё]*|днём|днем)/);
  if (!m) return "";
  if (m[1]) {
    let h = +m[1];
    if (h < 10) h += 12;
    return "после " + h + ":00";
  }
  if (m[2]) {
    let h2 = +m[2];
    if (h2 < 10) h2 += 12;
    return h2 + ":" + (m[3] || "00");
  }
  return m[4];
}

export function findName(original: string): string {
  const m = original.match(/(?:меня зовут|я\s*[-—])\s+([а-яё]{2,20})/i);
  return m ? m[1][0].toUpperCase() + m[1].slice(1).toLowerCase() : "";
}

export type Inquiry = {
  service: string;
  day: string;
  time: string;
  name: string;
  asksPrice: boolean;
};

export type Parsed = {
  inquiry: Inquiry;
  card: Array<[string, string]>;
  draft: string;
};

export function parseInquiry(raw: string): Parsed {
  const original = raw.slice(0, 1000);
  const t = original.toLowerCase();
  const inquiry: Inquiry = {
    service: findService(t),
    day: findDay(t),
    time: findTime(t),
    name: findName(original),
    asksPrice: /сколько|стоим|цен|прайс/.test(t),
  };
  const { service, day, time, name, asksPrice } = inquiry;
  const card: Array<[string, string]> = [
    ["Услуга", service || "не названа — уточнить"],
    ["День", day || "не назван — уточнить"],
    ["Время", time || "не названо — уточнить"],
    ["Имя", name || "не назвал"],
    ["Спрашивает цену", asksPrice ? "да" : "нет"],
  ];
  const lines = ["Здравствуйте" + (name ? ", " + name : "") + "!"];
  if (service) lines.push(service + " у нас стоит " + formatTenge(SERVICES[service]) + ", занимает около часа.");
  else
    lines.push(
      "Подскажите, пожалуйста, какая услуга нужна: стрижка (" + formatTenge(6000) + "), стрижка с бородой (" +
        formatTenge(9000) + "), детская (" + formatTenge(4000) + ") или только борода (" + formatTenge(4000) + ")?",
    );
  if (day && time) lines.push("На " + day + " " + time + " есть свободное время — записать вас? Мастер Ерлан.");
  else if (day) lines.push("На " + day + " есть окна. В какое время вам удобно?");
  else lines.push("На какой день и время вас записать?");
  lines.push("", "Барбершоп «Ножницы»");
  return { inquiry, card, draft: lines.join("\n") };
}

export const SAMPLES = [
  "Добрый день, сыну 7 лет, хотим подстричься завтра утром. Сколько стоит?",
  "Здравствуйте, нужно только бороду поправить, есть время сегодня вечером?",
  "Здравствуйте, хочу к вам записаться",
];

export const DAY_NAMES = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
export const HOURS = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"];

/** Занятые часы дня — детерминированно по смещению дня от сегодня. */
export function busyHours(offset: number): Set<string> {
  const s = new Set<string>();
  HOURS.forEach((h, i) => {
    if ((i * 7 + offset * 3) % 5 < 2) s.add(h);
  });
  return s;
}
