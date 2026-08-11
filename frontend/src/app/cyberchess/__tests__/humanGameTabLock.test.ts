import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* В живой партии с ЧЕЛОВЕКОМ уход в анализ или к коучу равен подсказке движком против
 * соперника, поэтому эти вкладки закрываются. Мера была написана только в десктопном
 * таб-баре: у нижней навигации не было даже понятия «заблокировано», и на телефоне
 * никакой защиты не существовало.
 *
 * Хуже всего это в режиме «за одной доской»: соперник сидит рядом, устройство — телефон,
 * то есть дыра шире всего ровно там, где мера нужнее всего. Ничего при этом не падало и
 * не выглядело сломанным — кнопка просто работала.
 */

const page = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const nav = page.slice(page.indexOf("function BottomNav("), page.indexOf("/* ─── BottomNav ─── */") + 4000);

describe("замок вкладок в партии с человеком", () => {
  it("нижняя навигация вообще знает про блокировку", () => {
    expect(nav).toMatch(/navLocked:boolean/);
    expect(nav).toMatch(/const locked=item\.lockable&&navLocked/);
  });

  it("закрыты именно те пункты, где виден движок", () => {
    /* «Играть» — возврат к доске, «Профиль» — своя статистика: движка там нет,
       закрывать их значило бы запереть человека на экране без выхода. */
    for (const id of ["puzzles", "analysis", "coach"]) {
      expect(nav, id).toMatch(new RegExp(`id:"${id}"[^}]*lockable:true`));
    }
    for (const id of ["play", "profile"]) {
      expect(nav, id).toMatch(new RegExp(`id:"${id}"[^}]*lockable:false`));
    }
  });

  it("нажатие на закрытый пункт объясняет причину, а не молчит", () => {
    /* Кнопка, которая просто не реагирует, читается как поломка. */
    expect(nav).toMatch(/onClick=\{locked\?onLockedTap:item\.action\}/);
    expect(page).toMatch(/onLockedTap=\{\(\)=>showToast\("🔒 Нельзя во время партии с человеком","info"\)\}/);
  });

  it("признак блокировки один и тот же на телефоне и на десктопе", () => {
    /* Два разных выражения для одной меры — это ровно то, из-за чего она и действовала
       на одном экране, но не на другом. */
    /* Выражение теперь ровно одно — `navLockedNow`; таб-бар и нижняя навигация берут
       его, а не считают заново. Раньше здесь проверялись две копии, и это было лучшее,
       что можно было проверить: копий действительно было две. */
    expect(page).toMatch(/const navLockedNow=on&&!over&&isHumanGame;/);
    expect(page).toMatch(/navLocked=\{navLockedNow\}/);
    /* Ровно одно вхождение на весь файл: это и есть «одно выражение». Копии были
       в четырёх местах, и именно поэтому мера действовала не везде. */
    expect(page.match(/on&&!over&&isHumanGame/g) ?? []).toHaveLength(1);
  });

  it("закрытый пункт видно и озвучивается программой чтения с экрана", () => {
    expect(nav).toMatch(/locked\?"🔒":item\.icon/);
    expect(nav).toMatch(/aria-disabled=\{locked\|\|undefined\}/);
  });
});

describe("замок один на все поверхности навигации", () => {
  /* Поверхностей три: десктопный таб-бар, нижняя навигация на телефоне и палитра
     команд (Ctrl+K). Проверка стояла у ВЫЗЫВАЮЩЕГО, поэтому держалась только там, где
     её написали: таб-бар закрывал вкладки, нижняя навигация про замок не знала вовсе,
     а палитра уводила в анализ мимо обеих. */

  it("есть одна точка, которая решает, можно ли уйти с вкладки", () => {
    expect(page).toMatch(/const requestTab=useCallback/);
    expect(page).toMatch(/const navLockedNow=on&&!over&&isHumanGame;/);
  });

  it("палитра команд ходит через неё, а не мимо", () => {
    const palette = page.slice(page.indexOf('{id:"pz-random"'), page.indexOf('{id:"nav-sections"'));
    expect(palette).toMatch(/requestTab\("analysis"\)/);
    expect(palette).toMatch(/requestTab\("coach"\)/);
    // и ни одного прямого переключения в обход замка
    expect(palette).not.toMatch(/sTab\("(analysis|coach|puzzles)"\)/);
  });

  it("десктопный таб-бар решает не сам, а спрашивает ту же точку", () => {
    expect(page).toMatch(/if\(!requestTab\(k\)\) return;/);
    /* Прежнее собственное условие с собственным тостом должно было исчезнуть —
       иначе снова два ответа на один вопрос. */
    expect(page).not.toMatch(/if\(navLocked\)\{ showToast/);
  });
});
