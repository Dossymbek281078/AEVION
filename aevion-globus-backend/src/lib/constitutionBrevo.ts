/**
 * Brevo (formerly Sendinblue) email helper for Constitution.
 *
 * Env:
 *   BREVO_API_KEY       — from Brevo dashboard → Account → API Keys
 *   BREVO_SENDER_EMAIL  — verified sender (default: noreply@aevion.app)
 *   BREVO_SENDER_NAME   — display name (default: AEVION Constitution)
 *
 * Used by:
 *   - constitutionWaitlist.ts: sendWeeklyDigest() when Pro launches
 *   - Future transactional emails: welcome, upgrade confirmation, cert-issued
 */

import { degraded } from "./degradedResponse";
import { noteEmailSent } from "./brevoQuota";
import { unsubscribeUrl, unsubContact } from "./waitlistUnsubToken";



const BREVO_API = "https://api.brevo.com/v3";

type BrevoRecipient = { email: string; name?: string };

export type ConstitutionEmailPayload = {
  to: BrevoRecipient[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  replyTo?: BrevoRecipient;
  tags?: string[];
};

async function sendBrevoEmail(payload: ConstitutionEmailPayload): Promise<{
  ok: boolean;
  messageId?: string;
  error?: string;
  degraded?: boolean;
  degradedReason?: string;
}> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn("[Brevo] BREVO_API_KEY not set — email not sent");
    return { ok: false, error: "BREVO_API_KEY missing" };
  }
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "noreply@aevion.app";
  const senderName  = process.env.BREVO_SENDER_NAME  || "AEVION Constitution";

  const body = {
    sender: { email: senderEmail, name: senderName },
    to: payload.to,
    subject: payload.subject,
    htmlContent: payload.htmlContent,
    textContent: payload.textContent,
    replyTo: payload.replyTo,
    tags: payload.tags,
  };

  try {
    const r = await fetch(`${BREVO_API}/smtp/email`, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      // Без таймаута зависший Brevo держал запрос бесконечно и вместе с ним
      // соединение из пула. Письмо не критично, ждать его нечего.
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return { ok: false, error: `Brevo HTTP ${r.status}: ${text.slice(0, 200)}` };
    }
    const j = await r.json() as { messageId?: string };
    // Считаем ОТПРАВЛЕННЫЕ, а не попытки: квоту Brevo расходует принятое письмо.
    // Стоит и на пути без messageId — провайдер принял запрос, значит квота
    // потрачена, даже если доставка не подтверждена.
    noteEmailSent();
    if (!j.messageId) {
      const { degradedReason } = degraded("Brevo returned 2xx with no messageId — delivery not confirmed");
      return { ok: true, degraded: true, degradedReason };
    }
    return { ok: true, messageId: j.messageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

/* ─── Constitution-specific email templates ──────────────────────── */

/**
 * Письмо подписчику зависит от того, где он подписался.
 *
 * Таблица `constitution_waitlist` перестала быть только конституционной: с
 * 14.08.2026 в неё пишет и общая форма на главной и на /go, потому что заводить
 * второе хранилище адресов ради тех же трёх полей — дороже, чем поле `source`.
 * Но письмо оставалось одно, конституционное, и человек, оставивший адрес на
 * главной ради «раннего доступа к модулям», получал «Ты в листе ожидания
 * Constitution Pro» с обещанием скидки на продукт, которого не просил, и с
 * подписью «вы подписались на aevion.app/constitution/pricing» — неправдой.
 * Замер в журнале Brevo показал, что письма реально уходят, то есть неправда
 * доезжала бы до каждого настоящего подписчика.
 *
 * Развилка идёт по `source`, а не по отдельному флагу: source уже хранится в
 * строке и уже отвечает на вопрос «откуда человек».
 */
/**
 * Блок отписки для подвала письма.
 *
 * До 21.08.2026 здесь стояла ссылка на страницу, которой НЕ СУЩЕСТВУЕТ (404), —
 * то есть отписаться было нельзя ни одним способом. Теперь ссылка ведёт на рабочую
 * ручку и несёт токен; если подписывать нечем (нет секрета), вместо ссылки в письме
 * стоит живой адрес почты, а не ссылка, которая молча не сработает.
 */
function unsubBlock(email: string, color = "#64748b"): string {
  const url = unsubscribeUrl(email);
  return url
    ? `<a href="${url}" style="color:${color}">Отписаться</a>`
    : `Отписаться: напишите на <a href="mailto:${unsubContact()}" style="color:${color}">${unsubContact()}</a>`;
}

export function buildWaitlistConfirmEmail(email: string, source?: string): ConstitutionEmailPayload {
  // Проверяется ВХОЖДЕНИЕ метки, а не начало строки. С 19.08 источник может
  // быть списком через запятую («cyberchess,constitution»): при повторной
  // подписке метка теперь дописывается, а не перезаписывает предыдущую. Условие
  // `/^constitution/` на таком списке дало бы ложное «не наш» и отправило бы
  // конституционному подписчику письмо про ранний доступ.
  const marks = String(source ?? "")
    .split(",")
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean);
  const fromConstitution = marks.length === 0 || marks.some((m) => m.startsWith("constitution"));
  if (!fromConstitution) return buildPlatformWaitlistEmail(email, source);
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0b1736;color:#e7ecf8;border-radius:12px">
      <div style="color:#d4af37;font-size:24px;font-weight:900;margin-bottom:8px">AEVION Constitution</div>
      <p style="margin:0 0 16px">Ты в списке ожидания Pro.</p>
      <p style="color:#9aa3c0;margin:0 0 16px">
        Как только Constitution Pro запустится, ты получишь письмо с
        <strong style="color:#f472b6">30% скидкой на первый месяц</strong> — только для ранней подписки.
      </p>
      <p style="color:#9aa3c0;margin:0 0 24px">
        Пока — пробуй Free: <a href="https://aevion.app/constitution" style="color:#22d3ee">aevion.app/constitution</a>
      </p>
      <hr style="border:none;border-top:1px solid rgba(212,175,55,0.2);margin-bottom:16px">
      <p style="color:#64748b;font-size:11px;margin:0">
        Ты получил это письмо потому что подписался на waitlist на aevion.app/constitution/pricing.<br>
        ${unsubBlock(email)}
      </p>
    </div>
  `;
  return {
    to: [{ email }],
    subject: "📨 Ты в листе ожидания Constitution Pro",
    htmlContent: html,
    textContent: `Ты в списке ожидания Constitution Pro. Откроем — сразу письмо с 30% скидкой. Пока: aevion.app/constitution`,
    tags: ["constitution", "waitlist-confirm"],
  };
}

/**
 * Письмо тому, кто оставил адрес на главной или на /go: ранний доступ к модулям
 * платформы, без обещаний по конкретному продукту, которых мы не давали на той
 * странице. Никаких скидок здесь не обещаем — цену и условия решает основатель.
 */
/**
 * Посадочные модулей: человек подписался НЕ «на платформу вообще», а ради
 * конкретного продукта и конкретной даты, и письмо обязано это отражать.
 *
 * До 19.08 подписчику с /cyberchess/launch уходило «вы оставили адрес на
 * главной странице aevion.app» — неправда — и ни слова про шахматы, ради
 * которых он подписался. Форма научилась передавать `source` 14.08, письмо
 * про это не знало.
 *
 * Дата названа как ПЛАН, а не обещание: письмо живёт в почте месяцами, а дата
 * запуска — цель доски, и она может сдвинуться. Обещаем то, что зависит от
 * нас: написать в день запуска.
 */
const LAUNCH_MODULES: Array<{ prefix: string; name: string; plan: string; page: string }> = [
  { prefix: "cyberchess", name: "CyberChess", plan: "30 сентября", page: "https://aevion.app/cyberchess/launch" },
  { prefix: "bureau", name: "AEVION IP Bureau", plan: "6 сентября", page: "https://aevion.app/bureau/launch" },
  { prefix: "qright", name: "AEVION IP Bureau", plan: "6 сентября", page: "https://aevion.app/bureau/launch" },
  { prefix: "devhub", name: "DevHub Studio", plan: "13 сентября", page: "https://aevion.app/devhub/launch" },
  { prefix: "multichat", name: "AEVION Multichat", plan: "20 сентября", page: "https://aevion.app/multichat-engine/launch" },
];

/**
 * Входы, где продукт УЖЕ работает. Отличать их от LAUNCH_MODULES обязательно:
 * там человек ждёт открытия, здесь он уже получил ценность и ждать ему нечего.
 *
 * Замер 27.08.2026: подписчик со страницы протокола долголетия получал общий
 * текст «платформа выпускает модули по одному, напишем в день запуска
 * следующего». Он подписался РАДИ протокола и уже забрал его бесплатно —
 * письмо не подтверждало ни того, что он получил, ни следующего шага. Это тот
 * же класс, что чинили 19.08 для шахмат: источник доезжает до письма, а письмо
 * про него не знает.
 */
/**
 * Часовой пояс запуска — Алматы, UTC+5 (тот же, что у обратного отсчёта на
 * странице запуска). Держим число здесь, а не считаем от сервера: сервер
 * живёт в UTC, и без сдвига письмо на шесть часов считало бы, что запуск
 * ещё не наступил.
 */
const LAUNCH_TZ_OFFSET_MS = 5 * 3_600_000;

/** Наступил ли день, с которого модуль считается открытым. */
// Экспортируется РАДИ ПРОВЕРКИ: без параметра now и без экспорта поведение в
// день запуска нельзя проверить иначе как переводом часов на машине.
export function isLiveNow(liveFromUtcMidnight?: number, now: Date = new Date()): boolean {
  if (liveFromUtcMidnight === undefined) return true;
  const shifted = new Date(now.getTime() + LAUNCH_TZ_OFFSET_MS);
  const today = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return today >= liveFromUtcMidnight;
}

const LIVE_ENTRIES: Array<{ prefix: string; name: string; page: string; nextStep: string; liveFrom?: number }> = [
  {
    prefix: "longevity",
    name: "Протокол долголетия",
    page: "https://aevion.app/longevity",
    // Следующий шаг называем без цен и без скидок: цена живёт в каталоге, а
    // условия решает основатель (это же сказано у соседнего письма выше).
    nextStep:
      "Протокол открыт целиком на странице — маркеры, стек по доказательности и двенадцать недель. " +
      "Там же можно забрать его в PDF, чтобы заполнять на нулевой и двенадцатой неделе, " +
      "и открыть подписку на остальные модули платформы.",
  },
  {
    // Шахматы переходят из «планируем» в «открыто» ПО ДАТЕ, а не рукой.
    // Найдено 29.08.2026: список открытых модулей был статическим, и 30-го
    // подписавшийся получил бы «Открываем по плану 30 августа» — в сам день
    // запуска. Ручной шаг, о котором никто не вспомнит в день запуска, — это
    // не шаг, а ловушка.
    prefix: "cyberchess",
    name: "CyberChess",
    page: "https://aevion.app/cyberchess",
    // ПЕРЕНЕСЕНО основателем 29.08.2026 на 30 сентября: «нет удобного
    // разбора партии сразу после её конца, много недоработок».
    // Дата здесь не украшение: 30.08 она сделала письмо ложным —
    // подписчик получал «уже открыт» в день, когда запуска не было.
    liveFrom: Date.UTC(2026, 8, 30),
    // Следующий шаг называем тем же, чем письмо запуска: задача дня решается
    // за минуту и работает с телефона — это самый короткий путь к первой
    // ценности. Цен и условий здесь нет: они живут в каталоге.
    nextStep:
      "Начать проще всего с задачи дня — она решается за минуту. " +
      "Там же рейтинг и турниры, а партию с движком удобнее играть с компьютера.",
  },
];

function liveEntryFromSource(source?: string) {
  if (!source) return null;
  const s = source.toLowerCase();
  return LIVE_ENTRIES.find((m) => (s === m.prefix || s.startsWith(`${m.prefix}-`)) && isLiveNow(m.liveFrom)) ?? null;
}

function moduleFromSource(source?: string) {
  if (!source) return null;
  const s = source.toLowerCase();
  return LAUNCH_MODULES.find((m) => s === m.prefix || s.startsWith(`${m.prefix}-`)) ?? null;
}

export function buildPlatformWaitlistEmail(email: string, source?: string): ConstitutionEmailPayload {
  const live = liveEntryFromSource(source);
  const mod = live ? null : moduleFromSource(source);
  const where = live
    ? `странице «${live.name}»`
    : mod
      ? `странице запуска ${mod.name}`
      : source === "go" || source?.startsWith("go-")
        ? "странице aevion.app/go"
        : "главной странице aevion.app";
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0b1736;color:#e7ecf8;border-radius:12px">
      <div style="color:#d4af37;font-size:24px;font-weight:900;margin-bottom:8px">AEVION</div>
      <p style="margin:0 0 16px">${live
        ? `Адрес записан — «${live.name}» уже открыт для вас.`
        : `Адрес записан${mod ? ` — вы в списке раннего доступа к ${mod.name}` : " — вы в списке раннего доступа"}.`}</p>
      <p style="color:#9aa3c0;margin:0 0 16px">
        ${live
          ? live.nextStep
          : mod
            ? `Открываем по плану ${mod.plan}. Напишем вам в день запуска — с условиями раннего доступа, пока цена стартовая. Если дата сдвинется, письмо всё равно придёт в день, когда откроем.`
            : "Платформа выпускает модули по одному. Как только выйдет следующий, вы получите письмо в день запуска — с условиями раннего доступа, пока цена стартовая."}
      </p>
      <p style="color:#9aa3c0;margin:0 0 24px">
        ${live
          ? `Открыть: <a href="${live.page}" style="color:#22d3ee">${live.page.replace("https://", "")}</a>`
          : mod
            ? `Страница запуска: <a href="${mod.page}" style="color:#22d3ee">${mod.page.replace("https://", "")}</a>`
            : `Пока можно посмотреть, что уже работает: <a href="https://aevion.app/go" style="color:#22d3ee">aevion.app/go</a>`}
      </p>
      <hr style="border:none;border-top:1px solid rgba(212,175,55,0.2);margin-bottom:16px">
      <p style="color:#64748b;font-size:11px;margin:0">
        Вы получили это письмо, потому что оставили адрес на ${where}.<br>
        ${unsubBlock(email)}
      </p>
    </div>
  `;
  return {
    to: [{ email }],
    subject: live
      ? `${live.name} — открыт для вас`
      : mod
        ? `Вы в списке раннего доступа: ${mod.name}`
        : "Вы в списке раннего доступа AEVION",
    htmlContent: html,
    textContent: live
      ? `Адрес записан — «${live.name}» уже открыт. ${live.nextStep} Открыть: ${live.page}`
      : mod
        ? `Адрес записан — вы в списке раннего доступа к ${mod.name}. Открываем по плану ${mod.plan}, напишем в день запуска. Страница: ${mod.page}`
        : `Адрес записан — вы в списке раннего доступа AEVION. Напишем в день запуска следующего модуля. Что уже работает: aevion.app/go`,
    tags: live ? ["platform", "live-entry-confirm"] : ["platform", "waitlist-confirm"],
  };
}

export function buildWeeklyDigestEmail(
  recipients: Array<{ email: string }>,
  topArtifacts: Array<{ title: string; regimeName: string; url: string; votes: number }>,
  weekOf: string,
): ConstitutionEmailPayload {
  const list = topArtifacts
    .map(
      (a, i) => `
      <tr>
        <td style="padding:8px 4px;color:#d4af37;font-weight:700">#${i + 1}</td>
        <td style="padding:8px 4px">
          <a href="${a.url}" style="color:#22d3ee">${a.title}</a>
        </td>
        <td style="padding:8px 4px;color:#9aa3c0">${a.regimeName}</td>
        <td style="padding:8px 4px;color:#f472b6;text-align:right">👍 ${a.votes}</td>
      </tr>`,
    )
    .join("");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0b1736;color:#e7ecf8;border-radius:12px">
      <div style="color:#d4af37;font-size:22px;font-weight:900;margin-bottom:4px">AEVION Constitution</div>
      <div style="color:#9aa3c0;font-size:12px;margin-bottom:20px">Weekly digest · ${weekOf}</div>
      <h2 style="color:#f5d27a;font-size:18px;margin:0 0 12px">Топ-5 конституций недели</h2>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:1px solid rgba(212,175,55,0.2)">
            <th style="padding:4px;text-align:left;color:#9aa3c0;font-size:11px">#</th>
            <th style="padding:4px;text-align:left;color:#9aa3c0;font-size:11px">Сценарий</th>
            <th style="padding:4px;text-align:left;color:#9aa3c0;font-size:11px">Режим</th>
            <th style="padding:4px;text-align:right;color:#9aa3c0;font-size:11px">Голоса</th>
          </tr>
        </thead>
        <tbody>${list}</tbody>
      </table>
      <div style="margin-top:20px;text-align:center">
        <a href="https://aevion.app/constitution/leaderboard" style="display:inline-block;padding:10px 20px;background:#d4af37;color:#0b1736;font-weight:700;border-radius:8px;text-decoration:none">
          Смотреть все →
        </a>
      </div>
      <hr style="border:none;border-top:1px solid rgba(212,175,55,0.2);margin:20px 0">
      <p style="color:#64748b;font-size:11px;margin:0">
        Constitution Weekly · 1 письмо в неделю ·
        <a href="https://aevion.app/constitution/pricing" style="color:#64748b">Upgrade to Pro</a>
      </p>
    </div>
  `;
  return {
    to: recipients.map((r) => ({ email: r.email })),
    subject: `📊 Топ-5 конституций недели · ${weekOf}`,
    htmlContent: html,
    tags: ["constitution", "weekly-digest"],
  };
}

/* ─── Exported send functions ─────────────────────────────────────── */

/**
 * Письмо с подтверждением адреса.
 *
 * До 19.08.2026 его не было вовсе: `POST /api/auth/email/verify/request`
 * создавал токен, писал его в базу и возвращал `{ok:true}`, а интерфейс
 * показывал «Verification email sent» — то есть сообщал об успехе действия,
 * которого не произошло. В разработке токен отдавался прямо в ответе
 * (`devToken`), и на этом фоне отсутствие отправки в проде не бросалось в
 * глаза.
 *
 * Отправляем тем же путём, каким уходят письма подписчикам, — он проверен и
 * работает. Ссылка ведёт на страницу подтверждения с токеном в адресе.
 */
export function buildEmailVerifyEmail(email: string, verifyUrl: string): ConstitutionEmailPayload {
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0b1736;color:#e7ecf8;border-radius:12px">
      <div style="color:#d4af37;font-size:24px;font-weight:900;margin-bottom:8px">AEVION</div>
      <p style="margin:0 0 16px">Подтвердите адрес — это займёт одно нажатие.</p>
      <p style="color:#9aa3c0;margin:0 0 20px">
        Мы отправили это письмо, потому что на аккаунте ${email} запросили подтверждение адреса.
        Если это были не вы, просто не открывайте ссылку — без неё ничего не изменится.
      </p>
      <p style="margin:0 0 24px">
        <a href="${verifyUrl}" style="display:inline-block;background:#22d3ee;color:#0b1736;font-weight:700;padding:12px 20px;border-radius:8px;text-decoration:none">
          Подтвердить адрес
        </a>
      </p>
      <p style="color:#64748b;font-size:11px;margin:0">
        Ссылка действует ограниченное время. Если кнопка не открывается, скопируйте адрес:<br>
        <span style="color:#9aa3c0">${verifyUrl}</span>
      </p>
    </div>
  `;
  return {
    to: [{ email }],
    subject: "Подтвердите адрес — AEVION",
    htmlContent: html,
    textContent: `Подтвердите адрес: ${verifyUrl}

Если это были не вы — просто не открывайте ссылку.`,
    tags: ["auth", "email-verify"],
  };
}

/** Отправляет письмо подтверждения. Возвращает, УДАЛОСЬ ли — вызывающий обязан
 *  сообщить человеку правду, а не «отправлено» в любом случае. */
export async function sendEmailVerify(email: string, verifyUrl: string): Promise<boolean> {
  const result = await sendBrevoEmail(buildEmailVerifyEmail(email, verifyUrl));
  if (!result.ok) {
    console.error("[Brevo] email-verify failed:", result.error);
    return false;
  }
  if (result.degraded) {
    console.warn(`[Brevo] email-verify degraded for ${email}: ${result.degradedReason}`);
  }
  return true;
}

/** Возвращает, УДАЛОСЬ ли отправить. Вызывающий обязан заметить false:
 *  молчаливый провал неотличим от задержки почты и не всплывает никогда. */
export async function sendWaitlistConfirm(email: string, source?: string): Promise<boolean> {
  const payload = buildWaitlistConfirmEmail(email, source);
  const result = await sendBrevoEmail(payload);
  if (!result.ok) {
    console.error("[Brevo] waitlist-confirm failed:", result.error);
    return false;
  }
  if (result.degraded) {
    console.warn(`[Brevo] waitlist-confirm degraded for ${email}: ${result.degradedReason}`);
  }
  return true;
}

export async function sendWeeklyDigestEmail(
  recipients: Array<{ email: string }>,
  topArtifacts: Array<{ title: string; regimeName: string; url: string; votes: number }>,
  weekOf: string,
): Promise<{ sent: number; errors: number; degraded: number }> {
  if (!recipients.length) return { sent: 0, errors: 0, degraded: 0 };
  // Brevo allows up to 50 recipients per send; batch if needed
  const BATCH = 50;
  let sent = 0;
  let errors = 0;
  let degradedCount = 0;
  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH);
    const payload = buildWeeklyDigestEmail(batch, topArtifacts, weekOf);
    const result = await sendBrevoEmail(payload);
    if (!result.ok) {
      errors += batch.length;
    } else if (result.degraded) {
      // Delivery not confirmed — don't count it as a clean "sent", but it did
      // reach Brevo without an HTTP error, so it's not a hard failure either.
      degradedCount += batch.length;
      console.warn(`[Brevo] weekly-digest degraded for batch of ${batch.length}: ${result.degradedReason}`);
    } else {
      sent += batch.length;
    }
  }
  return { sent, errors, degraded: degradedCount };
}
