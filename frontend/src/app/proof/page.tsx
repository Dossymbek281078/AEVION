import type { Metadata } from "next";
import { ProductPageShell } from "@/components/ProductPageShell";
import { PageTracking } from "@/components/PageTracking";
import { ProofPilotBlock } from "@/components/ProofPilotBlock";
import { PILOT_USD, PILOT_RECORDS, PILOT_DAYS } from "@/lib/proofPilot";

/**
 * Страница для ПОКУПАТЕЛЕЙ ДАННЫХ — продолжение письма, а не витрина.
 *
 * ПОВОД (08.10.2026, замер воронки за 4 дня с исправленной единицей byPost).
 * Из шестнадцати писем площадкам лицензирования и дата-компаниям живых
 * переходов оказалось ТРИ (Protege 1, Innodata 2), до страницы цен не дошёл
 * НИ ОДИН, ответов ноль. Письма при этом доходят — клики это и доказывают.
 * Умирал следующий шаг: все ссылки вели на /bureau, где заголовок про
 * «Proof of Authorship & Prior Art», а слов provenance, training data и
 * dataset нет вовсе. Человек, которому мы написали про происхождение файлов
 * для обучения ИИ, попадал на витрину бюро для авторов и не находил ни одного
 * слова из нашего письма.
 *
 * Поэтому здесь нет ни цен, ни кнопки «купить», ни перечня модулей. Есть ровно
 * то, что обещано в письме: что проверяется, чего НЕТ, три команды и порядок
 * пилота. Страница серверная намеренно — её должно быть видно и без браузера.
 *
 * ПРАВИЛО ДЛЯ ТОГО, КТО БУДЕТ ЕЁ ПРАВИТЬ: ни одного числа без замера. Все
 * цифры ниже сняты с прода 08.10.2026 и совпадают с тем, что написано в
 * письмах; разойдутся — письмо станет ложью раньше, чем страница.
 */

export const metadata: Metadata = {
  title: "Provenance for licensed training data",
  description:
    "AEVION attaches to a file a proof anyone can recheck without us: that it existed at a given moment, in exactly that form, and has not been altered since. Verify it yourself before talking to us.",
  alternates: { canonical: "/proof" },
  openGraph: {
    title: "Provenance you verify without us — AEVION",
    description:
      "Ed25519 over RFC 8785, published records, offline verification. Run our verifier against our own live signatures before any conversation.",
    type: "article",
    siteName: "AEVION",
  },
  robots: { index: true, follow: true },
};

/*
 * ⚠️ ИМЕНА В ЭТОМ ФАЙЛЕ — ЛАТИНИЦЕЙ НАМЕРЕННО, и это не вкусовщина.
 * Сторож englishAttrsDoNotGrow считает страницу «русским экраном» по наличию
 * кириллицы в ВИДИМОМ тексте, а его образец грубый и ловит кириллические имена
 * переменных тоже. Я назвал компонент «Строка» и константу «ЗАМЕР» — и сторож
 * тут же объявил английские подписи в метаданных недопустимыми подсказками на
 * русском экране (0 -> 2). Тот же класс уже ломал quantum-shield 29.09.
 * Страница целиком англоязычная: имена оставляем латиницей.
 */
const MEASURED = "2026-10-11";

/*
 * Адрес архива проверяльщика. Лежит статикой в frontend/public, поэтому
 * скачивается без ответа на письмо, без формы и без аккаунта — ровно тот шаг,
 * который до 11.10 требовал, чтобы занятый инженер ответил на холодное письмо.
 * Имя файла в двух местах (здесь и в public) держит сторож страницы.
 */
const VERIFIER = "/aevion-verify.zip";

/*
 * Адрес для ответа тому, у кого нашего письма нет: ссылку чаще всего
 * ПЕРЕСЫЛАЮТ, и до 11.10 такой читатель упирался в «reply to the letter».
 *
 * Почему именно этот адрес, и что про него измерено (подробно —
 * `07-Заявки-и-инвесторы/2026-10-02-ДАННЫЕ-ДЛЯ-ИИ/11-АДРЕС-для-ответа-замер.md`):
 * у домена есть MX (improvmx), почтовый сервер отвечает «250 Recipient
 * accepted» на этот ящик, а пересылка доказана одиннадцатью письмами ПОСТОРОННИХ
 * отправителей на пять произвольных ящиков домена за 60 дней. Чего НЕ измерено:
 * письма, пришедшего именно на `data@`, никто не видел — туда ещё не писали, а
 * проверить его письмом из нашего же Gmail нельзя в принципе (домен пересылает
 * в тот самый ящик, а Gmail отбрасывает копию своего отправленного письма).
 *
 * Сторож материалов не даёт опубликовать наш адрес без датированной строки
 * «доставка подтверждена ДД.ММ.ГГГГ» в материалах — именно чтобы это не
 * держалось на чьей-то памяти.
 */
const CONTACT = "data@aevion.app";

const Row = ({ children }: { children: React.ReactNode }) => (
  <li style={{ marginBottom: 8 }}>{children}</li>
);

export default function ProofPage() {
  return (
    <main>
      {/* Метка канала из письма должна дожить до учёта: без этого мы снова не
          узнаем, какое из писем привело человека. */}
      <PageTracking page="proof" />
      <ProductPageShell maxWidth={760}>
        <h1
          style={{
            fontSize: 30,
            fontWeight: 900,
            marginBottom: 8,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
          }}
        >
          Provenance for the data you license
        </h1>
        {/*
         * ПОВОД 11.10. Здесь стояло «You received a letter from us» — страница
         * предполагала письмо. Но самый вероятный путь к решающему человеку —
         * ПЕРЕСЫЛКА: инженер, которому мы написали, отправляет ссылку юристу
         * или в закупки, и тот открывает страницу без всякого письма. Для него
         * первая фраза была неверной, а дальше страница трижды отсылала «reply
         * to the letter» — к письму, которого у него нет. Плюс страница лежит
         * в карте сайта (проверено: 731 адрес, /proof среди них), то есть
         * приходят и из поиска.
         *
         * Теперь письмо упомянуто как ОДИН из путей, а не как условие, и прямо
         * сказано: чтобы нас проверить, связываться с нами не нужно вообще.
         */}
        <p style={{ color: "#475569", fontSize: 16, lineHeight: 1.6, marginBottom: 26 }}>
          If you arrived from our letter, this page is its continuation. If someone
          forwarded you the link, you have not missed anything: everything needed to judge
          us is on this page and in the archive below, and none of it requires contacting
          us. What is verifiable, what is not, and how to check both yourself — before any
          conversation about money.
        </p>

        {/*
         * 🔴 УКАЗАТЕЛЬ НА ПЛАТНЫЙ ШАГ, И ВОТ ЗАЧЕМ ОН НУЖЕН ОТДЕЛЬНО.
         *
         * Замер живым браузером 12.10.2026 сразу после выкатки блока пилота
         * (прод 02a69a6bd531, страница целиком): кнопка «Order the pilot»
         * достижима в оба окна (elementFromPoint отвечает «она сама»), но лежит
         * на 4.9 экрана вниз при 390×844 и на 3.0 экрана при 1463×724. То есть
         * единственный платный шаг страницы существует и работает, а увидеть
         * его без длинной прокрутки нельзя.
         *
         * Порядок убеждения при этом менять НЕЛЬЗЯ: цена стоит после доводов
         * намеренно — человек сперва убеждается, что проверка работает без нас.
         * Поэтому здесь не блок и не кнопка, а ОДНА строка: платный шаг есть,
         * стоит столько, лежит там. Денег она не просит и обещаний не добавляет.
         */}
        <p style={{ color: "#475569", fontSize: 15, lineHeight: 1.6, marginBottom: 26 }}>
          If you already know what you need signed, the paid pilot is{" "}
          <a href="#pilot" style={{ color: "#1d4ed8", fontWeight: 700 }}>
            ${PILOT_USD} for up to {PILOT_RECORDS.toLocaleString("en-US")} records in{" "}
            {PILOT_DAYS} days
          </a>{" "}
          — the terms and the limits are further down this page.
        </p>
        {/* 129: дубль кнопки заказа в первом экране — на телефоне до блока пилота 4 экрана прокрутки, 0 нажатий за 14 дн. */}
        <p style={{ marginTop: -14, marginBottom: 26 }}>
          <a href="#pilot" data-proof-order-top style={{ display: "inline-block", padding: "10px 18px", borderRadius: 10, background: "#0f766e", color: "#fff", fontWeight: 800, fontSize: 15, textDecoration: "none" }}>Order the pilot — ${PILOT_USD}</a>
        </p>

        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            padding: "16px 18px",
            marginBottom: 28,
            background: "#f8fafc",
            fontSize: 15,
            lineHeight: 1.7,
            color: "#334155",
          }}
        >
          <b>What we do.</b> We attach to a digital work a proof anyone can recheck{" "}
          <b>without us</b>: that it existed at a given moment, in exactly that form, and
          has not been altered since. Ed25519 over RFC&nbsp;8785 canonical JSON, published
          records, offline verification against a published public key. No account with
          us, no access to our systems, no trust in us.
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 32, marginBottom: 10 }}>
          Check it in three commands
        </h2>
        <p style={{ color: "#475569", fontSize: 15, lineHeight: 1.7, marginBottom: 12 }}>
          The verifier is 8 files, no dependencies, Node&nbsp;18+. It deliberately ignores
          the validity flags our own API returns and recomputes everything with Node&apos;s
          built-in crypto.{" "}
          <a href={VERIFIER} style={{ color: "#1d4ed8", fontWeight: 700 }}>
            Download it
          </a>{" "}
          — no form, no account, no reply to us required.
        </p>
        <pre
          style={{
            background: "#0f172a",
            color: "#e2e8f0",
            padding: "14px 16px",
            borderRadius: 10,
            fontSize: 13,
            lineHeight: 1.7,
            overflowX: "auto",
            marginBottom: 14,
          }}
        >
{`node verify-aevion.mjs manifest-sample.json           # five live production signatures
node verify-aevion.mjs manifest-control-revoked.json  # a revoked one — must fail
node demo-local.mjs                                   # sign 3 files, alter one byte, watch it refuse`}
        </pre>
        <p style={{ color: "#475569", fontSize: 15, lineHeight: 1.7, marginBottom: 8 }}>
          Measured {MEASURED}: five live signatures pass (exit 0); the revoked one is refused
          with reason and date (exit 1); the offline demo refuses the altered file and
          prints both hashes.
        </p>
        <p style={{ color: "#475569", fontSize: 15, lineHeight: 1.7, marginBottom: 26 }}>
          The second command matters more than the first. A verifier that approves
          everything proves nothing, so the refusal case ships in the same archive.
        </p>

        <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 32, marginBottom: 10 }}>
          Running in production right now
        </h2>
        <ul style={{ color: "#334155", fontSize: 15, lineHeight: 1.7, paddingLeft: 20, marginBottom: 8 }}>
          <Row>
            <b>42 signatures</b> in the live registry, <b>20 of them revoked</b>, two
            active keys — revocation is visible in verification, not hidden.
          </Row>
          <Row>
            Shamir <b>2-of-3</b> custody of the proof records, with Ed25519.
          </Row>
          <Row>
            Public verification address: anyone can fetch a record and recheck it offline.
          </Row>
        </ul>
        <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.7, marginBottom: 26 }}>
          Measured on production {MEASURED}. Those 42 signatures are a working base, not
          inventory — see the next section.
        </p>

        <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 32, marginBottom: 10 }}>
          What we are not — stated before you find it
        </h2>
        <div
          style={{
            border: "1px solid #fecaca",
            background: "#fef2f2",
            borderRadius: 10,
            padding: "16px 18px",
            marginBottom: 26,
          }}
        >
          <ul style={{ color: "#7f1d1d", fontSize: 15, lineHeight: 1.75, paddingLeft: 20, margin: 0 }}>
            <Row>
              <b>We hold no catalogue.</b> We sell no data. We are a proof layer on top of
              data someone else licenses.
            </Row>
            <Row>
              <b>We do not certify the author&apos;s identity.</b> Document checks are a
              stub today. A signature proves the file belongs to the key holder, not that
              the key holder is who they claim to be.
            </Row>
            <Row>
              <b>There is no notary co-signature</b>, and our marks carry no notarial legal
              force in any jurisdiction.
            </Row>
            <Row>
              <b>No SOC 2, no ISO 27001.</b> Neither audit has been undertaken.
            </Row>
            <Row>
              <b>Consent-to-train is specified, not built.</b> There is no field today in
              which an author grants or withdraws it.
            </Row>
            <Row>
              <b>No external paying customers yet.</b>
            </Row>
          </ul>
        </div>
        <p style={{ color: "#475569", fontSize: 15, lineHeight: 1.7, marginBottom: 26 }}>
          We put this above the pilot rather than in a footnote. If any of it is a
          dealbreaker, it is cheaper for both of us to know now than during legal review.
        </p>

        <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 32, marginBottom: 10 }}>
          The pilot, concretely
        </h2>
        <ol style={{ color: "#334155", fontSize: 15, lineHeight: 1.75, paddingLeft: 20, marginBottom: 14 }}>
          <Row>You name a set you already license. Nothing leaves your side yet.</Row>
          <Row>
            We prepare the payloads — a hash and a canonical record per file — and sign
            them.
          </Row>
          <Row>
            You get a manifest and verify it <b>independently</b>, with no access to our
            systems. Add your local copy of each file and the check also proves that the
            bytes you hold are the bytes that were signed.
          </Row>
          <Row>No money changes hands, and the manifest is yours either way.</Row>
        </ol>
        <p style={{ color: "#475569", fontSize: 15, lineHeight: 1.7, marginBottom: 26 }}>
          A valid signature alone does not mean the file in your hand is the signed one.
          Only passing your own copy to the verifier establishes that — which is why step
          three exists.
        </p>

        <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 32, marginBottom: 10 }}>
          Why this is worth your five minutes
        </h2>
        <p style={{ color: "#475569", fontSize: 15, lineHeight: 1.7, marginBottom: 12 }}>
          The authors&apos; case against Anthropic separated two questions: training on
          copyrighted works was not itself found unlawful, while obtaining them from pirate
          sites was — and ended in a $1.5&nbsp;billion settlement, roughly $3,000 per work.
          The money did not buy data; data is free and everywhere. It bought{" "}
          <b>provenance</b>.
        </p>
        <p style={{ color: "#475569", fontSize: 15, lineHeight: 1.7, marginBottom: 30 }}>
          That is the only part we make machine-checkable, and the only part we claim.
        </p>

        <ProofPilotBlock />

        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            padding: "16px 18px",
            background: "#f8fafc",
            fontSize: 15,
            lineHeight: 1.7,
            color: "#334155",
          }}
        >
          <b>
            <a href={VERIFIER} style={{ color: "#1d4ed8" }}>
              Download the verifier
            </a>
          </b>{" "}
          — 8 files, no dependencies, including the failing control. Nothing is asked of you
          first: no form, no account, no reply. You do not need anything from us to read it,
          and you do not need us to run it. If it convinces you, reply to our letter or
          write to{" "}
          <a href={`mailto:${CONTACT}`} style={{ color: "#1d4ed8", fontWeight: 700 }}>
            {CONTACT}
          </a>
          . If it does not convince you, you have lost five minutes and we have learned
          something.
        </div>
      </ProductPageShell>
    </main>
  );
}
