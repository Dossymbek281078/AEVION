"use client";

import { useEffect, useMemo, useState } from "react";

const MAX_COINS = 30;
const AEC_PER_COIN = 100;

function usePrefersReducedMotion(): boolean {
  const [prm, setPrm] = useState<boolean>(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrm(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return prm;
}

export function CoinTower({
  balance,
  height = 160,
  coinWidth = 56,
}: {
  balance: number;
  height?: number;
  coinWidth?: number;
}) {
  const prm = usePrefersReducedMotion();
  const [hovered, setHovered] = useState<boolean>(false);

  const coinCount = useMemo(() => {
    if (balance <= 0) return 0;
    return Math.min(MAX_COINS, Math.max(1, Math.floor(balance / AEC_PER_COIN)));
  }, [balance]);

  const coinHeight = 8;
  const towerHeight = Math.max(coinHeight, coinCount * (coinHeight - 2) + coinHeight);
  const baseY = height - 6;

  const coinIndices = Array.from({ length: coinCount }, (_, i) => i);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="img"
      aria-label={`Visual coin stack representing ${balance.toFixed(2)} AEC`}
      style={{
        position: "relative" as const,
        width: coinWidth + 30,
        height,
        perspective: 600,
        userSelect: "none" as const,
        flexShrink: 0,
      }}
    >
      <style>{`
        @keyframes coin-drop {
          0% { transform: translate(-50%, -120px) rotate(-12deg); opacity: 0; }
          70% { transform: translate(-50%, 4px) rotate(2deg); opacity: 1; }
          100% { transform: translate(-50%, 0) rotate(0deg); opacity: 1; }
        }
        @keyframes shimmer {
          0%, 100% { box-shadow: 0 1px 0 rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.04) inset; }
          50% { box-shadow: 0 1px 0 rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.18) inset; }
        }
      `}</style>

      <div
        style={{
          position: "absolute" as const,
          left: "50%",
          bottom: 4,
          width: coinWidth + 18,
          height: 8,
          transform: "translateX(-50%)",
          background: "radial-gradient(ellipse at center, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 70%)",
          borderRadius: "50%",
          filter: "blur(2px)",
          pointerEvents: "none" as const,
        }}
      />

      <div
        style={{
          position: "absolute" as const,
          left: 0,
          right: 0,
          bottom: 0,
          height: towerHeight + 10,
          transform: hovered && !prm ? "rotateZ(-2deg) translateX(2px)" : "rotateZ(0)",
          transition: prm ? "none" : "transform 360ms ease",
          transformOrigin: "50% 100%",
        }}
      >
        {coinIndices.map((i) => {
          const y = baseY - i * (coinHeight - 2);
          const drift = ((i * 53) % 7) - 3;
          const tilt = ((i * 41) % 5) - 2;
          return (
            <div
              key={i}
              style={{
                position: "absolute" as const,
                left: "50%",
                top: y - coinHeight,
                width: coinWidth,
                height: coinHeight,
                transform: `translateX(calc(-50% + ${drift}px)) rotate(${tilt}deg)`,
                animation: prm ? "none" : `coin-drop 360ms cubic-bezier(0.22, 1.6, 0.36, 1) ${i * 35}ms both, shimmer 3.2s ease-in-out ${i * 80}ms infinite`,
                pointerEvents: "none" as const,
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  background:
                    "radial-gradient(ellipse at 30% 30%, #fde68a 0%, #f59e0b 35%, #b45309 75%, #78350f 100%)",
                  boxShadow:
                    "0 1px 0 rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.08) inset, inset 0 -1px 1px rgba(0,0,0,0.25)",
                  position: "relative" as const,
                }}
              >
                <div
                  style={{
                    position: "absolute" as const,
                    top: 1,
                    left: "20%",
                    right: "20%",
                    height: 2,
                    borderRadius: "50%",
                    background:
                      "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)",
                  }}
                />
              </div>
            </div>
          );
        })}
        {coinCount === 0 ? (
          <div
            style={{
              position: "absolute" as const,
              left: "50%",
              bottom: 0,
              width: coinWidth,
              height: coinHeight,
              transform: "translateX(-50%)",
              borderRadius: "50%",
              border: "1px dashed rgba(15,23,42,0.18)",
              opacity: 0.6,
            }}
          />
        ) : null}
      </div>

      <div
        style={{
          position: "absolute" as const,
          top: 4,
          left: 0,
          right: 0,
          textAlign: "center" as const,
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "0.06em",
          color: "#64748b",
          textTransform: "uppercase" as const,
        }}
      >
        {coinCount}/{MAX_COINS}
      </div>
    </div>
  );
}
