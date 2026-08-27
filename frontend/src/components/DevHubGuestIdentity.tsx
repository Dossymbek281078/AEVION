"use client";

import { installDevhubGuestHeader } from "@/lib/devhubGuest";

// Ставится при вычислении модуля, а НЕ в useEffect: эффекты выполняются после
// монтирования, и первый список проектов успел бы уехать без заголовка — то есть
// показать общий ящик, а после обновления страницы вдруг другой. Модули же
// вычисляются раньше любого запроса.
installDevhubGuestHeader();

/** Ничего не рисует: нужен только чтобы модуль попал в клиентскую сборку. */
export function DevHubGuestIdentity() {
  return null;
}
