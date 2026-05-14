"use client";
import React, { useEffect, useRef, useState } from "react";

const ITEMS = [
  { id:"bureau",  name:"Патентное Бюро", emoji:"🏛", href:"/bureau" },
  { id:"qright",  name:"QRight",          emoji:"©",  href:"/qright" },
  { id:"build",   name:"QBuild",           emoji:"💼", href:"/build" },
  { id:"qsign",   name:"QSign",            emoji:"✍", href:"/qsign" },
  { id:"qcoreai", name:"QCoreAI",          emoji:"🧠", href:"/qcoreai" },
  { id:"qtrade",  name:"QTrade",           emoji:"📈", href:"/qtrade" },
  { id:"shield",  name:"QShield",          emoji:"🛡", href:"/quantum-shield" },
  { id:"healthai",name:"HealthAI",         emoji:"🩺", href:"/healthai" },
  { id:"planet",  name:"Planet",           emoji:"🌍", href:"/planet" },
  { id:"awards",  name:"Премии",           emoji:"🏆", href:"/awards" },
  { id:"qpaynet", name:"QPayNet",          emoji:"💸", href:"/qpaynet" },
  { id:"devhub",  name:"DevHub",           emoji:"⚡", href:"/devhub" },
];

export default function AevionTicker() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return true;
    try { return localStorage.getItem("cc_ticker_v1") !== "0"; } catch { return true; }
  });
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { localStorage.setItem("cc_ticker_v1", visible ? "1" : "0"); } catch {}
  }, [visible]);

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        style={{
          position: "fixed", top: 0, right: 48, zIndex: 200,
          padding: "2px 10px", background: "#1e1c19", color: "#8b8987",
          border: "1px solid #3d3b39", borderTop: "none", borderRadius: "0 0 6px 6px",
          fontSize: 10, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5,
        }}
      >
        AEVION ▾
      </button>
    );
  }

  // Дублируем items для бесшовной прокрутки
  const allItems = [...ITEMS, ...ITEMS];

  return (
    <div style={{
      position: "relative", height: 28, background: "#1e1c19",
      borderBottom: "1px solid #3d3b39", overflow: "hidden",
      display: "flex", alignItems: "center",
      flexShrink: 0,
    }}>
      {/* Бегущая строка */}
      <div
        ref={trackRef}
        style={{
          display: "flex", alignItems: "center", gap: 0,
          animation: "cc-ticker-scroll 40s linear infinite",
          whiteSpace: "nowrap",
        }}
      >
        {allItems.map((item, i) => (
          <a
            key={`${item.id}-${i}`}
            href={item.href}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "0 18px", fontSize: 11, fontWeight: 700,
              color: "#8b8987", textDecoration: "none",
              borderRight: "1px solid #3d3b39",
              transition: "color 150ms",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#bababa")}
            onMouseLeave={e => (e.currentTarget.style.color = "#8b8987")}
          >
            <span style={{ fontSize: 13 }}>{item.emoji}</span>
            {item.name}
          </a>
        ))}
      </div>

      {/* Градиентные края */}
      <div style={{ position:"absolute",left:0,top:0,bottom:0,width:40,background:"linear-gradient(to right,#1e1c19,transparent)",pointerEvents:"none" }}/>
      <div style={{ position:"absolute",right:28,top:0,bottom:0,width:40,background:"linear-gradient(to left,#1e1c19,transparent)",pointerEvents:"none" }}/>

      {/* Кнопка скрыть */}
      <button
        onClick={() => setVisible(false)}
        title="Скрыть строку AEVION"
        style={{
          position: "absolute", right: 0, top: 0, bottom: 0,
          width: 28, background: "transparent", border: "none",
          borderLeft: "1px solid #3d3b39", color: "#5d5b59",
          cursor: "pointer", fontSize: 14, display: "flex",
          alignItems: "center", justifyContent: "center",
        }}
      >
        ×
      </button>
    </div>
  );
}
