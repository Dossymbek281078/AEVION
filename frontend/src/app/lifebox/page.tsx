"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import MvpConceptBoard from "@/components/MvpConceptBoard";

type Trustee = { id: number; name: string; relation: string; issued: boolean };
type Vault = {
  id: string;
  title: string;
  trigger: string;
  threshold: string;
  encryption: string;
  status: "sealed" | "scheduled" | "armed";
  openDate: string;
};
type Toast = { step: number; text: string } | null;

const INITIAL_TRUSTEES: Trustee[] = [
  { id: 1, name: "Айгерим (дочь)", relation: "Семья", issued: false },
  { id: 2, name: "Нурлан (сын)", relation: "Семья", issued: false },
  { id: 3, name: "Адвокат А.К.", relation: "Юрист", issued: false },
  { id: 4, name: "Опекун-2", relation: "Опекун", issued: false },
  { id: 5, name: "Друг семьи", relation: "Друг", issued: false },
];

const SEED_VAULTS: Vault[] = [
  {
    id: "v1",
    title: "Письмо детям (открыть 2055)",
    trigger: "Дата · 2055-01-01",
    threshold: "3 / 5",
    encryption: "AES-256-GCM + Shamir(3,5)",
    status: "scheduled",
    openDate: "2055-01-01",
  },
  {
    id: "v2",
    title: "Финансовый план (доступ после 70 лет)",
    trigger: "Возраст · 70",
    threshold: "3 / 5",
    encryption: "AES-256-GCM + Shamir(3,5)",
    status: "sealed",
    openDate: "≈ 2069",
  },
  {
    id: "v3",
    title: "Кризисные инструкции (триггер: 30 дней без активности)",
    trigger: "Бездействие · 30 дней",
    threshold: "4 / 7",
    encryption: "AES-256-GCM + Shamir(4,7)",
    status: "armed",
    openDate: "по триггеру",
  },
];

export default function LifeBoxPage() {
  const [trustees, setTrustees] = useState<Trustee[]>(INITIAL_TRUSTEES);
  const [vaults, setVaults] = useState<Vault[]>(SEED_VAULTS);
  const [toast, setToast] = useState<Toast>(null);

  // Create-vault form
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [trigger, setTrigger] = useState("Дата");
  const [threshold, setThreshold] = useState("3/5");

  // Trustee-add form
  const [trusteeEmail, setTrusteeEmail] = useState("");
  const [trusteeRelation, setTrusteeRelation] = useState("Семья");

  const issuedCount = useMemo(() => trustees.filter((t) => t.issued).length, [trustees]);
  const reconstructed = issuedCount >= 3;

  const toggleTrustee = (id: number) =>
    setTrustees((prev) => prev.map((t) => (t.id === id ? { ...t, issued: !t.issued } : t)));

  const resetShares = () => setTrustees((prev) => prev.map((t) => ({ ...t, issued: false })));

  const runToast = (step: number, text: string, ms: number) =>
    new Promise<void>((resolve) => {
      setToast({ step, text });
      setTimeout(resolve, ms);
    });

  const handleCreateVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await runToast(1, "1/3 Generating AES key...", 900);
    await runToast(2, "2/3 Shamir-разделение (5 shares)...", 1100);
    await runToast(3, "3/3 Сейф запечатан. Передайте share-инструкции опекунам.", 1400);
    setVaults((prev) => [
      {
        id: `v${Date.now()}`,
        title: title.trim(),
        trigger: `${trigger} · только что`,
        threshold: threshold.replace("/", " / "),
        encryption: `AES-256-GCM + Shamir(${threshold.split("/").join(",")})`,
        status: "sealed",
        openDate: trigger === "Дата" ? "пользовательская дата" : "по триггеру",
      },
      ...prev,
    ]);
    setTitle("");
    setContent("");
    setTimeout(() => setToast(null), 600);
  };

  const handleAddTrustee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trusteeEmail.trim()) return;
    setTrustees((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: trusteeEmail.trim(),
        relation: trusteeRelation,
        issued: false,
      },
    ]);
    setTrusteeEmail("");
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "AEVION LifeBox",
    applicationCategory: "SecurityApplication",
    operatingSystem: "Web",
    description:
      "Digital safe for your future self. 100-year storage with Shamir-share inheritance via QShield and QSign access audit.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-950/30 via-zinc-950 to-zinc-950 text-zinc-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="sticky top-0 z-40 border-b border-amber-500/20 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3 text-sm">
          <Link href="/" className="text-zinc-400 transition hover:text-amber-300">
            ← AEVION
          </Link>
          <div className="font-mono tracking-wide">
            <span className="text-amber-300">LifeBox</span>
            <span className="mx-2 text-zinc-600">·</span>
            <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
              PLANNING
            </span>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-20 text-center">
        <div className="mb-4 text-xs uppercase tracking-[0.3em] text-amber-300/80">
          Digital Safe · 100-year storage · Inheritance
        </div>
        <h1 className="text-5xl font-light leading-tight md:text-6xl">
          Letter to your future self,{" "}
          <span className="bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">
            sealed.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-zinc-400">
          Сейф для документов, знаний и инструкций. Разблокировка по триггеру (смерть,
          недееспособность, дата). Наследование через Shamir-разбиение: 3 из 5 опекунов
          восстанавливают ключ.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-2xl font-light">Shamir Inheritance · демо</h2>
          <button
            onClick={resetShares}
            className="text-xs text-zinc-400 underline-offset-4 hover:text-amber-300 hover:underline"
          >
            сбросить shares
          </button>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-zinc-900/40 p-8">
          <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-[1fr_auto_1fr]">
            <div className="grid grid-cols-5 gap-3">
              {trustees.slice(0, 5).map((t) => (
                <button
                  key={t.id}
                  onClick={() => toggleTrustee(t.id)}
                  className={`group flex flex-col items-center gap-2 rounded-xl border p-3 transition ${
                    t.issued
                      ? "border-amber-400/60 bg-amber-500/10 shadow-[0_0_30px_-10px_rgba(251,191,36,0.6)]"
                      : "border-zinc-700 bg-zinc-900/60 hover:border-amber-500/40"
                  }`}
                  type="button"
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full text-xl ${
                      t.issued
                        ? "bg-amber-400/20 text-amber-300"
                        : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {t.issued ? "🔓" : "🔒"}
                  </div>
                  <div className="text-center text-[10px] leading-tight text-zinc-300">
                    {t.name.split(" ")[0]}
                  </div>
                  <div className="text-[9px] text-zinc-500">{t.relation}</div>
                </button>
              ))}
            </div>

            <div className="flex flex-col items-center justify-center">
              <div
                className={`flex h-24 w-24 items-center justify-center rounded-full border-2 text-4xl transition-all duration-500 ${
                  reconstructed
                    ? "border-amber-300 bg-amber-400/20 text-amber-200 shadow-[0_0_60px_-10px_rgba(251,191,36,0.9)]"
                    : "border-zinc-700 bg-zinc-900 text-zinc-600"
                }`}
              >
                {reconstructed ? "🗝" : "🔐"}
              </div>
              <div className="mt-3 font-mono text-xs text-zinc-400">
                {issuedCount} / 5 shares
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">
                threshold: 3
              </div>
            </div>

            <div
              className={`rounded-xl border p-5 text-sm transition ${
                reconstructed
                  ? "border-amber-400/50 bg-amber-500/10 text-amber-100"
                  : "border-zinc-700 bg-zinc-900/40 text-zinc-400"
              }`}
            >
              {reconstructed ? (
                <>
                  <div className="mb-2 font-mono text-xs text-amber-300">
                    ✓ THRESHOLD MET
                  </div>
                  <div>
                    Vault can be reconstructed. AES-ключ восстановлен из {issuedCount}{" "}
                    Shamir-shares. QSign фиксирует событие в аудит-логе.
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-2 font-mono text-xs text-zinc-500">
                    WAITING FOR SHARES
                  </div>
                  <div>
                    Нужно ещё {Math.max(0, 3 - issuedCount)} share(-а). Опекуны
                    собираются независимо — без них ключ невосстановим даже владельцем
                    AEVION.
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="mb-6 text-2xl font-light">Мои сейфы</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {vaults.map((v) => (
            <div
              key={v.id}
              className="rounded-2xl border border-amber-500/15 bg-zinc-900/40 p-5"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <h3 className="text-sm font-medium leading-snug text-zinc-100">
                  {v.title}
                </h3>
                <span
                  className={`shrink-0 rounded px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                    v.status === "sealed"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : v.status === "armed"
                        ? "bg-orange-500/15 text-orange-300"
                        : "bg-sky-500/15 text-sky-300"
                  }`}
                >
                  {v.status}
                </span>
              </div>
              <dl className="space-y-1.5 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <dt>Открытие</dt>
                  <dd className="text-zinc-200">{v.openDate}</dd>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <dt>Триггер</dt>
                  <dd className="text-zinc-200">{v.trigger}</dd>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <dt>Threshold</dt>
                  <dd className="text-zinc-200">{v.threshold}</dd>
                </div>
              </dl>
              <div className="mt-3 inline-block rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1 font-mono text-[10px] text-amber-300">
                {v.encryption}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-20 md:grid-cols-2">
        <form
          onSubmit={handleCreateVault}
          className="rounded-2xl border border-amber-500/20 bg-zinc-900/40 p-6"
        >
          <h2 className="mb-4 text-xl font-light">Создать сейф</h2>
          <div className="space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название (напр. «Письмо внукам»)"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm outline-none focus:border-amber-500/60"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Содержимое (зашифруется AES-256-GCM перед отправкой)"
              rows={4}
              className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm outline-none focus:border-amber-500/60"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm outline-none focus:border-amber-500/60"
              >
                <option>Дата</option>
                <option>Возраст</option>
                <option>Бездействие</option>
                <option>Явный запрос</option>
              </select>
              <select
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm outline-none focus:border-amber-500/60"
              >
                <option value="2/3">2 / 3 опекунов</option>
                <option value="3/5">3 / 5 опекунов</option>
                <option value="4/7">4 / 7 опекунов</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={!!toast}
              className="w-full rounded-lg bg-amber-500/90 px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60"
            >
              {toast ? "Запечатываем…" : "Создать сейф"}
            </button>
          </div>
        </form>

        <form
          onSubmit={handleAddTrustee}
          className="rounded-2xl border border-amber-500/20 bg-zinc-900/40 p-6"
        >
          <h2 className="mb-2 text-xl font-light">Опекуны</h2>
          <p className="mb-4 text-xs text-zinc-400">
            Получают по одному Shamir-share. {trustees.length} назначены.
          </p>
          <div className="space-y-3">
            <input
              value={trusteeEmail}
              onChange={(e) => setTrusteeEmail(e.target.value)}
              placeholder="email@опекуна.kz"
              type="email"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm outline-none focus:border-amber-500/60"
            />
            <select
              value={trusteeRelation}
              onChange={(e) => setTrusteeRelation(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm outline-none focus:border-amber-500/60"
            >
              <option>Семья</option>
              <option>Опекун</option>
              <option>Юрист</option>
              <option>Друг</option>
            </select>
            <button
              type="submit"
              className="w-full rounded-lg border border-amber-500/40 bg-transparent px-4 py-2.5 text-sm font-medium text-amber-300 transition hover:bg-amber-500/10"
            >
              Добавить опекуна
            </button>
          </div>
          <ul className="mt-4 max-h-32 space-y-1 overflow-y-auto text-xs">
            {trustees.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950/40 px-2 py-1"
              >
                <span className="truncate text-zinc-300">{t.name}</span>
                <span className="text-[10px] text-zinc-500">{t.relation}</span>
              </li>
            ))}
          </ul>
        </form>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="mb-4 text-sm uppercase tracking-wider text-zinc-500">
          Связанные модули AEVION
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            {
              href: "/quantum-shield",
              t: "Quantum Shield",
              d: "Shamir secret-sharing — основа inheritance в LifeBox.",
            },
            {
              href: "/qsign",
              t: "QSign",
              d: "Подпись каждого доступа к сейфу — никаких незамеченных открытий.",
            },
            {
              href: "/qright",
              t: "QRight",
              d: "Реестр авторства — LifeBox хранит права и подтверждения.",
            },
          ].map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition hover:border-amber-500/40 hover:bg-zinc-900/70"
            >
              <div className="mb-1 text-sm font-medium text-amber-200 group-hover:text-amber-300">
                {m.t} →
              </div>
              <div className="text-xs text-zinc-400">{m.d}</div>
            </Link>
          ))}
        </div>
      </section>

      <MvpConceptBoard
        moduleId="lifebox"
        noun="capsules"
        titleField="label"
        summaryField="occasion"
        accent="amber"
        sectionTitle="Community time-capsules"
        sectionHint="Манифесты капсул (только метаданные — содержимое всегда у владельца)."
        fields={[
          { key: "label", label: "Метка капсулы", required: true, placeholder: "Дочери, на 18-летие" },
          { key: "year", label: "Год открытия", type: "number", required: true, placeholder: "2042" },
          { key: "occasion", label: "Повод", type: "textarea", required: false, placeholder: "Контекст: что хотите передать, к какому событию приурочить." },
        ]}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 w-80 rounded-xl border border-amber-500/40 bg-zinc-900/95 p-4 shadow-2xl backdrop-blur">
          <div className="mb-2 flex items-center gap-2 text-xs text-amber-300">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
            Sealing vault · step {toast.step}/3
          </div>
          <div className="text-sm text-zinc-100">{toast.text}</div>
          <div className="mt-3 h-1 overflow-hidden rounded bg-zinc-800">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all"
              style={{ width: `${(toast.step / 3) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
