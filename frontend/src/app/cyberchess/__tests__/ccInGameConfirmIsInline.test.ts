// В партии нет системного confirm(): «Сдаться» и «Ничья» подтверждаются второй тап-нажатием
// (кнопка взводится, подпись меняется на вопрос, автосброс 4 с). Системное окно браузера —
// чужой интерфейс поверх доски, на телефоне блокирует экран; у chess.com/lichess подтверждение
// встроенное. Тестер 20.09.2026. Плюс: тест-активатор тарифа (самовыдача premium через
// localStorage-флаг) не попадает в production-сборку — это денежный путь.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ruOf } from "./_ruSlovar";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("подтверждение в партии — встроенное, не confirm()", () => {
  it("состояние armed с автосбросом", () => {
    expect(src).toContain('const[armed,sArmed]=useState<"resign"|"draw"|null>(null);');
    expect(src).toMatch(/useEffect\(\(\)=>\{if\(!armed\)return;const t=setTimeout\(\(\)=>sArmed\(null\),(\d+)\);/);
  });
  it("«Сдаться»: первый тап взводит, второй выполняет; подпись меняется", () => {
    expect(src).toContain('onClick={()=>{if(armed!=="resign"){sArmed("resign");return;}sArmed(null);');
    // 13–19.10.2026: подписи переехали в словарь; сторожим вызов ключей в том же условии armed и их русский смысл
    expect(src).toContain('{armed==="resign"?cc.t("btn.resignConfirm"):cc.t("btn.resign")}');
    expect(ruOf("btn.resignConfirm")).toBe("Точно сдаться? ✓");
    expect(ruOf("btn.resign")).toContain("Сдаться");
    expect(src).not.toContain('confirm("Сдаться?")');
  });
  it("«Ничья»: то же", () => {
    expect(src).toContain('onClick={()=>{if(armed!=="draw"){sArmed("draw");return;}sArmed(null);');
    expect(src).toContain('{armed==="draw"?cc.t("btn.drawConfirm"):cc.t("btn.draw")}');
    expect(ruOf("btn.drawConfirm")).toBe("Предложить ничью? ✓");
    expect(ruOf("btn.draw")).toContain("Ничья");
    expect(src).not.toContain('confirm("Предложить ничью?")');
  });
  it("тест-активатор тарифа отсутствует в production-сборке", () => {
    expect(src).toContain('{!owned&&t.id!=="free"&&process.env.NODE_ENV!=="production"&&typeof window!=="undefined"&&window.localStorage.getItem("aevion_debug")==="1"&&<button');
  });
});
