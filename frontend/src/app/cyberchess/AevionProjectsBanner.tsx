"use client";
import React from "react";

const PROJECTS = [
  { id:"bureau",  name:"Патентное Бюро", emoji:"🏛", href:"/bureau",         tag:"IP · Патенты" },
  { id:"build",   name:"QBuild",          emoji:"💼", href:"/build",          tag:"Строительство" },
  { id:"qright",  name:"QRight",          emoji:"©",  href:"/qright",         tag:"Авторские права" },
  { id:"shield",  name:"Крайт / QShield", emoji:"🛡", href:"/quantum-shield", tag:"Кибербезопасность" },
  { id:"qsign",   name:"Ксайн / QSign",   emoji:"✍", href:"/qsign",          tag:"Электр. подписи" },
];

interface Props {
  onHide: () => void;
}

export default function AevionProjectsBanner({ onHide }: Props) {
  return (
    <div style={{
      position: "fixed", right: 0, top: 28, bottom: 0, width: 240,
      background: "#1e1c19", borderLeft: "1px solid #3d3b39",
      display: "flex", flexDirection: "column", zIndex: 150,
      overflow: "hidden",
    }}>
      {/* Заголовок */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 10px", borderBottom: "1px solid #3d3b39", flexShrink: 0,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 900, color: "#5d5b59",
          letterSpacing: 1.2, textTransform: "uppercase",
        }}>
          Проекты АЕВИОН
        </span>
        <button
          onClick={onHide}
          title="Скрыть панель"
          style={{
            background: "transparent", border: "none", color: "#5d5b59",
            cursor: "pointer", fontSize: 14, padding: "0 2px", lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Карточки проектов */}
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
        {PROJECTS.map(p => (
          <a
            key={p.id}
            href={p.href}
            style={{
              display: "flex", alignItems: "center", gap: 9,
              height: 40, padding: "0 10px",
              textDecoration: "none", color: "#8b8987",
              borderBottom: "1px solid #2a2825",
              transition: "background 120ms",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "#262421"; (e.currentTarget as HTMLAnchorElement).style.color = "#bababa"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = "#8b8987"; }}
          >
            <span style={{ fontSize: 18, flexShrink: 0 }}>{p.emoji}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "inherit", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.name}
              </div>
              <div style={{ fontSize: 9, fontWeight: 600, color: "#5d5b59", marginTop: 1 }}>
                {p.tag}
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* Рекламный placeholder */}
      <div style={{
        height: 100, margin: "8px", flexShrink: 0,
        border: "1px dashed #3d3b39", borderRadius: 6,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#5d5b59", fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
      }}>
        Реклама 300×250
      </div>
    </div>
  );
}
