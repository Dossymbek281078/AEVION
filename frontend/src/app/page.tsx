/*
 * Серверная обёртка главной — нужна РОВНО для одного: объявить canonical.
 *
 * Замер 06.10.2026: у «/» canonical отсутствовал, при том что на /longevity и
 * /pricing он стоял. Для нас это не косметика: все наши ссылки из роликов,
 * писем и постов несут метку канала в адресе (`/?c=yt-devhub-2min` и десятки
 * других), и без canonical поисковик вправе считать каждый такой адрес
 * отдельной страницей. Для Яндекса это прямо влияет на склейку: сайт в
 * Вебмастере не подтверждён, разбираться с дублями будет некому.
 *
 * Почему обёртка, а не метаданные в самой странице: главная — клиентский
 * компонент («use client»), а клиентский компонент экспортировать metadata не
 * может. Поэтому содержимое уехало в `_home.tsx` без единой правки (git mv,
 * подчёркивание в имени = файл не маршрут), а здесь остался серверный слой.
 * Приём не новый: так же сделано в smeta-trainer (`_client.tsx`).
 *
 * canonical НЕ поставлен в корневом макете намеренно: оттуда он достался бы
 * каждой странице, не объявившей свой, и все они сказали бы поисковику «я
 * копия главной». На это в репозитории есть отдельный сторож —
 * layoutCanonicalDoesNotHideChildren.
 */
import type { Metadata } from "next";
import HomePage from "./_home";
import { serverLang } from "@/lib/serverLang";
import { ServerLangProvider } from "@/lib/serverLangContext";
import { строкиКадра, КЛЮЧИ_ГЛАВНОЙ } from "@/lib/serverFrameStrings";
import { homeLang, homeMetadata } from "./homeMetadata";

/*
 * 30.10.2026 (замер Приложений, прод 4f71ad70f, ru-RU): сырой HTML главной отдавал
 * английский h1 «Describe it in a sentence…», русский появлялся через ~6 с. Язык кадра
 * решает сервер (кука → Accept-Language → ru) и отдаёт строки home.* до словаря.
 * ЦЕНА: чтение cookies()/headers() делает «/» динамической — прежде она была статической
 * (ни dynamic, ни revalidate, корневой макет куки не читает) и отдавалась с CDN.
 */
export const dynamic = "force-dynamic";

/*
 * 1.11.2026 (замер Науки, прод dc4a968f8, curl): <title> главной всегда английский
 * при русском/казахском h1. Страница уже динамическая, значит язык известен и для
 * метаданных — заголовок, описание и og:* идут на языке гостя (homeMetadata.ts).
 */
export async function generateMetadata(): Promise<Metadata> {
  return homeMetadata(homeLang(await serverLang("ru")));
}

/*
 * lang на <html> — ДО первого кадра. Корневой макет держит lang="en" и не читает
 * запрос (cookies()/headers() там сделали бы динамическим весь сайт, см. макет);
 * его скрипт в <head> знает только куку и путь, а гостя без куки (первый визит,
 * робот с Accept-Language ru) оставлял под lang="en" — браузер предлагал машинный
 * перевод русской страницы. Сервер язык уже выбрал — объявляем его первым узлом
 * тела, раньше любого текста. data-lang-src="server" стоит ниже выбора человека
 * (cookie/path) и выше догадки по содержимому: скрипт в конце тела его не перебивает.
 * В сыром HTML без выполнения скриптов (curl) lang остаётся "en" — честная граница
 * этого приёма; полная починка = динамический корневой макет, решение отдельное.
 */
function HtmlLangScript({ lang }: { lang: string }) {
  // Имена атрибутов и язык — через JSON.stringify: 1.11 первая версия потеряла кавычки
  // при записи файла и отдавала невалидный JS; тест homeLangTitle это ловит.
  const ATTR = JSON.stringify("data-lang-src");
  const js =
    "try{var D=document.documentElement;if(!D.getAttribute(" + ATTR + ")){D.lang=" +
    JSON.stringify(lang) + ";D.setAttribute(" + ATTR + "," + JSON.stringify("server") + ")}}catch(e){}";
  return <script data-home-lang={lang} dangerouslySetInnerHTML={{ __html: js }} />;
}

export default async function Page() {
  const lang = await serverLang("ru");
  return (
    <ServerLangProvider lang={lang} frameStrings={строкиКадра(lang, КЛЮЧИ_ГЛАВНОЙ)}>
      <HtmlLangScript lang={lang} />
      <HomePage />
    </ServerLangProvider>
  );
}
