"use client";

/**
 * 152 (18.10.2026). Три первых замысла с кнопкой «👍 интересно» — первый экран гостя на /ventures.
 * Намеренно без Ceiling, модели и статуса «LIVE»: в шапке не должно появляться обещаний доходности
 * и того, что замыслы уже работают как продукты. Только имя, кнопка, счётчик и подсказка.
 */

import { IDEAS } from "./IdeaMarket";
import { InterestButton } from "./VenturesInterest";

export const TOP_IDEAS_COUNT = 3;

export default function TopIdeas() {
  return (
    <div className="vtx-top3" data-ventures-top3>
      <p className="vtx-top3-hint">
        Отметь, что интересно — без входа, один голос на замысел. Все 20 замыслов ниже.
      </p>
      <ul className="vtx-top3-list">
        {IDEAS.slice(0, TOP_IDEAS_COUNT).map((i) => (
          <li className="vtx-top3-card" key={i.id}>
            <span className="vtx-top3-num">{i.id}</span>
            <span className="vtx-top3-name">{i.name}</span>
            <InterestButton id={i.id} name={i.name} size="m" />
          </li>
        ))}
      </ul>
    </div>
  );
}
