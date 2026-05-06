"""
Автозагрузка нормативных сборников РК с new-shop.ksm.kz.

Источник: https://new-shop.ksm.kz/egfntd/ntdgo/kds/7.php
- Свободный доступ, прямые ссылки на .rar / .zip
- API/RSS нет, только статический HTML — поэтому скрейп
- Обновления привязаны к приказам Комитета по делам строительства МПС РК
  (нерегулярные, но не реже квартала)

Логика:
1. Скачать каталожную страницу
2. Извлечь все .rar/.zip-ссылки на нормативные сборники
3. Сравнить с raw-corpus/ksm-state.json (URL → размер + hash)
4. Скачать новое/обновлённое
5. Распаковать .rar → raw-corpus/ksm-source/
6. Запустить парсер для ССЦ → raw-corpus/parsed/
7. Скопировать parsed/*.json → frontend/public/ssc/
8. Обновить ksm-state.json

Запускается:
- вручную: `python -X utf8 raw-corpus/fetch-ksm.py`
- через GitHub Action (.github/workflows/update-ksm.yml) — раз в неделю
"""
from __future__ import annotations
import hashlib, json, os, re, shutil, subprocess, sys, time
from pathlib import Path
from urllib.parse import quote, unquote, urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
CATALOG_URL = "https://new-shop.ksm.kz/egfntd/ntdgo/kds/7.php"
STATE_FILE = ROOT / "ksm-state.json"
DOWNLOAD_DIR = ROOT / "ksm-downloads"
SOURCE_DIR = ROOT / "ksm-source"
PARSED_DIR = ROOT / "parsed"
PUBLIC_SSC = ROOT.parent / "frontend" / "public" / "ssc"
PARSE_SCRIPT = ROOT / "parse-ssc.py"
UNRAR = r"C:\Program Files\WinRAR\UnRAR.exe"  # Windows fallback
USER_AGENT = "Mozilla/5.0 (compatible; aevion-smeta-trainer/1.0)"

# фильтр: какие документы скачиваем (префиксы по имени файла)
WANTED_PREFIXES = (
    "ССЦ РК 8.04-08",   # сметные цены на материалы
    "ССЦ РК 8.04-09",   # сметные цены на инженерное оборудование
    "СЦЭМ РК 8.04-11",  # сметные цены на эксплуатацию строительных машин
    "СЦПГ РК 8.04-12",  # сметные цены на перевозки грузов
    "СЦЗТ РК 8.04-13",  # сметные цены на затраты труда
    "НДЦС РК 8.04-03",  # единичные сметные цены на СМР
    "НДЦС РК 8.04-07",  # индексы стоимости
    "ЭСН РК",           # элементные сметные нормы (любой год)
    "ЕСЦ РК",           # единичные сметные цены
)

# ---- HTTP --------------------------------------------------------------------

def safe_url(url: str) -> str:
    """urllib не URL-encode'ит кириллицу автоматически и падает с
    UnicodeEncodeError. Прогоняем path через quote(), сохраняя уже
    закодированные %XX (safe='%/...')."""
    parts = urlsplit(url)
    path = quote(parts.path, safe="/%")
    return urlunsplit((parts.scheme, parts.netloc, path, parts.query, parts.fragment))

def http_get(url: str, dest: Path | None = None) -> bytes | None:
    req = Request(safe_url(url), headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=300) as r:
        if dest is None:
            return r.read()
        dest.parent.mkdir(parents=True, exist_ok=True)
        with open(dest, "wb") as f:
            shutil.copyfileobj(r, f)
        return None

def http_head_size(url: str) -> int | None:
    """HEAD-запрос для получения размера без скачивания."""
    req = Request(safe_url(url), headers={"User-Agent": USER_AGENT}, method="HEAD")
    try:
        with urlopen(req, timeout=30) as r:
            cl = r.headers.get("Content-Length")
            return int(cl) if cl else None
    except Exception as e:
        print(f"  HEAD failed for {url}: {e}", file=sys.stderr)
        return None

# ---- catalog parsing ---------------------------------------------------------

def parse_catalog(html: str) -> list[dict]:
    """Извлечь ссылки на сборники из HTML каталога."""
    items = []
    # match href="..." или href='...' — оба формата
    for m in re.finditer(r"""href=["']([^"']+\.(?:rar|zip|pdf))["']""", html, re.I):
        href = m.group(1)
        url = urljoin(CATALOG_URL, href)
        # имя файла — последний сегмент пути, URL-decoded
        fname = unquote(href.rsplit("/", 1)[-1])
        if not any(fname.startswith(p) for p in WANTED_PREFIXES):
            continue
        items.append({"url": url, "filename": fname})
    # дедуп по URL
    seen = set()
    out = []
    for it in items:
        if it["url"] in seen:
            continue
        seen.add(it["url"])
        out.append(it)
    return out

# ---- state -------------------------------------------------------------------

def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {"items": {}}

def save_state(state: dict) -> None:
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2),
                          encoding="utf-8")

def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()

# ---- unrar / unzip ----------------------------------------------------------

def extract(archive: Path, dest: Path) -> bool:
    dest.mkdir(parents=True, exist_ok=True)
    suffix = archive.suffix.lower()
    if suffix == ".zip":
        import zipfile
        with zipfile.ZipFile(archive) as z:
            z.extractall(dest)
        return True
    if suffix == ".rar":
        # пробуем unrar (linux/CI), потом WinRAR (локально).
        # capture_output без text — WinRAR на Windows выводит cp866, не utf-8.
        for tool in ["unrar", UNRAR]:
            try:
                r = subprocess.run([tool, "x", "-o+", "-y", str(archive), str(dest) + os.sep],
                                   capture_output=True, timeout=900)
                if r.returncode == 0:
                    return True
                err = (r.stderr or b"").decode("cp866", errors="replace")[:300]
                print(f"  {tool} failed (rc={r.returncode}): {err}", file=sys.stderr)
            except FileNotFoundError:
                continue
            except Exception as e:
                print(f"  {tool} exception: {e}", file=sys.stderr)
                continue
        print(f"  no working unrar tool for {archive}", file=sys.stderr)
        return False
    if suffix == ".pdf":
        # просто кладём как есть
        shutil.copy(archive, dest / archive.name)
        return True
    return False

# ---- main --------------------------------------------------------------------

def main(force: bool = False) -> int:
    print(f"==> fetching catalog: {CATALOG_URL}")
    html = http_get(CATALOG_URL).decode("utf-8", errors="replace")
    items = parse_catalog(html)
    print(f"    found {len(items)} matching documents")
    state = load_state()

    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)

    changed = []
    for it in items:
        url = it["url"]
        fname = it["filename"]
        prev = state["items"].get(url, {})
        size = http_head_size(url)
        if not force and prev.get("size") == size and (DOWNLOAD_DIR / fname).exists():
            continue  # без изменений
        print(f"==> downloading {fname} ({size or '?'} bytes)")
        dest = DOWNLOAD_DIR / fname
        try:
            http_get(url, dest)
        except Exception as e:
            print(f"  ERR download: {e}", file=sys.stderr)
            continue
        sha = file_sha256(dest)
        if prev.get("sha256") == sha:
            state["items"][url] = {"filename": fname, "size": size, "sha256": sha,
                                   "checked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
            continue
        # распаковка
        sub = SOURCE_DIR / fname.rsplit(".", 1)[0]
        if sub.exists():
            shutil.rmtree(sub, ignore_errors=True)
        ok = extract(dest, sub)
        if not ok:
            print(f"  ERR extract failed: {fname}", file=sys.stderr)
            continue
        state["items"][url] = {"filename": fname, "size": size, "sha256": sha,
                               "extracted": True,
                               "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        changed.append(fname)

    save_state(state)
    if not changed:
        print("==> no changes")
        return 0

    print(f"==> {len(changed)} archives updated, re-running parser")
    # перезапускаем существующий парсер ССЦ; он сам найдёт docx в SSC_DIR.
    # parse-ssc.py ищет в raw-corpus/ssc-rk-2025/ — для совместимости создаём симлинк
    # или копируем извлечённые docx туда.
    legacy_dir = ROOT / "ssc-rk-2025" / "ССЦ РК 8.04-08-2025 Сметные цены на строительные материалы"
    legacy_dir.mkdir(parents=True, exist_ok=True)
    for sub in SOURCE_DIR.iterdir():
        if not sub.is_dir():
            continue
        # внутри может быть вложенная папка с docx
        for docx in sub.rglob("*.docx"):
            target = legacy_dir / docx.name
            if not target.exists() or target.stat().st_mtime < docx.stat().st_mtime:
                shutil.copy2(docx, target)
    rc = subprocess.run([sys.executable, "-X", "utf8", str(PARSE_SCRIPT)],
                        cwd=str(ROOT)).returncode
    if rc != 0:
        print("  parser failed", file=sys.stderr)
        return rc

    print("==> copying parsed JSON to frontend/public/ssc/")
    PUBLIC_SSC.mkdir(parents=True, exist_ok=True)
    for j in PARSED_DIR.glob("*.json"):
        shutil.copy2(j, PUBLIC_SSC / j.name)
    print(f"    copied {len(list(PARSED_DIR.glob('*.json')))} files")
    print(f"==> done. Updated: {', '.join(changed[:5])}{'…' if len(changed) > 5 else ''}")
    return 0

if __name__ == "__main__":
    force = "--force" in sys.argv
    sys.exit(main(force=force))
