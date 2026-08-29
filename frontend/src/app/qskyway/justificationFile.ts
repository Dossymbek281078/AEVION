/**
 * Что уносит с собой человек, скачавший обоснование.
 *
 * ПОВОД (29.08.2026). Страница брала из ответа `document`, `attestation` и
 * `scope`, а `verifyYourself` — рецепт проверки — ВЫБРАСЫВАЛА. Значит файл
 * уходил к регулятору или партнёру без единого слова о том, как его проверить:
 * подпись есть, а что с ней делать — знает только тот, кто был на странице.
 *
 * Это та же ночная тема, что и с якорем: доказательство путешествует отдельно
 * от способа его проверить, и потому не работает.
 *
 * Отдельная функция, а не тело обработчика клика: содержимое файла — предмет,
 * который надо проверять значениями, а не кликом.
 */
export interface JustificationFileInput {
  document: unknown;
  attestation: unknown;
  scope?: string;
  /**
   * Английская половина оговорки. Файл уходит один, и читатель у него может
   * быть любой: 29.08.2026 страница брала только русскую, хотя служба отдаёт
   * обе. Оговорка о применимости — как раз то, что регулятор читает первым.
   */
  scopeEn?: string;
  /** Рецепт из ответа ручки. Может отсутствовать у старого бэкенда. */
  verifyYourself?: unknown;
}

export function buildJustificationFile(input: JustificationFileInput): string {
  const body: Record<string, unknown> = {
    document: input.document,
    attestation: input.attestation,
  };
  if (input.scope) body.scope = input.scope;
  if (input.scopeEn) body.scopeEn = input.scopeEn;
  // ⚠️ Рецепт кладём, только если он ПРИШЁЛ. Выдумать его здесь значило бы
  // повторить ошибку в другую сторону: файл обещал бы проверку по шагам,
  // которых служба не подтверждала.
  if (input.verifyYourself) body.verifyYourself = input.verifyYourself;
  return JSON.stringify(body, null, 2);
}

export function justificationFileName(doc: unknown): string {
  const d = (doc ?? {}) as Record<string, unknown>;
  const city = typeof d.city === "string" ? d.city : "city";
  const from = typeof d.from === "number" ? d.from : 0;
  const to = typeof d.to === "number" ? d.to : 0;
  return "qskyway-justification-" + city + "-" + from + "-" + to + ".json";
}
