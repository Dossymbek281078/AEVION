/**
 * Разбор письма (RFC 822 / .eml) — источник заявок для пилота.
 *
 * Заявки в агентства приходят почтой, и первый день пилота почти всегда упирается
 * в неё. Клиенту проще всего выгрузить письма файлами или настроить пересылку в
 * папку, поэтому здесь разбор БЕЗ сети и без зависимостей: тестируется офлайн,
 * не требует паролей и не ломается от смены почтового провайдера.
 *
 * Ловушки настоящей почты, каждая из которых МОЛЧА портит текст:
 *  - заголовки кодируются как =?UTF-8?B?...?= или =?windows-1251?Q?...?=;
 *  - тело приходит в base64 или quoted-printable, где «=D0=9F» это буква;
 *  - у письма бывает несколько частей (текст и HTML) — брать надо текстовую;
 *  - кодировка объявляется в Content-Type и не обязана быть UTF-8;
 *  - строки в quoted-printable рвутся знаком «=» на конце.
 */


/**
 * Письмо, которое НЕ является обращением клиента: автоответ, рассылка, отбойник.
 * Такие приходят в тот же ящик, и без пометки менеджер получает карточку на
 * автоответ банка. Признаки — стандартные заголовки и служебные адреса.
 */
export function detectNonInquiry(headers, subject) {
  const reasons = [];
  const h = headers || {};
  if (h["auto-submitted"] && !/^no$/i.test(String(h["auto-submitted"]).trim())) reasons.push("автоответ (Auto-Submitted)");
  if (/bulk|list|junk|auto_reply/i.test(String(h["precedence"] || ""))) reasons.push("рассылка (Precedence)");
  if (h["x-autoreply"] || h["x-autorespond"] || h["x-auto-response-suppress"]) reasons.push("автоответ (X-Autoreply)");
  if (h["list-unsubscribe"]) reasons.push("рассылка (есть отписка)");
  const from = String(h.from || "").toLowerCase();
  if (/no-?reply@|mailer-daemon@|postmaster@|bounce/.test(from)) reasons.push("служебный отправитель");
  if (/^(автоответ|out of office|отпуск|delivery status|undelivered)/i.test(String(subject || "").trim())) {
    reasons.push("тема автоответа");
  }
  return reasons;
}

/** Разбирает =?charset?B?base64?= и =?charset?Q?quoted?= в заголовках. */
export function decodeHeaderValue(raw) {
  const value = String(raw || "");
  return value.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (whole, charset, kind, data) => {
    try {
      let bytes;
      if (kind.toLowerCase() === "b") {
        bytes = Buffer.from(data, "base64");
      } else {
        // Q-кодировка: подчёркивание = пробел, =XX = байт
        const text = data.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (m, hex) =>
          String.fromCharCode(parseInt(hex, 16))
        );
        bytes = Buffer.from(text, "binary");
      }
      return new TextDecoder(normalizeCharset(charset)).decode(bytes);
    } catch {
      // не смогли раскодировать — возвращаем как было, но НЕ выбрасываем:
      // потерянная тема письма хуже некрасивой
      return whole;
    }
  });
}

function normalizeCharset(name) {
  const c = String(name || "utf-8").toLowerCase().trim();
  if (c === "utf8" || c === "utf-8") return "utf-8";
  if (c === "koi8r") return "koi8-r";
  return c;
}

/** Раскодирует quoted-printable: «=D0=9F» -> байт, «=» в конце строки — склейка. */
export function decodeQuotedPrintable(text) {
  const joined = String(text || "").replace(/=\r?\n/g, "");
  const bytes = [];
  for (let i = 0; i < joined.length; i++) {
    if (joined[i] === "=" && /[0-9A-Fa-f]{2}/.test(joined.slice(i + 1, i + 3))) {
      bytes.push(parseInt(joined.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(joined.charCodeAt(i) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

/** Делит письмо на заголовки и тело. */
function splitMessage(raw) {
  const text = String(raw || "").replace(/\r\n/g, "\n");
  const sep = text.indexOf("\n\n");
  if (sep === -1) return { headerText: text, body: "" };
  return { headerText: text.slice(0, sep), body: text.slice(sep + 2) };
}

/** Заголовки в объект. Многострочные (свёрнутые) склеиваются. */
export function parseHeaders(headerText) {
  const headers = Object.create(null);
  const lines = String(headerText || "").split("\n");
  let current = null;
  for (const line of lines) {
    if (/^[ \t]/.test(line) && current) {
      headers[current] += " " + line.trim();
      continue;
    }
    const m = line.match(/^([A-Za-z-]+):\s*(.*)$/);
    if (!m) continue;
    current = m[1].toLowerCase();
    // защита: имя заголовка из письма НЕ должно становиться служебным ключом
    if (current === "__proto__" || current === "constructor") { current = null; continue; }
    headers[current] = m[2];
  }
  return headers;
}

function charsetOf(contentType) {
  const m = String(contentType || "").match(/charset\s*=\s*"?([\w-]+)"?/i);
  return normalizeCharset(m ? m[1] : "utf-8");
}

function decodeBody(body, headers) {
  const encoding = String(headers["content-transfer-encoding"] || "").toLowerCase().trim();
  const charset = charsetOf(headers["content-type"]);

  let bytes;
  if (encoding === "base64") {
    bytes = Buffer.from(body.replace(/\s+/g, ""), "base64");
  } else if (encoding === "quoted-printable") {
    bytes = decodeQuotedPrintable(body);
  } else if (charset === "utf-8") {
    // Тело НЕ закодировано, а строку мы уже прочитали как UTF-8 — гнать её через
    // побайтовый путь нельзя: каждый русский символ схлопнется в один байт и текст
    // превратится в мусор. Первый прогон именно так и сломался.
    return String(body);
  } else {
    bytes = Buffer.from(body, "binary");
  }

  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

/** Убирает разметку из HTML-части, если текстовой не оказалось. */
function htmlToText(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Разбирает письмо целиком.
 * @returns {{from, fromEmail, subject, date, text, isHtmlOnly, problems: string[]}}
 */
export function parseEml(raw) {
  const problems = [];
  const { headerText, body } = splitMessage(raw);
  const headers = parseHeaders(headerText);

  const from = decodeHeaderValue(headers.from || "");
  const emailMatch = from.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  const subject = decodeHeaderValue(headers.subject || "");
  const date = headers.date || null;

  const contentType = String(headers["content-type"] || "");
  let text = "";
  let isHtmlOnly = false;

  const boundaryMatch = contentType.match(/boundary\s*=\s*"?([^";]+)"?/i);
  if (boundaryMatch) {
    // Части бывают ВЛОЖЕННЫМИ: multipart/mixed с вложением содержит внутри
    // multipart/alternative с текстом. Без рекурсии такие письма (обычные для
    // Outlook) читаются как «нет ни текстовой, ни HTML-части» — на прогоне из
    // 202 писем так терялось 40, то есть каждое пятое обращение клиента.
    const walk = (rawBody, boundaryId, depth) => {
      if (depth > 5) return { text: "", html: null };   // защита от кольца
      const marker = "--" + boundaryId;
      const parts = String(rawBody).split(marker).slice(1, -1);
      let foundText = "";
      let foundHtml = null;
      for (const part of parts) {
        const { headerText: ph, body: pb } = splitMessage(part.startsWith(String.fromCharCode(10)) ? part.slice(1) : part);
        const partHeaders = parseHeaders(ph);
        const ct = String(partHeaders["content-type"] || "");
        const nested = ct.match(/boundary\s*=\s*"?([^";]+)"?/i);
        if (nested) {
          const inner = walk(pb, nested[1], depth + 1);
          if (inner.text && !foundText) foundText = inner.text;
          if (inner.html && foundHtml === null) foundHtml = inner.html;
          continue;
        }
        if (/text\/plain/i.test(ct) && !foundText) foundText = decodeBody(pb, partHeaders).trim();
        else if (/text\/html/i.test(ct) && foundHtml === null) foundHtml = decodeBody(pb, partHeaders);
      }
      return { text: foundText, html: foundHtml };
    };
    const found = walk(body, boundaryMatch[1], 0);
    if (found.text) {
      text = found.text;
    } else if (found.html !== null) {
      text = htmlToText(found.html);
      isHtmlOnly = true;
    }
    if (!text) problems.push("не найдено ни текстовой, ни HTML-части");
  } else if (/text\/html/i.test(contentType)) {
    text = htmlToText(decodeBody(body, headers));
    isHtmlOnly = true;
  } else {
    text = decodeBody(body, headers).trim();
  }

  const nonInquiry = detectNonInquiry(headers, subject);

  if (!subject) problems.push("нет темы письма");
  if (!emailMatch) problems.push("не удалось определить адрес отправителя");
  if (!text) problems.push("пустой текст письма");

  return {
    from,
    fromEmail: emailMatch ? emailMatch[0] : null,
    subject,
    date,
    text,
    isHtmlOnly,
    nonInquiry,        // непустой список = это НЕ обращение клиента
    problems,
  };
}
