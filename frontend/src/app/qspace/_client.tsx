"use client";

// QSpace — 3D-модельер помещений. MVP: DXF → 3D, три слоя (черновая отделка
// с разводкой, чистовая отделка, декор и мебель), каталог мебели с
// перетаскиванием, экспорт кадра в PNG.
//
// Демо-план загружается сразу: человек видит результат ДО того, как ему
// понадобился собственный чертёж (prompt-first, feedback_devhub_prompt_first_ux).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  demoPlan,
  generateLights,
  generatePlumbing,
  generateWiring,
  planBounds,
  pointOnWall,
  WALL_HEIGHT,
  type Plan,
} from "./planModel";
import { parseDxf } from "./dxf";
import { estimatePlan } from "./estimate";
import { planFromPdfSegments, readPdfSegments, type PdfSegments } from "./pdf";
import { drawMaterial, materialById, materialsFor } from "./materials";
import RasterReview from "./RasterReview";
import {
  CEILING_STRETCH,
  FLOOR_WET,
  WALL_BLOCK,
  WALL_FRAME,
  finishedHeightM,
  totalMm,
} from "./wallStructure";

// ---------------------------------------------------------------------------
// Каталог мебели и оборудования. Размеры в метрах. Каждый предмет — группа
// из простых объёмов: это осознанный выбор MVP (грузится мгновенно, не
// требует внешних моделей), а не временный мусор.

interface CatalogItem {
  id: string;
  name: string;
  group: string;
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

const CATALOG: CatalogItem[] = [
  { id: "sofa", name: "Диван", group: "Гостиная", build: () => {
    const g = new THREE.Group();
    box(g, 2.2, 0.4, 0.9, 0x8a9bb0);          // основание
    box(g, 2.2, 0.5, 0.2, 0x7b8ca1, 0, 0.4, -0.35); // спинка
    box(g, 0.2, 0.35, 0.9, 0x7b8ca1, -1.0, 0.4);    // подлокотники
    box(g, 0.2, 0.35, 0.9, 0x7b8ca1, 1.0, 0.4);
    return g;
  }},
  { id: "armchair", name: "Кресло", group: "Гостиная", build: () => {
    const g = new THREE.Group();
    box(g, 0.9, 0.4, 0.85, 0xa98d6f);
    box(g, 0.9, 0.45, 0.18, 0x9a7e60, 0, 0.4, -0.33);
    return g;
  }},
  { id: "coffee", name: "Журнальный стол", group: "Гостиная", build: () => {
    const g = new THREE.Group();
    box(g, 0.9, 0.05, 0.55, 0x8b6f4e, 0, 0.4);
    cyl(g, 0.03, 0.4, 0x6f5638, -0.38, 0, -0.2); cyl(g, 0.03, 0.4, 0x6f5638, 0.38, 0, -0.2);
    cyl(g, 0.03, 0.4, 0x6f5638, -0.38, 0, 0.2); cyl(g, 0.03, 0.4, 0x6f5638, 0.38, 0, 0.2);
    return g;
  }},
  { id: "tv", name: "ТВ-тумба + телевизор", group: "Гостиная", build: () => {
    const g = new THREE.Group();
    box(g, 1.6, 0.45, 0.4, 0x5a4632);
    box(g, 1.3, 0.75, 0.05, 0x1c1c22, 0, 0.55, 0);
    return g;
  }},
  { id: "shelf", name: "Стеллаж", group: "Гостиная", build: () => {
    const g = new THREE.Group();
    box(g, 0.9, 1.9, 0.3, 0x8b6f4e);
    box(g, 0.8, 0.03, 0.26, 0xd9cbb8, 0, 0.5); box(g, 0.8, 0.03, 0.26, 0xd9cbb8, 0, 1.0);
    box(g, 0.8, 0.03, 0.26, 0xd9cbb8, 0, 1.5);
    return g;
  }},
  { id: "bed", name: "Кровать", group: "Спальня", build: () => {
    const g = new THREE.Group();
    box(g, 1.6, 0.35, 2.0, 0xb6a58e);
    box(g, 1.6, 0.12, 1.9, 0xe9e2d5, 0, 0.35, 0.02); // матрас
    box(g, 1.6, 0.6, 0.08, 0x8b6f4e, 0, 0, -1.0);    // изголовье
    box(g, 0.5, 0.05, 0.7, 0xdcd3c2, -0.35, 0.47, 0.45); // одеяло-плед
    return g;
  }},
  { id: "nightstand", name: "Тумбочка", group: "Спальня", build: () => {
    const g = new THREE.Group(); box(g, 0.45, 0.5, 0.4, 0x8b6f4e); return g;
  }},
  { id: "wardrobe", name: "Шкаф", group: "Спальня", build: () => {
    const g = new THREE.Group();
    box(g, 1.8, 2.3, 0.6, 0x9d8265);
    box(g, 0.02, 2.1, 0.02, 0x5a4632, 0, 0.1, 0.31);
    return g;
  }},
  { id: "kitchen", name: "Кухонный гарнитур", group: "Кухня", build: () => {
    const g = new THREE.Group();
    box(g, 2.4, 0.85, 0.6, 0xdad5cc);             // нижний ряд
    box(g, 2.4, 0.04, 0.62, 0x6f6a63, 0, 0.85);   // столешница
    box(g, 2.4, 0.7, 0.35, 0xe6e1d8, 0, 1.5, -0.12); // верхние шкафы
    box(g, 0.5, 0.02, 0.4, 0x9fb3c8, 0.6, 0.89);  // мойка
    return g;
  }},
  { id: "fridge", name: "Холодильник", group: "Кухня", build: () => {
    const g = new THREE.Group(); box(g, 0.6, 1.85, 0.65, 0xcfd4d9); return g;
  }},
  { id: "stove", name: "Плита", group: "Кухня", build: () => {
    const g = new THREE.Group();
    box(g, 0.6, 0.85, 0.6, 0xd8d8d8);
    cyl(g, 0.09, 0.02, 0x333333, -0.15, 0.85, -0.12); cyl(g, 0.09, 0.02, 0x333333, 0.15, 0.85, -0.12);
    cyl(g, 0.07, 0.02, 0x333333, -0.15, 0.85, 0.15); cyl(g, 0.07, 0.02, 0x333333, 0.15, 0.85, 0.15);
    return g;
  }},
  { id: "dining", name: "Обеденный стол", group: "Кухня", build: () => {
    const g = new THREE.Group();
    box(g, 1.4, 0.05, 0.8, 0x8b6f4e, 0, 0.72);
    cyl(g, 0.035, 0.72, 0x6f5638, -0.6, 0, -0.3); cyl(g, 0.035, 0.72, 0x6f5638, 0.6, 0, -0.3);
    cyl(g, 0.035, 0.72, 0x6f5638, -0.6, 0, 0.3); cyl(g, 0.035, 0.72, 0x6f5638, 0.6, 0, 0.3);
    return g;
  }},
  { id: "chair", name: "Стул", group: "Кухня", build: () => {
    const g = new THREE.Group();
    box(g, 0.45, 0.05, 0.45, 0xa98d6f, 0, 0.45);
    box(g, 0.45, 0.5, 0.05, 0xa98d6f, 0, 0.5, -0.2);
    cyl(g, 0.02, 0.45, 0x6f5638, -0.19, 0, -0.19); cyl(g, 0.02, 0.45, 0x6f5638, 0.19, 0, -0.19);
    cyl(g, 0.02, 0.45, 0x6f5638, -0.19, 0, 0.19); cyl(g, 0.02, 0.45, 0x6f5638, 0.19, 0, 0.19);
    return g;
  }},
  { id: "bathtub", name: "Ванна", group: "Санузел", build: () => {
    const g = new THREE.Group();
    box(g, 1.7, 0.6, 0.75, 0xf2f2f0);
    const inner = box(g, 1.5, 0.1, 0.55, 0xdde8ee, 0, 0.51, 0);
    inner.position.y = 0.56;
    return g;
  }},
  { id: "toilet", name: "Унитаз", group: "Санузел", build: () => {
    const g = new THREE.Group();
    box(g, 0.38, 0.4, 0.55, 0xf2f2f0, 0, 0, 0.05);
    box(g, 0.38, 0.4, 0.18, 0xeeeeec, 0, 0.4, -0.18);
    return g;
  }},
  { id: "sink", name: "Раковина", group: "Санузел", build: () => {
    const g = new THREE.Group();
    cyl(g, 0.09, 0.8, 0xf2f2f0);
    box(g, 0.5, 0.12, 0.42, 0xf5f5f3, 0, 0.8);
    return g;
  }},
  { id: "washer", name: "Стиральная машина", group: "Санузел", build: () => {
    const g = new THREE.Group();
    box(g, 0.6, 0.85, 0.6, 0xe8e8e6);
    cyl(g, 0.18, 0.02, 0x4a5560, 0, 0.45, 0.3).rotation.x = Math.PI / 2;
    return g;
  }},
  { id: "split", name: "Сплит-система", group: "Климат", build: () => {
    const g = new THREE.Group();
    box(g, 0.85, 0.29, 0.21, 0xf4f4f2, 0, 2.25, 0);
    box(g, 0.8, 0.03, 0.02, 0xb9c2cc, 0, 2.26, 0.1);
    return g;
  }},
  { id: "radiator", name: "Радиатор", group: "Климат", build: () => {
    const g = new THREE.Group();
    for (let i = 0; i < 8; i++) box(g, 0.08, 0.5, 0.06, 0xe6e6e4, -0.42 + i * 0.12, 0.15);
    return g;
  }},
  { id: "rug", name: "Ковёр", group: "Декор", build: () => {
    const g = new THREE.Group(); box(g, 2.0, 0.02, 1.4, 0xb0655a); return g;
  }},
  { id: "plant", name: "Растение", group: "Декор", build: () => {
    const g = new THREE.Group();
    cyl(g, 0.16, 0.3, 0xa9743e);
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 14, 12),
      new THREE.MeshLambertMaterial({ color: 0x5a8a53 }),
    );
    crown.position.y = 0.85; g.add(crown);
    return g;
  }},
  { id: "lamp", name: "Торшер", group: "Декор", build: () => {
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
];

// ---------------------------------------------------------------------------
// Текстуры отделки берутся из каталога materials.ts — данные отдельно от
// отрисовки, поэтому каталог растёт без правки этого файла.

function textureFor(id: string, roomW: number, roomH: number): THREE.Texture | null {
  const m = materialById(id);
  if (!m) return null;
  const t = new THREE.CanvasTexture(drawMaterial(m));
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  // Повтор считается от РАЗМЕРА ПОМЕЩЕНИЯ и физического размера элемента:
  // иначе одна и та же плитка была бы на разных планах разной величины.
  t.repeat.set(Math.max(1, roomW / m.unitM / 4), Math.max(1, roomH / m.unitM / 4));
  return t;
}

const CONCRETE = 0xb6b0a6;
const SCREED = 0x9b958b;

// ---------------------------------------------------------------------------

interface PlacedItem {
  uid: number;
  catalogId: string;
  name: string;
}

export default function QSpaceClient() {
  const mountRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [plan, setPlan] = useState<Plan>(() => demoPlan());
  const [layers, setLayers] = useState({ rough: false, finish: true, decor: true });
  const [partition, setPartition] = useState("wall-block");
  const [wallMatId, setWallMatId] = useState("paint-warm-white");
  const [floorMatId, setFloorMatId] = useState("parquet-oak");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [unitLabel, setUnitLabel] = useState<string>("");
  const [placed, setPlaced] = useState<PlacedItem[]>([]);
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [webglOk, setWebglOk] = useState(true);
  // PDF разобран, но масштаб ещё не назван человеком — план не строим.
  const [pdfPending, setPdfPending] = useState<PdfSegments | null>(null);
  // Растровый план ждёт проверки человеком: строить 3D молча по
  // распознанному нельзя (см. RasterReview).
  const [rasterUrl, setRasterUrl] = useState<string | null>(null);
  const [pdfExtent, setPdfExtent] = useState("10");

  // three-объекты живут в ref, React ими не управляет
  const three = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    gRough: THREE.Group;
    gFinish: THREE.Group;
    gDecor: THREE.Group;
    gWalls: THREE.Group;
    wallMat: THREE.MeshLambertMaterial;
    floorMat: THREE.MeshLambertMaterial;
    floorMesh: THREE.Mesh | null;
    raycaster: THREE.Raycaster;
    dragUid: number | null;
    uidSeq: number;
  } | null>(null);

  const selRef = useRef<number | null>(null);
  selRef.current = selectedUid;

  // ---- начальная сцена ----------------------------------------------------
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    } catch {
      setWebglOk(false);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f4f1);

    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 200);
    camera.position.set(10, 9, 12);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c6, 0.95));
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.0);
    sun.position.set(12, 18, 8);
    scene.add(sun);

    const gRough = new THREE.Group();
    const gFinish = new THREE.Group();
    const gDecor = new THREE.Group();
    const gWalls = new THREE.Group();
    scene.add(gRough, gFinish, gDecor, gWalls);

    const wallMat = new THREE.MeshLambertMaterial({ color: CONCRETE });
    const floorMat = new THREE.MeshLambertMaterial({ color: SCREED });

    three.current = {
      scene, camera, renderer, controls,
      gRough, gFinish, gDecor, gWalls,
      wallMat, floorMat, floorMesh: null,
      raycaster: new THREE.Raycaster(),
      dragUid: null, uidSeq: 1,
    };

    let alive = true;
    const loop = () => {
      if (!alive) return;
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(loop);
    };
    loop();

    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    // --- перетаскивание мебели --------------------------------------------
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const ndc = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      return new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
      );
    };
    const topGroup = (o: THREE.Object3D): THREE.Object3D | null => {
      let cur: THREE.Object3D | null = o;
      while (cur && cur.parent !== gDecor) cur = cur.parent;
      return cur;
    };
    const onDown = (e: PointerEvent) => {
      const t = three.current; if (!t) return;
      t.raycaster.setFromCamera(ndc(e), t.camera);
      const hits = t.raycaster.intersectObjects(t.gDecor.children, true);
      if (hits.length > 0) {
        const g = topGroup(hits[0].object);
        if (g) {
          t.dragUid = g.userData.uid as number;
          setSelectedUid(t.dragUid);
          t.controls.enabled = false;
        }
      }
    };
    const onMove = (e: PointerEvent) => {
      const t = three.current; if (!t || t.dragUid === null) return;
      t.raycaster.setFromCamera(ndc(e), t.camera);
      const p = new THREE.Vector3();
      if (t.raycaster.ray.intersectPlane(floorPlane, p)) {
        const g = t.gDecor.children.find((c) => c.userData.uid === t.dragUid);
        if (g) { g.position.x = p.x; g.position.z = p.z; }
      }
    };
    const onUp = () => {
      const t = three.current; if (!t) return;
      t.dragUid = null;
      t.controls.enabled = true;
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    return () => {
      alive = false;
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
      three.current = null;
    };
  }, []);

  // ---- перестройка сцены при смене плана ---------------------------------
  useEffect(() => {
    const t = three.current; if (!t) return;
    const clear = (g: THREE.Group) => {
      while (g.children.length) {
        const c = g.children[0];
        g.remove(c);
        c.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
        });
      }
    };
    clear(t.gRough); clear(t.gFinish); clear(t.gWalls); clear(t.gDecor);
    setPlaced([]); setSelectedUid(null);

    const b = planBounds(plan);
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minY + b.maxY) / 2;
    const W = Math.max(b.maxX - b.minX, 2);
    const H = Math.max(b.maxY - b.minY, 2);

    // --- пол ---------------------------------------------------------------
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.6, H + 0.6), t.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, 0, cz);
    t.gWalls.add(floor);
    t.floorMesh = floor;

    // подложка-газон вокруг, чтобы модель не висела в пустоте
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(W + 14, H + 14),
      new THREE.MeshLambertMaterial({ color: 0xe4e1d8 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(cx, -0.02, cz);
    t.gWalls.add(ground);

    // --- стены с проёмами --------------------------------------------------
    const wallBox = (
      w: typeof plan.walls[number],
      from: number, to: number,
      z0: number, z1: number,
    ) => {
      if (to - from < 0.01 || z1 - z0 < 0.01) return;
      const len = to - from;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, z1 - z0, w.thickness), t.wallMat);
      const a = pointOnWall(w, from);
      const bb = pointOnWall(w, to);
      mesh.position.set((a.x + bb.x) / 2, (z0 + z1) / 2, (a.y + bb.y) / 2);
      mesh.rotation.y = -Math.atan2(w.y2 - w.y1, w.x2 - w.x1);
      t.gWalls.add(mesh);
    };
    plan.walls.forEach((w, wi) => {
      const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
      const holes = plan.openings
        .filter((o) => o.wall === wi)
        .sort((a, bo) => a.offset - bo.offset);
      let cur = 0;
      for (const o of holes) {
        wallBox(w, cur, o.offset, 0, w.height);              // до проёма
        wallBox(w, o.offset, o.offset + o.width, o.sill + o.height, w.height); // перемычка
        if (o.sill > 0) wallBox(w, o.offset, o.offset + o.width, 0, o.sill);   // подоконная часть
        cur = o.offset + o.width;
      }
      wallBox(w, cur, L, 0, w.height);
    });

    // --- чистовой слой: окна, двери, светильники ---------------------------
    for (const o of plan.openings) {
      const w = plan.walls[o.wall];
      const a = pointOnWall(w, o.offset);
      const bb2 = pointOnWall(w, o.offset + o.width);
      const mid = { x: (a.x + bb2.x) / 2, y: (a.y + bb2.y) / 2 };
      const rotY = -Math.atan2(w.y2 - w.y1, w.x2 - w.x1);
      if (o.kind === "window") {
        const glass = new THREE.Mesh(
          new THREE.BoxGeometry(o.width, o.height, 0.04),
          new THREE.MeshLambertMaterial({ color: 0xbcd8e8, transparent: true, opacity: 0.55 }),
        );
        glass.position.set(mid.x, o.sill + o.height / 2, mid.y);
        glass.rotation.y = rotY;
        t.gFinish.add(glass);
      } else {
        const door = new THREE.Mesh(
          new THREE.BoxGeometry(o.width - 0.06, o.height - 0.04, 0.05),
          new THREE.MeshLambertMaterial({ color: 0x8b6f4e }),
        );
        door.position.set(mid.x, (o.height - 0.04) / 2, mid.y);
        door.rotation.y = rotY + 0.5; // приоткрыта
        t.gFinish.add(door);
      }
    }
    for (const l of generateLights(plan)) {
      const fixture = new THREE.Group();
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.05, 16),
        new THREE.MeshLambertMaterial({ color: 0xe9e6df }),
      );
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xfff3c8 }),
      );
      bulb.position.y = -0.06;
      fixture.add(base, bulb);
      fixture.position.set(l.x, WALL_HEIGHT - 0.03, l.y);
      t.gFinish.add(fixture);
    }

    // --- черновой слой: электрика и трубы ----------------------------------
    const wiring = generateWiring(plan);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xd97a2b });
    for (const run of wiring.runs) {
      const geo = new THREE.BufferGeometry().setFromPoints(
        run.map(([x, y, z]) => new THREE.Vector3(x, z, y)),
      );
      t.gRough.add(new THREE.Line(geo, lineMat));
    }
    for (const p of wiring.points) {
      const color = p.kind === "panel" ? 0x3d4d60 : p.kind === "switch" ? 0xc8b26a : 0xd97a2b;
      const size = p.kind === "panel" ? [0.3, 0.4, 0.12] : [0.08, 0.08, 0.05];
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(size[0], size[1], size[2]),
        new THREE.MeshLambertMaterial({ color }),
      );
      m.position.set(p.x, p.z, p.y);
      t.gRough.add(m);
    }
    const plumb = generatePlumbing(plan);
    const pipe = (run: Array<[number, number, number]>, color: number, r: number) => {
      for (let i = 0; i + 1 < run.length; i++) {
        const a = new THREE.Vector3(run[i][0], run[i][2], run[i][1]);
        const c = new THREE.Vector3(run[i + 1][0], run[i + 1][2], run[i + 1][1]);
        const len = a.distanceTo(c);
        if (len < 0.01) continue;
        const m = new THREE.Mesh(
          new THREE.CylinderGeometry(r, r, len, 10),
          new THREE.MeshLambertMaterial({ color }),
        );
        m.position.copy(a.clone().add(c).multiplyScalar(0.5));
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.clone().sub(a).normalize());
        t.gRough.add(m);
      }
    };
    for (const r of plumb.cold) pipe(r, 0x4a7fb5, 0.02);
    for (const r of plumb.hot) pipe(r, 0xb55a4a, 0.02);
    for (const r of plumb.drain) pipe(r, 0x6f6a63, 0.045);

    // --- камера на план ----------------------------------------------------
    const diag = Math.hypot(W, H);
    t.camera.position.set(cx + diag * 0.75, diag * 0.8, cz + diag * 0.9);
    t.controls.target.set(cx, 1, cz);
    t.controls.update();
  }, [plan]);

  // ---- видимость слоёв ----------------------------------------------------
  useEffect(() => {
    const t = three.current; if (!t) return;
    t.gRough.visible = layers.rough;
    t.gFinish.visible = layers.finish;
    t.gDecor.visible = layers.decor;
  }, [layers]);

  // ---- материалы чистовой отделки ----------------------------------------
  useEffect(() => {
    const t = three.current; if (!t) return;
    if (layers.finish) {
      const b = planBounds(plan);
      const W = b.maxX - b.minX;
      const H = b.maxY - b.minY;

      const wm = materialById(wallMatId);
      if (wm && wm.pattern === "solid") {
        // Сплошной цвет рисовать текстурой незачем — берём цветом материала.
        t.wallMat.color.set(wm.colors[0]);
        t.wallMat.map = null;
      } else {
        const wt = textureFor(wallMatId, W, WALL_HEIGHT);
        t.wallMat.color.set(0xffffff);
        t.wallMat.map = wt;
      }

      const ft = textureFor(floorMatId, W, H);
      const fm = materialById(floorMatId);
      if (ft && fm && fm.pattern !== "solid") {
        t.floorMat.color.set(0xffffff);
        t.floorMat.map = ft;
      } else {
        t.floorMat.color.set(fm ? fm.colors[0] : 0xffffff);
        t.floorMat.map = null;
      }
    } else {
      t.wallMat.color.set(CONCRETE);
      t.wallMat.map = null;
      t.floorMat.color.set(SCREED);
      t.floorMat.map = null;
    }
    t.wallMat.needsUpdate = true;
    t.floorMat.needsUpdate = true;
  }, [wallMatId, floorMatId, layers.finish, plan]);

  // ---- подсветка выбранного предмета -------------------------------------
  useEffect(() => {
    const t = three.current; if (!t) return;
    for (const g of t.gDecor.children) {
      const on = g.userData.uid === selectedUid;
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        const mat = m.material as THREE.MeshLambertMaterial | undefined;
        if (mat && mat.emissive) mat.emissive.set(on ? 0x33502e : 0x000000);
      });
    }
  }, [selectedUid, placed]);

  // ---- действия -----------------------------------------------------------
  const addItem = useCallback((item: CatalogItem) => {
    const t = three.current; if (!t) return;
    const g = item.build();
    const b = planBounds(plan);
    const uid = t.uidSeq++;
    g.userData.uid = uid;
    g.position.set((b.minX + b.maxX) / 2, 0, (b.minY + b.maxY) / 2);
    t.gDecor.add(g);
    setPlaced((p) => [...p, { uid, catalogId: item.id, name: item.name }]);
    setSelectedUid(uid);
    setLayers((l) => ({ ...l, decor: true }));
  }, [plan]);

  const withSelected = useCallback((fn: (g: THREE.Object3D) => void) => {
    const t = three.current; if (!t || selRef.current === null) return;
    const g = t.gDecor.children.find((c) => c.userData.uid === selRef.current);
    if (g) fn(g);
  }, []);

  const rotateSelected = useCallback((dir: number) => {
    withSelected((g) => { g.rotation.y += (dir * Math.PI) / 8; });
  }, [withSelected]);

  const moveSelected = useCallback((dx: number, dz: number) => {
    withSelected((g) => { g.position.x += dx; g.position.z += dz; });
  }, [withSelected]);

  const deleteSelected = useCallback(() => {
    const t = three.current; if (!t || selRef.current === null) return;
    const uid = selRef.current;
    const g = t.gDecor.children.find((c) => c.userData.uid === uid);
    if (g) {
      t.gDecor.remove(g);
      g.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
    }
    setPlaced((p) => p.filter((x) => x.uid !== uid));
    setSelectedUid(null);
  }, []);

  const onFile = useCallback(async (f: File) => {
    setPdfPending(null);
    if (/^image\//.test(f.type) || /\.(png|jpe?g|webp|bmp)$/i.test(f.name)) {
      setRasterUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(f);
      });
      setWarnings([]);
      setUnitLabel("");
      return;
    }
    if (/\.pdf$/i.test(f.name)) {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const src = await readPdfSegments(bytes);
      if (src.segments.length === 0) {
        // Отказ показывается отказом: почему не вышло — словами, а не пустотой.
        setWarnings(src.warnings);
        setUnitLabel("");
        return;
      }
      // Масштаб PDF неизвестен — спрашиваем габарит у человека, а не гадаем.
      setPdfPending(src);
      setWarnings([
        `Найдено линий: ${src.segments.length}. PDF не хранит масштаб чертежа — `
        + "укажите длину БОЛЬШЕЙ стороны плана в метрах, и модель построится.",
        ...src.warnings,
      ]);
      setUnitLabel("");
      return;
    }
    const text = await f.text();
    const r = parseDxf(text);
    setWarnings(r.warnings);
    setUnitLabel(r.plan ? r.unitLabel : "");
    if (r.plan) setPlan(r.plan);
  }, []);

  const applyPdfScale = useCallback(() => {
    if (!pdfPending) return;
    const r = planFromPdfSegments(pdfPending, Number(pdfExtent));
    setWarnings(r.warnings);
    if (r.plan) {
      setPlan(r.plan);
      setUnitLabel(`масштаб задан вами: ${pdfExtent} м по большей стороне`);
      setPdfPending(null);
    }
  }, [pdfPending, pdfExtent]);

  const screenshot = useCallback(() => {
    const t = three.current; if (!t) return;
    t.renderer.render(t.scene, t.camera);
    const url = t.renderer.domElement.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "qspace.png";
    a.click();
  }, []);

  // ---- разметка -----------------------------------------------------------
  const b = planBounds(plan);
  const dims = `${(b.maxX - b.minX).toFixed(1)} × ${(b.maxY - b.minY).toFixed(1)} м`;

  const est = useMemo(() => {
    const w = generateWiring(plan);
    const pl = generatePlumbing(plan);
    return estimatePlan(plan, w, pl, generateLights(plan).length);
  }, [plan]);

  const S = styles;
  const groups = [...new Set(CATALOG.map((c) => c.group))];

  return (
    <main style={S.page}>
      <header style={S.header}>
        <h1 style={S.h1}>QSpace — 3D-модельер помещений</h1>
        <p style={S.lead}>
          Загрузите план из AutoCAD (DXF) или векторный PDF — QSpace построит 3D-модель
          с тремя слоями: черновая отделка с разводкой электрики и труб, чистовая отделка,
          декор и мебель. Демо-квартира уже открыта ниже — покрутите её мышью.
        </p>
        <p style={S.note}>
          Что это даёт и чего не даёт. Разводка кабелей и труб —{" "}
          <strong>черновик по типовым нормам</strong> (розетки 0.3 м, выключатели 0.9 м,
          магистраль под потолком): ориентир для обсуждения с прорабом, не проектная
          документация. PDF читается <strong>векторный</strong> — экспортированный из
          AutoCAD или Revit; <strong>скан и JPEG пока не распознаются</strong>, это
          следующий этап. У PDF нет масштаба внутри файла, поэтому мы спросим у вас
          длину большей стороны плана, а не станем угадывать.
        </p>
      </header>

      <section style={S.toolbar} aria-label="Управление планом">
        <label style={S.uploadBtn}>
          Загрузить план (DXF, PDF или картинка)
          <input
            ref={fileRef}
            type="file"
            accept=".dxf,.pdf,image/*"
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
          />
        </label>
        <button type="button" style={S.btn} onClick={() => { setPlan(demoPlan()); setWarnings([]); setUnitLabel(""); }}>
          Демо-план
        </button>
        <button type="button" style={S.btn} onClick={screenshot}>Скачать кадр (PNG)</button>
        <span style={S.dims}>
          {plan.name} · {dims}{unitLabel ? ` · единицы: ${unitLabel}` : ""}
        </span>
      </section>

      {warnings.length > 0 && (
        <ul style={S.warnings}>
          {warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}

      {pdfPending && (
        <div style={S.scaleBox}>
          <label htmlFor="qspace-pdf-extent" style={{ fontSize: 14 }}>
            Длина большей стороны плана, м:
          </label>
          <input
            id="qspace-pdf-extent"
            type="number"
            min={0.5}
            max={500}
            step={0.1}
            value={pdfExtent}
            onChange={(e) => setPdfExtent(e.target.value)}
            style={S.scaleInput}
          />
          <button type="button" style={S.uploadBtn} onClick={applyPdfScale}>
            Построить модель
          </button>
          <span style={S.hint}>
            Возьмите размер с самого чертежа — от этого числа зависят все
            остальные размеры модели.
          </span>
        </div>
      )}

      {rasterUrl && (
        <RasterReview
          imageUrl={rasterUrl}
          onCancel={() => {
            URL.revokeObjectURL(rasterUrl);
            setRasterUrl(null);
          }}
          onAccept={(p) => {
            setPlan(p);
            setUnitLabel("масштаб задан вами по картинке");
            setWarnings([
              "Модель построена по РАСПОЗНАННОЙ картинке и вашей правке — "
              + "сверьте размеры с чертежом, прежде чем считать по ней закупку.",
            ]);
            URL.revokeObjectURL(rasterUrl);
            setRasterUrl(null);
          }}
        />
      )}

      <section style={S.layersRow} aria-label="Слои модели">
        {([
          ["rough", "1 · Черновая: разводка, трубы, бетон"],
          ["finish", "2 · Чистовая: краска, пол, свет, окна"],
          ["decor", "3 · Декор и мебель"],
        ] as const).map(([key, label]) => (
          <label key={key} style={S.layerLabel}>
            <input
              type="checkbox"
              checked={layers[key]}
              onChange={(e) => setLayers((l) => ({ ...l, [key]: e.target.checked }))}
            />{" "}
            {label}
          </label>
        ))}
      </section>

      <div style={S.body}>
        <aside style={S.panel}>
          {layers.rough && (
            <>
              <h2 style={S.h2}>Черновая: состав конструкций</h2>
              <div style={S.swatchRow} role="group" aria-label="Тип перегородки">
                {[WALL_BLOCK, WALL_FRAME].map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setPartition(w.id)}
                    title={`${w.title}, ${totalMm(w)} мм`}
                    style={{
                      ...S.btn,
                      fontWeight: partition === w.id ? 700 : 400,
                      borderColor: partition === w.id ? "#2f5e2a" : "#c9c4bb",
                    }}
                  >
                    {w.id === "wall-block" ? "Газоблок" : "Каркас ГКЛ"} · {totalMm(w)} мм
                  </button>
                ))}
              </div>
              <table style={S.estTable}>
                <tbody>
                  {(partition === "wall-block" ? WALL_BLOCK : WALL_FRAME).layers.map((l) => (
                    <tr key={l.name}>
                      <td style={S.estTd} title={l.note}>{l.name}</td>
                      <td style={S.estTdNum}>{l.thicknessMm} мм</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={S.estTd}><strong>Пол (пирог по перекрытию)</strong></td>
                    <td style={S.estTdNum}><strong>{totalMm(FLOOR_WET)} мм</strong></td>
                  </tr>
                  <tr>
                    <td style={S.estTd}><strong>Потолок натяжной (зазор + полотно)</strong></td>
                    <td style={S.estTdNum}><strong>{totalMm(CEILING_STRETCH)} мм</strong></td>
                  </tr>
                  <tr>
                    <td style={S.estTd}>Высота «в бетоне»</td>
                    <td style={S.estTdNum}>{WALL_HEIGHT.toFixed(2)} м</td>
                  </tr>
                  <tr>
                    <td style={S.estTd}><strong>Чистовая высота после ремонта</strong></td>
                    <td style={S.estTdNum}>
                      <strong>{finishedHeightM(WALL_HEIGHT, FLOOR_WET, CEILING_STRETCH).toFixed(2)} м</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p style={S.hint}>
                Наведите на слой — покажет, за что он отвечает. Толщины типовые
                для практики ремонта, а не требование норматива: сверьте с прорабом.
              </p>
            </>
          )}

          <h2 style={S.h2}>Чистовая отделка</h2>
          <div style={S.swatchRow} role="group" aria-label="Отделка стен">
            {materialsFor("wall").map((m) => (
              <button
                key={m.id}
                type="button"
                aria-label={`Стены: ${m.name}. ${m.note}`}
                title={`${m.name} — ${m.note}`}
                onClick={() => setWallMatId(m.id)}
                style={{
                  ...S.swatch,
                  background: m.pattern === "stripes"
                    ? `repeating-linear-gradient(90deg, ${m.colors[0]} 0 6px, ${m.colors[1]} 6px 12px)`
                    : m.colors[0],
                  outline: wallMatId === m.id ? "3px solid #2f5e2a" : "1px solid #b8b3aa",
                }}
              />
            ))}
          </div>
          <p style={S.hint}>
            Стены: {materialById(wallMatId)?.name ?? "—"}
          </p>
          <div style={S.swatchRow} role="group" aria-label="Напольное покрытие">
            {materialsFor("floor").map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setFloorMatId(m.id)}
                title={m.note}
                style={{
                  ...S.btn,
                  fontWeight: floorMatId === m.id ? 700 : 400,
                  borderColor: floorMatId === m.id ? "#2f5e2a" : "#c9c4bb",
                }}
              >
                {m.name}
              </button>
            ))}
          </div>

          <h2 style={S.h2}>Мебель и оборудование</h2>
          {groups.map((grp) => (
            <div key={grp}>
              <h3 style={S.h3}>{grp}</h3>
              <div style={S.catalogGrid}>
                {CATALOG.filter((c) => c.group === grp).map((c) => (
                  <button key={c.id} type="button" style={S.catBtn} onClick={() => addItem(c)}>
                    + {c.name}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {selectedUid !== null && (
            <div style={S.selBox}>
              <h3 style={S.h3}>
                Выбрано: {placed.find((p) => p.uid === selectedUid)?.name ?? "предмет"}
              </h3>
              <div style={S.selRow}>
                <button type="button" style={S.btn} onClick={() => rotateSelected(-1)} aria-label="Повернуть влево">⟲</button>
                <button type="button" style={S.btn} onClick={() => rotateSelected(1)} aria-label="Повернуть вправо">⟳</button>
                <button type="button" style={S.btn} onClick={() => moveSelected(-0.2, 0)} aria-label="Сдвинуть влево">←</button>
                <button type="button" style={S.btn} onClick={() => moveSelected(0.2, 0)} aria-label="Сдвинуть вправо">→</button>
                <button type="button" style={S.btn} onClick={() => moveSelected(0, -0.2)} aria-label="Сдвинуть от себя">↑</button>
                <button type="button" style={S.btn} onClick={() => moveSelected(0, 0.2)} aria-label="Сдвинуть к себе">↓</button>
                <button type="button" style={{ ...S.btn, color: "#8c2f2f" }} onClick={deleteSelected}>
                  Удалить
                </button>
              </div>
              <p style={S.hint}>Предмет можно перетаскивать мышью прямо в 3D.</p>
            </div>
          )}

          {placed.length > 0 && (
            <p style={S.hint}>Предметов в сцене: {placed.length}</p>
          )}

          <h2 style={S.h2}>Спецификация (черновик)</h2>
          <table style={S.estTable}>
            <tbody>
              <tr><td style={S.estTd}>Пол (по габариту плана)</td><td style={S.estTdNum}>{est.floorArea.toFixed(1)} м²</td></tr>
              <tr><td style={S.estTd}>Покрытие пола (+5 % подрезка)</td><td style={S.estTdNum}>{est.flooringArea.toFixed(1)} м²</td></tr>
              <tr><td style={S.estTd}>Стены (по осям, одна сторона, минус проёмы)</td><td style={S.estTdNum}>{est.wallArea.toFixed(1)} м²</td></tr>
              <tr><td style={S.estTd}>Краска (0.12 л/м², два слоя)</td><td style={S.estTdNum}>{est.paintLitres.toFixed(1)} л</td></tr>
              <tr><td style={S.estTd}>Розетки</td><td style={S.estTdNum}>{est.outlets} шт</td></tr>
              <tr><td style={S.estTd}>Выключатели</td><td style={S.estTdNum}>{est.switches} шт</td></tr>
              <tr><td style={S.estTd}>Кабель (магистрали + спуски)</td><td style={S.estTdNum}>{est.cableMeters.toFixed(0)} м</td></tr>
              <tr><td style={S.estTd}>Трубы воды (ХВС + ГВС)</td><td style={S.estTdNum}>{est.pipeMeters.toFixed(1)} м</td></tr>
              <tr><td style={S.estTd}>Канализация</td><td style={S.estTdNum}>{est.drainMeters.toFixed(1)} м</td></tr>
              <tr><td style={S.estTd}>Светильники</td><td style={S.estTdNum}>{est.ceilingLights} шт</td></tr>
            </tbody>
          </table>
          <p style={S.hint}>
            Числа выводятся из модели и меняются вместе с планом. Это черновик
            для разговора о закупке, не смета под подпись.
          </p>
        </aside>

        <div style={S.canvasWrap}>
          {webglOk ? (
            <div
              ref={mountRef}
              style={S.canvas}
              aria-label="3D-модель помещения. Вращение — мышью, приближение — колесом."
              role="application"
            />
          ) : (
            <p style={S.warnings}>
              Браузер не дал создать WebGL-контекст — 3D показать не получится.
              Попробуйте другой браузер или включите аппаратное ускорение.
            </p>
          )}
        </div>
      </div>

      <footer style={S.footer}>
        <p>
          Этап 2 (в работе): распознавание растровых планов — скан и JPEG — с экраном
          ручной правки стен; проёмы (окна и двери) из чертежа; экспорт модели в GLB.
        </p>
      </footer>
    </main>
  );
}

// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 1240,
    margin: "0 auto",
    padding: "24px 16px 48px",
    color: "#1f1d1a",
    background: "#fdfcfa",
  },
  header: { marginBottom: 16 },
  h1: { fontSize: 30, margin: "0 0 8px", lineHeight: 1.2 },
  h2: { fontSize: 17, margin: "18px 0 8px" },
  h3: { fontSize: 14, margin: "10px 0 6px", color: "#4a453d" },
  lead: { fontSize: 16, lineHeight: 1.5, margin: "0 0 8px", maxWidth: 860 },
  note: {
    fontSize: 13.5, lineHeight: 1.5, color: "#5a544b",
    background: "#f4f1ea", border: "1px solid #e2ddd2",
    borderRadius: 8, padding: "8px 12px", maxWidth: 860,
  },
  toolbar: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", margin: "12px 0" },
  uploadBtn: {
    display: "inline-block", padding: "8px 14px", background: "#2f5e2a", color: "#fff",
    borderRadius: 8, cursor: "pointer", fontSize: 14,
  },
  btn: {
    padding: "7px 12px", background: "#fff", border: "1px solid #c9c4bb",
    borderRadius: 8, cursor: "pointer", fontSize: 14, color: "#1f1d1a",
  },
  dims: { fontSize: 13.5, color: "#5a544b" },
  warnings: {
    fontSize: 13.5, color: "#7a5a1f", background: "#fbf3df",
    border: "1px solid #ecdbb2", borderRadius: 8, padding: "8px 12px 8px 28px",
    margin: "8px 0",
  },
  layersRow: { display: "flex", flexWrap: "wrap", gap: 16, margin: "8px 0 12px", fontSize: 14.5 },
  layerLabel: { cursor: "pointer", userSelect: "none" },
  body: { display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" },
  panel: {
    flex: "0 1 300px", minWidth: 260,
    border: "1px solid #e2ddd2", borderRadius: 10, padding: "4px 14px 14px",
    background: "#fff",
  },
  swatchRow: { display: "flex", flexWrap: "wrap", gap: 8, margin: "6px 0" },
  swatch: { width: 34, height: 34, borderRadius: 8, cursor: "pointer", border: "none" },
  catalogGrid: { display: "flex", flexWrap: "wrap", gap: 6 },
  catBtn: {
    padding: "5px 9px", background: "#f7f5f0", border: "1px solid #d8d3c9",
    borderRadius: 7, cursor: "pointer", fontSize: 13, color: "#1f1d1a",
  },
  selBox: {
    marginTop: 14, borderTop: "1px solid #e2ddd2", paddingTop: 8,
  },
  selRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  hint: { fontSize: 12.5, color: "#6a645a", margin: "8px 0 0" },
  scaleBox: {
    display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
    background: "#eef4ea", border: "1px solid #cfdec7", borderRadius: 8,
    padding: "10px 12px", margin: "8px 0",
  },
  scaleInput: {
    width: 90, padding: "6px 8px", border: "1px solid #b8c9ae",
    borderRadius: 6, fontSize: 14,
  },
  estTable: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  estTd: { padding: "3px 6px 3px 0", borderBottom: "1px solid #eee9df", color: "#4a453d" },
  estTdNum: { padding: "3px 0", borderBottom: "1px solid #eee9df", textAlign: "right", whiteSpace: "nowrap" },
  // 3D-вид закреплён: каталог мебели длиннее вида, и без этого человек,
  // прокрутив до кнопок, не видит, что он добавляет в сцену. Отступ считается
  // от высоты шапки сайта — она разная на телефоне и десктопе, поэтому число
  // здесь не годится (переменную публикует SiteHeader).
  canvasWrap: {
    flex: "1 1 560px",
    minWidth: 300,
    position: "sticky",
    top: "calc(var(--aevion-header-h, 0px) + 8px)",
    alignSelf: "flex-start",
  },
  canvas: {
    width: "100%", height: "min(70vh, 640px)",
    border: "1px solid #e2ddd2", borderRadius: 10, overflow: "hidden",
    touchAction: "none",
  },
  footer: { marginTop: 20, fontSize: 13.5, color: "#5a544b" },
};
