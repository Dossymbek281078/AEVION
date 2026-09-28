/**
 * Бейдж «Сделано в AEVION» на каждом сайте, который опубликовал DevHub.
 *
 * ЗАЧЕМ. Петля роста: опубликованное приложение живёт по своему адресу и его
 * показывают другим людям. Без бейджа этот показ не приводит НИКОГО — 28.09.2026
 * замер дал 0 пользователей DevHub при полностью рабочей публикации (живой адрес
 * за 45 секунд). Ссылка с меткой канала превращает каждый чужой показ в переход,
 * который видно в учёте.
 *
 * ПОЧЕМУ ТОЛЬКО БЕСПЛАТНЫМ. Бейдж на своём сайте терпят за бесплатную публикацию;
 * у платного тарифа его снимать — общая практика, и это ещё одна честная причина
 * платить. Поэтому решение висит на тарифе, а не на настройке.
 *
 * ЧЕГО БЕЙДЖ НЕ ДЕЛАЕТ. Не трогает разметку страницы (вставка перед </body>), не
 * тянет ни скриптов, ни шрифтов, не ставит cookie и не следит за посетителем чужого
 * сайта: это одна ссылка с подписью. Вставка идемпотентна — повторная публикация не
 * плодит второй бейдж.
 */

/** Метка канала. Должна быть в CHANNELS на сайте, иначе переход уйдёт в «unattributed». */
export const МЕТКА_БЕЙДЖА = "badge";

const МАРКЕР = "data-aevion-badge";

/** Нужен ли бейдж на этом тарифе. Незнание трактуем как бесплатный: бейдж не вредит. */
export function нуженБейдж(tier: string | null | undefined): boolean {
  const t = String(tier ?? "free").toLowerCase();
  return t !== "pro" && t !== "enterprise";
}

function поРусски(html: string): boolean {
  if (/lang\s*=\s*["']ru/i.test(html)) return true;
  const кириллица = (html.match(/[а-яё]/gi) || []).length;
  return кириллица > 20;
}

export function разметкаБейджа(html: string, base = "https://aevion.app"): string {
  const ссылка = `${base}/devhub?c=${МЕТКА_БЕЙДЖА}`;
  const текст = поРусски(html) ? "Сделано в AEVION" : "Built with AEVION";
  return (
    `<a ${МАРКЕР} href="${ссылка}" target="_blank" rel="noopener noreferrer"` +
    ` style="position:fixed;right:12px;bottom:12px;z-index:2147483000;` +
    `font:500 12px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;` +
    `padding:6px 10px;border-radius:8px;background:rgba(15,23,42,.86);color:#f1f5f9;` +
    `text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,.25)">${текст}</a>`
  );
}

/**
 * Вставить бейдж в HTML. Возвращает исходный html, если бейдж уже стоит.
 * Разметку не разбираем и не переписываем: единственная правка — вставка перед
 * последним </body> (или дописывание в конец, если тега нет).
 */
export function вставитьБейдж(html: string, base = "https://aevion.app"): string {
  const текст = String(html ?? "");
  if (текст.includes(МАРКЕР)) return текст;
  const бейдж = разметкаБейджа(текст, base);
  const i = текст.toLowerCase().lastIndexOf("</body>");
  if (i < 0) return текст + бейдж;
  return текст.slice(0, i) + бейдж + текст.slice(i);
}
