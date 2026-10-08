import { текстRobots } from "../robotsRules";

/**
 * robots.txt отдаёт обработчик, а не метаданные Next.
 *
 * 🔴 Причина одна и конкретная: нам нужна директива `Clean-param`, которую
 * понимает Яндекс, а в типе `MetadataRoute.Robots` её нет — Next умеет только
 * allow/disallow/sitemap/host/crawlDelay. Через метаданные директиву не
 * отдать никак, поэтому файл собирается текстом в `robotsRules.текстRobots`
 * и возвращается отсюда.
 *
 * Правила при этом НЕ продублированы: списки запретов, разрешений и карт
 * живут в одном месте — `app/robotsRules.ts`, — и оттуда же их читает карта
 * сайта и четыре сторожа. Второго источника правды не заведено намеренно:
 * разъедется — и мы снова будем звать поисковика туда, куда сами его не
 * пускаем.
 *
 * force-static: файл зависит только от констант и базового адреса, пересчёт
 * на каждый запрос ему не нужен.
 */
export const dynamic = "force-static";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export function GET(): Response {
  return new Response(текстRobots(BASE_URL), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
