import type { Metadata } from "next";
import { getApiBase } from "@/lib/apiBase";
import { daysUntilLaunch } from "@/lib/daysUntilLaunch";
import { channelFrom } from "@/lib/products";
import { WaitlistCapture } from "@/components/WaitlistCapture";
import { LandingView } from "@/components/LandingView";
import { PageTracking } from "@/components/PageTracking";

// Посадочная запуска «патентного бюро» (QRight + QSign + IP Bureau) — 10 сентября.
//
// ПОЧЕМУ ЗДЕСЬ НЕТ НИ ОДНОГО ЧИСЛА ПРО МАСШТАБ. Замер 18.08: в реестре QRight
// 25 объектов, но без пробных остаётся пять, и те называются «1», «Музыка 1»,
// «My First Track»; сертификатов в бюро пять, три из них — «smoke test».
// Числа здесь были бы правдой формально и обманом по сути, поэтому страница
// обещает РАБОТУ модуля, а не его размер. Появятся настоящие записи — появится
// и счётчик, из живого API, как на посадочной шахмат.
//
// ЧТО ПРОВЕРЕНО ПЕРЕД ТЕМ, КАК ОБЕЩАТЬ (18.08, живой прод):
//   • реестр объектов отвечает: GET /api/qright/objects → 200;
//   • подпись работает по-настоящему: POST /api/qsign/sign → подпись,
//     POST /api/qsign/verify → valid:true, а с испорченной подписью — false;
//   • QSign v2 жив: algoVersion qsign-v2.0, канонизация RFC 8785, база ok;
//   • публичная проверка сертификата без входа: GET /api/bureau/cert/<id>/embed
//     → 200 с данными сертификата.
//
// ЧЕГО ЗДЕСЬ НАМЕРЕННО НЕТ: постквантовой ML-DSA. Её на проде нет, ключи —
// HMAC и Ed25519; заявление о ней уже висит ошибкой на /investor и ждёт
// выкатки чужой починки. Второй раз обещать то же самое нельзя.

export const metadata: Metadata = {
  title: "AEVION IP Bureau — запуск 10 сентября",
  description:
    "Зафиксировать авторство: хеш содержимого в реестре, криптографическая подпись, сертификат с публичной проверкой по ссылке.",
  openGraph: {
    title: "AEVION IP Bureau — запуск 10 сентября",
    description: "Реестр, подпись, сертификат с проверкой по ссылке. Ранний доступ по адресу почты.",
    // Контент посадочных русский, а корневой layout объявляет lang="en":
    // проверено запросом от имени поискового робота — в серверной разметке
    // 2167 кириллических символов при lang="en" и без hreflang. Для
    // поисковика и превью в мессенджерах это рассогласование, и оно решается
    // здесь точечно: трогать общий layout нельзя, остальной сайт двуязычный.
    locale: "ru_RU",
    type: "website",
  },
};

const PAPER = "#f7f6f2";
const INK = "#16161a";
const MUTED = "#5d5f66";
const GOLD = "#a9781a";

/** Живой ли контур прямо сейчас. Обещать работу модуля, не проверив её, нельзя. */
async function probe(path: string): Promise<boolean> {
  try {
    const r = await fetch(`${getApiBase()}${path}`, { next: { revalidate: 1800 } });
    return r.ok;
  } catch {
    return false;
  }
}

export default async function BureauLaunchPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const [registryUp, signUp, bureauUp] = await Promise.all([
    probe("/api/qright/objects"),
    probe("/api/qsign/v2/health"),
    probe("/api/bureau/health"),
  ]);
  const left = daysUntilLaunch(Date.UTC(2026, 8, 10)); // 10 сентября 2026

  // Метка канала — та же механика, что на посадочной шахмат: без неё после
  // запуска не ответить, какой источник привёл людей именно в бюро.
  const channel = channelFrom((await searchParams).c);
  const source = channel ? `bureau-${channel}` : "bureau";

  return (
    <main style={{ minHeight: "100vh", background: PAPER, color: INK, padding: "32px 18px 56px" }}>
      {/* Заходы сюда не считались до 28.08.2026: страница собирает адреса, но
          события page_view не слала. Воронка считает переходы ОТ page_view,
          поэтому её посетители не попадали в знаменатель — конверсия выглядела
          лучше, чем есть. Компонент сам читает ?c= из ссылки. */}
      <PageTracking page="bureau-launch" />
      <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>
        <header>
          <div style={{ fontFamily: "monospace", fontSize: 12, letterSpacing: "0.12em", color: GOLD, textTransform: "uppercase" }}>
            AEVION · IP Bureau
          </div>
          <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 34, lineHeight: 1.15, margin: "10px 0 0", letterSpacing: "-0.01em" }}>
            Доказать, что это ваше
          </h1>
          <p style={{ color: MUTED, fontSize: 15.5, lineHeight: 1.6, margin: "12px 0 0" }}>
            Трек, текст, макет, идея — фиксируются хешем содержимого, подписываются
            криптографически и получают сертификат, который любой может проверить по
            ссылке, не входя в систему.
            {left > 0 ? ` Открываем ${left === 1 ? "завтра" : `через ${left} дн.`} — 10 сентября.` : " Уже открыто."}
          </p>
        </header>

        <LandingView source={source} />


        <WaitlistCapture
          source={source}
          tone="light"
          title="Написать вам в день запуска"
          description="Одно письмо на запуск и условия раннего доступа. Ничего больше."
        />

        <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: 21, margin: 0 }}>Как это работает</h2>

          <Step
            n={1}
            title="Реестр по хешу содержимого"
            note="Записывается отпечаток файла, а не сам файл: доказывает, что объект существовал в этот момент и с тех пор не менялся."
            live={registryUp}
          />
          <Step
            n={2}
            title="Криптографическая подпись"
            note="HMAC-SHA256 и Ed25519 поверх канонизации RFC 8785 — одинаковый результат независимо от порядка полей. Испорченная подпись не проходит проверку."
            live={signUp}
          />
          <Step
            n={3}
            title="Сертификат с проверкой по ссылке"
            note="Открывается без входа и без аккаунта — тому, кому вы её отправили: заказчику, площадке, суду."
            live={bureauUp}
          />

          <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.6, margin: 0 }}>
            Отметка «работает» ставится не вручную: страница спрашивает у боевого
            сервера при сборке.
          </p>
        </section>

        <section style={{ background: "#fffdf8", border: "1px solid rgba(22,22,26,0.10)", borderRadius: 12, padding: "16px 18px" }}>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: 18, margin: "0 0 6px" }}>Чего мы не обещаем</h2>
          <p style={{ color: MUTED, fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
            Подпись сегодня — HMAC и Ed25519. Постквантовых алгоритмов в работе нет,
            и пока их нет, мы о них не пишем. Сертификат — доказательство времени и
            неизменности, а не государственная регистрация патента.
          </p>
        </section>

        <footer style={{ borderTop: "1px solid rgba(22,22,26,0.12)", paddingTop: 16 }}>
          <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.6, margin: 0 }}>
            Пока идёт подготовка, реестр уже открыт:{" "}
            <a href="/bureau" style={{ color: GOLD, fontWeight: 600 }}>
              посмотреть бюро
            </a>
            . Отписка — одной ссылкой в каждом письме.
          </p>
        </footer>
      </div>
    </main>
  );
}

function Step({ n, title, note, live }: { n: number; title: string; note: string; live: boolean }) {
  return (
    <div style={{ background: "#fffdf8", border: "1px solid rgba(22,22,26,0.10)", borderRadius: 12, padding: "14px 16px", display: "flex", gap: 12 }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 700, color: GOLD, lineHeight: 1.2 }}>{n}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 16.5, fontWeight: 700 }}>{title}</span>
          <span style={{ fontFamily: "monospace", fontSize: 11, color: live ? "#1a6b45" : MUTED }}>
            {live ? "работает" : "проверяется"}
          </span>
        </div>
        <div style={{ color: MUTED, fontSize: 13.5, lineHeight: 1.55, marginTop: 4 }}>{note}</div>
      </div>
    </div>
  );
}
