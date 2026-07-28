import type { Metadata } from "next";
import { CompetitorMatrix } from "@/components/CompetitorMatrix";
import { COMPETITOR_SETS, unverifiedCount } from "@/lib/competitors";

// Одно место, где видно все сравнения AEVION с аналогами сразу.
//
// Почему отдельная страница, а не только внутри каждого модуля: у модуля своя
// страница и часто своя сессия, а сравнение должно быть сопоставимым по форме —
// иначе в одном месте оно честное, а в другом превращается в рекламу. Здесь
// один компонент и один набор правил на всех. Модуль при этом может встроить
// свой набор к себе двумя строками — QSkyway так и сделал.

const TITLE = "AEVION — чем отличаемся от аналогов и где слабее";
const DESCRIPTION =
  "Сравнение модулей AEVION с аналогами, где у каждой ячейки виден источник: наше — из фактического "
  + "прогона со ссылкой на живую ручку, чужое — только то, что продукт публично о себе говорит, с датой. "
  + "Отдельным блоком — где мы объективно слабее.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION },
};

export default function ComparePage() {
  const sets = Object.values(COMPETITOR_SETS);
  const totalUnverified = sets.reduce((n, s) => n + unverifiedCount(s), 0);

  return (
    <div style={{ background: "#0a121d", minHeight: "100vh", color: "#dbe6f3" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 20px 60px" }}>
        <div style={{ color: "#5f7086", fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>
          AEVION · сравнение с аналогами
        </div>
        <h1 style={{ fontSize: 30, margin: "8px 0 12px", fontWeight: 700 }}>
          Чем отличаемся и <span style={{ color: "#fb7185" }}>где слабее</span>
        </h1>

        <p style={{ color: "#c3d0e0", fontSize: 15, lineHeight: 1.6, maxWidth: 860 }}>
          Таблица «мы против них» — самый лёгкий способ незаметно перейти от фактов к маркетингу:
          свою колонку пишут по памяти, чужую по впечатлению, и обе выглядят одинаково убедительно.
          Поэтому здесь у каждой ячейки виден источник.
        </p>

        <ul style={{ color: "#93a4bd", fontSize: 13.5, lineHeight: 1.7, maxWidth: 860, paddingLeft: 18 }}>
          <li>
            <b style={{ color: "#2dd4bf" }}>замерено</b> — наше число из фактического прогона; рядом ссылка,
            которой его можно перепроверить прямо сейчас.
          </li>
          <li>
            <b style={{ color: "#93a4bd" }}>публичный факт</b> — бесспорное: чем компания является, что говорит
            регламент. С датой, потому что продукты меняются помесячно.
          </li>
          <li>
            <b style={{ color: "#c8964f" }}>не проверяли</b> — мы этого не смотрели. Показано как незакрытый
            вопрос, а не как факт о чужом продукте.
          </li>
        </ul>

        <p style={{ color: "#93a4bd", fontSize: 13.5, lineHeight: 1.6, maxWidth: 860 }}>
          Про себя утверждаем конкретно — можем показать прогон. Про чужой продукт только то, что он публично
          о себе говорит, и <b style={{ color: "#dbe6f3" }}>никогда не заявляем, что у него чего-то нет</b>:
          отсутствие функции проверить нельзя, а ошибка в эту сторону дороже всего стоит доверию.
          {totalUnverified > 0 && (
            <> Незакрытых ячеек сейчас <b style={{ color: "#c8964f" }}>{totalUnverified}</b>.</>
          )}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
          {sets.map((s) => <CompetitorMatrix key={s.moduleId} set={s} />)}
        </div>

        <p style={{ color: "#5f7086", fontSize: 12, lineHeight: 1.6, marginTop: 28, maxWidth: 860 }}>
          Здесь пока не все модули AEVION. Набор появляется тогда, когда его есть чем подкрепить: наша
          колонка — прогоном, чужая — публикацией аналога. Заполнять по памяти ради полноты таблицы
          означало бы ровно то, против чего эта страница устроена.
        </p>
      </div>
    </div>
  );
}
