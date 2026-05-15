"""
Парсер НДЦС РК 8.04-07-2025 «Индексы стоимости для строительства» (PDF).

Источник: ksm-source/НДЦС РК 8.04-07-2025 .../Сборник НДЦС РК 8.04-07-2025
(на русском и казахском) контрольный экземпляр.pdf
Структура: 16 страниц, табличные данные на стр 9-10 (каз) и 14-15 (рус).
Колонки: Период | Индекс к предыдущему периоду, % | Коэффициент

Выход: frontend/public/normatives/indexes-2025.json
{
  "version": "НДЦС РК 8.04-07-2025",
  "approvedBy": "Приказ Комитета по делам строительства МПС РК № 94-НҚ от 18.06.2025",
  "effectiveFrom": "2025-07-01",
  "annual": [{ "period": "2026 год", "indexPct": 107.9, "coefficient": 1.0790 }, ...],
  "quarterly": [{ "period": "2025 III кв", "indexPct": 101.92, "coefficient": 1.0192 }, ...]
}
"""
from __future__ import annotations
import json, re, sys
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "raw-corpus" / "ksm-source" / "НДЦС РК 8.04-07-2025 Индексы стоимости для строительства" \
    / "НДЦС РК 8.04-07-2025 Индексы стоимости для строительства" \
    / "Сборник НДЦС РК 8.04-07-2025 (на русском и казахском) контрольный экземпляр.pdf"
OUT = ROOT / "frontend" / "public" / "normatives" / "indexes-2025.json"

YEAR_RE = re.compile(r"^(\d{4})\s*год$")
QUARTER_RE = re.compile(r"^(\d{4})\s*г\.?\s*(I{1,3}|IV|V?I{0,3})\s*квартал[а]?$", re.I)

def _to_num(s: str | None) -> float | None:
    if not s: return None
    s = s.replace(",", ".").replace("\xa0", "").strip()
    try: return float(s)
    except ValueError: return None

def parse_pdf(path: Path) -> dict:
    annual: list[dict] = []
    quarterly: list[dict] = []
    section = None
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = (page.extract_text() or "").lower()
            # русские страницы только (избегаем дубля каз)
            if "период" not in text or "индекс" not in text:
                continue
            for table in page.extract_tables():
                for row in table:
                    if not row or len(row) < 3: continue
                    period = (row[0] or "").strip()
                    if not period or period in ("1",):
                        continue
                    if "Раздел" in period or "Период" in period or period.startswith("Индекс"):
                        section = period
                        continue
                    pct = _to_num(row[1])
                    coef = _to_num(row[2])
                    if pct is None and coef is None:
                        continue
                    rec = {"period": period, "indexPct": pct, "coefficient": coef, "section": section}
                    # годовые: "2026 год"; квартальные содержат "квартал"
                    if "квартал" in period.lower() or "тоқсан" in period.lower():
                        quarterly.append(rec)
                    elif YEAR_RE.match(period.replace(" ", " ")):
                        annual.append(rec)
                    else:
                        # пропускаем строки шапки и пустые
                        continue
    return {
        "version": "НДЦС РК 8.04-07-2025",
        "title": "Индексы стоимости для строительства",
        "approvedBy": "Приказ Комитета по делам строительства МПС РК № 94-НҚ от 18.06.2025",
        "effectiveFrom": "2025-07-01",
        "supersedes": "НДЦС РК 8.04-07-2024",
        "source": str(path.relative_to(ROOT)),
        "annual": annual,
        "quarterly": quarterly,
    }

def main() -> int:
    if not SRC.exists():
        print(f"PDF not found: {SRC}", file=sys.stderr)
        print("Скачайте архив через `python raw-corpus/fetch-ksm.py` сначала.", file=sys.stderr)
        return 2
    print(f"==> parsing {SRC.name}")
    data = parse_pdf(SRC)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"==> annual: {len(data['annual'])}, quarterly: {len(data['quarterly'])}")
    print(f"    written: {OUT.relative_to(ROOT)}")
    if data["annual"]:
        print("\n  annual sample:")
        for r in data["annual"][:5]:
            print(f"    {r['period']:<15} pct={r['indexPct']} coef={r['coefficient']}")
    if data["quarterly"]:
        print("\n  quarterly sample:")
        for r in data["quarterly"][:5]:
            print(f"    {r['period']:<25} pct={r['indexPct']} coef={r['coefficient']}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
