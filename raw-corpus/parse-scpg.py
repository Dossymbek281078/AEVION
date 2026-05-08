"""
Парсер СЦПГ РК 8.04-12-2025 «Сметные цены на перевозки грузов» (PDF, 34 стр).

Структура:
- Отдел 1 — Автомобильные перевозки (учебно достаточно)
- Отдел 2 — Железнодорожные (отдельный PDF, не парсим в MVP)
Таблицы тарифов по расстоянию (1..900 км) × 6 типов транспорта:
  Код 411-XXX-YY: малая/средняя/большая грузоподъёмность × в/вне нас. пунктов
В тенге за тонну.

Выход: frontend/public/normatives/scpg-2025-auto.json
"""
from __future__ import annotations
import json, re, sys
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
SRC_CANDIDATES = [
    Path(r"C:\tmp\scpg")
        / "СЦПГ РК 8.04-12-2025 Сметные цены на перевозки грузов"
        / "СЦПГ РК 8.04-12-2025 Сметные цены на перевозки грузов Отдел 1. АВТОМОБИЛЬНЫЕ ПЕРЕВОЗКИ"
        / "СЦПГ РК 8.04-12-2025 Отдел 1. АВТОМОБИЛЬНЫЕ ПЕРЕВОЗКИ.pdf",
]
OUT = ROOT / "frontend" / "public" / "normatives" / "scpg-2025-auto.json"

CODE_RE = re.compile(r"^411-\d{3}-\d{2}$")

def _num(s: str | None) -> int | None:
    if not s: return None
    # Убираем скобочные значения «767 (669)» → берём первое число
    m = re.match(r"^\s*(\d[\d\s]*)", s.replace("\xa0", " "))
    if not m: return None
    n = m.group(1).replace(" ", "")
    try: return int(n)
    except ValueError: return None

def parse_pdf(path: Path) -> dict:
    transports: list[dict] = []
    rows: list[dict] = []
    seen_codes: dict[str, int] = {}  # code → index в transports

    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for tbl in page.extract_tables() or []:
                if not tbl or len(tbl) < 4: continue
                # ищем строку с шапкой «Код» и кодами 411-XXX-YY
                code_row_idx = None
                for ri, row in enumerate(tbl[:5]):
                    for cell in row:
                        if cell and CODE_RE.match((cell or "").strip()):
                            code_row_idx = ri
                            break
                    if code_row_idx is not None: break
                if code_row_idx is None: continue
                # Регистрируем коды как «транспорты»
                code_row = [(c or "").strip() for c in tbl[code_row_idx]]
                col_to_code: dict[int, str] = {}
                for ci, cell in enumerate(code_row):
                    if CODE_RE.match(cell):
                        col_to_code[ci] = cell
                        if cell not in seen_codes:
                            # Определим название транспорта из шапки выше
                            title_parts = []
                            for hi in range(code_row_idx):
                                hdr = (tbl[hi][ci] or "").strip().replace("\n", " ")
                                if hdr: title_parts.append(hdr)
                            seen_codes[cell] = len(transports)
                            transports.append({"code": cell, "title": " · ".join(title_parts)[:120]})
                # Парсим строки: первая колонка — № позиции, вторая — расстояние,
                # затем тарифы по col_to_code
                for row in tbl[code_row_idx + 1:]:
                    if not row or len(row) < 3: continue
                    pos = (row[0] or "").strip()
                    dist = (row[1] or "").strip()
                    # пропускаем пустые / заголовочные
                    if not pos or not dist or not pos.isdigit(): continue
                    distance_km = _num(dist)
                    if distance_km is None: continue
                    rates: dict[str, int] = {}
                    for ci, code in col_to_code.items():
                        if ci >= len(row): continue
                        v = _num(row[ci])
                        if v is not None: rates[code] = v
                    if rates:
                        rows.append({"position": int(pos), "distance_km": distance_km, "rates": rates})

    return {
        "version": "СЦПГ РК 8.04-12-2025",
        "title": "Сметные цены на перевозки грузов · Отдел 1. Автомобильные",
        "approvedBy": "Приказ Комитета по делам строительства МПС РК № 94-НҚ от 18.06.2025",
        "effectiveFrom": "2025-07-01",
        "supersedes": "СЦПГ РК 8.04-12-2024",
        "unit": "тенге за тонну",
        "source": str(path.name),
        "transports": transports,
        "rows": rows,
    }

def main() -> int:
    src = next((p for p in SRC_CANDIDATES if p.exists()), None)
    if not src:
        print(f"PDF not found: {SRC_CANDIDATES}", file=sys.stderr)
        return 2
    print(f"==> parsing {src.name}")
    data = parse_pdf(src)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    print(f"==> transports={len(data['transports'])} rows={len(data['rows'])}")
    print(f"    written: {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")
    if data["transports"]:
        print("\n  transports:")
        for t in data["transports"]:
            print(f"    {t['code']}  {t['title'][:80]}")
    if data["rows"]:
        print("\n  sample rows (по расстоянию):")
        for row in data["rows"][:5]:
            tarif_str = ", ".join(f"{c}={v}" for c, v in list(row["rates"].items())[:3])
            print(f"    {row['distance_km']} км → {tarif_str} ₸/т")
    return 0

if __name__ == "__main__":
    sys.exit(main())
