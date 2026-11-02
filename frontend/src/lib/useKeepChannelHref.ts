"use client";
import { useEffect, useState } from "react";
import { keepChannel } from "@/lib/products";
import { channelNow, сыраяМеткаКанала } from "@/lib/channelNow";

/**
 * Внутренняя ссылка с меткой канала (`?c=`) из текущего адреса — для кнопок
 * внутри страниц, собранных не через ProductCard/шапку.
 *
 * 02.11.2026 (Продукт, проход письма pb376): /bureau?c=mail-pb376 → «Protect Your
 * Work» → /qright БЕЗ метки. Человек из письма на второй странице становился
 * «прямым заходом». Та же схема, что у useСсылкаВхода (auth/loginHref.ts):
 * первый кадр — голый путь (SSR без адреса), после монтирования — с меткой.
 * Якорь (#…) отделяется и возвращается после `?c=`: иначе метка встала бы
 * позади решётки и потерялась.
 */
export function ссылкаСМеткой(куда: string, канал: string | null = null, сырая: string | null = null): string {
  const i = куда.indexOf("#");
  const путь = i >= 0 ? куда.slice(0, i) : куда;
  const якорь = i >= 0 ? куда.slice(i) : "";
  return keepChannel(путь, канал, сырая) + якорь;
}

export function useСсылкаСМеткой(куда: string): string {
  const [href, setHref] = useState(() => ссылкаСМеткой(куда));
  useEffect(() => {
    try {
      setHref(ссылкаСМеткой(куда, channelNow(), сыраяМеткаКанала()));
    } catch {
      setHref(ссылкаСМеткой(куда));
    }
  }, [куда]);
  return href;
}
