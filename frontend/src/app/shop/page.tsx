import type { Metadata } from "next";

// AEVION Shop — единая витрина всех цифровых товаров (Gumroad).
// Одна точка продаж, на которую могут ссылаться любые модули-планеты.
// Статическая серверная страница: только внешние ссылки на живой чекаут Gumroad.

export const metadata: Metadata = {
  title: "Магазин AEVION — гайды и книги",
  description:
    "Цифровые товары AEVION: научные гайды о долголетии и седине, книга. Мгновенная доставка через Gumroad. Wellness, не медицина.",
};

interface Product {
  title: string;
  format: string;
  desc: string;
  price: string;
  href: string;
  badge?: string;
}

const PRODUCTS: Product[] = [
  {
    title: "Протокол «Анти-седина»",
    format: "PDF · гайд · RU",
    desc: "Наука о том, почему волос седеет и что реально её замедляет — без хайпа. Медь/цинк, спермидин, окислительный стресс + 12-недельный протокол.",
    price: "$9",
    href: "https://aevion.gumroad.com/l/tmuyxw",
    badge: "Новое",
  },
  {
    title: "The Anti-Grey Protocol",
    format: "PDF · guide · EN",
    desc: "The evidence-first science of pigment aging and what actually slows it. Copper/zinc, spermidine, oxidative stress + a 12-week protocol.",
    price: "$19",
    href: "https://aevion.gumroad.com/l/kkiavh",
    badge: "New",
  },
  {
    title: "Gratitude ∞ Forever Young",
    format: "PDF + EPUB · книга",
    desc: "90-дневная практика благодарности и молодости: 4 минуты в день. Полный пакет.",
    price: "$29.99",
    href: "https://aevion.gumroad.com/l/ghvzq",
  },
];

export default function ShopPage() {
  return (
    <main style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.eyebrow}>AEVION · Shop</div>
        <h1 style={styles.h1}>Магазин AEVION</h1>
        <p style={styles.lede}>
          Цифровые товары с мгновенной доставкой — научные гайды и книга. Оплата и выдача через Gumroad.
          Wellness и образование, не медицина.
        </p>

        <div style={styles.grid}>
          {PRODUCTS.map((p) => (
            <a
              key={p.href}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.card}
            >
              <div style={styles.cardTop}>
                {p.badge ? <span style={styles.badge}>{p.badge}</span> : null}
                <span style={styles.format}>{p.format}</span>
              </div>
              <h2 style={styles.cardTitle}>{p.title}</h2>
              <p style={styles.cardDesc}>{p.desc}</p>
              <div style={styles.cardFoot}>
                <span style={styles.price}>{p.price}</span>
                <span style={styles.buy}>Купить&nbsp;→</span>
              </div>
            </a>
          ))}
        </div>

        <p style={styles.foot}>
          Все продукты — образовательные/wellness-материалы. Не предназначены для диагностики, лечения
          или профилактики заболеваний.
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#070b14", color: "#e8eef6", padding: "48px 20px" },
  wrap: { maxWidth: 980, margin: "0 auto" },
  eyebrow: {
    fontFamily: "monospace",
    fontSize: 12,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "#c8823f",
  },
  h1: { fontSize: 36, margin: "10px 0 0", fontWeight: 700 },
  lede: { color: "#9fb0c4", marginTop: 14, lineHeight: 1.6, maxWidth: 640 },
  grid: {
    marginTop: 32,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 18,
  },
  card: {
    display: "flex",
    flexDirection: "column",
    background: "#0d1422",
    border: "1px solid #1c2942",
    borderRadius: 16,
    padding: 22,
    textDecoration: "none",
    color: "#e8eef6",
  },
  cardTop: { display: "flex", alignItems: "center", gap: 10 },
  badge: {
    fontFamily: "monospace",
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    background: "#c8823f",
    color: "#0a0a0a",
    borderRadius: 6,
    padding: "2px 8px",
    fontWeight: 700,
  },
  format: { fontFamily: "monospace", fontSize: 11.5, color: "#6c7d92" },
  cardTitle: { fontSize: 19, fontWeight: 700, margin: "12px 0 0" },
  cardDesc: { color: "#9fb0c4", fontSize: 13.5, lineHeight: 1.55, marginTop: 8, flex: 1 },
  cardFoot: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
  },
  price: { fontSize: 20, fontWeight: 700 },
  buy: {
    background: "#c8823f",
    color: "#0a0a0a",
    borderRadius: 10,
    padding: "10px 18px",
    fontSize: 14,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  foot: {
    marginTop: 28,
    fontSize: 12.5,
    color: "#8b9bb0",
    borderTop: "1px solid #1c2942",
    paddingTop: 16,
  },
};
