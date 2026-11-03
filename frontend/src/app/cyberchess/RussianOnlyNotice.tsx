'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { loadLocale } from './i18n';

/**
 * Переключатель языка обещает перевод, а словарь покрывает практически
 * только главную страницу модуля: замер 29.08.2026 — 269 обращений на
 * главной и 0 на остальных 21 странице при сотнях русских слов.
 *
 * Человек с английским браузером получал кнопку EN, видел русский текст и
 * не понимал, сломалось ли что-то. Это хуже, чем если бы не переводилось
 * ничего: перевод работает на первом экране и тем самым обещает, что
 * работает везде.
 *
 * Полоса говорит правду до перевода. Снимать её нужно не целиком, а по
 * мере перевода страниц — поэтому список исключений здесь, а не в каждой
 * странице отдельно.
 */

// Страницы, которые ДЕЙСТВИТЕЛЬНО переведены: на них полоса не нужна.
const PEREVEDENY = ['/cyberchess'];

/*
 * Страницы, у которых перевод живёт по СВОЕМУ адресу (/en/…, /kk/…). 3.11.2026, замер
 * Приложений перед роликами: человек с английским браузером по ссылке из Shorts
 * (aevion.app/cyberchess/traps) читал «available in Russian only», хотя
 * /en/cyberchess/traps переведена целиком. Здесь полоса ведёт на неё, с той же
 * строкой запроса — метка ролика (?c=yt-…) не теряется.
 */
const PEREVOD_PO_ADRESU = ['/cyberchess/traps', '/cyberchess/guide'];

export default function RussianOnlyNotice() {
  const put = usePathname();
  const [pokazat, setPokazat] = useState(false);
  const [perevod, setPerevod] = useState<string | null>(null);

  useEffect(() => {
    // Язык читаем только здесь: чтение браузера при отрисовке даёт
    // расхождение разметки сервера и клиента.
    try {
      const yazyk = loadLocale();
      const ne_ru = yazyk !== 'ru';
      const perevedena = PEREVEDENY.includes(put ?? '');
      setPokazat(ne_ru && !perevedena);
      setPerevod(
        ne_ru && PEREVOD_PO_ADRESU.includes(put ?? '')
          ? `/${yazyk}${put}${window.location.search}`
          : null,
      );
    } catch {}
  }, [put]);

  if (!pokazat) return null;

  return (
    <div
      role="status"
      style={{
        color: '#f0b429', background: '#f0b4290f', borderBottom: '1px solid #f0b42933',
        padding: '8px 16px', fontSize: 13, textAlign: 'center',
      }}
    >
      {perevod ? (
        <a href={perevod} style={{ color: '#f0b429', fontWeight: 700 }}>
          {perevod.startsWith('/kk/') ? 'Бұл беттің қазақша нұсқасы →' : 'Read this page in English →'}
        </a>
      ) : (
        <>
          This page is available in Russian only for now — the main CyberChess
          screen is translated.
        </>
      )}
    </div>
  );
}
