// 4.11.2026, замер прода 9ca100905 (390×844): «Спроси тренера», цель «Открой тренера» и нижний «Анализ»
// переключали раздел, а шторка с тренером и анализом оставалась за краем экрана (.cc-right-panel x=390).
// Шторка открывается от раздела, а не от кнопки.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const ЭФФЕКТ = "useEffect(()=>{if(isMobileLayout&&РАЗДЕЛЫ_В_ШТОРКЕ.has(tab))sMobileSidebarOpen(true)},[tab])";

describe("CyberChess на телефоне: шторка открывается от любого входа в раздел", () => {
  it("тренер и анализ — разделы шторки", () => {
    expect(src).toContain('const РАЗДЕЛЫ_В_ШТОРКЕ = new Set(["coach","analysis"])');
  });
  it("эффект на tab открывает шторку на телефонной раскладке", () => {
    expect(src).toContain(ЭФФЕКТ);
  });
  it("эффект стоит после объявления шторки, раздела и набора разделов", () => {
    const эффект = src.indexOf(ЭФФЕКТ);
    expect(эффект).toBeGreaterThan(src.indexOf("const[mobileSidebarOpen,sMobileSidebarOpen]=useState(false)"));
    expect(эффект).toBeGreaterThan(src.indexOf("const[tab,sTab]=useState<"));
    expect(эффект).toBeGreaterThan(src.indexOf("const РАЗДЕЛЫ_В_ШТОРКЕ"));
  });
});
