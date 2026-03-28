/** Стабильные categoryId для голосов Planet (премии / номинации MVP). */

export type NominationOption = { id: string; label: string };

export function nominationLabel(
  artifactType: string | undefined,
  categoryId: string
): string {
  const opts = planetNominationOptions(artifactType);
  const hit = opts.find((o) => o.id === categoryId);
  return hit ? hit.label : categoryId;
}

export function planetNominationOptions(artifactType: string | undefined): NominationOption[] {
  const t = (artifactType || "").toLowerCase();
  const general: NominationOption = { id: "general", label: "Общая оценка" };

  if (t === "music") {
    return [
      general,
      { id: "award.music.recording", label: "Лучшая запись / трек" },
      { id: "award.music.production", label: "Саунд-продакшн / аранжировка" },
      { id: "award.music.ai_creative", label: "ИИ-ассистированное творчество" },
      { id: "award.music.lyrics", label: "Текст / концепция" },
    ];
  }

  if (t === "movie") {
    return [
      general,
      { id: "award.film.direction", label: "Режиссура / визуальный ряд" },
      { id: "award.film.story", label: "Сценарий / история" },
      { id: "award.film.editing", label: "Монтаж" },
      { id: "award.film.ai_creative", label: "ИИ-ассистированное творчество" },
    ];
  }

  if (t === "code" || t === "web") {
    return [
      general,
      { id: "award.code.quality", label: "Качество / архитектура" },
      { id: "award.code.innovation", label: "Новизна / идея" },
    ];
  }

  return [general];
}
