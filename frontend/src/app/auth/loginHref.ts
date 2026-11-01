/**
 * Ссылка «Войти / создать аккаунт» С ВОЗВРАТОМ — обратная сторона returnTo.ts.
 *
 * 30.10.2026 (прод, гость 390 px): после «Protected. Provable. Permanent.» на /qright
 * гость не получал ни одной подсказки про аккаунт, а на /bureau вместо «Мои
 * сертификаты» видел пустоту; с голого /auth регистрация оставляла человека на
 * /auth. Страница входа понимает `?next=<путь>` (`адресВозврата`), поэтому
 * ссылка обязана его нести — иначе путь обрывается на /auth.
 *
 * Метка канала (`?c=`) едет на обоих прыжках: внутрь `next` (куда вернёмся) и в
 * сам адрес /auth — тем же `keepChannel`, что строит остальные внутренние
 * ссылки сайта; второго способа разбора метки здесь не появляется.
 */
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { keepChannel } from "@/lib/products";
import { channelNow, сыраяМеткаКанала } from "@/lib/channelNow";

/** Чистая часть: `/auth?next=<куда с меткой>` плюс метка. Без канала — голый `next`. */
export function ссылкаВхода(куда: string, канал: string | null = null, сырая: string | null = null): string {
  const возврат = keepChannel(куда, канал, сырая);
  return keepChannel(`/auth?next=${encodeURIComponent(возврат)}`, канал, сырая);
}

/**
 * Для разметки: сперва ссылка без метки (одинакова на сервере и при гидрации),
 * после монтирования — с каналом из адреса или памяти вкладки.
 */
export function useСсылкаВхода(куда: string): string {
  const [href, setHref] = useState(() => ссылкаВхода(куда));
  useEffect(() => {
    try {
      setHref(ссылкаВхода(куда, channelNow(), сыраяМеткаКанала()));
    } catch {
      // Хранилище или адрес не читаются — ссылка остаётся без метки, возврат работает.
      setHref(ссылкаВхода(куда));
    }
  }, [куда]);
  return href;
}

/** На самой странице входа шапка не зацикливается: /auth и его подстраницы — без next. */
function этоСтраницаВхода(путь: string | null | undefined): boolean {
  const п = String(путь ?? "");
  return п === "/auth" || п.startsWith("/auth/");
}

/**
 * Ссылка «Авторизация» в общей шапке: `/auth?next=<текущий путь с query>&c=<метка>`.
 * 2.11.2026 (прод ad2f92fa1): шапка вела на голый /auth на всех страницах — метка и возврат терялись.
 * Тот же механизм, что у кнопок «Войти» (ссылкаВхода); на /auth — только метка, без next.
 */
export function useСсылкаАвторизацииШапки(): string {
  const путь = usePathname() || "/";
  const вход = этоСтраницаВхода(путь);
  const [href, setHref] = useState(() => (вход ? "/auth" : ссылкаВхода(путь)));
  useEffect(() => {
    try {
      const канал = channelNow();
      const сырая = сыраяМеткаКанала();
      if (вход) {
        setHref(keepChannel("/auth", канал, сырая));
        return;
      }
      // Метку ?c= из адреса убираем из хвоста: ссылкаВхода допишет её сама (иначе c дважды в next).
      const q = new URLSearchParams(window.location.search);
      q.delete("c");
      const хвост = q.toString();
      setHref(ссылкаВхода(хвост ? `${путь}?${хвост}` : путь, канал, сырая));
    } catch {
      setHref(вход ? "/auth" : ссылкаВхода(путь));
    }
  }, [путь, вход]);
  return href;
}
