/**
 * Клиент для нормативного сборника ССЦ РК 8.04-08-2025.
 * Данные лежат в /public/ssc/ как отдельные JSON по slug, грузятся лениво.
 */

export type SscRow = {
  code: string;
  name: string;
  unit: string;
  cargoClass?: string;
  grossKg?: number | null;
  smetnaya?: number | null;   // сметная цена, тенге (включает ТЗР)
  otpusknaya?: number | null; // отпускная цена, тенге (от производителя)
  isGroup?: boolean;
};

export type SscBookMeta = {
  slug: string;
  file: string;
  region: string | null;
  region_slug: string;
  book: string | null;
  issue: number | null;
  kind: "rates" | "general";
  rows: number;
  materials: number;
  size_bytes: number;
};

export type SscBook = SscBookMeta & { rows: SscRow[]; source: string };

const cache = new Map<string, Promise<SscBook>>();
let indexPromise: Promise<SscBookMeta[]> | null = null;

export async function loadSscIndex(): Promise<SscBookMeta[]> {
  if (!indexPromise) {
    indexPromise = fetch("/ssc/ssc-2025-index.json").then((r) => {
      if (!r.ok) throw new Error("ssc index unavailable");
      return r.json();
    });
  }
  return indexPromise;
}

export async function loadSscBook(slug: string): Promise<SscBook> {
  let p = cache.get(slug);
  if (!p) {
    p = fetch(`/ssc/${encodeURIComponent(slug)}.json`).then((r) => {
      if (!r.ok) throw new Error(`ssc book ${slug} not found`);
      return r.json();
    });
    cache.set(slug, p);
  }
  return p;
}

/** Регионы в порядке отображения, slug → русское название. */
export const REGIONS: Array<{ slug: string; label: string; isCity?: boolean }> = [
  { slug: "almaty", label: "г. Алматы", isCity: true },
  { slug: "astana", label: "г. Астана / Косшы", isCity: true },
  { slug: "shymkent", label: "г. Шымкент", isCity: true },
  { slug: "almaty-obl", label: "Алматинская обл." },
  { slug: "akmola", label: "Акмолинская обл." },
  { slug: "aktobe", label: "Актюбинская обл." },
  { slug: "atyrau", label: "Атырауская обл." },
  { slug: "vko", label: "Восточно-Казахстанская обл." },
  { slug: "zhambyl", label: "Жамбылская обл." },
  { slug: "zko", label: "Западно-Казахстанская обл." },
  { slug: "karaganda", label: "Карагандинская обл." },
  { slug: "kostanay", label: "Костанайская обл." },
  { slug: "kyzylorda", label: "Кызылординская обл." },
  { slug: "mangystau", label: "Мангистауская обл." },
  { slug: "pavlodar", label: "Павлодарская обл." },
  { slug: "sko", label: "Северо-Казахстанская обл." },
  { slug: "turkestan", label: "Туркестанская обл." },
  { slug: "abay", label: "Область Абай" },
  { slug: "zhetysu", label: "Область Жетісу" },
  { slug: "ulytau", label: "Область Ұлытау" },
];

export const REGION_LABELS: Record<string, string> = Object.fromEntries(
  REGIONS.map((r) => [r.slug, r.label]),
);
REGION_LABELS["common"] = "Общие книги";

/** Описание книг ССЦ (для пояснений в UI). */
export const BOOK_DESCRIPTIONS: Record<string, string> = {
  "1": "Кн. 1 — Основные строительные материалы (региональная)",
  "2": "Кн. 2 — Местные стройматериалы и изделия",
  "3": "Кн. 3 — Изделия из дерева",
  "4": "Кн. 4 — Металлоконструкции и металлоизделия",
  "5.1": "Кн. 5.1 — Оборудование (часть 1)",
  "5.2": "Кн. 5.2 — Оборудование (часть 2)",
  "5.3": "Кн. 5.3 — Оборудование (часть 3)",
  "5.4": "Кн. 5.4 — Оборудование (часть 4)",
  "6": "Кн. 6 — Отделочные материалы",
  "7": "Кн. 7 — Бетонные и железобетонные конструкции",
};

export function bookLabel(book: string | null, issue: number | null, kind: string): string {
  if (kind === "general") return "Общие положения по применению";
  if (!book) return "—";
  const base = BOOK_DESCRIPTIONS[book] ?? `Кн. ${book}`;
  if (issue) return `${base} · Выпуск ${issue}`;
  return base;
}

/** Локальный поиск внутри загруженной книги. */
export function searchInBook(
  book: SscBook,
  query: string,
  limit = 200,
): SscRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return book.rows.filter((r) => !r.isGroup).slice(0, limit);
  const isCode = /^\d/.test(q);
  const out: SscRow[] = [];
  for (const r of book.rows) {
    if (r.isGroup) continue;
    if (isCode ? r.code.includes(q) : r.name.toLowerCase().includes(q)) {
      out.push(r);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** Форматирование цены в тенге. */
export function formatTenge(v?: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("ru-RU") + " ₸";
}
