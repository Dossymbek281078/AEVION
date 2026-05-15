"""
Парсер ССЦ РК PDF-сборников (для тех, что распространяются как PDF, а не DOCX).

Применяется к:
- ССЦ РК 8.04-09-2025 «Сметные цены на инженерное оборудование» (Кн. 51,
  424 страницы) — насосы, электрооборудование, котлы, баки и т.д.
- ССЦ РК 8.04-08-2025 Общие положения (методика применения)

Структура таблицы как в DOCX-сборниках:
Код | Наименование | Ед.изм. | Класс груза | Масса брутто, кг |
Отпускная цена, тенге | Сметная цена, тенге

Выход: тот же формат что у parse-ssc.py:
  frontend/public/ssc/ssc-2025-{slug}.json + дописывает в ssc-2025-index.json
"""
from __future__ import annotations
import json, re, sys
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_SSC = ROOT / "frontend" / "public" / "ssc"

CODE_RE = re.compile(r"^\d{3}-\d{3}-\d{4}$")

def _norm_int(s: str | None) -> int | None:
    if not s: return None
    s = s.replace("\xa0", "").replace(" ", "").replace(",", ".").strip()
    if not s: return None
    try: return int(round(float(s)))
    except ValueError: return None

def parse_pdf_table(path: Path) -> list[dict]:
    rows: list[dict] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables() or []:
                if not table or len(table) < 2:
                    continue
                # шапка: первая ячейка "Код"
                header = [(c or "").strip() for c in table[0]]
                if header[0].lower() != "код":
                    continue
                # схема — 7 колонок (как в общих ССЦ DOCX)
                for raw in table[1:]:
                    if not raw or len(raw) < 3:
                        continue
                    code = (raw[0] or "").strip()
                    if not CODE_RE.match(code):
                        continue
                    name = (raw[1] or "").strip().replace("\n", " ")
                    unit = (raw[2] or "").strip()
                    cargo = (raw[3] or "").strip() if len(raw) > 3 else ""
                    gross = _norm_int(raw[4]) if len(raw) > 4 else None
                    otp   = _norm_int(raw[5]) if len(raw) > 5 else None
                    sm    = _norm_int(raw[6]) if len(raw) > 6 else None
                    is_group = code.endswith("00") and sm is None and otp is None
                    rec: dict = {"code": code, "name": name, "unit": unit}
                    if is_group:
                        rec["isGroup"] = True
                    else:
                        if cargo: rec["cargoClass"] = cargo
                        if gross is not None: rec["grossKg"] = gross
                        if otp is not None: rec["otpusknaya"] = otp
                        if sm is not None: rec["smetnaya"] = sm
                    rows.append(rec)
    return rows

def write_book(slug: str, src_path: Path, region: str | None,
               region_slug: str, book: str | None, kind: str = "rates") -> tuple[int, int]:
    rows = parse_pdf_table(src_path)
    payload = {
        "source": "ССЦ РК 8.04-09-2025" if "8.04-09" in str(src_path) else "ССЦ РК 8.04-08-2025",
        "file": src_path.name,
        "region": region,
        "region_slug": region_slug,
        "book": book,
        "issue": None,
        "kind": kind,
        "rows": rows,
    }
    out = PUBLIC_SSC / f"{slug}.json"
    out.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    non_group = sum(1 for r in rows if not r.get("isGroup"))
    return len(rows), non_group

def main() -> int:
    targets = [
        # ССЦ-09 Кн.51 — инженерное оборудование (общие книги)
        {
            "src": ROOT / "raw-corpus" / "ksm-source"
                / "ССЦ РК 8.04-09-2025 Инженерное оборудование"
                / "ССЦ РК 8.04-09-2025 Инженерное оборудование"
                / "ru" / "Книга 51 Инженерное оборудование рус.pdf",
            "slug": "ssc-2025-09-common-book51",
            "region": None,
            "region_slug": "common",
            "book": "51",
        },
    ]
    total_rows = 0
    total_mats = 0
    updates = []
    for t in targets:
        if not t["src"].exists():
            print(f"SKIP {t['slug']}: not found ({t['src']})", file=sys.stderr)
            continue
        print(f"==> parsing {t['src'].name}")
        n, m = write_book(t["slug"], t["src"], t["region"], t["region_slug"], t["book"])
        print(f"    {t['slug']}: {n} rows ({m} materials)")
        total_rows += n
        total_mats += m
        updates.append({**t, "rows": n, "materials": m})

    # Дописываем в ssc-2025-index.json
    idx_path = PUBLIC_SSC / "ssc-2025-index.json"
    if idx_path.exists():
        idx = json.loads(idx_path.read_text(encoding="utf-8"))
        existing = {i["slug"] for i in idx}
        for u in updates:
            if u["slug"] in existing:
                continue
            idx.append({
                "slug": u["slug"],
                "file": u["src"].name,
                "region": u["region"],
                "region_slug": u["region_slug"],
                "book": u["book"],
                "issue": None,
                "kind": "rates",
                "rows": u["rows"],
                "materials": u["materials"],
                "size_bytes": (PUBLIC_SSC / f"{u['slug']}.json").stat().st_size,
            })
        idx_path.write_text(json.dumps(idx, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"    updated index: {len(idx)} entries")
    print(f"\nDONE. {total_rows} rows, {total_mats} materials.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
