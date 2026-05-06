"""
Сопоставляет материалы из seed.json с реальными позициями ССЦ РК 8.04-08-2025.

Для каждого уникального (name, unit) материала из seed.json ищем кандидата
в ССЦ Алматы Кн.1 (последний выпуск) + общие книги 2-6, и в Алматы Кн.7.
Эвристика — пересечение значимых слов + совпадение единицы измерения.

Результат → frontend/src/app/smeta-trainer/data/material-ssc-map.json:
  {
    "version": "ССЦ РК 8.04-08-2025",
    "region": "almaty",
    "generated_at": "...",
    "materials": [
      { "name": "Раствор цементно-известковый М100", "unit": "м³",
        "sscCode": "411-001-0143", "sscName": "...", "score": 0.62,
        "smetnaya": 17850 }
    ]
  }

Запуск: python -X utf8 raw-corpus/match-seed-to-ssc.py
"""
from __future__ import annotations
import json, re, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "frontend" / "src" / "app" / "smeta-trainer" / "data" / "seed.json"
SSC_DIR = ROOT / "frontend" / "public" / "ssc"
OUT = ROOT / "frontend" / "src" / "app" / "smeta-trainer" / "data" / "material-ssc-map.json"

# книги для матча (Алматы — приоритет, общие — fallback)
SOURCE_BOOKS = [
    "ssc-2025-almaty-book1-v2",   # Алматы Кн.1 Вып.2 — основные материалы
    "ssc-2025-almaty-book7-v2",   # Алматы Кн.7 — бетон/ж/б
    "ssc-2025-common-book2-v2",   # местные материалы
    "ssc-2025-common-book3-v2",   # дерево
    "ssc-2025-common-book4-v2",   # металл
    "ssc-2025-common-book5-1",    # оборудование 1
    "ssc-2025-common-book5-2-v2", # оборудование 2
    "ssc-2025-common-book5-3-v2", # оборудование 3
    "ssc-2025-common-book5-4-v2", # оборудование 4
    "ssc-2025-common-book6-v2",   # отделочные
]

# нормализация единиц (seed → ССЦ)
UNIT_ALIASES = {
    "м3": {"м3", "м³"}, "м³": {"м3", "м³"},
    "м2": {"м2", "м²"}, "м²": {"м2", "м²"},
    "т": {"т", "тонна"},
    "кг": {"кг"},
    "л": {"л", "литр"},
    "шт": {"шт", "шт.", "штука"},
    "шт.": {"шт", "шт."},
    "м": {"м", "пог.м", "п.м"},
    "пог.м": {"м", "пог.м"},
    "компл": {"компл", "комплект"},
    "пара": {"пара"},
}
def units_match(a: str, b: str) -> bool:
    a, b = (a or "").strip().lower(), (b or "").strip().lower()
    if a == b: return True
    for k, vs in UNIT_ALIASES.items():
        kn = k.lower()
        vsn = {v.lower() for v in vs}
        if a in vsn and b in vsn: return True
        if a == kn and b in vsn: return True
        if b == kn and a in vsn: return True
    return False

# токенизация: убираем шумовые слова, оставляем значимые
STOPWORDS = {
    "и","в","на","с","для","по","из","от","до","к","о",
    "гост","ту","снип","рк","шт","штук","кг","м","м2","м3","т","л",
    "натуральный","обыкновенный","стандартный",
    "марки","марка","типа","тип","класс","ст","сорт","диаметр","толщина",
    "размер","группы","группа",
}
def tokenize(s: str) -> list[str]:
    s = s.lower()
    s = re.sub(r"[^\w\s]+", " ", s, flags=re.UNICODE)
    toks = []
    for t in s.split():
        if t in STOPWORDS: continue
        if t.isdigit() and len(t) > 4: continue  # длинные номера ГОСТ
        if len(t) < 2: continue
        toks.append(t)
    return toks

def score(seed_name: str, ssc_name: str) -> float:
    """Jaccard-подобный скор пересечения значимых токенов."""
    a, b = set(tokenize(seed_name)), set(tokenize(ssc_name))
    if not a or not b: return 0.0
    inter = len(a & b)
    if not inter: return 0.0
    # вес: пересечение / (1 + штраф за лишние слова в ССЦ-имени)
    return inter / (len(a) + 0.3 * (len(b) - inter))

def load_book(slug: str) -> list[dict]:
    p = SSC_DIR / f"{slug}.json"
    if not p.exists(): return []
    return json.loads(p.read_text(encoding="utf-8"))["rows"]

def collect_seed_materials() -> list[tuple[str, str]]:
    seed = json.loads(SEED.read_text(encoding="utf-8"))
    seen: set[tuple[str, str]] = set()
    for r in seed.get("rates", []):
        for res in r.get("resources", []):
            if res.get("kind") != "материал": continue
            key = (res["name"].strip(), res["unit"].strip())
            if key not in seen:
                seen.add(key)
    return sorted(seen)

def best_candidate(name: str, unit: str, books: dict[str, list[dict]],
                   min_score: float = 0.35) -> dict | None:
    best = None
    best_s = 0.0
    for slug, rows in books.items():
        for r in rows:
            if r.get("isGroup"): continue
            if not units_match(unit, r.get("unit", "")): continue
            if r.get("smetnaya") is None: continue
            s = score(name, r["name"])
            if s > best_s:
                best_s, best = s, {**r, "_slug": slug, "_score": round(s, 3)}
    if best_s >= min_score: return best
    return None

def main() -> int:
    print("==> loading SSC books")
    books = {slug: load_book(slug) for slug in SOURCE_BOOKS}
    total_rows = sum(len(rs) for rs in books.values())
    print(f"    {len(books)} books, {total_rows} rows")
    materials = collect_seed_materials()
    print(f"==> matching {len(materials)} unique materials from seed")
    matched = []
    unmatched = []
    for name, unit in materials:
        cand = best_candidate(name, unit, books)
        if cand:
            matched.append({
                "name": name, "unit": unit,
                "sscCode": cand["code"],
                "sscName": cand["name"],
                "sscBook": cand["_slug"],
                "score": cand["_score"],
                "smetnaya": cand.get("smetnaya"),
                "otpusknaya": cand.get("otpusknaya"),
            })
        else:
            unmatched.append({"name": name, "unit": unit})
    out = {
        "version": "ССЦ РК 8.04-08-2025",
        "region": "almaty",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "books": SOURCE_BOOKS,
        "materials": matched,
        "unmatched": unmatched,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"==> matched={len(matched)} unmatched={len(unmatched)}")
    print(f"    written: {OUT.relative_to(ROOT)}")
    if matched:
        print("\n  examples (matched):")
        for m in matched[:8]:
            print(f"    [{m['score']:.2f}] {m['name'][:35]:<35} → {m['sscCode']} {m['sscName'][:35]:<35} | {m['smetnaya']:>10,} ₸")
    if unmatched:
        print("\n  examples (unmatched, first 10):")
        for m in unmatched[:10]:
            print(f"    {m['name'][:50]:<50} ({m['unit']})")
    return 0

if __name__ == "__main__":
    sys.exit(main())
