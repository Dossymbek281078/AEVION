"use client";
import React from "react";
import Link from "next/link";
import ModulePricingChip from "@/components/ModulePricingChip";

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

const BANNER_W = 240;

export default function AevionProjectsBanner({ onHide }: Props) {
  // Панель фиксированная и лежит ПОВЕРХ страницы: без компенсации она срезает
  // правый край контента — на лаунчпаде под неё уходил край кнопки «Играть».
  // Отступ снимается при размонтировании, поэтому «скрыть панель» возвращает
  // страницу к прежней ширине.
  React.useEffect(() => {
    const prev = document.body.style.paddingRight;
    document.body.style.paddingRight = `${BANNER_W}px`;
    // Отступ у body двигает только поток. ЗАКРЕПЛЁННЫЕ соседи его не видят и
    // ложатся поверх рейки — 01.09.2026 плашка стрима так накрыла «Купить»,
    // цену и «Все тарифы →», то есть весь путь покупки на странице шахмат.
    // Публикуем ширину, чтобы закреплённые элементы могли посторониться.
    document.documentElement.style.setProperty("--aevion-projects-w", `${BANNER_W}px`);
    return () => {
      document.body.style.paddingRight = prev;
      document.documentElement.style.removeProperty("--aevion-projects-w");
    };
  }, []);

  return (
    <div style={{
      position: "fixed", right: 0, top: 28, bottom: 0, width: BANNER_W,
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
              {/* translate="no": это имена продуктов. Без него авто-перевод
                  делал из «Ксайн / QSign» — «Xsign / QSign», а из «Крайт» — «Krait». */}
              <div translate="no" className="notranslate" style={{ fontSize: 11, fontWeight: 700, color: "inherit", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.name}
              </div>
              <div style={{ fontSize: 9, fontWeight: 600, color: "#5d5b59", marginTop: 1 }}>
                {p.tag}
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* CyberChess pricing — live from /api/pricing via ModulePricingChip */}
      <div style={{
        margin: "8px", padding: "10px 12px", flexShrink: 0,
        border: "1px solid #3d3b39", borderRadius: 6,
        background: "#262421",
      }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: "#5d5b59", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
          CyberChess подписка
        </div>
        <ModulePricingChip moduleId="cyberchess" theme="dark" />
        <Link
          href="/pricing"
          style={{
            display: "block", marginTop: 8, fontSize: 10, fontWeight: 700,
            color: "#34d399", textDecoration: "none", textAlign: "center",
          }}
        >
          Все тарифы →
        </Link>
      </div>
    </div>
  );
}
