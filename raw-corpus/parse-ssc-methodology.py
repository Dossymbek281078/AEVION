"""
Парсер ССЦ РК 8.04-08-2025 «Общие положения по применению» (методический PDF).

Документ содержит:
- Нумерованные пункты (1.1, 2.4.7, 7.10.3 и т.д.) — методические положения
- Таблицы коэффициентов (морозостойкость, водонепроницаемость, надбавки...)
- Примеры расчётов

Пропускаем казахскую часть (страницы дублируются на 2 языках).

Выход: frontend/public/normatives/ssc-methodology-2025.json
{
  "version": "ССЦ РК 8.04-08-2025",
  "title": "Общие положения по применению",
  "approvedBy": "...",
  "sections": [{ "num": "2.4", "title": "...", "items": [...] }],
  "tables": [{ "num": "7", "title": "...", "rows": [...] }]
}
"""
from __future__ import annotations
import json, re, sys
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "raw-corpus" / "ksm-source" \
    / "ССЦ РК 8.04-08-2025 Материалы, изделия и конструкции" \
    / "ССЦ РК 8.04-08-2025 Материалы, изделия и конструкции" \
    / "ru" / "Общие положения_Материалы_рус.pdf"
OUT = ROOT / "frontend" / "public" / "normatives" / "ssc-methodology-2025.json"

# Заголовок верхнего раздела: одна цифра + короткий именной заголовок
TOP_SECTION_RE = re.compile(r"^([1-9])\s+([А-ЯЁ][А-Яа-яёЁ]{2,15}(?:\s+[а-яё]{3,15}){0,3})$")
TOP_BLOCKLIST_VERBS = ("ется", "ются", "ался", "ляет", "ить", "ать", "уют",
                       "ование", "ировани", "лагает", "ляются", "ходит")
# Преамбульные секции — игнорируем
TOP_BLOCKLIST_TITLES = ("разработан", "представлен", "утвержден",
                        "рекомендован", "введен", "взамен", "согласован")
# Любая нумерованная запись: 1.x, 1.x.y, 1.x.y.z (двух+ уровня)
ENTRY_RE = re.compile(r"^([1-9]\d?(?:\.\d+){1,3})\s+(.+)$")
# Таблица: "Таблица 7 – Что-то"
TABLE_RE = re.compile(r"^Таблица\s+(\d+(?:\.\d+)?)\s*[–\-—]?\s*(.+)$", re.M)

def is_kazakh_page(text: str) -> bool:
    """Эвристика: казахская страница содержит специфичные слова без русских аналогов."""
    kz_markers = ["қаласы", "жалпы ережелер", "сметалық бағалар", "құрылыстағы",
                  "қолданылады", "беріледі", "мынадай"]
    has_kz = any(m in text.lower() for m in kz_markers)
    has_ru = any(m in text.lower() for m in ["настоящий", "следует", "применяется",
                                                "сборник", "цена приведена"])
    if has_kz and not has_ru:
        return True
    return False

def parse_pdf(path: Path) -> dict:
    """Возвращает плоский список entries (нумерованные пункты любого уровня) +
    список tables. UI группирует entries по top-level номеру через split('.')[0]."""
    top_sections: list[dict] = []  # {num, title}
    entries: list[dict] = []        # {num, text, page}
    tables: list[dict] = []
    seen_table_nums: set[str] = set()

    with pdfplumber.open(path) as pdf:
        for pi, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            if is_kazakh_page(text):
                continue
            # Skip cover-pages
            if "БАҚЫЛАУ ДАНАСЫ" in text and len(text) < 1100:
                continue

            # ── Таблицы ──────────────────────────────────────────
            for tbl in page.extract_tables() or []:
                if not tbl or len(tbl) < 2:
                    continue
                header = [(c or "").strip() for c in tbl[0]]
                if not any(header):
                    continue
                if not re.search(r"(№|Вид|Наименование|Тип|Класс|Код|Период|Год|Коэффициент|Надбавк)",
                                 " ".join(header[:4]), re.I):
                    continue
                m = TABLE_RE.search(text)
                num = m.group(1) if m else f"p{pi + 1}"
                if num in seen_table_nums:
                    continue
                seen_table_nums.add(num)
                title = m.group(2).strip() if m else "Таблица"
                tables.append({
                    "num": num,
                    "title": title[:200],
                    "page": pi + 1,
                    "header": header,
                    "rows": [
                        [(c or "").strip().replace("\n", " ") for c in row]
                        for row in tbl[1:] if any((c or "").strip() for c in row)
                    ][:40],
                })

            # ── Текст ────────────────────────────────────────────
            for raw_line in text.split("\n"):
                line = raw_line.strip()
                if not line:
                    continue
                # Колонтитулы/футеры пропускаем
                if "ССЦ РК 8.04-08-2025" == line:
                    continue
                if line.lower().startswith("продолжение таблицы"):
                    continue

                # Top section (с фильтром глагольных окончаний — иначе ловит «2 При превышении ...»)
                tm = TOP_SECTION_RE.match(line)
                if tm and not ENTRY_RE.match(line):
                    title = tm.group(2).strip()
                    title_lc = title.lower()
                    if (not any(v in title_lc for v in TOP_BLOCKLIST_VERBS)
                            and not any(t in title_lc for t in TOP_BLOCKLIST_TITLES)):
                        # Дедуп по номеру
                        if not any(s["num"] == tm.group(1) for s in top_sections):
                            top_sections.append({"num": tm.group(1), "title": title})
                        continue
                # Нумерованный пункт (2+ уровня)
                em = ENTRY_RE.match(line)
                if em:
                    entries.append({
                        "num": em.group(1),
                        "text": em.group(2).strip(),
                        "page": pi + 1,
                    })
                    continue
                # Продолжение предыдущего пункта
                if entries:
                    last = entries[-1]
                    if len(line) > 8 and line[0].islower():
                        last["text"] = (last["text"] + " " + line)[:2000]

    return {
        "version": "ССЦ РК 8.04-08-2025",
        "title": "Общие положения по применению сметных цен на строительные материалы, изделия и конструкции",
        "approvedBy": "Приказ Комитета по делам строительства МПС РК № 94-НҚ от 18.06.2025",
        "effectiveFrom": "2025-07-01",
        "supersedes": "ССЦ РК 8.04-08-2024",
        "source": str(path.relative_to(ROOT)),
        "topSections": top_sections,
        "entries": entries,
        "tables": tables,
    }

def main() -> int:
    if not SRC.exists():
        print(f"PDF not found: {SRC}", file=sys.stderr)
        return 2
    print(f"==> parsing {SRC.name}")
    data = parse_pdf(SRC)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"==> top sections={len(data['topSections'])} entries={len(data['entries'])} tables={len(data['tables'])}")
    print(f"    written: {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")
    if data["topSections"]:
        print("\n  top sections:")
        for s in data["topSections"]:
            print(f"    {s['num']:<3} {s['title']}")
    if data["entries"]:
        print("\n  entries sample:")
        for e in data["entries"][:6]:
            print(f"    {e['num']:<8} {e['text'][:70]}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
