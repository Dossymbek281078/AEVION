"""
Парсер СЦЭМ РК 8.04-11-2025 «Сметные цены на эксплуатацию строительных машин
и механизмов» — все 20 региональных PDF.

Структура каждого файла:
  Код (XXX-XXX-XXXX) | Наименование | Сметная цена | Прямые затраты |
  ОТ машинистов | Перебазировка
В тенге за 1 маш.-ч.

Выход:
  frontend/public/normatives/szem-2025-{regionSlug}.json — на регион
  frontend/public/normatives/szem-2025-index.json — карта регион → метаданные
"""
from __future__ import annotations
import json, re, sys
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
SRC_DIRS = [
    Path(r"C:\tmp\szem")
        / "СЦЭМ РК 8.04-11-2025 Сметные цены на эксплуатацию строительных машин и механизмов"
        / "ru",
    ROOT / "raw-corpus" / "ksm-source"
        / "СЦЭМ РК 8.04-11-2025 Сметные цены на эксплуатацию строительных машин и механизмов"
        / "СЦЭМ РК 8.04-11-2025 Сметные цены на эксплуатацию строительных машин и механизмов"
        / "ru",
]
OUT_DIR = ROOT / "frontend" / "public" / "normatives"

# Соответствие имени файла → slug (совпадает с REGIONS slug в lib/ssc.ts)
REGION_SLUGS = {
    "город Астана": "astana",
    "город Алматы": "almaty",
    "город Шымкент": "shymkent",
    "Алматинская область": "almaty-obl",
    "Акмолинская область": "akmola",
    "Актюбинская область": "aktobe",
    "Атырауская область": "atyrau",
    "Восточно-казахстанская область": "vko",
    "Жамбылская область": "zhambyl",
    "Западно-казахстанская область": "zko",
    "Карагандинская область": "karaganda",
    "Костанайская область": "kostanay",
    "Кызылординская область": "kyzylorda",
    "Мангистауская область": "mangystau",
    "Павлодарская область": "pavlodar",
    "Северо-казахстанская область": "sko",
    "Туркестанская область": "turkestan",
    "область Абай": "abay",
    "область Жетiсу": "zhetysu",
    "область Жетісу": "zhetysu",
    "область Ұлытау": "ulytau",
}

CODE_RE = re.compile(r"^\d{3}-\d{3}-\d{4}$")

def _num(s):
    if not s: return None
    s = s.replace("\xa0", "").replace(" ", "").replace(",", ".").strip()
    if not s: return None
    try: return int(round(float(s)))
    except ValueError: return None

def parse_pdf(path):
    rows = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for tbl in page.extract_tables() or []:
                if not tbl or len(tbl) < 2: continue
                hdr = [(c or "").strip() for c in tbl[0]]
                if not hdr or hdr[0].lower() != "код": continue
                for raw in tbl[1:]:
                    if not raw or len(raw) < 3: continue
                    code = (raw[0] or "").strip()
                    if not CODE_RE.match(code): continue
                    name = (raw[1] or "").strip().replace("\n", " ")
                    smetnaya = _num(raw[2]) if len(raw) > 2 else None
                    direct = _num(raw[3]) if len(raw) > 3 else None
                    op_wage = _num(raw[4]) if len(raw) > 4 else None
                    reloc = _num(raw[5]) if len(raw) > 5 else None
                    is_group = code.endswith("00") and smetnaya is None
                    rec = {"code": code, "name": name}
                    if is_group:
                        rec["isGroup"] = True
                    else:
                        if smetnaya is not None: rec["smetnaya"] = smetnaya
                        if direct is not None: rec["directCosts"] = direct
                        if op_wage is not None: rec["operatorWage"] = op_wage
                        if reloc is not None: rec["relocation"] = reloc
                    rows.append(rec)
    return rows

def main():
    src_dir = next((d for d in SRC_DIRS if d.exists()), None)
    if not src_dir:
        print(f"СЦЭМ source dir not found in candidates: {SRC_DIRS}", file=sys.stderr)
        return 2

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    pdfs = sorted(src_dir.glob("*.pdf"))
    print(f"==> found {len(pdfs)} PDFs in {src_dir.name}")

    index = []
    for p in pdfs:
        region_name = p.stem
        slug = REGION_SLUGS.get(region_name)
        if not slug:
            print(f"  SKIP {region_name}: no slug mapping", file=sys.stderr)
            continue
        out_file = OUT_DIR / f"szem-2025-{slug}.json"
        try:
            rows = parse_pdf(p)
        except Exception as e:
            print(f"  ERR {region_name}: {e}", file=sys.stderr)
            continue
        machines = sum(1 for r in rows if not r.get("isGroup"))
        payload = {
            "version": "СЦЭМ РК 8.04-11-2025",
            "title": "Сметные цены на эксплуатацию строительных машин и механизмов",
            "region": region_name,
            "regionSlug": slug,
            "approvedBy": "Приказ Комитета по делам строительства МПС РК № 94-НҚ от 18.06.2025",
            "effectiveFrom": "2025-07-01",
            "supersedes": "СЦЭМ РК 8.04-11-2024",
            "unit": "тенге/маш.-ч",
            "source": p.name,
            "rows": rows,
        }
        out_file.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        index.append({
            "slug": slug,
            "region": region_name,
            "rows": len(rows),
            "machines": machines,
            "size_kb": out_file.stat().st_size // 1024,
        })
        print(f"  {slug:<12} {region_name:<30} {machines:>4} machines, {out_file.stat().st_size // 1024} KB")

    idx_file = OUT_DIR / "szem-2025-index.json"
    idx_file.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    total_m = sum(i["machines"] for i in index)
    total_kb = sum(i["size_kb"] for i in index)
    print(f"\nDONE. {len(index)} regions, {total_m} machines, {total_kb} KB total")
    return 0

if __name__ == "__main__":
    sys.exit(main())
