"""
Парсер ССЦ РК 8.04-08-2025 (Сметные цены на строительные материалы).

Источник: docx-сборники в raw-corpus/ssc-rk-2025/.
Выход: parsed/ssc-2025-{slug}.json + parsed/ssc-2025-index.json.

Структура книг:
- Региональные (Алматы, Астана, ... + Книги 1, 7): 6 колонок
  Код | Наименование | Ед.изм. | Класс груза | Масса брутто, кг |
  ячейка с двумя строками "сметная || отпускная" под общей шапкой
  "Сметная цена / Отпускная цена, тенге"
- Общие (Книги 2, 3, 4, 5.1-5.4, 6): 7 колонок
  Код | Наименование | Ед.изм. | Класс груза | Масса брутто, кг |
  Отпускная цена, тенге | Сметная цена, тенге

Строка с кодом, оканчивающимся на "00" и без цены — заголовок группы.
"""
from __future__ import annotations
import json, os, re, sys, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

WNS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
SRC_DIR = Path(r"C:\Users\user\aevion-smeta-trainer\raw-corpus\ssc-rk-2025") \
    / "ССЦ РК 8.04-08-2025 Сметные цены на строительные материалы"
OUT_DIR = Path(r"C:\Users\user\aevion-smeta-trainer\raw-corpus\parsed")
OUT_DIR.mkdir(exist_ok=True)

CODE_RE = re.compile(r"^\d{3}-\d{3}-\d{4}$")
PRICE_RE = re.compile(r"^[\d\s,.]+$")

# ---- region/book detection ---------------------------------------------------

REGION_MAP = {
    "Акмолинская область": "akmola",
    "Актюбинская область": "aktobe",
    "Алматинская область": "almaty-obl",
    "Атырауская область": "atyrau",
    "Восточно-Казахстанская область": "vko",
    "Город Алматы": "almaty",
    "Город Астана, город Косшы": "astana",
    "Город Астана, Город Косшы": "astana",
    "Город Шымкент": "shymkent",
    "Жамбылская область": "zhambyl",
    "Западно-Казахстанская область": "zko",
    "Карагандинская область": "karaganda",
    "Костанайская область": "kostanay",
    "Кызылординская область": "kyzylorda",
    "Мангистауская область": "mangystau",
    "Область Абай": "abay",
    "Область Жетісу": "zhetysu",
    "Область Ұлытау": "ulytau",
    "Павлодарская область": "pavlodar",
    "Северо-Казахстанская область": "sko",
    "Туркестанская область": "turkestan",
}

def parse_filename(name: str) -> dict:
    """Извлечь регион и номер книги/выпуска из имени файла."""
    base = name.replace(".docx", "")
    info = {"file": name, "region": None, "region_slug": "common",
            "book": None, "issue": None, "kind": "rates"}
    if "Общие положения" in base:
        info["kind"] = "general"
        return info
    m = re.search(r"Книга\s+(\d+(?:\.\d+)?)\.\s*Выпуск\s+(\d+)", base)
    if m:
        info["book"], info["issue"] = m.group(1), int(m.group(2))
    else:
        m = re.search(r"Книга\s+(\d+(?:\.\d+)?)", base)
        if m:
            info["book"] = m.group(1)
    # книги типа "Книги 2, 3, 6. Выпуск 3" — сводный том
    m2 = re.search(r"Книги\s+([\d,\s]+)\.\s*Выпуск\s+(\d+)", base)
    if m2:
        info["book"] = "combo-" + m2.group(1).replace(" ", "")
        info["issue"] = int(m2.group(2))
    # Win-truncated names: "...Книга 1. Выпу.docx" / "Выпус.docx" — подразумеваем выпуск 2
    if info["book"] and info["issue"] is None and re.search(r"Выпу(?:с(?:к)?)?\.?$", base):
        info["issue"] = 2
    for ru, slug in REGION_MAP.items():
        if ru in base:
            info["region"], info["region_slug"] = ru, slug
            break
    return info

def make_slug(info: dict) -> str:
    parts = ["ssc-2025", info["region_slug"]]
    if info["kind"] == "general":
        parts.append("general")
    if info["book"]:
        parts.append("book" + info["book"].replace(".", "-"))
    if info["issue"]:
        parts.append(f"v{info['issue']}")
    return "-".join(parts)

# ---- docx -> rows ------------------------------------------------------------

def cell_paragraphs(cell) -> list[str]:
    out = []
    for p in cell.iter(WNS + "p"):
        line = "".join((t.text or "") for t in p.iter(WNS + "t")).strip()
        if line:
            out.append(line)
    return out

def cell_text(cell) -> str:
    return " ".join(cell_paragraphs(cell))

def normalize_price(raw: str) -> int | None:
    """`'1 077'` → 1077; `'2,5'` → None (некорректно для целочисленной цены).
       Сохраняем целые тенге."""
    if not raw:
        return None
    s = raw.replace("\xa0", " ").replace(" ", "").replace(",", ".")
    if not s:
        return None
    try:
        f = float(s)
        return int(round(f))
    except ValueError:
        return None

def is_header_row(cells_text: list[str]) -> bool:
    if not cells_text:
        return False
    return cells_text[0].strip().lower() == "код"

def parse_table(tbl) -> list[dict]:
    """Парсит таблицу, возвращает список записей."""
    rows = tbl.findall(WNS + "tr")
    if not rows:
        return []
    # шапка
    schema = None  # "wide" (7 col) | "narrow" (6 col, prices stacked) | "general" (3 col, no prices)
    data_rows = []
    header_cells = None
    for r in rows:
        cells = r.findall(WNS + "tc")
        ct = [cell_text(c) for c in cells]
        if is_header_row(ct):
            header_cells = ct
            if len(cells) >= 7 and "Сметная" in (ct[6] if len(ct) > 6 else ""):
                schema = "wide"
            elif len(cells) >= 6 and ("Сметная" in ct[5] or "Отпускная" in ct[5]):
                schema = "narrow"
            elif len(cells) >= 3:
                schema = "general"
            continue
        data_rows.append(cells)
    if schema is None:
        return []
    out = []
    for cells in data_rows:
        if not cells:
            continue
        code = cell_text(cells[0]).strip()
        if not CODE_RE.match(code):
            continue
        name = cell_text(cells[1]).strip() if len(cells) > 1 else ""
        unit = cell_text(cells[2]).strip() if len(cells) > 2 else ""
        rec = {"code": code, "name": name, "unit": unit}
        if schema in ("wide", "narrow"):
            rec["cargoClass"] = cell_text(cells[3]).strip() if len(cells) > 3 else ""
            rec["grossKg"] = normalize_price(cell_text(cells[4])) if len(cells) > 4 else None
        if schema == "wide":
            rec["otpusknaya"] = normalize_price(cell_text(cells[5])) if len(cells) > 5 else None
            rec["smetnaya"] = normalize_price(cell_text(cells[6])) if len(cells) > 6 else None
        elif schema == "narrow":
            paras = cell_paragraphs(cells[5]) if len(cells) > 5 else []
            # формат: первая строка — сметная, вторая — отпускная (по шапке "Сметная / Отпускная")
            rec["smetnaya"] = normalize_price(paras[0]) if len(paras) > 0 else None
            rec["otpusknaya"] = normalize_price(paras[1]) if len(paras) > 1 else None
        # group-row marker — код заканчивается на "00" и нет цены
        is_group = code.endswith("00") and rec.get("smetnaya") is None and rec.get("otpusknaya") is None
        if is_group:
            rec["isGroup"] = True
            # для групп удаляем пустые поля цены/массы
            for k in ("cargoClass", "grossKg", "smetnaya", "otpusknaya"):
                rec.pop(k, None)
        out.append(rec)
    return out

def parse_docx(path: Path) -> list[dict]:
    with zipfile.ZipFile(path) as z:
        xml_bytes = z.read("word/document.xml")
    root = ET.fromstring(xml_bytes)
    rows = []
    for tbl in root.iter(WNS + "tbl"):
        rows.extend(parse_table(tbl))
    return rows

# ---- main --------------------------------------------------------------------

def main() -> None:
    files = sorted(SRC_DIR.glob("*.docx"))
    if not files:
        print("no docx in", SRC_DIR, file=sys.stderr)
        sys.exit(1)
    index = []
    for f in files:
        info = parse_filename(f.name)
        slug = make_slug(info)
        try:
            rows = parse_docx(f)
        except Exception as e:
            print(f"  ERR {f.name}: {e}", file=sys.stderr)
            continue
        out_path = OUT_DIR / (slug + ".json")
        payload = {
            "source": "ССЦ РК 8.04-08-2025",
            "file": f.name,
            "region": info["region"],
            "region_slug": info["region_slug"],
            "book": info["book"],
            "issue": info["issue"],
            "kind": info["kind"],
            "rows": rows,
        }
        out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        non_group = sum(1 for r in rows if not r.get("isGroup"))
        index.append({
            "slug": slug,
            "file": f.name,
            "region": info["region"],
            "region_slug": info["region_slug"],
            "book": info["book"],
            "issue": info["issue"],
            "kind": info["kind"],
            "rows": len(rows),
            "materials": non_group,
            "size_bytes": out_path.stat().st_size,
        })
        print(f"  {slug}: {len(rows)} rows ({non_group} materials)")
    (OUT_DIR / "ssc-2025-index.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    total_rows = sum(i["rows"] for i in index)
    total_mats = sum(i["materials"] for i in index)
    print(f"\nDONE. {len(index)} files, {total_rows} rows, {total_mats} materials.")

if __name__ == "__main__":
    main()
