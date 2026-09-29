import type { Metadata } from "next";
import { DevHubGuestIdentity } from "@/components/DevHubGuestIdentity";

// Метаданные — самое опасное место для преувеличения: их читают в выдаче и в
// предпросмотре ссылки, а сверить с продуктом там нечем. Поэтому обещают они
// ровно то же, что страница, и не больше.
//
// Были английскими при русском содержимом. Это не мелочь: описание уходит в
// поиск и в мессенджеры, то есть человек встречает модуль на чужом языке ещё
// до того, как открыл его.
//
// Про «без аккаунта» сказано с оговоркой: работать без входа правда можно, но
// проект тогда привязан к браузеру (см. строку на самой витрине). Обещать
// удобство и умолчать о цене — то же, что обещать лишнее.
/*
 * 29.09.2026. Заголовок вкладки был жёстко русским, а тело страницы говорит на
 * языке посетителя. Находка соседнего окна на английском пути: человек с Product
 * Hunt открывает страницу, видит английский текст — и русскую надпись во вкладке,
 * в истории браузера и в предпросмотре ссылки, то есть там, где читают раньше
 * самой страницы. Тот же приём, что уже применён к рабочему окну проекта:
 * метаданные строит сервер, и единственный доступный ему источник — Accept-Language.
 */
const ЗАГОЛОВКИ: Record<string, { card: string; title: string; description: string; locale: string }> = {
  ru: { card: "«Сделай мне…» вместо конструктора: код, страницы и публикация из одного описания.", title: "DevHub — приложение по описанию", description: "Опишите приложение словами — DevHub напишет код и откроет живой адрес.", locale: "ru_RU" },
  kk: { card: "«Маған жаса…» — конструктордың орнына: код, беттер және жариялау бір сипаттамадан.", title: "DevHub — сипаттама бойынша қосымша", description: "Қосымшаны сөзбен сипаттаңыз — DevHub кодты жазып, тірі мекенжай ашады.", locale: "kk_KZ" },
  en: { card: "Say what you need instead of assembling it: code, pages and publishing from one description.", title: "DevHub — describe an app, get a live address", description: "Describe your app in plain words — DevHub writes the code and opens a live address.", locale: "en_US" },
};

export function языкИзЗаголовка(accept: string | null | undefined): "ru" | "en" | "kk" {
  const v = String(accept ?? "").toLowerCase();
  for (const кусок of v.split(",")) {
    const код = кусок.trim().slice(0, 2);
    if (код === "ru" || код === "kk") return код;
    if (код === "en") return "en";
  }
  return "en";
}

export async function generateMetadata(): Promise<Metadata> {
  const { headers } = await import("next/headers");
  let язык: "ru" | "en" | "kk" = "en";
  try {
    язык = языкИзЗаголовка((await headers()).get("accept-language"));
  } catch {
    // Заголовков может не быть (сборка, предпросмотр) — это не повод падать.
  }
  const т = ЗАГОЛОВКИ[язык];
  // title как ОБЪЕКТ с absolute: корневой шаблон иначе допишет «— AEVION» к
  // заголовку, где это имя уже есть, и получится «AEVION DevHub … — AEVION».
  return {
    /*
     * Имя платформы приписано ЗДЕСЬ, а не спрятано в таблице выше: так его видно
     * и человеку, и сторожу. absolute нужен, чтобы корневой шаблон не дописал
     * «— AEVION» второй раз.
     */
    title: { absolute: `AEVION ${т.title}` },
    description: т.description,
    openGraph: { locale: т.locale },
    /*
     * СВОЙ блок twitter — вернул 29.09.2026 после собственной регрессии: переводя
     * заголовок на язык посетителя, я заменил статические метаданные функцией и
     * потерял эту подпись. Без неё на X карточка подписывается корневым
     * «AEVION — Trust OS» вместо имени модуля (найдено сторожем в тот же час).
     * Теперь подпись тоже на языке посетителя — иначе англоязычный увидел бы
     * английский заголовок и русское описание под ним.
     */
    twitter: {
      card: "summary_large_image",
      title: `AEVION ${т.title}`,
      description: т.card,
    },
  };
}

export default function DevHubLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DevHubGuestIdentity />
      {children}
    </>
  );
}
