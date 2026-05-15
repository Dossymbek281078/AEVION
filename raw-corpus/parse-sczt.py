"""
Парсер СЦЗТ РК 8.04-13-2025 «Сметные цены на затраты труда в строительстве» (PDF, 187 стр).

Структура документа:
- Заголовок региона: «01.00 город Астана, город Косшы», «02.00 город Алматы», ...
- Заголовок группы работ: «Группа - 001. Работы по разработке грунта...»
- Под группой — таблица 8 колонок: 2 пары (Код | Разряд | СЦЗТ | СТС)
  Коды XXX-YYYY: XXX = группа, YYYY = строка-разряд (0110 = разряд 1.0, 0150 = 5.0)
- Тарифы в тенге/чел.-ч, уровень цен — июнь 2025

Выход: frontend/public/normatives/sczt-2025.json
{
  "version": "СЦЗТ РК 8.04-13-2025",
  "regions": [{code, name}],
  "groups": [{code, name}],
  "rates": [{regionCode, groupCode, rank, sczt, sts}]   ← все ставки
}
"""
from __future__ import annotations
import json, re, sys
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
SRC_CANDIDATES = [
    Path(r"C:\tmp\sczt") / "СЦЗТ РК 8.04-13-2025 Сметные цены на затраты труда в строительстве"
        / "СЦЗТ РК 8.04-13-2025 Сметные цены на затраты труда в строительстве.pdf",
    ROOT / "raw-corpus" / "ksm-source"
        / "СЦЗТ РК 8.04-13-2025 Сметные цены на затраты труда в строительстве"
        / "СЦЗТ РК 8.04-13-2025 Сметные цены на затраты труда в строительстве"
        / "СЦЗТ РК 8.04-13-2025 Сметные цены на затраты труда в строительстве.pdf",
]
OUT = ROOT / "frontend" / "public" / "normatives" / "sczt-2025.json"

REGION_RE = re.compile(r"^(\d{2}\.\d{2})\s+(.+)$")
GROUP_RE = re.compile(r"^Группа\s*[-–—]?\s*(\d{3})\.?\s*(.+?)$")
CODE_RE = re.compile(r"^\d{3}-\d{4}$")

def _num(s: str | None) -> int | None:
    if not s: return None
    s = s.replace("\xa0", "").replace(" ", "").replace(",", ".").strip()
    if not s: return None
    try: return int(round(float(s)))
    except ValueError: return None

def _rank(s: str | None) -> float | None:
    if not s: return None
    s = s.replace(",", ".").strip()
    try: return float(s)
    except ValueError: return None

def parse_pdf(path: Path) -> dict:
    regions: list[dict] = []
    region_index: dict[str, dict] = {}
    groups: list[dict] = []
    group_index: dict[str, dict] = {}
    rates: list[dict] = []

    cur_region_code: str | None = None
    cur_group_code: str | None = None

    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            # Обновляем region/group из текста страницы (они идут на одной странице с таблицей)
            for line in text.split("\n"):
                line = line.strip()
                if not line: continue
                rm = REGION_RE.match(line)
                if rm:
                    code = rm.group(1).split(".")[0]
                    # чистим хвост вида " ... 3" / "... 11" — это TOC-страничные номера
                    name = re.sub(r"\s+\d+\s*$", "", rm.group(2)).strip()
                    if code not in region_index:
                        rec = {"code": code, "name": name}
                        regions.append(rec)
                        region_index[code] = rec
                    cur_region_code = code
                    continue
                gm = GROUP_RE.match(line)
                if gm:
                    code = gm.group(1)
                    name = gm.group(2).strip()
                    if code not in group_index:
                        rec = {"code": code, "name": name}
                        groups.append(rec)
                        group_index[code] = rec
                    cur_group_code = code
                    continue

            # Извлекаем таблицы расценок
            for tbl in page.extract_tables() or []:
                if not tbl: continue
                for row in tbl:
                    if not row or len(row) < 4: continue
                    # Левая половина: cols 0..3 (Код | Разряд | СЦЗТ | СТС)
                    # Правая половина: cols 4..7
                    for offset in (0, 4):
                        if len(row) <= offset + 3: continue
                        code = (row[offset] or "").strip()
                        if not CODE_RE.match(code): continue
                        rank = _rank(row[offset + 1])
                        sczt = _num(row[offset + 2])
                        sts = _num(row[offset + 3])
                        if rank is None or sczt is None: continue
                        # Группа из кода как fallback
                        group_code = code.split("-")[0]
                        rates.append({
                            "regionCode": cur_region_code or "01",
                            "groupCode": group_code,
                            "rank": rank,
                            "sczt": sczt,
                            "sts": sts,
                        })

    return {
        "version": "СЦЗТ РК 8.04-13-2025",
        "title": "Сметные цены на затраты труда в строительстве",
        "approvedBy": "Приказ Комитета по делам строительства МПС РК № 94-НҚ от 18.06.2025",
        "effectiveFrom": "2025-07-01",
        "supersedes": "СЦЗТ РК 8.04-13-2024",
        "priceLevel": "июнь 2025 года",
        "source": str(path.name),
        "regions": regions,
        "groups": groups,
        "rates": rates,
    }

def main() -> int:
    src = next((p for p in SRC_CANDIDATES if p.exists()), None)
    if not src:
        print(f"PDF not found in any candidate: {SRC_CANDIDATES}", file=sys.stderr)
        return 2
    print(f"==> parsing {src.name}")
    data = parse_pdf(src)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    print(f"==> regions={len(data['regions'])} groups={len(data['groups'])} rates={len(data['rates'])}")
    print(f"    written: {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")
    if data["regions"]:
        print("\n  regions sample:")
        for r in data["regions"][:6]:
            print(f"    {r['code']}  {r['name']}")
    if data["groups"]:
        print("\n  groups sample:")
        for g in data["groups"][:8]:
            print(f"    {g['code']}  {g['name'][:60]}")
    if data["rates"]:
        # Sample: Алматы (02) группа 001 разряд 4
        sample = [r for r in data["rates"] if r["regionCode"] == "02" and r["groupCode"] == "001" and r["rank"] == 4]
        if sample:
            print(f"\n  Алматы / земляные работы / разряд 4: СЦЗТ={sample[0]['sczt']} СТС={sample[0]['sts']} тенге/чел.-ч")
    return 0

if __name__ == "__main__":
    sys.exit(main())
