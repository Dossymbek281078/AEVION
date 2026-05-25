"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  classify,
  COUNTRIES,
  DEFAULT_SLIDERS,
  SLIDER_META,
  type Country,
  type Sliders,
} from "@/lib/constitution";
import { ConstitutionEmbed } from "@/components/ConstitutionEmbed";
import { useI18n } from "@/lib/i18n";

const ONBOARDED_KEY = "constitution.onboarded";

export default function ConstitutionWelcomePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [pickedCountry, setPickedCountry] = useState<Country | null>(null);
  const [sliders, setSliders] = useState<Sliders>(DEFAULT_SLIDERS);

  const finish = useCallback(
    (applyCountry: boolean) => {
      try {
        window.localStorage.setItem(ONBOARDED_KEY, new Date().toISOString());
      } catch {
        /* ignore */
      }
      if (applyCountry && pickedCountry) {
        router.push(`/constitution?country=${pickedCountry.code}`);
      } else {
        router.push("/constitution");
      }
    },
    [router, pickedCountry],
  );

  const skip = () => finish(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1736] via-[#131f3d] to-[#050a1a] text-[#e7ecf8] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1 rounded-full transition-all ${
                  s === step
                    ? "w-12 bg-[#d4af37]"
                    : s < step
                      ? "w-12 bg-[#d4af37]/50"
                      : "w-8 bg-[#d4af37]/15"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={skip}
            className="text-xs text-[#9aa3c0] hover:text-[#d4af37]"
          >
            {t("constitution.welcome.skip")}
          </button>
        </div>

        {step === 0 && <StepGreeting onNext={() => setStep(1)} t={t} />}

        {step === 1 && (
          <StepPickCountry
            picked={pickedCountry}
            onPick={(c) => setPickedCountry(c)}
            onNext={() => {
              if (pickedCountry) {
                setSliders({ ...DEFAULT_SLIDERS, ...pickedCountry.sliders });
                setStep(2);
              }
            }}
            onBack={() => setStep(0)}
            t={t}
          />
        )}

        {step === 2 && pickedCountry && (
          <StepMiniTask
            country={pickedCountry}
            sliders={sliders}
            onChange={setSliders}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
            t={t}
          />
        )}

        {step === 3 && pickedCountry && (
          <StepDone
            country={pickedCountry}
            sliders={sliders}
            onFinish={() => finish(true)}
            t={t}
          />
        )}
      </div>
    </div>
  );
}

type TFn = (key: string, vars?: Record<string, string | number>) => string;

function StepGreeting({ onNext, t }: { onNext: () => void; t: TFn }) {
  return (
    <div className="bg-[#0b1736]/60 border border-[#d4af37]/30 rounded-2xl p-8 text-center">
      <div className="text-6xl mb-4">🌍</div>
      <h1 className="text-3xl md:text-4xl font-bold text-[#d4af37] mb-3">
        {t("constitution.welcome.greeting.title")}
      </h1>
      <p className="text-[#9aa3c0] mb-2">
        {t("constitution.welcome.greeting.subtitle")}
      </p>
      <p className="text-[#e7ecf8] mb-6 max-w-xl mx-auto leading-relaxed">
        {t("constitution.welcome.greeting.intro")}
      </p>
      <p className="text-xs text-[#9aa3c0] mb-6">
        {t("constitution.welcome.greeting.duration")}
      </p>
      <button
        type="button"
        onClick={onNext}
        className="px-6 py-3 rounded-lg bg-[#d4af37] text-[#0b1736] font-bold hover:opacity-90"
      >
        {t("constitution.welcome.greeting.start")}
      </button>
    </div>
  );
}

function StepPickCountry({
  picked,
  onPick,
  onNext,
  onBack,
  t,
}: {
  picked: Country | null;
  onPick: (c: Country) => void;
  onNext: () => void;
  onBack: () => void;
  t: TFn;
}) {
  return (
    <div className="bg-[#0b1736]/60 border border-[#d4af37]/30 rounded-2xl p-6 md:p-8">
      <div className="text-xs uppercase tracking-wider text-[#9aa3c0] mb-1">
        {t("constitution.welcome.step2.label")}
      </div>
      <h2 className="text-2xl md:text-3xl font-bold text-[#d4af37] mb-2">
        {t("constitution.welcome.pickCountry.title")}
      </h2>
      <p className="text-sm text-[#9aa3c0] mb-5">
        {t("constitution.welcome.pickCountry.subtitle")}
      </p>
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mb-5">
        {COUNTRIES.map((c) => {
          const active = picked?.code === c.code;
          return (
            <button
              key={c.code}
              type="button"
              onClick={() => onPick(c)}
              className={`p-3 rounded-lg border text-left transition ${
                active
                  ? "bg-[#d4af37]/15 border-[#d4af37]"
                  : "border-[#d4af37]/15 hover:bg-[#d4af37]/5"
              }`}
            >
              <div className="text-2xl">{c.flag}</div>
              <div className="text-xs mt-1 truncate">{c.name}</div>
            </button>
          );
        })}
      </div>
      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-sm px-4 py-2 rounded border border-[#d4af37]/30 hover:bg-[#d4af37]/10"
        >
          {t("constitution.welcome.back")}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!picked}
          className="px-5 py-2 rounded bg-[#d4af37] text-[#0b1736] font-bold disabled:opacity-40"
        >
          {t("constitution.welcome.next")}
        </button>
      </div>
    </div>
  );
}

function StepMiniTask({
  country,
  sliders,
  onChange,
  onNext,
  onBack,
  t,
}: {
  country: Country;
  sliders: Sliders;
  onChange: (s: Sliders) => void;
  onNext: () => void;
  onBack: () => void;
  t: TFn;
}) {
  // Target ползунок: подбираем тот, где у страны самое слабое место
  const weakestKey = useMemo<keyof Sliders>(() => {
    const entries = (Object.keys(country.sliders) as Array<keyof Sliders>)
      .map((k) => ({ k, v: country.sliders[k] }))
      .sort((a, b) => a.v - b.v);
    return entries[0]?.k ?? "ruleOfLaw";
  }, [country]);

  const meta = SLIDER_META.find((m) => m.key === weakestKey)!;
  const baseline = country.sliders[weakestKey];
  const current = sliders[weakestKey];
  const moved = current !== baseline;
  const regime = useMemo(() => classify(sliders), [sliders]);

  return (
    <div className="bg-[#0b1736]/60 border border-[#d4af37]/30 rounded-2xl p-6 md:p-8">
      <div className="text-xs uppercase tracking-wider text-[#9aa3c0] mb-1">
        {t("constitution.welcome.step3.label", { flag: country.flag, country: country.name })}
      </div>
      <h2 className="text-2xl md:text-3xl font-bold text-[#d4af37] mb-2">
        {t("constitution.welcome.miniTask.title", { label: meta.label })}
      </h2>
      <p className="text-sm text-[#9aa3c0] mb-1">
        {t("constitution.welcome.miniTask.subtitle", { country: country.name, baseline })}
      </p>
      <p className="text-xs text-[#9aa3c0] italic mb-5">{meta.hint}</p>

      <div className="mb-5">
        <div className="flex justify-between items-baseline mb-1">
          <label className="font-medium">{meta.label}</label>
          <span className="text-[#d4af37] font-mono">
            {current}{" "}
            <span className="text-xs text-[#9aa3c0]">
              {t("constitution.welcome.miniTask.was", { baseline })}
            </span>
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={current}
          onChange={(e) =>
            onChange({ ...sliders, [weakestKey]: Number(e.target.value) })
          }
          className="w-full accent-[#d4af37]"
        />
        <div className="flex justify-between text-xs text-[#9aa3c0] mt-1">
          <span>{meta.low}</span>
          <span>{meta.high}</span>
        </div>
      </div>

      <div className="bg-[#050a1a]/40 border border-[#d4af37]/15 rounded p-3 mb-5">
        <div className="text-xs text-[#9aa3c0] mb-1">
          {t("constitution.welcome.miniTask.resulting")}
        </div>
        <div className="text-[#f5d27a] font-bold">{regime.name}</div>
        <div className="text-xs text-[#9aa3c0] italic">{regime.era}</div>
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-sm px-4 py-2 rounded border border-[#d4af37]/30 hover:bg-[#d4af37]/10"
        >
          {t("constitution.welcome.back")}
        </button>
        <button
          type="button"
          onClick={onNext}
          className="px-5 py-2 rounded bg-[#d4af37] text-[#0b1736] font-bold"
        >
          {moved
            ? t("constitution.welcome.miniTask.done")
            : t("constitution.welcome.miniTask.donePrompt")}
        </button>
      </div>
    </div>
  );
}

function StepDone({
  country,
  sliders,
  onFinish,
  t,
}: {
  country: Country;
  sliders: Sliders;
  onFinish: () => void;
  t: TFn;
}) {
  const regime = useMemo(() => classify(sliders), [sliders]);

  return (
    <div className="bg-[#0b1736]/60 border border-emerald-400/40 rounded-2xl p-6 md:p-8 text-center">
      <div className="text-5xl mb-3">🎉</div>
      <h2 className="text-2xl md:text-3xl font-bold text-emerald-300 mb-2">
        {t("constitution.welcome.done.title")}
      </h2>
      <p className="text-[#9aa3c0] mb-5">
        {t("constitution.welcome.done.body", { flag: country.flag, country: country.name })}
      </p>
      <div className="my-5 flex justify-center">
        <ConstitutionEmbed sliders={sliders} label={regime.name} size="md" />
      </div>
      <p className="text-sm text-[#e7ecf8] max-w-md mx-auto mb-6 leading-relaxed">
        {t("constitution.welcome.done.next")}
      </p>
      <div className="flex justify-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={onFinish}
          className="px-6 py-3 rounded-lg bg-[#d4af37] text-[#0b1736] font-bold hover:opacity-90"
        >
          {t("constitution.welcome.done.openEditor")}
        </button>
        <Link
          href="/constitution/learn"
          onClick={() => {
            try {
              window.localStorage.setItem(ONBOARDED_KEY, new Date().toISOString());
            } catch { /* ignore */ }
          }}
          className="px-6 py-3 rounded-lg border border-emerald-400/40 text-emerald-300 font-semibold hover:bg-emerald-500/10"
        >
          {t("constitution.welcome.done.toAcademy")}
        </Link>
      </div>
    </div>
  );
}
