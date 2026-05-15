"use client";

/**
 * Row of stylized customer wordmarks.
 *
 * Реальные клиентские логотипы будут добавлены, когда NDA будут сняты.
 * Сейчас — визуально-разнообразные wordmark-плашки, имитирующие
 * diverse customer base (banks, startups, gov, creators, law firms).
 *
 * Решение через CSS letter-spacing + font-weight + color, без растровых
 * картинок — масштабируется и не зависит от внешних активов.
 */

interface LogoWordmark {
  text: string;
  family: string;
  weight: number;
  letterSpacing: string;
  color: string;
  italic?: boolean;
  /** Маленький постфикс, имитирует TM/registered-style модификатор */
  suffix?: string;
}

const WORDMARKS: LogoWordmark[] = [
  {
    text: "INKUBATOR",
    family: "ui-monospace, monospace",
    weight: 800,
    letterSpacing: "0.18em",
    color: "#475569",
  },
  {
    text: "Acme Legal",
    family: "Georgia, serif",
    weight: 700,
    letterSpacing: "-0.01em",
    color: "#475569",
    italic: true,
  },
  {
    text: "FINTECH·5",
    family: "system-ui, sans-serif",
    weight: 900,
    letterSpacing: "0.04em",
    color: "#475569",
  },
  {
    text: "STORYTELLER",
    family: "Georgia, serif",
    weight: 400,
    letterSpacing: "0.3em",
    color: "#475569",
  },
  {
    text: "DigitalGov",
    family: "system-ui, sans-serif",
    weight: 800,
    letterSpacing: "-0.02em",
    color: "#475569",
    suffix: ".kz",
  },
  {
    text: "kontent.io",
    family: "ui-monospace, monospace",
    weight: 600,
    letterSpacing: "-0.01em",
    color: "#475569",
  },
];

export function CustomerLogosRow({ label }: { label: string }) {
  return (
    <section
      style={{
        marginBottom: 40,
        padding: "20px 0",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.08em",
          color: "#94a3b8",
          marginBottom: 16,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: "20px 36px",
          opacity: 0.7,
        }}
      >
        {WORDMARKS.map((w, i) => (
          <div
            key={i}
            style={{
              fontFamily: w.family,
              fontWeight: w.weight,
              letterSpacing: w.letterSpacing,
              color: w.color,
              fontStyle: w.italic ? "italic" : "normal",
              fontSize: 18,
              lineHeight: 1,
              userSelect: "none",
            }}
          >
            {w.text}
            {w.suffix && (
              <span
                style={{
                  fontSize: 13,
                  opacity: 0.6,
                  marginLeft: 1,
                }}
              >
                {w.suffix}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
