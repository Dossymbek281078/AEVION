"""
Парсер СЦЭМ РК 8.04-11-2025 «Сметные цены на эксплуатацию строительных машин
и механизмов» (PDF, по регионам).

Структура: ru/{Регион}.pdf — для каждого региона свой файл (~147 стр).
Таблица 6 колонок:
  Код | Наименование | Сметная цена | Прямые затраты |
  ОТ машинистов | Перебазировка
Коды XXX-XXX-XXXX (как в ССЦ).
Базовая ставка — тенге за 1 маш.-ч.

Чтобы не раздувать корпус, парсим только ru/город Алматы.pdf — этого
достаточно для учебного режима (Алматы = базовый регион курса).
По мере необходимости добавим другие регионы.

Выход: frontend/public/normatives/szem-2025-almaty.json
"""
from __future__ import annotations
import json, re, sys
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
SRC_CANDIDATES = [
    Path(r"C:\tmp\szem")
        / "СЦЭМ РК 8.04-11-2025 Сметные цены на эксплуатацию строительных машин и механизмов"
        / "ru" / "город Алматы.pdf",
    ROOT / "raw-corpus" / "ksm-source"
        / "СЦЭМ РК 8.04-11-2025 Сметные цены на эксплуатацию строительных машин и механизмов"
        / "СЦЭМ РК 8.04-11-2025 Сметные цены на эксплуатацию строительных машин и механизмов"
        / "ru" / "город Алматы.pdf",
]
OUT = ROOT / "frontend" / "public" / "normatives" / "szem-2025-almaty.json"

CODE_RE = re.compile(r"^\d{3}-\d{3}-\d{4}$")

def _num(s: str | None) -> int | None:
    if not s: return None
    s = s.replace("\xa0", "").replace(" ", "").replace(",", ".").strip()
    if not s: return None
    try: return int(round(float(s)))
    except ValueError: return None

def parse_pdf(path: Path) -> dict:
    rows: list[dict] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for tbl in page.extract_tables() or []:
                if not tbl or len(tbl) < 2: continue
                # шапка с "Код"
                hdr = [(c or "").strip() for c in tbl[0]]
                if not hdr or hdr[0].lower() != "код": continue
                for raw in tbl[1:]:
                    if not raw or len(raw) < 3: continue
                    code = (raw[0] or "").strip()
                    if not CODE_RE.match(code): continue
                    name = (raw[1] or "").strip().replace("\n", " ")
                    smetnaya = _num(raw[2]) if len(raw) > 2 else None
                    direct = _num(raw[3]) if len(raw) > 3 else None
                    operator_wage = _num(raw[4]) if len(raw) > 4 else None
                    relocation = _num(raw[5]) if len(raw) > 5 else None
                    is_group = code.endswith("00") and smetnaya is None
                    rec: dict = {"code": code, "name": name}
                    if is_group:
                        rec["isGroup"] = True
                    else:
                        if smetnaya is not None: rec["smetnaya"] = smetnaya
                        if direct is not None: rec["directCosts"] = direct
                        if operator_wage is not None: rec["operatorWage"] = operator_wage
                        if relocation is not None: rec["relocation"] = relocation
                    rows.append(rec)
    return {
        "version": "СЦЭМ РК 8.04-11-2025",
        "title": "Сметные цены на эксплуатацию строительных машин и механизмов",
        "region": "город Алматы",
        "regionSlug": "almaty",
        "approvedBy": "Приказ Комитета по делам строительства МПС РК № 94-НҚ от 18.06.2025",
        "effectiveFrom": "2025-07-01",
        "supersedes": "СЦЭМ РК 8.04-11-2024",
        "unit": "тенге/маш.-ч",
        "source": str(path.name),
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
    machines = sum(1 for r in data["rows"] if not r.get("isGroup"))
    print(f"==> rows={len(data['rows'])} machines={machines}")
    print(f"    written: {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")
    if data["rows"]:
        print("\n  sample:")
        for r in data["rows"][:8]:
            if r.get("isGroup"):
                print(f"    [G] {r['code']}  {r['name'][:60]}")
            else:
                print(f"        {r['code']}  {r['name'][:50]:<50} {r.get('smetnaya','—'):>8} ₸/маш.-ч")
    return 0

if __name__ == "__main__":
    sys.exit(main())
