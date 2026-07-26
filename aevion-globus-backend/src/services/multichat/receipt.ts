// Мультичат — чек за ответ.
//
// Ставка: по мере роста базовых моделей ценность самой оркестрации падает —
// то, что в 2023-м требовало спора пяти агентов, сегодня одиночная модель
// делает лучше и дешевле. Не обесценивается другое: возможность ответить на
// вопрос «на каком основании это решено, сколько стоило и можно ли повторить».
// Рой, который спорит, — коммодити. Решение с квитанцией — нет.
//
// Чек фиксирует состав панели, промт, ответы, карту разногласий и стоимость в
// канонической форме RFC8785 и считает от неё sha256. Любой может пересчитать
// хеш и убедиться, что артефакт не подменён.
//
// Подпись берётся из СУЩЕСТВУЮЩЕГО реестра ключей QSign v2 — своих ключей
// модуль не заводит. Если ключи не настроены, чек честно отдаётся неподписанным
// (`signature: null`) вместо тихой выдачи чего-то похожего на подпись.

import crypto from "node:crypto";
import { canonicalHash, CANONICALIZATION_SPEC } from "../../lib/qsignV2/canonicalize";
import { getActiveEd25519 } from "../../lib/qsignV2/keyRegistry";
import type { DissentMap } from "./dissent";

export type ReceiptAgent = {
  agentId: string;
  role?: string;
  provider?: string;
  model?: string;
  ok: boolean;
  /** Хеш ответа, а не сам ответ: чек должен быть проверяемым, но не обязан
   *  тащить в себя всю переписку — она остаётся в беседе. */
  replyHash: string | null;
  replyChars: number;
};

export type Receipt = {
  version: 1;
  conversationId: string;
  askedAt: string;
  promptHash: string;
  promptChars: number;
  panel: ReceiptAgent[];
  dissent: {
    verdict: DissentMap["verdict"];
    agreement: number | null;
    numericConflicts: number;
    outlier: string | null;
    hedged: string[];
  };
  cost: { calls: number; answered: number; failed: number };
  canonicalization: string;
};

export type SignedReceipt = {
  receipt: Receipt;
  /** sha256 канонической формы — пересчитывается кем угодно. */
  hash: string;
  /** Подпись реестра QSign v2; null, если ключи не настроены. */
  signature: { algo: "ed25519"; kid: string; value: string } | null;
  /** Честная причина, если подписи нет. */
  signatureNote: string | null;
};

const sha = (s: string) => crypto.createHash("sha256").update(s, "utf8").digest("hex");

type AnswerLike = {
  agentId: string;
  role?: string;
  provider?: string;
  model?: string;
  ok: boolean;
  reply?: string;
};

/** Сборка чека. Чистая функция: одинаковый вход даёт одинаковый хеш, иначе
 *  «воспроизводимость» была бы обещанием без покрытия. */
export function buildReceipt(input: {
  conversationId: string;
  prompt: string;
  answers: AnswerLike[];
  dissent: DissentMap;
  askedAt: string;
}): Receipt {
  const panel: ReceiptAgent[] = input.answers.map((a) => ({
    agentId: a.agentId,
    role: a.role,
    provider: a.provider,
    model: a.model,
    ok: a.ok,
    replyHash: a.ok && a.reply ? sha(a.reply) : null,
    replyChars: a.reply ? a.reply.length : 0,
  }));

  return {
    version: 1,
    conversationId: input.conversationId,
    askedAt: input.askedAt,
    promptHash: sha(input.prompt),
    promptChars: input.prompt.length,
    panel,
    dissent: {
      verdict: input.dissent.verdict,
      agreement: input.dissent.agreement,
      numericConflicts: input.dissent.numericConflicts.length,
      outlier: input.dissent.outlier?.agentId ?? null,
      hedged: input.dissent.hedges.map((h) => h.agentId),
    },
    cost: {
      calls: input.answers.length,
      answered: input.answers.filter((a) => a.ok).length,
      failed: input.answers.filter((a) => !a.ok).length,
    },
    canonicalization: CANONICALIZATION_SPEC,
  };
}

/** Подпись через реестр QSign v2. Ключей нет — отдаём чек без подписи и прямо
 *  говорим почему: «похожая на подпись» строка хуже её отсутствия. */
export async function signReceipt(receipt: Receipt): Promise<SignedReceipt> {
  // Канонизация считается один раз: она обходит весь объект, и вызывать её
  // дважды ради хеша и подписи — лишняя работа на каждом ответе.
  const { hash, canonical } = canonicalHash(receipt);
  try {
    const key = await getActiveEd25519();
    if (!key?.privateKey || !key?.kid) {
      return { receipt, hash, signature: null, signatureNote: "активный ed25519-ключ не настроен — чек без подписи" };
    }
    const value = crypto.sign(null, Buffer.from(canonical, "utf8"), key.privateKey).toString("hex");
    return { receipt, hash, signature: { algo: "ed25519", kid: key.kid, value }, signatureNote: null };
  } catch (e) {
    // Наружу — только факт, без деталей. Реестр ключей ходит в БД, и её ошибки
    // («SASL: SCRAM-SERVER-FIRST-MESSAGE…») содержат сведения об инфраструктуре,
    // которым в публичном ответе не место. Подробность уходит в лог сервера.
    console.error("[multichat/receipt] подпись недоступна:", e instanceof Error ? e.message : e);
    return {
      receipt,
      hash,
      signature: null,
      signatureNote: "реестр ключей недоступен — чек без подписи, но с проверяемым хешем",
    };
  }
}

/** Пересчёт хеша по готовому чеку — то, чем проверяющий убеждается, что
 *  артефакт не подменён. Выделено отдельно, чтобы это можно было вызвать и с
 *  клиента, и из теста. */
export function verifyReceiptHash(receipt: Receipt, expectedHash: string): boolean {
  return canonicalHash(receipt).hash === expectedHash;
}
