/**
 * Светлый ли фон под элементом — по computed-цвету первого непрозрачного предка.
 *
 * Повод — 20.10.2026: ModulePricingChip вызывается с theme="dark" на 30 страницах,
 * а многие из них уже светлые. На /multichat-engine «Входит в подписку AEVION» был
 * #e2e8f0 на #f8fafc — контраст 1.18:1 (прибор kontrast.mjs, прод). Тему должен
 * решать реальный фон, а не обещание в месте вызова.
 *
 * Нет ни одного непрозрачного предка — фон страницы по умолчанию белый, то есть светлый.
 */
export function яркость(r: number, g: number, b: number): number {
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function фонСветлыйПод(el: Element | null): boolean {
  let p: Element | null = el;
  while (p) {
    const m = getComputedStyle(p).backgroundColor.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const [r, g, b, a = 1] = m[1].split(",").map((x) => parseFloat(x));
      if (a > 0.5) return яркость(r, g, b) > 0.5;
    }
    p = p.parentElement;
  }
  return true;
}
