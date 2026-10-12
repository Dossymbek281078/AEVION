/**
 * Хранилище внутри превью DevHub.
 *
 * Замер 12.10.2026 на проде (388b8a56589b): сгенерированный список дел бросал
 * в превью `SecurityError: Failed to read the 'localStorage' property from
 * 'Window': The document is sandboxed and lacks the 'allow-same-origin' flag`.
 * ИИ почти всегда сохраняет состояние именно в localStorage, поэтому это не
 * редкий случай, а общий: в превью сохранение молча не работает, и человек
 * узнаёт об этом только после выкатки.
 *
 * ПОЧЕМУ НЕ allow-same-origin. Тогда чужой сгенерированный код оказался бы в
 * нашем origin и получил бы куки и хранилище самого DevHub. Флаг не добавляем
 * ни при каких условиях — вместо него песочнице подкладывается СВОЁ хранилище
 * в памяти кадра: приложение работает, ничего нашего не видит, а данные живут
 * столько, сколько открыто превью.
 *
 * Граница названа честно и для человека (подпись под превью), и здесь: это НЕ
 * настоящее сохранение. Закрыл превью — данные ушли. На выкаченном адресе
 * работает обычный localStorage браузера.
 */

/** Скрипт идёт ПЕРВЫМ в <head> превью — до любого кода приложения. */
export const PREVIEW_STORAGE_SHIM = `(function(){
  function sozdat(){
    var dannye = Object.create(null);
    return {
      getItem: function(k){ k = String(k); return Object.prototype.hasOwnProperty.call(dannye, k) ? dannye[k] : null; },
      setItem: function(k, v){ dannye[String(k)] = String(v); },
      removeItem: function(k){ delete dannye[String(k)]; },
      clear: function(){ dannye = Object.create(null); },
      key: function(i){ var ks = Object.keys(dannye); return i >= 0 && i < ks.length ? ks[i] : null; },
      get length(){ return Object.keys(dannye).length; }
    };
  }
  function postavit(imya){
    try {
      var est = false;
      try { var _ = window[imya]; est = true; } catch (e) { est = false; }
      if (est && window[imya]) {
        try { window[imya].setItem("__aevion_probe__", "1"); window[imya].removeItem("__aevion_probe__"); return; } catch (e) {}
      }
    } catch (e) {}
    try { Object.defineProperty(window, imya, { value: sozdat(), configurable: true }); } catch (e) {}
  }
  postavit("localStorage");
  postavit("sessionStorage");
})();`;

/** Подпись под превью: человек должен знать, что сохранение здесь временное. */
export const PODPIS_O_HRANILISHE =
  "Сохранение работает только пока открыто превью — после «Выкатить» данные будут храниться у человека в браузере.";

/**
 * Вставляет заглушку хранилища первым скриптом документа превью.
 * Возвращает НОВЫЙ html; исходный документ не трогается.
 */
export function vstavitZaglushkuHranilisha(html: string): string {
  const skript = `<script>${PREVIEW_STORAGE_SHIM}</script>`;
  const head = html.match(/<head[^>]*>/i);
  if (head) {
    const i = html.indexOf(head[0]) + head[0].length;
    return html.slice(0, i) + skript + html.slice(i);
  }
  const html_ = html.match(/<html[^>]*>/i);
  if (html_) {
    const i = html.indexOf(html_[0]) + html_[0].length;
    return html.slice(0, i) + skript + html.slice(i);
  }
  return skript + html;
}
