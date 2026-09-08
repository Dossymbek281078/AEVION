import type { Metadata } from "next";
import paper from "@/styles/aevionPaper.module.css";
import { probeJson } from "@/lib/probeLive";
import { voiceIsKnownDown } from "../capabilityRows";
import { channelFrom } from "@/lib/products";
import { WaitlistCapture } from "@/components/WaitlistCapture";
import { PageTracking } from "@/components/PageTracking";
import { daysUntilLaunch } from "@/lib/daysUntilLaunch";

// Посадочная запуска DevHub.
//
// ПОЧЕМУ ЗДЕСЬ НЕТ ДАТЫ ОТКРЫТИЯ. Первая версия этой страницы объявляла дату в
// заголовке, в OG-карточке и обратным отсчётом «через N дн.». Я проверил её
// происхождение и не нашёл опоры ВНЕ собственной работы: каждое вхождение вело в
// файлы, которые я же написал в тот день. Единственная подтверждённая дата на
// платформе — 30 августа у шахмат (ветка launch/2026-08-30 и независимая сводка
// вкладки CyberChess). Дата запуска — решение основателя, и выдуманная дата на
// странице, где у человека просят адрес, есть обещание, которого платформа не
// давала. Поэтому здесь честное «напишем в день запуска», а оно к тому же и есть
// настоящая причина оставить адрес.
//
// ПОЧЕМУ СТРАНИЦА НАЧИНАЕТСЯ С «ОПИШИТЕ», А НЕ СО СПИСКА ВОЗМОЖНОСТЕЙ.
// Основатель однажды открыл /devhub и не понял, что делать: вход выглядел
// инвентарём — шаблоны, модели, панели. Модуль же устроен наоборот, от фразы
// «сделай мне…». Поэтому первое, что человек читает здесь, — предложение
// описать задачу словами, а перечень остаётся ниже как подтверждение.
//
// ПОЧЕМУ ЗДЕСЬ НЕТ НИ ОДНОГО ЧИСЛА ПРО СОЗДАННЫЕ ПРОЕКТЫ. Замер 18.08:
// /api/devhub/projects отдаёт 17 записей, но уникальных названий семь, из них
// одиннадцать раз один и тот же «таймер помодоро», а остальное — final retest,
// pomodoro retest, react-preview-smoke, cf-pages-test, prod-smoke-test. Статусы:
// 16 draft и 1 live. Это прогоны разработки, а не работа пользователей: число
// было бы правдой формально и обманом по сути. То же правило, по которому
// сделана посадочная патентного бюро.
//
// ЧТО ПРОВЕРЕНО ПЕРЕД ТЕМ, КАК ОБЕЩАТЬ (19.08, боевой прод api.aevion.app):
//   • GET /api/devhub/templates        → 200, 5 начал: Next.js App, Express API,
//     Landing Page, React SPA, Analytics Dashboard;
//   • GET /api/devhub/agent/templates  → 200, 3 сценария, каждый собирает
//     страницу вместе с озвучкой и звуком;
//   • GET /api/devhub/media/3d/models  → 200, configured: true (trellis, hunyuan3d);
//   • GET /api/devhub/media/video/models → 200, configured: true (veo-3, veo-3-fast,
//     seedance);
//   • POST /api/constitution/waitlist/subscribe с мусором → 400 — приём адресов
//     есть и поля проверяет.
//
// ЦЕНЫ ЗДЕСЬ НЕТ, И ЭТО НЕ УПУЩЕНИЕ. В плане запуска у модуля стоит $149/мес, но
// в прайсе (MODULES_PRICING) записи devhub нет вовсе, в магазине позиции нет, а
// политика платного доступа модуля не знает — проверено на проде. Пока это так,
// назвать цену значило бы отправить человека к кнопке, которой не существует.
// Разбор — в Desktop\АЕВИОН\05-DevHub\2026-08-12\DEVHUB-НЕТ-В-РЕЕСТРЕ-запуск-13-09.md
//
// ЧЕГО ЗДЕСЬ НАМЕРЕННО НЕТ: обещания выкладки «в один клик». Публикация у модуля
// есть, но её я не проверял живым прогоном, а история этого пути в репозитории
// прямо предупреждает: успех деплоя раньше отмечался до того, как страница
// начинала отвечать (см. конвенцию «deploy = uploaded + serves» в
// aevion-globus-backend/CLAUDE.md). Не проверил — не обещаю.

export const metadata: Metadata = {
  alternates: { canonical: "/devhub/launch" },
  title: "AEVION DevHub — ранний доступ",
  // Описание для поиска обязано обещать столько же, сколько текст страницы, а не
  // больше. Здесь стояло «сценарии сборки под ключ» — то самое обещание, от
  // которого страница абзацем ниже честно отказывается («связать код и медиа в
  // разметке — последний шаг за вами»). Метаданные — самое опасное место для
  // преувеличения: их читают в выдаче и в предпросмотре ссылки, а сверить с
  // продуктом там нечем.
  description:
    "Опишите приложение словами — DevHub соберёт проект, страницы, картинки и озвучку. Пять готовых начал; код и медиа приходят отдельными файлами.",
  openGraph: {
    title: "AEVION DevHub — ранний доступ",
    description:
      "«Сделай мне…» вместо конструктора: проект, медиа и озвучка создаются по описанию и приходят файлами. Ранний доступ по адресу почты.",
    // Контент посадочных русский, а корневой layout объявляет lang="en":
    // проверено запросом от имени поискового робота — в серверной разметке
    // 2167 кириллических символов при lang="en" и без hreflang. Для
    // поисковика и превью в мессенджерах это рассогласование, и оно решается
    // здесь точечно: трогать общий layout нельзя, остальной сайт двуязычный.
    locale: "ru_RU",
    type: "website",
  },
};

export default async function DevhubLaunchPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  // Обещание опирается на СОДЕРЖИМОЕ ответа, а не на то, что маршрут ответил:
  // пустой список начал тоже вернул бы 200, а каталог видеомоделей отдаётся
  // статически всегда и сам сообщает, настроен ли провайдер (`configured`).
  const [tpl, agents, media, caps] = await Promise.all([
    probeJson<{ templates?: unknown[] }>("/api/devhub/templates"),
    probeJson<{ templates?: unknown[] }>("/api/devhub/agent/templates"),
    probeJson<{ models?: unknown[]; configured?: boolean }>("/api/devhub/media/video/models"),
    probeJson<{ capabilities?: Array<{ id: string; status: string }> }>("/api/devhub/studio/capabilities"),
  ]);
  const tplUp = Array.isArray(tpl?.templates) && tpl.templates.length > 0;
  const agentsUp = Array.isArray(agents?.templates) && agents.templates.length > 0;
  // Каталог без ключа провайдера — не возможность, а список названий.
  const mediaUp = media?.configured === true && Array.isArray(media.models) && media.models.length > 0;

  /**
   * Голос страница обещает ЧЕТЫРЕЖДЫ — в заголовке шага 3 и во всех трёх
   * сценариях шага 2 (озвучка лендинга, аудиочтение статьи, голосовой
   * онбординг панели), — а спрашивала только каталог ВИДЕО. Замер 08.09.2026:
   * /studio/capabilities отдаёт audio_tts как degraded (отвергнут ключ
   * ElevenLabs), и карточка при этом писала «работает».
   *
   * Умолчание здесь ОБРАТНОЕ тому, что стоит у суммы в таблице сравнения, и
   * это не небрежность: там вопрос «сколько мы стоим» и незнание не должно
   * занижать нас, здесь вопрос «обещать ли вслух» и незнание не должно
   * обещать за нас. Поэтому оговорка появляется, только когда состояние
   * ПРИШЛО и оно нерабочее; молчащая ручка оставляет страницу как была.
   */
  const voiceStatus = caps?.capabilities?.find((c) => c.id === "audio_tts")?.status;
  const voiceDown = voiceIsKnownDown(voiceStatus);
  const voiceCaveat = voiceDown
    ? "Голос сейчас недоступен: провайдер озвучки не принимает наш ключ. Остальное в этом шаге работает."
    : null;

  // Метка канала — та же механика, что на посадочных бюро, шахмат и мультичата:
  // без неё после запуска не ответить, какой источник привёл людей именно сюда.
  const channel = channelFrom((await searchParams).c);
  const source = channel ? `devhub-${channel}` : "devhub";
  // Дней до открытия. 10 сентября 2026 — документ основателя
  // 00-НАЧНИ-ОТСЮДА/2026-08-30-ПЛАН-даты-запуска-новые.md.
  //
  // Вернул при сборке цикла 11: перестройка страницы (поле выше сгиба) шла от
  // ветки, где этой строки ещё не было, и разрешение конфликта в пользу
  // чужой стороны увезло её вместе с макетом. Сторож поймал.
  const left = daysUntilLaunch(Date.UTC(2026, 8, 10));

  return (
    <main lang="ru" className={paper.paper} style={{ minHeight: "100vh", padding: "clamp(16px, 4vw, 32px) 18px 56px" }}>
      {/* Заходы сюда не считались до 28.08.2026: страница собирает адреса, но
          события page_view не слала. Воронка считает переходы ОТ page_view,
          поэтому её посетители не попадали в знаменатель — конверсия выглядела
          лучше, чем есть. Компонент сам читает ?c= из ссылки. */}
      <PageTracking page="devhub-launch" />
      <div style={{ maxWidth: 620, margin: "0 auto", display: "flex", flexDirection: "column", gap: "clamp(18px, 4vw, 28px)" }}>
        <header>
          <div className={paper.kicker}>AEVION · DevHub</div>
          <h1
            className={paper.serifTitle}
            style={{ fontSize: "clamp(28px, 5vw, 36px)", lineHeight: 1.15, marginTop: 10 }}
          >
            Опишите приложение словами
          </h1>
          <p style={{ color: "var(--ink-soft)", fontSize: 15.5, lineHeight: 1.5, margin: "10px 0 0" }}>
            «Сделай таймер помодоро с настройкой длительности» — и DevHub соберёт
            проект: код, страницы, а при необходимости картинки и озвучку к ним.
            {/*
              Строка, которая ОБЯЗАНА стать другой в назначенный день, не может
              быть статической: 10 сентября подписчик получит письмо «DevHub
              открыт», придёт сюда и прочтёт «откроем скоро». Менять её руками
              в день запуска никто не успеет.
            */}
            {left > 0
              ? ` Открываем ${left === 1 ? "завтра" : `через ${left} дн.`}. Оставьте адрес, и письмо придёт в день запуска.`
              : " Уже открыто — заходите."}
          </p>
        </header>


        <WaitlistCapture
          // Язык НЕ задан жёстко (было lang="ru", снято 06.09.2026 по живому
          // замеру): машинный доводчик AutoTranslate переводит EN-визитёру
          // весь текст посадочной, но НЕ атрибуты — человек видел английскую
          // страницу с русским «вы@почта.рф» ровно в поле контакта. Форма
          // идёт за языком посетителя: русскому — русская, как и раньше.
          source={source}
          tone="light"
          title="Написать вам в день запуска"
          description="Одно письмо на запуск и условия раннего доступа. Ничего больше."
        />

        {/* Хвост объяснения стоит ПОСЛЕ формы намеренно. Замер прода
            08.09.2026 на 360×640 (вахта нашла, я перемерил): поле адреса
            лежало на 697px при сгибе 640 — то есть человек, пришедший по
            письму, не видел единственного действия, ради которого страница
            существует. Верхних 234px занимает общая шапка сайта, ещё 287 —
            заголовок с абзацем; форме оставалось начаться за экраном.
            На 390×844 всё было в порядке, поэтому на глаз не заметно. */}
        <p style={{ color: "var(--ink-soft)", fontSize: 15.5, lineHeight: 1.5, margin: 0 }}>
          Начинать со списка возможностей не нужно, он ниже — просто чтобы вы
          видели, из чего собирается. Дату открытия объявим отдельно: оставьте
          адрес, и письмо придёт в тот же день.
        </p>

        <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className={paper.sectionHead}>
            <h2 className={paper.serifTitle} style={{ fontSize: 21 }}>
              Что происходит после описания
            </h2>
          </div>

          <Step
            n={1}
            title="Проект собирается с готового начала"
            note="Пять начал на выбор, и выбирать их вручную не обязательно: Next.js с серверными ручками, REST API на TypeScript, лендинг, одностраничное приложение на Vite, панель с графиками."
            live={tplUp}
          />
          <Step
            n={2}
            title="Сценарий даёт и страницу, и медиа к ней"
            note="Три сценария за один запуск: лендинг — вёрстка плюс озвучка и звуковой эффект; статья — картинка в шапке и аудиочтение; панель — карточки, график и голосовой онбординг. Файлы приходят отдельными: код и медиа ложатся рядом, связать их в разметке — последний шаг за вами. Обещать «готовую страницу целиком» мы не будем: шаг с кодом идёт первым и о будущих файлах ещё не знает."
            live={agentsUp}
            caveat={voiceCaveat}
          />
          <Step
            n={3}
            title="Картинки, видео и голос — внутри, а не сбоку"
            note="Генерация подключена по-настоящему: видео (veo-3, veo-3-fast, seedance) и объёмные модели (trellis, hunyuan3d). Это те же ключи, что у платформы, — отдельных подписок на медиа не нужно."
            live={mediaUp}
            caveat={voiceCaveat}
          />

          <p style={{ color: "var(--ink-faint)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
            Отметка «работает» ставится не вручную: страница спрашивает у боевого
            сервера и перепроверяет его раз в полчаса.
          </p>
        </section>

        <section className={paper.card}>
          <h2 className={paper.serifTitle} style={{ fontSize: 18, marginBottom: 6 }}>
            Чего мы не обещаем
          </h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
            Не обещаем выкладку «в один клик»: публикация в модуле есть, но живым
            прогоном мы её здесь не подтверждали, а раньше на этом пути успех
            отмечался до того, как страница начинала отвечать. Не называем и число
            созданных приложений: сегодня в базе почти всё — прогоны разработки, и
            цифра выглядела бы убедительнее, чем есть на самом деле.
          </p>
        </section>

        <footer style={{ borderTop: "1px solid var(--rule)", paddingTop: 16 }}>
          <p style={{ color: "var(--ink-faint)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
            Пока идёт подготовка, модуль уже открыт:{" "}
            <a className={paper.link} href="/devhub">
              посмотреть DevHub
            </a>
            . Отписка — одной ссылкой в каждом письме.
          </p>
        </footer>
      </div>
    </main>
  );
}

function Step({ n, title, note, live, caveat }: { n: number; title: string; note: string; live: boolean; caveat?: string | null }) {
  return (
    <div className={paper.card} style={{ display: "flex", gap: 12 }}>
      <div
        className={paper.serifTitle}
        style={{ fontSize: 20, color: "var(--teal-deep)", lineHeight: 1.2 }}
      >
        {n}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
          <span className={paper.serifTitle} style={{ fontSize: 16.5 }}>
            {title}
          </span>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              color: live ? "var(--teal-deep)" : "var(--ink-faint)",
            }}
          >
            {live ? "работает" : "проверяется"}
          </span>
        </div>
        <div style={{ color: "var(--ink-soft)", fontSize: 13.5, lineHeight: 1.55, marginTop: 4 }}>
          {note}
        </div>
        {caveat ? (
          <div style={{ color: "var(--amber-deep, #b45309)", fontSize: 12.5, lineHeight: 1.5, marginTop: 6 }}>
            {caveat}
          </div>
        ) : null}
      </div>
    </div>
  );
}
