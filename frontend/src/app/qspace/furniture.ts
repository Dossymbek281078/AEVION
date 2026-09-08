/**
 * QSpace — каталог мебели и оборудования.
 *
 * Вынесен из компонента: каталог растёт, а страница не должна расти вместе с
 * ним. У каждого предмета указан РЕАЛЬНЫЙ габарит в метрах — модель нужна,
 * чтобы понять «влезет ли», поэтому размеры взяты типовые для рынка, а не на
 * глаз, и показываются человеку в подсказке.
 *
 * Геометрия создаётся вызовом build(), а не хранится: один и тот же диван
 * можно поставить дважды, и это должны быть разные объекты.
 */

import * as THREE from "three";

export interface CatalogItem {
  id: string;
  name: string;
  group: string;
  /** габарит Ш×Г×В в метрах */
  size: [number, number, number];
  build: () => THREE.Group;
}

function box(
  g: THREE.Group,
  w: number, h: number, d: number,
  color: number,
  x = 0, y = 0, z = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.position.set(x, y + h / 2, z);
  g.add(m);
  return m;
}

function cyl(g: THREE.Group, r: number, h: number, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, h, 20),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.position.set(x, y + h / 2, z);
  g.add(m);
  return m;
}

/** Ножки под столешницу — повторяются у столов и стульев. */
function legs(g: THREE.Group, w: number, d: number, h: number, color: number, r = 0.03) {
  const dx = w / 2 - r * 2;
  const dz = d / 2 - r * 2;
  cyl(g, r, h, color, -dx, 0, -dz); cyl(g, r, h, color, dx, 0, -dz);
  cyl(g, r, h, color, -dx, 0, dz); cyl(g, r, h, color, dx, 0, dz);
}

const WOOD = 0x8b6f4e;
const WOOD_DARK = 0x6f5638;
const FABRIC = 0x8a9bb0;
const WHITE = 0xf2f2f0;
const METAL = 0xcfd4d9;

export const CATALOG: CatalogItem[] = [
  // ── Гостиная ──────────────────────────────────────────────────────────
  { id: "sofa", name: "Диван", group: "Гостиная", size: [2.2, 0.9, 0.85], build: () => {
    const g = new THREE.Group();
    box(g, 2.2, 0.4, 0.9, FABRIC);
    box(g, 2.2, 0.5, 0.2, 0x7b8ca1, 0, 0.4, -0.35);
    box(g, 0.2, 0.35, 0.9, 0x7b8ca1, -1.0, 0.4);
    box(g, 0.2, 0.35, 0.9, 0x7b8ca1, 1.0, 0.4);
    return g;
  }},
  { id: "sofa-corner", name: "Угловой диван", group: "Гостиная", size: [2.6, 1.8, 0.85], build: () => {
    const g = new THREE.Group();
    box(g, 2.6, 0.4, 0.9, FABRIC, 0, 0, -0.45);
    box(g, 2.6, 0.5, 0.2, 0x7b8ca1, 0, 0.4, -0.8);
    box(g, 0.9, 0.4, 0.9, FABRIC, -0.85, 0, 0.45);
    box(g, 0.2, 0.5, 1.8, 0x7b8ca1, -1.2, 0.4, 0);
    return g;
  }},
  { id: "armchair", name: "Кресло", group: "Гостиная", size: [0.9, 0.85, 0.85], build: () => {
    const g = new THREE.Group();
    box(g, 0.9, 0.4, 0.85, 0xa98d6f);
    box(g, 0.9, 0.45, 0.18, 0x9a7e60, 0, 0.4, -0.33);
    return g;
  }},
  { id: "coffee", name: "Журнальный стол", group: "Гостиная", size: [0.9, 0.55, 0.45], build: () => {
    const g = new THREE.Group();
    box(g, 0.9, 0.05, 0.55, WOOD, 0, 0.4);
    legs(g, 0.9, 0.55, 0.4, WOOD_DARK);
    return g;
  }},
  { id: "tv", name: "ТВ-тумба + телевизор", group: "Гостиная", size: [1.6, 0.4, 1.2], build: () => {
    const g = new THREE.Group();
    box(g, 1.6, 0.45, 0.4, 0x5a4632);
    box(g, 1.3, 0.75, 0.05, 0x1c1c22, 0, 0.55, 0);
    return g;
  }},
  { id: "shelf", name: "Стеллаж", group: "Гостиная", size: [0.9, 0.3, 1.9], build: () => {
    const g = new THREE.Group();
    box(g, 0.9, 1.9, 0.3, WOOD);
    for (const y of [0.5, 1.0, 1.5]) box(g, 0.8, 0.03, 0.26, 0xd9cbb8, 0, y);
    return g;
  }},
  { id: "bookcase", name: "Книжный шкаф", group: "Гостиная", size: [1.2, 0.35, 2.1], build: () => {
    const g = new THREE.Group();
    box(g, 1.2, 2.1, 0.35, 0x7a5f42);
    for (const y of [0.4, 0.8, 1.2, 1.6]) box(g, 1.1, 0.03, 0.3, 0xd9cbb8, 0, y);
    for (let i = 0; i < 9; i++) box(g, 0.04, 0.24, 0.16, 0x9d5f4a + i * 0x0a0500, -0.45 + i * 0.06, 0.83, 0.05);
    return g;
  }},

  // ── Спальня ───────────────────────────────────────────────────────────
  { id: "bed", name: "Кровать двуспальная", group: "Спальня", size: [1.6, 2.0, 0.9], build: () => {
    const g = new THREE.Group();
    box(g, 1.6, 0.35, 2.0, 0xb6a58e);
    box(g, 1.6, 0.12, 1.9, 0xe9e2d5, 0, 0.35, 0.02);
    box(g, 1.6, 0.6, 0.08, WOOD, 0, 0, -1.0);
    box(g, 0.5, 0.05, 0.7, 0xdcd3c2, -0.35, 0.47, 0.45);
    return g;
  }},
  { id: "bed-single", name: "Кровать односпальная", group: "Спальня", size: [0.9, 2.0, 0.9], build: () => {
    const g = new THREE.Group();
    box(g, 0.9, 0.35, 2.0, 0xb6a58e);
    box(g, 0.9, 0.12, 1.9, 0xe9e2d5, 0, 0.35, 0.02);
    box(g, 0.9, 0.55, 0.08, WOOD, 0, 0, -1.0);
    return g;
  }},
  { id: "nightstand", name: "Тумбочка", group: "Спальня", size: [0.45, 0.4, 0.5], build: () => {
    const g = new THREE.Group();
    box(g, 0.45, 0.5, 0.4, WOOD);
    box(g, 0.3, 0.02, 0.02, METAL, 0, 0.3, 0.21);
    return g;
  }},
  { id: "wardrobe", name: "Шкаф", group: "Спальня", size: [1.8, 0.6, 2.3], build: () => {
    const g = new THREE.Group();
    box(g, 1.8, 2.3, 0.6, 0x9d8265);
    box(g, 0.02, 2.1, 0.02, 0x5a4632, 0, 0.1, 0.31);
    return g;
  }},
  { id: "wardrobe-sliding", name: "Шкаф-купе", group: "Спальня", size: [2.4, 0.65, 2.4], build: () => {
    const g = new THREE.Group();
    box(g, 2.4, 2.4, 0.65, 0x8d7458);
    box(g, 0.03, 2.2, 0.03, METAL, -0.4, 0.1, 0.34);
    box(g, 0.03, 2.2, 0.03, METAL, 0.4, 0.1, 0.34);
    box(g, 1.1, 1.8, 0.02, 0xc9d4dc, 0.6, 0.3, 0.33);
    return g;
  }},
  { id: "dresser", name: "Комод", group: "Спальня", size: [1.0, 0.45, 0.85], build: () => {
    const g = new THREE.Group();
    box(g, 1.0, 0.85, 0.45, WOOD);
    for (const y of [0.15, 0.42, 0.68]) box(g, 0.5, 0.02, 0.02, METAL, 0, y, 0.23);
    return g;
  }},
  { id: "desk", name: "Письменный стол", group: "Спальня", size: [1.2, 0.6, 0.75], build: () => {
    const g = new THREE.Group();
    box(g, 1.2, 0.04, 0.6, WOOD, 0, 0.71);
    legs(g, 1.2, 0.6, 0.71, WOOD_DARK);
    box(g, 0.4, 0.3, 0.5, 0xa89880, -0.35, 0.3, 0);
    return g;
  }},

  // ── Кухня ─────────────────────────────────────────────────────────────
  { id: "kitchen", name: "Кухонный гарнитур", group: "Кухня", size: [2.4, 0.6, 2.2], build: () => {
    const g = new THREE.Group();
    box(g, 2.4, 0.85, 0.6, 0xdad5cc);
    box(g, 2.4, 0.04, 0.62, 0x6f6a63, 0, 0.85);
    box(g, 2.4, 0.7, 0.35, 0xe6e1d8, 0, 1.5, -0.12);
    box(g, 0.5, 0.02, 0.4, 0x9fb3c8, 0.6, 0.89);
    return g;
  }},
  { id: "kitchen-island", name: "Кухонный остров", group: "Кухня", size: [1.8, 0.9, 0.9], build: () => {
    const g = new THREE.Group();
    box(g, 1.8, 0.85, 0.9, 0xdad5cc);
    box(g, 1.9, 0.05, 1.0, 0x585450, 0, 0.85);
    return g;
  }},
  { id: "fridge", name: "Холодильник", group: "Кухня", size: [0.6, 0.65, 1.85], build: () => {
    const g = new THREE.Group();
    box(g, 0.6, 1.85, 0.65, METAL);
    box(g, 0.02, 0.5, 0.03, 0x9aa3ab, 0.26, 1.1, 0.33);
    box(g, 0.58, 0.02, 0.02, 0x9aa3ab, 0, 1.15, 0.33);
    return g;
  }},
  { id: "stove", name: "Плита", group: "Кухня", size: [0.6, 0.6, 0.85], build: () => {
    const g = new THREE.Group();
    box(g, 0.6, 0.85, 0.6, 0xd8d8d8);
    cyl(g, 0.09, 0.02, 0x333333, -0.15, 0.85, -0.12); cyl(g, 0.09, 0.02, 0x333333, 0.15, 0.85, -0.12);
    cyl(g, 0.07, 0.02, 0x333333, -0.15, 0.85, 0.15); cyl(g, 0.07, 0.02, 0x333333, 0.15, 0.85, 0.15);
    return g;
  }},
  { id: "hood", name: "Вытяжка", group: "Кухня", size: [0.6, 0.5, 0.5], build: () => {
    const g = new THREE.Group();
    box(g, 0.6, 0.12, 0.5, METAL, 0, 1.55);
    box(g, 0.25, 0.55, 0.25, METAL, 0, 1.67, -0.1);
    return g;
  }},
  { id: "dishwasher", name: "Посудомоечная машина", group: "Кухня", size: [0.6, 0.6, 0.85], build: () => {
    const g = new THREE.Group();
    box(g, 0.6, 0.85, 0.6, 0xe4e4e2);
    box(g, 0.5, 0.02, 0.02, METAL, 0, 0.72, 0.31);
    return g;
  }},
  { id: "dining", name: "Обеденный стол", group: "Кухня", size: [1.4, 0.8, 0.75], build: () => {
    const g = new THREE.Group();
    box(g, 1.4, 0.05, 0.8, WOOD, 0, 0.72);
    legs(g, 1.4, 0.8, 0.72, WOOD_DARK, 0.035);
    return g;
  }},
  { id: "dining-round", name: "Круглый стол", group: "Кухня", size: [1.1, 1.1, 0.75], build: () => {
    const g = new THREE.Group();
    cyl(g, 0.55, 0.05, WOOD, 0, 0.72);
    cyl(g, 0.07, 0.72, WOOD_DARK);
    cyl(g, 0.3, 0.03, WOOD_DARK);
    return g;
  }},
  { id: "chair", name: "Стул", group: "Кухня", size: [0.45, 0.45, 0.95], build: () => {
    const g = new THREE.Group();
    box(g, 0.45, 0.05, 0.45, 0xa98d6f, 0, 0.45);
    box(g, 0.45, 0.5, 0.05, 0xa98d6f, 0, 0.5, -0.2);
    legs(g, 0.45, 0.45, 0.45, WOOD_DARK, 0.02);
    return g;
  }},
  { id: "barstool", name: "Барный стул", group: "Кухня", size: [0.4, 0.4, 1.05], build: () => {
    const g = new THREE.Group();
    cyl(g, 0.18, 0.05, 0x4a4a48, 0, 0.7);
    cyl(g, 0.04, 0.7, METAL);
    cyl(g, 0.2, 0.03, METAL);
    return g;
  }},

  // ── Санузел ───────────────────────────────────────────────────────────
  { id: "bathtub", name: "Ванна", group: "Санузел", size: [1.7, 0.75, 0.6], build: () => {
    const g = new THREE.Group();
    box(g, 1.7, 0.6, 0.75, WHITE);
    const inner = box(g, 1.5, 0.1, 0.55, 0xdde8ee, 0, 0.51, 0);
    inner.position.y = 0.56;
    return g;
  }},
  { id: "shower", name: "Душевая кабина", group: "Санузел", size: [0.9, 0.9, 2.0], build: () => {
    const g = new THREE.Group();
    box(g, 0.9, 0.12, 0.9, WHITE);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.9, 0.03),
      new THREE.MeshLambertMaterial({ color: 0xcfe0e8, transparent: true, opacity: 0.4 }),
    );
    glass.position.set(0, 1.07, 0.44); g.add(glass);
    const side = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 1.9, 0.9),
      new THREE.MeshLambertMaterial({ color: 0xcfe0e8, transparent: true, opacity: 0.4 }),
    );
    side.position.set(0.44, 1.07, 0); g.add(side);
    return g;
  }},
  { id: "toilet", name: "Унитаз", group: "Санузел", size: [0.38, 0.7, 0.8], build: () => {
    const g = new THREE.Group();
    box(g, 0.38, 0.4, 0.55, WHITE, 0, 0, 0.05);
    box(g, 0.38, 0.4, 0.18, 0xeeeeec, 0, 0.4, -0.18);
    return g;
  }},
  { id: "sink", name: "Раковина", group: "Санузел", size: [0.5, 0.42, 0.9], build: () => {
    const g = new THREE.Group();
    cyl(g, 0.09, 0.8, WHITE);
    box(g, 0.5, 0.12, 0.42, 0xf5f5f3, 0, 0.8);
    cyl(g, 0.02, 0.18, METAL, 0, 0.92, -0.14);
    return g;
  }},
  { id: "vanity", name: "Тумба с раковиной", group: "Санузел", size: [0.8, 0.45, 0.85], build: () => {
    const g = new THREE.Group();
    box(g, 0.8, 0.75, 0.45, 0xdfe4e6);
    box(g, 0.84, 0.1, 0.48, WHITE, 0, 0.75);
    cyl(g, 0.02, 0.2, METAL, 0, 0.85, -0.15);
    return g;
  }},
  { id: "washer", name: "Стиральная машина", group: "Санузел", size: [0.6, 0.6, 0.85], build: () => {
    const g = new THREE.Group();
    box(g, 0.6, 0.85, 0.6, 0xe8e8e6);
    cyl(g, 0.18, 0.02, 0x4a5560, 0, 0.45, 0.3).rotation.x = Math.PI / 2;
    return g;
  }},
  { id: "mirror", name: "Зеркало", group: "Санузел", size: [0.7, 0.05, 0.9], build: () => {
    const g = new THREE.Group();
    box(g, 0.7, 0.9, 0.03, 0xdce6ea, 0, 1.1);
    box(g, 0.74, 0.94, 0.02, 0xb9bfc2, 0, 1.08, -0.01);
    return g;
  }},

  // ── Климат и инженерия ────────────────────────────────────────────────
  { id: "split", name: "Сплит-система", group: "Климат", size: [0.85, 0.21, 0.29], build: () => {
    const g = new THREE.Group();
    box(g, 0.85, 0.29, 0.21, 0xf4f4f2, 0, 2.25, 0);
    box(g, 0.8, 0.03, 0.02, 0xb9c2cc, 0, 2.26, 0.1);
    return g;
  }},
  { id: "radiator", name: "Радиатор", group: "Климат", size: [0.9, 0.06, 0.5], build: () => {
    const g = new THREE.Group();
    for (let i = 0; i < 8; i++) box(g, 0.08, 0.5, 0.06, 0xe6e6e4, -0.42 + i * 0.12, 0.15);
    return g;
  }},
  { id: "boiler", name: "Водонагреватель", group: "Климат", size: [0.9, 0.45, 0.45], build: () => {
    const g = new THREE.Group();
    const t = cyl(g, 0.22, 0.9, 0xeeeeec, 0, 1.2);
    t.rotation.z = Math.PI / 2;
    return g;
  }},
  { id: "towel-heater", name: "Полотенцесушитель", group: "Климат", size: [0.5, 0.08, 0.8], build: () => {
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const b = cyl(g, 0.012, 0.5, METAL, 0, 0.9 + i * 0.13, 0);
      b.rotation.z = Math.PI / 2;
    }
    cyl(g, 0.015, 0.72, METAL, -0.25, 0.9);
    cyl(g, 0.015, 0.72, METAL, 0.25, 0.9);
    return g;
  }},

  // ── Декор ─────────────────────────────────────────────────────────────
  { id: "rug", name: "Ковёр", group: "Декор", size: [2.0, 1.4, 0.02], build: () => {
    const g = new THREE.Group(); box(g, 2.0, 0.02, 1.4, 0xb0655a); return g;
  }},
  { id: "plant", name: "Растение", group: "Декор", size: [0.64, 0.64, 1.2], build: () => {
    const g = new THREE.Group();
    cyl(g, 0.16, 0.3, 0xa9743e);
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 14, 12),
      new THREE.MeshLambertMaterial({ color: 0x5a8a53 }),
    );
    crown.position.y = 0.85; g.add(crown);
    return g;
  }},
  { id: "lamp", name: "Торшер", group: "Декор", size: [0.34, 0.34, 1.7], build: () => {
    const g = new THREE.Group();
    cyl(g, 0.14, 0.02, 0x555555);
    cyl(g, 0.015, 1.5, 0x555555, 0, 0.02);
    const shade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.17, 0.25, 18, 1, true),
      new THREE.MeshLambertMaterial({ color: 0xf0e0b8, side: THREE.DoubleSide }),
    );
    shade.position.y = 1.55; g.add(shade);
    return g;
  }},
  { id: "picture", name: "Картина", group: "Декор", size: [0.8, 0.05, 0.6], build: () => {
    const g = new THREE.Group();
    box(g, 0.8, 0.6, 0.04, 0x6b5a44, 0, 1.4);
    box(g, 0.72, 0.52, 0.02, 0xc8b89a, 0, 1.44, 0.02);
    return g;
  }},
  { id: "curtains", name: "Шторы", group: "Декор", size: [1.7, 0.12, 2.3], build: () => {
    const g = new THREE.Group();
    box(g, 1.7, 0.04, 0.05, METAL, 0, 2.35);
    box(g, 0.5, 2.2, 0.08, 0xd8cfc0, -0.55, 0.1);
    box(g, 0.5, 2.2, 0.08, 0xd8cfc0, 0.55, 0.1);
    return g;
  }},
];

/** Категории в порядке появления — чтобы список на странице был устойчив. */
export function groups(): string[] {
  return [...new Set(CATALOG.map((c) => c.group))];
}

export function itemById(id: string): CatalogItem | undefined {
  return CATALOG.find((c) => c.id === id);
}

/**
 * Расстановка демо-квартиры.
 *
 * Зачем. Третий слой, который основатель назвал прямым текстом («3 ракурс
 * декор и мебель»), при первом заходе был ПУСТ: человек включал флажок и не
 * видел ничего. Проверено браузером на боевой сборке — картинка не менялась.
 * Пустой слой неотличим от сломанного, а первый экран решает, останется ли
 * человек.
 *
 * Координаты — центр предмета в метрах плана (`demoPlan()`, 8 × 6 м).
 * Расстановка проверяется теми же сторожами, что и работа человека:
 * `checkClearance` и `checkPassage` обязаны дать НОЛЬ замечаний — иначе
 * модуль встречает гостя собственными предупреждениями.
 */
export interface DemoPlacement {
  catalogId: string;
  x: number;
  y: number;
  rotY: number;
}

export function demoFurniture(): DemoPlacement[] {
  const at = (catalogId: string, x: number, y: number, rotY = 0): DemoPlacement =>
    ({ catalogId, x, y, rotY });
  return [
    // гостиная-кухня, 27 м² (западная часть)
    at("kitchen", 1.5, 5.45),
    at("dining", 2.2, 4.2),
    at("chair", 2.2, 3.5),
    at("sofa", 2.4, 1.9),
    at("coffee", 2.4, 1.0),
    at("tv", 2.4, 0.35),
    at("plant", 4.3, 5.4),
    // спальня, 9.6 м² (юго-восток)
    at("bed", 6.4, 1.4),
    at("nightstand", 5.25, 0.4),
    at("wardrobe", 6.9, 3.1),
    // санузел, 4.4 м² (северо-восток)
    at("bathtub", 7.5, 4.9, Math.PI / 2),
    at("toilet", 6.2, 5.5),
    at("sink", 6.8, 5.5),
  ];
}

/**
 * Та же расстановка в формате сохранённого проекта.
 *
 * ⚠️ ОСЬ МЕНЯЕТ ИМЯ. Вся геометрия модуля (план, стены, проверка расстановки,
 * помещения) живёт в координатах x/y плана. Сцена three.js и формат проекта
 * держат ту же величину под именем z: у сцены вертикаль — это y. Переход
 * делается ЗДЕСЬ и только здесь, чтобы его было видно, а не в десяти местах
 * молча. Перестановка осей не падает и не краснеет — она просто ставит
 * квартиру боком, поэтому её стережёт отдельный тест.
 */
export function demoPlacedSnapshots(): Array<{
  catalogId: string; x: number; z: number; rotY: number;
}> {
  return demoFurniture().map((d) => ({ catalogId: d.catalogId, x: d.x, z: d.y, rotY: d.rotY }));
}
