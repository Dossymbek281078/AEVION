/**
 * Картинки, которых нет в проекте, — заглушка вместо alt-текста.
 *
 * 4.11.2026, замер Ниш на проде (гость): модель пишет в index.html
 * `<img src="hero.jpg" alt="Фото салона…">`, файла hero.jpg в проекте нет, и
 * браузер рисует alt-текст крупно поверх заголовка. Сгенерированные файлы
 * проходят здесь до сохранения: у <img> с относительным src, которого нет
 * среди файлов проекта (ни существующих, ни только что созданных), src
 * заменяется на встроенный SVG-градиент. alt остаётся — для чтения с экрана.
 *
 * Не трогаем: абсолютные адреса (http/https/data/blob/protocol-relative),
 * srcset и CSS-фоны. Без побочных эффектов, чистая функция — тест рядом
 * (tests/devhubMissingImages.test.ts).
 */

export type ФайлПроекта = { path: string; content: string };

/** Нейтральная заглушка 1600×900: мягкий градиент, без текста. */
export const ЗАГЛУШКА_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#e2e8f0"/><stop offset="1" stop-color="#cbd5e1"/></linearGradient></defs>' +
      '<rect width="1600" height="900" fill="url(#g)"/></svg>',
  );

const ВНЕШНИЙ = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

/** Приводит относительный src к пути внутри проекта (без ./, ведущего / и query). */
export function нормализоватьПуть(src: string, изФайла: string): string {
  const безХвоста = src.split(/[?#]/)[0].trim();
  const безПрефикса = безХвоста.replace(/^\.\//, "").replace(/^\/+/, "");
  if (безХвоста.startsWith("/") || безХвоста.startsWith("./") || !безХвоста.includes("/")) {
    // корень проекта или тот же каталог, что и html
    const каталог = изФайла.includes("/") ? изФайла.slice(0, izFolderEnd(изФайла)) : "";
    if (безХвоста.startsWith("/")) return безПрефикса;
    return каталог ? `${каталог}/${безПрефикса}` : безПрефикса;
  }
  const каталог = изФайла.includes("/") ? изФайла.slice(0, izFolderEnd(изФайла)) : "";
  return каталог ? `${каталог}/${безПрефикса}` : безПрефикса;
}

function izFolderEnd(p: string): number {
  return p.lastIndexOf("/");
}

/** Есть ли файл по пути — с поправкой на `public/` (статика Next/Vite лежит там, а src её не называет). */
function файлЕсть(путь: string, все: Set<string>): boolean {
  if (все.has(путь)) return true;
  if (все.has(`public/${путь}`)) return true;
  const безPublic = путь.replace(/^public\//, "");
  return все.has(безPublic);
}

/**
 * Возвращает новые файлы с подставленными заглушками и список замен
 * (путь html → src, которого не было).
 */
export function подставитьЗаглушкиКартинок(
  новые: ФайлПроекта[],
  существующие: ФайлПроекта[] = [],
): { files: ФайлПроекта[]; замены: Array<{ file: string; src: string }> } {
  const все = new Set<string>([...существующие, ...новые].map((f) => f.path.replace(/^\.\//, "").replace(/^\/+/, "")));
  const замены: Array<{ file: string; src: string }> = [];
  const files = новые.map((f) => {
    if (!/\.(html?|jsx|tsx|vue|svelte)$/i.test(f.path)) return f;
    const content = f.content.replace(/<img\b([^>]*?)\ssrc=(["'])([^"']+)\2/gi, (целиком, до, кавычка, src) => {
      if (ВНЕШНИЙ.test(src) || src.startsWith("{")) return целиком;
      const путь = нормализоватьПуть(src, f.path);
      if (файлЕсть(путь, все)) return целиком;
      замены.push({ file: f.path, src });
      return `<img${до} src=${кавычка}${ЗАГЛУШКА_SVG}${кавычка}`;
    });
    return content === f.content ? f : { ...f, content };
  });
  return { files, замены };
}
