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
    expect(page).toMatch(/navLocked=\{on&&!over&&isHumanGame\}/);
    expect(page).toMatch(/const navLocked=on&&!over&&isHumanGame;/);
  });

  it("закрытый пункт видно и озвучивается программой чтения с экрана", () => {
    expect(nav).toMatch(/locked\?"🔒":item\.icon/);
    expect(nav).toMatch(/aria-disabled=\{locked\|\|undefined\}/);
  });
});
