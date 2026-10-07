import { getProviders } from "../services/qcoreai/providers";

/**
 * Живы ли ИМЕНА моделей, которые мы объявляем в реестре провайдеров.
 *
 * Повод 07.10.2026. Панель состояния отвечала «ключ годен, деньги есть» — и
 * это было правдой, при которой модуль всё равно падал: имя модели у
 * поставщика исчезло. Замер того дня: из трёх объявленных моделей Gemini жива
 * была ОДНА (`gemini-2.0-flash-001` и `gemini-1.5-pro` → 404), из семи
 * бесплатных слагов OpenRouter — ДВЕ. Один путь падал уже тогда: `healthai`
 * при `provider: "gemini"` звал снятую модель, и снаружи это читалось как
 * «ИИ иногда ломается».
 *
 * ⚠️ ГРАНИЦА, и она названа в подписи ответа: «имя есть у поставщика» слабее,
 * чем «вызов разрешён». 07.10 `gemini-2.5-pro` и `gemini-2.5-flash-lite`
 * числились в каталоге и отвечали 404 «недоступна новым пользователям».
 * Настоящий вызов каждой модели стоил бы денег у платных поставщиков, поэтому
 * здесь спрашиваются бесплатные читающие списки, а сильная проверка живёт
 * отдельно: `C:/Users/user/aevion-ai-models-alive.mjs`.
 */

type Список = () => Promise<string[]>;

const КАК: Record<string, { ключ?: string; список: Список }> = {
  gemini: {
    ключ: "GEMINI_API_KEY",
    список: async () => {
      const k = process.env.GEMINI_API_KEY?.trim();
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(k || "")}`
      );
      if (!r.ok) throw new Error(`gemini list HTTP ${r.status}`);
      const j = (await r.json()) as { models?: Array<{ name?: string }> };
      return (j.models || []).map((m) => String(m.name || "").replace(/^models\//, ""));
    },
  },
  openai: {
    ключ: "OPENAI_API_KEY",
    список: async () => {
      const r = await fetch("https://api.openai.com/v1/models", {
        headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY?.trim() || ""}` },
      });
      if (!r.ok) throw new Error(`openai list HTTP ${r.status}`);
      const j = (await r.json()) as { data?: Array<{ id?: string }> };
      return (j.data || []).map((m) => String(m.id));
    },
  },
  anthropic: {
    ключ: "ANTHROPIC_API_KEY",
    список: async () => {
      const r = await fetch("https://api.anthropic.com/v1/models?limit=200", {
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY?.trim() || "",
          "anthropic-version": "2023-06-01",
        },
      });
      if (!r.ok) throw new Error(`anthropic list HTTP ${r.status}`);
      const j = (await r.json()) as { data?: Array<{ id?: string }> };
      return (j.data || []).map((m) => String(m.id));
    },
  },
  openrouter: {
    // Ключ не нужен: каталог публичный. Значит эту часть проверки можно
    // задавать всегда, даже когда ключа OpenRouter у нас нет вовсе.
    список: async () => {
      const r = await fetch("https://openrouter.ai/api/v1/models");
      if (!r.ok) throw new Error(`openrouter list HTTP ${r.status}`);
      const j = (await r.json()) as { data?: Array<{ id?: string }> };
      return (j.data || []).map((m) => String(m.id));
    },
  },
};

const ЧАСЫ = Number(process.env.MODEL_NAMES_CHECK_HOURS || 6);
let кэш: { когда: number; ответ: { ok: boolean; detail: string } } | null = null;

export async function проверитьИменаМоделей(): Promise<{ ok: boolean; detail: string }> {
  if (кэш && Date.now() - кэш.когда < ЧАСЫ * 3600_000) return кэш.ответ;

  const пропавшие: string[] = [];
  const неСпрошены: string[] = [];
  let проверено = 0;
  let поставщиков = 0;

  for (const [id, как] of Object.entries(КАК)) {
    const п = getProviders().find((x) => x.id === id);
    if (!п) continue;
    // Поставщика без ключа мы и не зовём — его имена не могут нам навредить.
    // Исключение: у кого ключ не нужен (публичный каталог), спрашиваем всегда.
    if (как.ключ && !п.configured) continue;
    поставщиков += 1;
    let живые: string[];
    try {
      живые = await как.список();
      if (!живые.length) throw new Error("пустой список");
    } catch (e) {
      неСпрошены.push(`${id} (${e instanceof Error ? e.message : String(e)})`);
      continue;
    }
    const объявлены = п.models || [];
    проверено += объявлены.length;
    for (const м of объявлены) if (!живые.includes(м)) пропавшие.push(`${id}/${м}`);
  }

  // Ноль проверенных имён — это «не знаю», а не «всё живо». Без этой ветки
  // проверка, переставшая кого-либо находить, отвечала бы зелёным.
  const ok = пропавшие.length === 0 && проверено > 0 && неСпрошены.length === 0;
  const части = [
    `проверено имён: ${проверено} у ${поставщиков} поставщиков`,
    пропавшие.length ? `НЕТ У ПОСТАВЩИКА: ${пропавшие.join(", ")}` : "все объявленные имена на месте",
    неСпрошены.length ? `не спрошены: ${неСпрошены.join("; ")}` : "",
    "по списку поставщика; «имя есть» слабее, чем «вызов разрешён»",
  ].filter(Boolean);

  const ответ = { ok, detail: части.join(" · ").slice(0, 400) };
  кэш = { когда: Date.now(), ответ };
  return ответ;
}

/** Для проверок: сбросить кэш, чтобы следующий вызов пошёл в сеть заново. */
export function сброситьКэшИмёнМоделей(): void {
  кэш = null;
}

/**
 * Отвечает ли МОДЕЛЬ ПО УМОЛЧАНИЮ на настоящий вызов.
 *
 * Это ДРУГОЙ вопрос, чем выше, и держать их в одной пробе нельзя — сегодня я
 * уже видел, во что это обходится. Разница измерена 07.10.2026:
 *   • `gemini-2.0-flash-001` ИСЧЕЗ из каталога → ловится проверкой имён;
 *   • `gemini-2.5-pro` в каталоге ЕСТЬ и отвечает 404 «недоступна новым
 *     пользователям» → проверкой имён НЕ ловится, нужен вызов.
 * Оба состояния реальны, поэтому нужны обе пробы.
 *
 * Зовём только УМОЛЧАНИЕ каждого настроенного поставщика — самое ходовое имя
 * на платформе — и ровно один токен. Кэш общий по времени с проверкой имён.
 * Проверять так все модели было бы тратой без повода: платят за каждый вызов.
 */
let кэшВызова: { когда: number; ответ: { ok: boolean; detail: string } } | null = null;

async function вызватьОдинТокен(id: string, модель: string): Promise<{ ok: boolean; почему?: string }> {
  if (id === "gemini") {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${модель}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY?.trim() || "")}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "." }] }],
          generationConfig: { maxOutputTokens: 1, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );
    return r.ok ? { ok: true } : { ok: false, почему: `HTTP ${r.status}` };
  }
  if (id === "anthropic") {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY?.trim() || "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      // temperature НЕ шлём: opus-4-8 и fable-5 его не принимают.
      body: JSON.stringify({ model: модель, max_tokens: 1, messages: [{ role: "user", content: "." }] }),
    });
    return r.ok ? { ok: true } : { ok: false, почему: `HTTP ${r.status}` };
  }
  if (id === "openai") {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY?.trim() || ""}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: модель, max_tokens: 1, messages: [{ role: "user", content: "." }] }),
    });
    return r.ok ? { ok: true } : { ok: false, почему: `HTTP ${r.status}` };
  }
  if (id === "openrouter") {
    // Последнее звено цепочки запаса, и до 07.10 оно было проверено ТОЛЬКО
    // каталогом. Замер того дня: gemini — деньги есть, но срок перехода на
    // предоплату 12.10; openai — ключ жив, денег нет; anthropic — $8.93.
    // То есть запас держится на бесплатных слагах, а работают ли они на
    // вызов, никто не спрашивал. Вызов бесплатный — спрашиваем.
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.OPENROUTER_API_KEY?.trim() || ""}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: модель, max_tokens: 1, messages: [{ role: "user", content: "." }] }),
    });
    return r.ok ? { ok: true } : { ok: false, почему: `HTTP ${r.status}` };
  }
  return { ok: false, почему: "вызывать этого поставщика не умею" };
}

export async function проверитьУмолчанияВызовом(): Promise<{ ok: boolean; detail: string }> {
  if (кэшВызова && Date.now() - кэшВызова.когда < ЧАСЫ * 3600_000) return кэшВызова.ответ;

  const отказали: string[] = [];
  let спрошено = 0;
  for (const id of ["gemini", "anthropic", "openai", "openrouter"]) {
    const п = getProviders().find((x) => x.id === id);
    if (!п?.configured) continue;
    try {
      const о = await вызватьОдинТокен(id, п.defaultModel);
      спрошено += 1;
      if (!о.ok) отказали.push(`${id}/${п.defaultModel} ${о.почему}`);
    } catch (e) {
      // Сеть не ответила — это тоже «не ок», но причина другая, и она названа.
      отказали.push(`${id}/${п.defaultModel} (${e instanceof Error ? e.message : String(e)})`);
    }
  }

  // Ноль спрошенных — «не знаю», не «всё хорошо».
  const ok = отказали.length === 0 && спрошено > 0;
  const части = [
    `проверено умолчаний вызовом: ${спрошено}`,
    отказали.length ? `НЕ ОТВЕТИЛИ: ${отказали.join(", ")}` : "все умолчания отвечают",
    "настоящий вызов на один токен; отказ по деньгам выглядит так же, как отказ по имени",
  ];
  const ответ = { ok, detail: части.join(" · ").slice(0, 400) };
  кэшВызова = { когда: Date.now(), ответ };
  return ответ;
}

/** Для проверок: сбросить и этот кэш тоже. */
export function сброситьКэшВызоваУмолчаний(): void {
  кэшВызова = null;
}
