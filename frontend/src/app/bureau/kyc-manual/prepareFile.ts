/**
 * Подготовка файла к ручной проверке личности (/bureau/kyc-manual/[id]).
 *
 * Бэк принимает не больше 3,5 МБ на файл (MANUAL_KYC_MAX_FILE_BYTES). Фото с
 * телефона обычно 4–12 МБ, поэтому любое изображение перекодируем в JPEG через
 * canvas, уменьшая сторону и качество, пока не влезет. Заодно стираются EXIF
 * (геометка) и HEIC превращается в JPEG там, где браузер его открывает. PDF
 * уходит как есть — сжать его в браузере честно нельзя, больше предела → отказ.
 */
export const KYC_MAX_FILE_BYTES = 3.5 * 1024 * 1024;

export type Подготовлено =
  | { ok: true; mime: string; base64: string; bytes: number }
  | { ok: false; error: "type" | "tooBig" };

/** Кодировщик картинки: сторона ≤ maxSide, JPEG с качеством q → байты. */
export type Кодировщик = (maxSide: number, quality: number) => Promise<Blob | null>;

/** Ступени: от бережной к жёсткой. Последняя (1280 px, 0.5) читаема для паспорта. */
export const СТУПЕНИ: ReadonlyArray<[number, number]> = [
  [2400, 0.85],
  [2000, 0.8],
  [1600, 0.75],
  [1600, 0.6],
  [1280, 0.5],
];

/** Первая ступень, чей результат влез в предел; null — не влезла ни одна. */
export async function сжатьКартинку(encode: Кодировщик, max = KYC_MAX_FILE_BYTES): Promise<Blob | null> {
  for (const [side, q] of СТУПЕНИ) {
    const b = await encode(side, q);
    if (b && b.size > 0 && b.size <= max) return b;
  }
  return null;
}

async function вBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = "";
  const CH = 0x8000;
  for (let i = 0; i < buf.length; i += CH) s += String.fromCharCode(...buf.subarray(i, i + CH));
  return btoa(s);
}

function canvasКодировщик(img: HTMLImageElement): Кодировщик {
  return (maxSide, quality) =>
    new Promise((resolve) => {
      const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * k));
      c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const ctx = c.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => resolve(b), "image/jpeg", quality);
    });
}

function открытьКартинку(file: File): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function подготовитьФайл(file: File, allowPdf: boolean): Promise<Подготовлено> {
  if (file.type === "application/pdf") {
    if (!allowPdf) return { ok: false, error: "type" };
    if (file.size > KYC_MAX_FILE_BYTES) return { ok: false, error: "tooBig" };
    return { ok: true, mime: "application/pdf", base64: await вBase64(file), bytes: file.size };
  }
  if (!file.type.startsWith("image/") && file.type !== "") return { ok: false, error: "type" };
  const img = await открытьКартинку(file);
  if (!img) return { ok: false, error: "type" };
  try {
    const b = await сжатьКартинку(canvasКодировщик(img));
    if (!b) return { ok: false, error: "tooBig" };
    return { ok: true, mime: "image/jpeg", base64: await вBase64(b), bytes: b.size };
  } finally {
    // Адрес объекта нужен только на время кодирования.
    URL.revokeObjectURL(img.src);
  }
}
