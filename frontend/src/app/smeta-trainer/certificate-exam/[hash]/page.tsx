"use client";

/**
 * Сертификат экзамена — A4-страница для печати.
 * URL: /smeta-trainer/certificate-exam/[hash], где hash — base64url JSON-payload.
 *
 * Содержит: имя, серию, дату, список 5 заданий с баллами, QR-код для верификации
 * (QR кодирует full URL текущей страницы, по которому можно восстановить payload).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import {
  decodePayload,
  certificateSerial,
  type CertificatePayload,
} from "../../lib/examCertificate";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function CertificatePage({ params }: { params: { hash: string } }) {
  const payload = decodePayload(params.hash);
  if (!payload) {
    notFound();
  }
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/smeta-trainer/certificate-exam/${params.hash}`;
    QRCode.toDataURL(url, { width: 220, margin: 1, errorCorrectionLevel: "M" })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [params.hash]);

  const serial = certificateSerial(payload!);
  const tierLabel =
    payload!.tier === "gold" ? "🥇 С ОТЛИЧИЕМ"
    : payload!.tier === "silver" ? "🥈 СТАНДАРТНЫЙ"
    : "🥉 БАЗОВЫЙ";
  const tierColor =
    payload!.tier === "gold" ? "text-amber-600"
    : payload!.tier === "silver" ? "text-emerald-600"
    : "text-orange-600";
  const borderColor =
    payload!.tier === "gold" ? "border-amber-400"
    : payload!.tier === "silver" ? "border-emerald-400"
    : "border-orange-400";

  return (
    <div className="min-h-screen bg-slate-100 p-6 print:p-0 print:bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between mb-4 print:hidden">
          <Link href="/smeta-trainer/exam-journal" className="text-xs text-blue-600 hover:underline">
            ← К журналу
          </Link>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-semibold hover:bg-emerald-700"
          >
            🖨 Распечатать (A4)
          </button>
        </div>

        {/* Сертификат */}
        <div
          className={`bg-white border-8 ${borderColor} rounded-lg p-12 print:border-4 print:rounded-none print:shadow-none shadow-xl relative`}
          style={{ minHeight: "1050px" }}
        >
          {/* Угловые декоративные элементы */}
          <div className="absolute top-4 left-4 w-16 h-16 border-t-4 border-l-4 border-slate-300 print:border-slate-500" />
          <div className="absolute top-4 right-4 w-16 h-16 border-t-4 border-r-4 border-slate-300 print:border-slate-500" />
          <div className="absolute bottom-4 left-4 w-16 h-16 border-b-4 border-l-4 border-slate-300 print:border-slate-500" />
          <div className="absolute bottom-4 right-4 w-16 h-16 border-b-4 border-r-4 border-slate-300 print:border-slate-500" />

          {/* Шапка */}
          <div className="text-center mb-8">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-500 font-semibold">
              AEVION Smeta Trainer
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              AI-тренажёр сметного дела Республики Казахстан
            </div>
          </div>

          {/* Заголовок */}
          <div className="text-center mb-8 border-y-2 border-slate-200 py-6">
            <div className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-2">
              Сертификат
            </div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">
              Об успешном завершении
            </h1>
            <div className="text-lg text-slate-700">экзаменационного цикла</div>
            <div className={`text-2xl font-bold mt-3 ${tierColor}`}>
              {tierLabel}
            </div>
          </div>

          {/* Получатель */}
          <div className="text-center mb-8">
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
              Выдан
            </div>
            <div className="text-3xl font-serif font-bold text-slate-900 border-b-2 border-slate-300 pb-2 inline-block min-w-[400px]">
              {payload!.studentName}
            </div>
          </div>

          {/* Описание */}
          <div className="text-center text-sm text-slate-700 leading-relaxed mb-8 px-12">
            подтверждает, что владелец сертификата успешно сдал {payload!.results.length} экзаменационных
            заданий по составлению локально-сметного расчёта в соответствии с НДЦС РК 8.01-08-2022,
            продемонстрировав знание методики, нормативной базы и навыки практического применения
            AI-проверки смет.
          </div>

          {/* Результаты */}
          <div className="mb-8">
            <div className="text-xs uppercase tracking-wider text-slate-500 text-center mb-3">
              Результаты по заданиям (лучший балл)
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-slate-300">
                  <th className="py-2 px-2 text-left">№</th>
                  <th className="py-2 px-2 text-left">Задание</th>
                  <th className="py-2 px-2 text-right">Балл</th>
                  <th className="py-2 px-2 text-right">Оценка</th>
                  <th className="py-2 px-2 text-right">Дата</th>
                </tr>
              </thead>
              <tbody>
                {payload!.results.map((r, i) => (
                  <tr key={r.taskId} className="border-b border-slate-100">
                    <td className="py-2 px-2 text-slate-600">{i + 1}</td>
                    <td className="py-2 px-2 text-slate-800">{r.title}</td>
                    <td className="py-2 px-2 text-right font-mono font-bold">
                      {r.score} / 100
                    </td>
                    <td className="py-2 px-2 text-right capitalize">{r.grade}</td>
                    <td className="py-2 px-2 text-right text-slate-500">
                      {r.timestamp ? formatDate(r.timestamp) : "—"}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300 font-bold">
                  <td colSpan={2} className="py-2 px-2 text-right">Средний балл:</td>
                  <td className="py-2 px-2 text-right font-mono text-emerald-700">
                    {payload!.avgScore.toFixed(1)} / 100
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Подписи + QR */}
          <div className="grid grid-cols-3 gap-6 mt-12 items-end">
            <div>
              <div className="border-t-2 border-slate-400 pt-2 text-center text-xs">
                <div className="font-semibold">AEVION Education</div>
                <div className="text-slate-500 text-[10px]">платформа выдачи</div>
              </div>
            </div>
            <div className="text-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR верификации"
                  className="mx-auto"
                  style={{ width: 110, height: 110 }}
                />
              ) : (
                <div className="w-[110px] h-[110px] mx-auto bg-slate-200 flex items-center justify-center text-[10px] text-slate-500">
                  QR…
                </div>
              )}
              <div className="text-[10px] text-slate-500 mt-1 font-mono">{serial}</div>
              <div className="text-[10px] text-slate-400">сканируйте для проверки</div>
            </div>
            <div>
              <div className="border-t-2 border-slate-400 pt-2 text-center text-xs">
                <div className="font-semibold">{formatDate(payload!.issuedAt)}</div>
                <div className="text-slate-500 text-[10px]">дата выдачи</div>
              </div>
            </div>
          </div>

          {/* Юр. примечание */}
          <div className="text-center text-[9px] text-slate-400 mt-8 italic">
            Сертификат подтверждает прохождение учебного цикла на платформе AEVION Smeta Trainer.
            Не является государственным документом о профессиональной квалификации.
            Верификация — по QR-коду или ссылке.
          </div>
        </div>
      </div>
    </div>
  );
}
