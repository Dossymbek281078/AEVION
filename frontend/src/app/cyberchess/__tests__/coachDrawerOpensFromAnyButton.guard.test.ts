// 4.11.2026, замер прода 9ca100905 (390×844): «Спроси тренера» и цель «Открой тренера» переключали раздел
// на «coach», а шторка тренера оставалась за краем экрана. Шторка открывается от раздела, а не от кнопки.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("CyberChess: тренер на телефоне — шторка открывается от любого входа в раздел", () => {
  it("эффект на tab открывает шторку на телефонной раскладке", () => {
    expect(src).toMatch(/useEffect\(\(\)=>\{if\(tab==="coach"&&isMobileLayout\)sMobileSidebarOpen\(true\)\},\[tab\]\)/);
  });
  it("эффект стоит после объявления шторки и раздела", () => {
    const эффект = src.indexOf('if(tab==="coach"&&isMobileLayout)sMobileSidebarOpen(true)');
    expect(эффект).toBeGreaterThan(src.indexOf("const[mobileSidebarOpen,sMobileSidebarOpen]=useState(false)"));
    expect(эффект).toBeGreaterThan(src.indexOf('const[tab,sTab]=useState<'));
  });
});
