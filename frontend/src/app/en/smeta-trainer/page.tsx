import type { Metadata } from "next";
import { PageTracking } from "@/components/PageTracking";
import { channelFrom, keepChannel } from "@/lib/products";

// /en/smeta-trainer — английская посадочная русскоязычного продукта.
//
// Замер EN-свипа 06.09.2026: /smeta-trainer под cookie en — 84 % кириллицы,
// худшая строка антирейтинга. Полный перевод интерфейса здесь НЕ решение:
// предмет (государственные сметные нормы Казахстана, НДЦС РК) русскоязычен
// по природе, и продукт честно об этом говорит. Задача посадочной — чтобы
// en-посетитель понял, ЧТО это и для кого, а не упёрся в стену русского.
//
// Чисел из корпуса здесь нет намеренно: вписанное число тихо расходится с
// данными (класс из памяти платформы); корпус сам печатает свои счётчики
// внутри приложения.

export const metadata: Metadata = {
  title: "Smeta Trainer — construction estimating for Kazakhstan (Russian-language)",
  description:
    "An AI trainer for Kazakhstan state construction estimating (НДЦС РК): a real ЭСН rate corpus, levels, exams and document forms. The product speaks Russian — the domain is Russian-language by nature.",
  alternates: { canonical: "https://aevion.app/en/smeta-trainer" },
  openGraph: {
    title: "Smeta Trainer — construction estimating for Kazakhstan",
    description:
      "AI trainer on the real Kazakhstan estimating norms corpus. Russian-language product.",
    url: "https://aevion.app/en/smeta-trainer",
    type: "website",
  },
};

export default async function EnSmetaPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const channel = channelFrom((await searchParams).c);
  return (
    <main style={styles.page}>
      <PageTracking page="en-smeta-trainer" />
      <div style={styles.wrap}>
        <div style={styles.brand}>AEVION</div>
        <h1 style={styles.h1}>Smeta Trainer</h1>
        <p style={styles.lede}>
          An AI trainer for construction estimating in Kazakhstan: built on the
          real state rate corpus (НДЦС РК / ЭСН), with levels, exams, document
          forms and mistake analysis.
        </p>
        <p style={styles.note}>
          The product speaks Russian — Kazakhstan estimating norms are a
          Russian-language domain, and the trainer teaches you to work with
          the real documents. If you read Russian, dive in; if you are
          evaluating it for a Russian-speaking team, the buttons below work
          either way.
        </p>
        <div style={styles.row}>
          <a href={keepChannel("/smeta-trainer", channel)} style={styles.cta}>
            Open the trainer
          </a>
          <a href={keepChannel("/pricing?module=smeta-trainer", channel)} style={styles.ctaGhost}>
            Plans &amp; pricing
          </a>
        </div>
      </div>
    </main>
  );
}

const PAPER = "#f7f6f2";
const INK = "#16161a";
const MUTED = "#5d5f66";
const GOLD = "#a9781a";

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: PAPER, color: INK, padding: "64px 20px" },
  wrap: { maxWidth: 640, margin: "0 auto" },
  brand: { fontSize: 13, letterSpacing: 3, color: GOLD, fontWeight: 700 },
  h1: { fontFamily: "Georgia, serif", fontSize: 40, margin: "10px 0 12px" },
  lede: { fontSize: 18, lineHeight: 1.55, color: MUTED },
  note: { fontSize: 15, lineHeight: 1.6, color: MUTED, marginTop: 16 },
  row: { display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" },
  cta: {
    background: INK,
    color: "#fff",
    borderRadius: 8,
    padding: "12px 20px",
    fontWeight: 700,
    fontSize: 15,
    textDecoration: "none",
  },
  ctaGhost: {
    border: `1px solid ${INK}`,
    color: INK,
    borderRadius: 8,
    padding: "12px 20px",
    fontWeight: 700,
    fontSize: 15,
    textDecoration: "none",
  },
};
