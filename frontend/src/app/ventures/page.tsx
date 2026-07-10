/**
 * /ventures — AEVION Ventures · Идея-Маркет.
 *
 * A showcase window inside AEVION: any visitor sees that inside AEVION you can
 * not only *use* AI but *build businesses*. Presents 20 vetted business models
 * as an "idea exchange" board (each with a realistic revenue ceiling), and
 * features the first live venture — AEVIA, a longevity gummy under the AEVION
 * umbrella.
 *
 * Static RSC page — zero data deps, zero client JS. All styling is inlined and
 * namespaced under `.vtx` so it never collides with the app's global CSS.
 * Self-theming via prefers-color-scheme. Backend registry wiring (health-matrix
 * card, catalog tier) is a follow-up.
 */

export const metadata = {
  title: "AEVION Ventures — Идея-Маркет",
  description:
    "Внутри AEVION можно не только пользоваться AI, но и строить бизнесы. 20 моделей до $10M + живой венчур AEVIA.",
};

type Idea = {
  n: string;
  name: string;
  desc: string;
  model: string;
  ceiling: string;
  diff: number; // 1..5
  status: "live" | "open" | "lab" | "pump";
};

const IDEAS: Idea[] = [
  { n: "01", name: "AEVIA — longevity / anti-grey гамми", desc: "Красота и антиэйдж изнутри, подписка", model: "DTC + подписка", ceiling: "$1B", diff: 4, status: "live" },
  { n: "02", name: "AI-ресепшн / голосовой агент", desc: "Для клиник, СТО, салонов", model: "SaaS", ceiling: "$10M", diff: 3, status: "open" },
  { n: "03", name: "Collagen sticks — 口服美容", desc: "Beauty-дринк, рынок Китая $10B+", model: "DTC", ceiling: "$250M", diff: 4, status: "lab" },
  { n: "04", name: "Longevity coffee / грибной латте", desc: "Ежедневный ритуал, высокий повтор", model: "DTC", ceiling: "$120M", diff: 3, status: "lab" },
  { n: "05", name: "AI-лидоген как сервис", desc: "Замена Apollo/Clay для СНГ", model: "SaaS", ceiling: "$10M", diff: 3, status: "open" },
  { n: "06", name: "AI-клон эксперта", desc: "Платный чат-двойник блогеров, rev-share", model: "Creator SaaS", ceiling: "$10M", diff: 4, status: "open" },
  { n: "07", name: "DTC beauty / skincare hero-SKU", desc: "Один герой-продукт", model: "E-commerce", ceiling: "$80M", diff: 4, status: "open" },
  { n: "08", name: "Высокочек-курс по AI", desc: "Денежный насос, реальная история", model: "Info product", ceiling: "$20M", diff: 2, status: "pump" },
  { n: "09", name: "Pet-товар с подпиской", desc: "Корм / лакомство / гаджет", model: "DTC подписка", ceiling: "$60M", diff: 4, status: "open" },
  { n: "10", name: "White-label AI-платформа", desc: "Перепродажа под брендом реселлера", model: "B2B2C SaaS", ceiling: "$10M", diff: 3, status: "open" },
  { n: "11", name: "STEM-игрушка + unboxing-воронка", desc: "Дети, YouTube-дистрибуция", model: "DTC + media", ceiling: "$70M", diff: 4, status: "open" },
  { n: "12", name: "Функциональный beauty-снек", desc: "Коллаген / протеин-бар, ритейл", model: "Food", ceiling: "$90M", diff: 4, status: "open" },
  { n: "13", name: "Sleep / calm гамми", desc: "Мелатонин + адаптогены", model: "DTC подписка", ceiling: "$150M", diff: 3, status: "lab" },
  { n: "14", name: "Gut / probiotic гамми", desc: "Огромная растущая категория", model: "DTC подписка", ceiling: "$140M", diff: 3, status: "lab" },
  { n: "15", name: "Адаптоген-шот (энергия без сахара)", desc: "Prime-подобный вирус", model: "Напиток", ceiling: "$200M", diff: 4, status: "open" },
  { n: "16", name: "Compliance / документооборот AI", desc: "ИИ проверяет договоры", model: "SaaS", ceiling: "$10M", diff: 3, status: "open" },
  { n: "17", name: "Ниша-маркетплейс", desc: "Одна вертикаль, take-rate 15%", model: "Marketplace", ceiling: "$50M", diff: 5, status: "open" },
  { n: "18", name: "Nootropic / focus гамми", desc: "Продуктивность, студенты", model: "DTC подписка", ceiling: "$110M", diff: 3, status: "lab" },
  { n: "19", name: "Виральный health-гаджет", desc: "Умная бутылка / трекер", model: "Device", ceiling: "$100M", diff: 4, status: "open" },
  { n: "20", name: "3D-визуализация недвижимости", desc: "Сервис → SaaS для застройщиков", model: "Service → SaaS", ceiling: "$10M", diff: 3, status: "open" },
];

const STATUS_LABEL: Record<Idea["status"], string> = {
  live: "▲ LIVE",
  open: "open",
  lab: "в лаб.",
  pump: "насос",
};

function Dots({ n }: { n: number }) {
  return (
    <span className="vtx-dots" aria-label={`сложность ${n} из 5`}>
      {"●".repeat(n)}
      <span className="vtx-off">{"●".repeat(5 - n)}</span>
    </span>
  );
}

export default function VenturesPage() {
  return (
    <div className="vtx">
      <style>{CSS}</style>

      <header className="vtx-top">
        <div className="vtx-wrap">
          <p className="vtx-eyebrow">Модуль AEVION · Идея-Маркет</p>
          <h1 className="vtx-h1">
            Внутри AEVION можно не только пользоваться AI. Можно строить бизнесы.
          </h1>
          <p className="vtx-lede">
            Идея-Маркет — витрина из 20 проверенных бизнес-моделей с посчитанной
            юнит-экономикой до <b>$10M</b>. Одна ставка уже запущена:{" "}
            <b>AEVIA</b> — longevity-гамми под зонтом AEVION с потолком в Китае
            до <b>$1B</b>.
          </p>
        </div>
      </header>

      <div className="vtx-wrap">
        {/* how it works */}
        <section className="vtx-sec">
          <p className="vtx-label"><span className="vtx-n">01</span> Как это работает</p>
          <h2 className="vtx-h2">AEVION как венчурный движок</h2>
          <p className="vtx-sub">
            Не «ещё один AI-чат», а конвейер: идея → сборка на AI-стеке →
            дистрибуция через медиа-фабрику → рекуррентная выручка. Пользователь
            заходит выбрать идею и запускает её теми же инструментами, которыми
            построена сама платформа.
          </p>
          <div className="vtx-flow">
            {[
              ["Движок", "Медиа-фабрика", "Faceless-контент раздаёт дешёвый трафик — тестирует 8–12 товаров, чтобы найти один хит."],
              ["Насос", "Курс / когорта", "Быстрый кэш за недели — финансирует оборотку под товар, без займов."],
              ["Звезда", "Физический бестселлер", "Высокая маржа + подписка + глобальный потолок $100M–$1B."],
              ["Актив", "AI-SaaS", "Несгораемый рекуррент на годы — строится, когда кэш пошёл."],
            ].map(([k, t, d]) => (
              <div className="vtx-step" key={t}>
                <p className="vtx-k">{k}</p>
                <b>{t}</b>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* idea board */}
        <section className="vtx-sec">
          <p className="vtx-label"><span className="vtx-n">02</span> Идея-Маркет</p>
          <h2 className="vtx-h2">Биржа из 20 идей</h2>
          <p className="vtx-sub">
            «Ceiling» — реалистичный глобальный потолок выручки, не обещание.
            Base rate низкий: побеждает 1–3 из 20, поэтому маркет — конвейер
            дешёвых ставок, а не одна догадка.
          </p>
          <div className="vtx-board">
            <table className="vtx-table">
              <thead>
                <tr>
                  <th>#</th><th>Идея</th><th>Модель</th><th>Ceiling</th><th>Сложн.</th><th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {IDEAS.map((i) => (
                  <tr key={i.n}>
                    <td className="vtx-num">{i.n}</td>
                    <td><span className="vtx-name">{i.name}</span><br /><span className="vtx-desc">{i.desc}</span></td>
                    <td>{i.model}</td>
                    <td className="vtx-num vtx-cap">{i.ceiling}</td>
                    <td><Dots n={i.diff} /></td>
                    <td><span className={`vtx-pill vtx-${i.status}`}>{STATUS_LABEL[i.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="vtx-note">
            <b>Как читать потолок.</b> «$1B» — опцион, а не прогноз: так
            масштабируется 1 из сотен товаров, попавших в Китай/глобал. Мы платим
            за опцион дёшево — конвейером тестов, а не ставкой всего капитала на
            один SKU.
          </div>
        </section>

        {/* featured venture */}
        <section className="vtx-sec">
          <p className="vtx-label"><span className="vtx-n">03</span> Живая ставка</p>
          <div className="vtx-feature">
            <span className="vtx-badge"><span className="vtx-dot" /> Live venture · powered by AEVION</span>
            <h2 className="vtx-h2" style={{ color: "#f6f3ec" }}>AEVIA — «Roots»</h2>
            <p className="vtx-fmuted">
              AEVIA — потребительский венчур под зонтом AEVION. Они рекламируют
              друг друга: AEVION даёт научный ореол доверия, AEVIA заводит
              массовую TikTok-аудиторию в экосистему. Отдельный товарный знак не
              плодим.
            </p>
            <p className="vtx-fbody">
              Жевательные gummy для волос, кожи и клеточного возраста. Легенда —
              на исследовательском тезисе: <b>седина — видимый биомаркер
              старения</b> (истощение стволовых клеток меланоцитов, накопление
              ROS, митохондриальная усталость). Формат гамми камерогеничен для
              медиа-движка, лёгок в доставке в любую страну и держит подписку.
            </p>

            <div className="vtx-grid2">
              <div>
                <p className="vtx-mth">Состав-легенда · формулировки wellness</p>
                <div className="vtx-actives">
                  {[
                    ["Zn : Cu ≈ 10:1", "поддержка естественной пигментации и синтеза коллагена"],
                    ["Catalase + антиоксиданты", "защита от окислительного стресса (ROS)"],
                    ["Спермидин (зародыш пшеницы)", "клеточное обновление (аутофагия)"],
                    ["PQQ / CoQ10", "митохондриальная энергия клеток"],
                    ["Биотин + селен + L-цистеин", "строительные блоки волос и ногтей"],
                    ["Адаптоген (ашваганда)", "поддержка при стрессе"],
                  ].map(([ing, why]) => (
                    <div className="vtx-arow" key={ing}>
                      <span className="vtx-ing">{ing}</span>
                      <span className="vtx-why">{why}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="vtx-mth">Юнит-экономика · путь до $10M</p>
                <ul className="vtx-kv">
                  {[
                    ["Цена (подписка / мес)", "$39", false],
                    ["Себестоимость (COGS)", "≈ $4", false],
                    ["Валовая маржа", "≈ 85%", true],
                    ["Целевой CAC", "< $25", false],
                    ["Контрибуция / клиент (LTV)", "≈ $120", false],
                    ["Активных подписок = $10M/год", "≈ 21 400", true],
                    ["Первая партия (MOQ 5 000)", "≈ $20–40k", false],
                  ].map(([lab, val, hi]) => (
                    <li key={lab as string}>
                      <span className="vtx-vlab">{lab}</span>
                      <span className={`vtx-vval${hi ? " vtx-hi" : ""}`}>{val}</span>
                    </li>
                  ))}
                </ul>
                <p className="vtx-fnote">
                  Первую партию финансирует денежный насос (курс) — без займов и
                  разбавления.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* sku pipeline */}
        <section className="vtx-sec">
          <p className="vtx-label"><span className="vtx-n">04</span> Конвейер SKU</p>
          <h2 className="vtx-h2">8 тестов, один победитель</h2>
          <p className="vtx-sub">
            Все SKU держатся одной темы (красота · долголетие · здоровье), чтобы
            бренд оставался цельным, а медиа-движок переиспользовал аудиторию.
            Запускаем дёшево, весь бюджет — в того, кто покажет лучший отклик.
          </p>
          <div className="vtx-board">
            <table className="vtx-table">
              <thead><tr><th>SKU</th><th>Формат</th><th>Маржа</th><th>Крючок для рынка</th></tr></thead>
              <tbody>
                {[
                  ["AEVIA Roots", "гамми", "~85%", "против седины / клеточный возраст", true],
                  ["AEVIA Glow", "гамми", "~85%", "коллаген, сияние кожи", false],
                  ["AEVIA Sleep", "гамми", "~85%", "сон, магний + мелатонин", false],
                  ["AEVIA Calm", "гамми", "~85%", "стресс, ашваганда", false],
                  ["AEVIA Focus", "гамми", "~85%", "концентрация, ноотропы", false],
                  ["AEVIA Gut", "гамми", "~80%", "про/пребиотики, ЖКТ", false],
                  ["AEVIA Sticks", "дринк-микс", "~80%", "коллаген-стик, 口服美容 для Китая", false],
                  ["AEVIA Coffee", "кофе", "~75%", "longevity-латте, ежедневный ритуал", false],
                ].map(([sku, fmt, mrg, hook, flag]) => (
                  <tr key={sku as string}>
                    <td className="vtx-name">
                      {sku}
                      {flag ? <span className="vtx-pill vtx-live" style={{ marginLeft: 6 }}>flagship</span> : null}
                    </td>
                    <td>{fmt}</td>
                    <td className="vtx-num">{mrg}</td>
                    <td>{hook}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* china */}
        <section className="vtx-sec">
          <p className="vtx-label"><span className="vtx-n">05</span> Производство и Китай</p>
          <h2 className="vtx-h2">Трансграничный вход 跨境</h2>
          <p className="vtx-sub">
            Для health/beauty в Китай не нужна сразу внутренняя регистрация
            (blue-hat): трансграничная торговля пускает иностранный бренд через
            бондовые склады. Производство — решаемый второй момент, спрос
            подтверждаем раньше.
          </p>
          <ol className="vtx-steps">
            {[
              ["Контрактное производство.", "Private-label gummy CMO в США / ЕС / Австралии — для глобала и премиум-легенды «импортный бренд» в Китае. MOQ ≈ 5 000–10 000 шт."],
              ["Формула и тесты.", "Согласовать состав под wellness-регуляции целевых рынков (US FDA supplement, EU food supplement, требования cross-border к этикетке)."],
              ["Бондовый склад (保税仓).", "Ханчжоу / Чжэнчжоу. Товар лежит в Китае, растаможивается по факту заказа — без полной внутренней регистрации."],
              ["Магазины.", "Tmall Global, Douyin cross-border 小店, Xiaohongshu. Регистрация через TP-агентство (Tmall Partner)."],
              ["Посев у 达人 (KOL).", "Douyin/Xiaohongshu-инфлюенсеры + собственная медиа-фабрика на тех же площадках."],
            ].map(([b, s]) => (
              <li key={b}><b>{b}</b> <span>{s}</span></li>
            ))}
          </ol>
          <div className="vtx-note vtx-warn">
            <b>Регуляторный барьер (жёстко).</b> Wellness, не лечение. Никаких
            «вылечит седину». Только «поддержка», «нутриенты для…». Иначе бан на
            TikTok/маркетплейсах и юридический риск — действует на все SKU и весь
            контент.
          </div>
        </section>

        {/* 90 days */}
        <section className="vtx-sec">
          <p className="vtx-label"><span className="vtx-n">06</span> Исполнение</p>
          <h2 className="vtx-h2">90 дней</h2>
          <div className="vtx-plan">
            {[
              ["Недели 1–3", "Насос включён", "Запуск курса + первые ролики Roots. Первый кэш на оборотку."],
              ["Недели 3–8", "Товар в поле", "На кэш — первая партия Roots, поставщик, подписка. Первые 100–500 подписок."],
              ["Недели 8–12", "Масштаб движка", "Мульти-аккаунт, оптимизация воронки. Трек $50–150k MRR."],
              ["Месяц 3+", "Несгораемый актив", "Старт AI-SaaS на подтверждённом кэше — рекуррент на годы."],
            ].map(([w, t, d]) => (
              <div className="vtx-phase" key={w}>
                <p className="vtx-wk">{w}</p>
                <b>{t}</b>
                <p>{d}</p>
              </div>
            ))}
          </div>
          <div className="vtx-note vtx-teal">
            <b>Честный вердикт.</b> «$10M за год каждый» — не будет. Реалистично:
            год 1 = $0.5–3M совокупно при сильном исполнении; $10M ARR — цель на
            18–24 мес по флагману; $1B — опцион, за который платим дёшево тестами.
          </div>
        </section>
      </div>

      <footer className="vtx-foot">
        <div className="vtx-wrap">
          <span className="vtx-fmono">AEVION · VENTURES</span> — Идея-Маркет ·
          wellness, не медицинский продукт · потолки = гипотезы, не обещания
        </div>
      </footer>
    </div>
  );
}

const CSS = `
.vtx{--ink:#14151b;--paper:#f4f2ec;--paper2:#ece9e0;--line:#d8d3c7;--text:#17181e;--soft:#565561;--amber:#c8871f;--amberS:#e7bd63;--teal:#1f8a70;--tealS:#2fae8f;--card:#fff;--cardL:#e3ded2;--sh:0 1px 2px rgba(20,21,27,.06),0 8px 30px rgba(20,21,27,.05);
  color:var(--text);background:var(--paper);font-family:"Helvetica Neue",Helvetica,Arial,system-ui,sans-serif;line-height:1.55;font-size:17px;letter-spacing:-.005em;}
@media (prefers-color-scheme:dark){.vtx{--ink:#0e0f14;--paper:#101116;--paper2:#16181f;--line:#2a2d38;--text:#ecebe6;--soft:#9b9aa6;--amber:#e7bd63;--amberS:#c8871f;--teal:#3fc2a0;--tealS:#1f8a70;--card:#171922;--cardL:#262935;--sh:0 1px 2px rgba(0,0,0,.4),0 12px 40px rgba(0,0,0,.35);}}
.vtx *{box-sizing:border-box;}
.vtx .vtx-wrap{max-width:1080px;margin:0 auto;padding:0 24px;}
.vtx-top{background:var(--ink);border-bottom:2px solid var(--amber);padding:56px 0 48px;}
.vtx-eyebrow{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--amber);margin:0 0 18px;}
.vtx-h1{font-size:clamp(30px,5.6vw,58px);line-height:1.03;letter-spacing:-.03em;font-weight:800;margin:0 0 20px;color:#f6f3ec;text-wrap:balance;}
.vtx-lede{font-size:clamp(16px,2.2vw,20px);color:#c9c5b8;max-width:48ch;margin:0;}
.vtx-lede b{color:var(--amberS);font-weight:600;}
.vtx-sec{padding:52px 0;border-top:1px solid var(--line);}
.vtx-label{font-family:ui-monospace,Menlo,monospace;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--soft);margin:0 0 8px;}
.vtx-label .vtx-n{color:var(--amber);}
.vtx-h2{font-size:clamp(23px,3.3vw,33px);line-height:1.1;letter-spacing:-.02em;font-weight:800;margin:0 0 14px;text-wrap:balance;}
.vtx-sub{color:var(--soft);max-width:62ch;margin:0 0 4px;}
.vtx-flow{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:22px;}
.vtx-step{background:var(--card);border:1px solid var(--cardL);border-radius:12px;padding:16px;box-shadow:var(--sh);}
.vtx-step .vtx-k{font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--amber);margin:0 0 8px;}
.vtx-step b{display:block;margin-bottom:3px;font-size:15px;color:var(--text);}
.vtx-step p{font-size:14.5px;margin:0;color:var(--soft);}
.vtx-board{overflow-x:auto;border:1px solid var(--cardL);border-radius:14px;box-shadow:var(--sh);margin-top:22px;}
.vtx-table{border-collapse:collapse;width:100%;font-size:14.5px;background:var(--card);}
.vtx-table thead th{font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--soft);font-weight:600;text-align:left;padding:12px 14px;border-bottom:1px solid var(--cardL);white-space:nowrap;}
.vtx-table td{padding:11px 14px;border-bottom:1px solid var(--cardL);vertical-align:top;}
.vtx-table tbody tr:last-child td{border-bottom:0;}
.vtx-name{font-weight:700;}
.vtx-desc{color:var(--soft);font-size:13px;}
.vtx-num{font-family:ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums;white-space:nowrap;}
.vtx-cap{color:var(--amber);font-weight:600;}
.vtx-pill{display:inline-block;font-family:ui-monospace,Menlo,monospace;font-size:10.5px;letter-spacing:.06em;padding:2px 8px;border-radius:999px;white-space:nowrap;border:1px solid currentColor;}
.vtx-pill.vtx-live{color:var(--teal);}
.vtx-pill.vtx-open{color:var(--soft);}
.vtx-pill.vtx-lab{color:var(--amber);}
.vtx-pill.vtx-pump{color:var(--amber);}
.vtx-dots{color:var(--amber);letter-spacing:2px;}
.vtx-dots .vtx-off{color:var(--line);}
.vtx-note{background:var(--paper2);border-left:3px solid var(--amber);border-radius:0 10px 10px 0;padding:14px 18px;font-size:14.5px;color:var(--soft);margin-top:20px;}
.vtx-note b{color:var(--text);}
.vtx-note.vtx-teal{border-left-color:var(--teal);}
.vtx-note.vtx-warn{border-left-color:var(--amber);}
.vtx-feature{background:var(--ink);border:1px solid #2a2d38;border-radius:18px;padding:34px;margin-top:6px;}
.vtx-badge{display:inline-flex;align-items:center;gap:7px;font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--tealS);border:1px solid var(--tealS);border-radius:999px;padding:3px 10px;margin-bottom:18px;}
.vtx-badge .vtx-dot{width:7px;height:7px;border-radius:50%;background:var(--tealS);}
.vtx-fmuted{color:#8f8e9a;font-size:14px;max-width:56ch;margin:0 0 12px;}
.vtx-fbody{color:#c4c0b4;max-width:58ch;}
.vtx-fbody b{color:#e9e6dd;}
.vtx-grid2{display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:24px;}
.vtx-mth{font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--amberS);margin:0 0 10px;}
.vtx-actives{display:grid;gap:8px;}
.vtx-arow{display:grid;grid-template-columns:auto 1fr;gap:12px;font-size:14px;padding:9px 12px;background:#16181f;border:1px solid #262935;border-radius:9px;}
.vtx-ing{font-weight:700;color:#f2efe7;}
.vtx-why{color:#9b9aa6;}
.vtx-kv{list-style:none;margin:0;padding:0;}
.vtx-kv li{display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid #262935;font-size:14.5px;}
.vtx-kv li:last-child{border-bottom:0;}
.vtx-vlab{color:#9b9aa6;}
.vtx-vval{font-family:ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums;color:#f2efe7;text-align:right;}
.vtx-vval.vtx-hi{color:var(--amberS);}
.vtx-fnote{font-size:13px;color:#8f8e9a;margin-top:12px;}
.vtx-steps{counter-reset:s;list-style:none;padding:0;margin:22px 0 0;display:grid;gap:10px;}
.vtx-steps li{counter-increment:s;display:grid;grid-template-columns:auto 1fr;gap:14px;background:var(--card);border:1px solid var(--cardL);border-radius:11px;padding:14px 16px;box-shadow:var(--sh);}
.vtx-steps li::before{content:counter(s);font-family:ui-monospace,Menlo,monospace;font-weight:700;color:var(--amber);background:var(--paper2);border-radius:8px;width:30px;height:30px;display:grid;place-items:center;font-size:14px;}
.vtx-steps b{font-weight:700;}
.vtx-steps span{color:var(--soft);font-size:14px;}
.vtx-plan{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:22px;}
.vtx-phase{background:var(--card);border:1px solid var(--cardL);border-radius:12px;padding:16px;box-shadow:var(--sh);}
.vtx-wk{font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.1em;color:var(--amber);text-transform:uppercase;margin:0 0 8px;}
.vtx-phase b{display:block;font-size:15px;margin-bottom:5px;}
.vtx-phase p{font-size:13.5px;color:var(--soft);margin:0;}
.vtx-foot{border-top:1px solid var(--line);padding:28px 0 48px;color:var(--soft);font-size:13px;}
.vtx-fmono{color:var(--amber);font-family:ui-monospace,Menlo,monospace;}
@media (max-width:860px){.vtx-flow,.vtx-plan{grid-template-columns:repeat(2,1fr);}.vtx-grid2{grid-template-columns:1fr;}}
@media (max-width:560px){.vtx-flow,.vtx-plan{grid-template-columns:1fr;}.vtx-feature{padding:22px;}}
`;
