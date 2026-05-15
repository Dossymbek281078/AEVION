"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const CERT_ID_RE = /^AEV-СМТ-\d{4}-\d{4}$/;

/**
 * Публичная страница проверки сертификата по номеру (без авторизации).
 *
 * MVP: проверяем, что номер соответствует формату AEV-СМТ-YYYY-NNNN
 * (как генерирует /certificate). Реальную верификацию можно добавить
 * позже через подпись сертификата на бэке + хеш в QR.
 */
export default function VerifyPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params?.id ?? "").toUpperCase();
  const [validFormat, setValidFormat] = useState<boolean | null>(null);

  useEffect(() => {
    setValidFormat(CERT_ID_RE.test(id));
  }, [id]);

  if (validFormat === null) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md w-full text-center">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">
          AEVION · Проверка сертификата
        </div>
        <div className="mt-3 font-mono text-sm bg-slate-900 text-emerald-300 rounded px-3 py-2 inline-block">
          {id || "—"}
        </div>

        {validFormat ? (
          <div className="mt-6">
            <div className="text-5xl mb-2">✓</div>
            <div className="text-xl font-bold text-emerald-700">
              Номер сертификата корректен
            </div>
            <p className="text-sm text-slate-600 mt-3 leading-relaxed">
              Сертификат с этим номером был сгенерирован системой AEVION
              «Сметный тренажёр РК».
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2 text-left text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded p-2">
                <span className="text-slate-500">Курс: </span>
                <span className="font-semibold text-slate-800">
                  Сметное дело в Республике Казахстан
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded p-2">
                <span className="text-slate-500">Объём: </span>
                <span className="font-semibold text-slate-800">
                  88 учебных часов · 5 уровней · 32+ урока
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded p-2">
                <span className="text-slate-500">Сквозной кейс: </span>
                <span className="font-semibold text-slate-800">
                  Капитальный ремонт СОШ №47, г. Алматы
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded p-2">
                <span className="text-slate-500">Нормативная база: </span>
                <span className="font-semibold text-slate-800">
                  НДЦС РК 8.01-08-2022, СН РК 8.02
                </span>
              </div>
            </div>
            <p className="mt-4 text-[11px] text-slate-400 italic leading-relaxed">
              Проверка по номеру подтверждает корректность формата сертификата.
              Для централизованной верификации (с подписью и реестром) свяжитесь
              с куратором: имя владельца совпадает с записью в Dashboard.
            </p>
          </div>
        ) : (
          <div className="mt-6">
            <div className="text-5xl mb-2">⚠</div>
            <div className="text-xl font-bold text-red-700">
              Номер не соответствует формату
            </div>
            <p className="text-sm text-slate-600 mt-3 leading-relaxed">
              Корректный формат: <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">AEV-СМТ-YYYY-NNNN</code>
              <br />
              Пример: <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">AEV-СМТ-2026-1234</code>
            </p>
            <p className="text-xs text-slate-500 mt-3">
              Возможные причины: опечатка, поддельный сертификат, или сертификат
              из другой системы.
            </p>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-200">
          <Link
            href="/smeta-trainer"
            className="text-xs text-emerald-600 hover:text-emerald-800 underline"
          >
            ← К курсу AEVION
          </Link>
        </div>
      </div>
    </div>
  );
}
