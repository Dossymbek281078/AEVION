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
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
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
import { CATALOG, groups, itemById, type CatalogItem } from "./furniture";
import { checkClearance, type Issue, type Placed } from "./clearance";
import { findRooms } from "./rooms";
import { checkPassage } from "./passage";
import { roomSpec, roomSpecText } from "./roomSpec";
import RasterReview from "./RasterReview";
import HeatingPanel from "./HeatingPanel";
import { nearestWall, placeOpening, removeOpeningNear } from "./openings";
import {
  clearLocal,
  loadLocal,
  parseProjectFile,
  projectFileName,
  saveLocal,
  type PlacedSnapshot,
  type Project,
} from "./project";
import {
  CEILING_STRETCH,
  FLOOR_WET,
  WALL_BLOCK,
  WALL_FRAME,
  finishedHeightM,
  totalMm,
} from "./wallStructure";

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
  // Режим расстановки проёмов: из DXF/PDF/картинки приходят только стены,
  // окна и двери человек ставит сам кликом по стене.
  const [openingMode, setOpeningMode] = useState<"off" | "door" | "window" | "erase">("off");
  const [partition, setPartition] = useState("wall-block");
  const [wallMatId, setWallMatId] = useState("paint-warm-white");
  const [floorMatId, setFloorMatId] = useState("parquet-oak");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [unitLabel, setUnitLabel] = useState<string>("");
  const [placed, setPlaced] = useState<PlacedItem[]>([]);
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [webglOk, setWebglOk] = useState(true);
  const [exporting, setExporting] = useState(false);
  // Состояние сохранения: человек должен ВИДЕТЬ, сохранена ли его работа.
  const [saveNote, setSaveNote] = useState<string>("");
  // Сообщение о восстановлении держится отдельно: автосохранение срабатывает
  // через секунду и затирало его — человек не успевал прочитать, что его
  // проект вернули (поймано браузерной пробой, а не чтением кода).
  const [restoreNote, setRestoreNote] = useState<string>("");
  // Восстановление возможно только после того, как сцена собрана, поэтому
  // прочитанный проект ждёт здесь.
  const [pendingRestore, setPendingRestore] = useState<Project | null>(null);
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

  // Обработчик мыши создаётся один раз вместе со сценой, поэтому режим и
  // действие он должен читать через ref, а не из замкнутого состояния.
  const openingModeRef = useRef<"off" | "door" | "window" | "erase">("off");
  const openingClickRef = useRef<((x: number, y: number, mode: "door" | "window" | "erase") => void) | null>(null);
  const recheckRef = useRef<(() => void) | null>(null);

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

      // Режим проёмов перехватывает клик: он про стены, а не про мебель.
      // Читаем режим из ref, потому что обработчик вешается один раз при
      // создании сцены и замкнул бы начальное значение состояния.
      const mode = openingModeRef.current;
      if (mode !== "off") {
        const p = new THREE.Vector3();
        if (!t.raycaster.ray.intersectPlane(floorPlane, p)) return;
        // в плане ось Y — это Z сцены
        openingClickRef.current?.(p.x, p.z, mode);
        return;
      }

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
      const moved = t.dragUid !== null;
      t.dragUid = null;
      t.controls.enabled = true;
      // перетаскивание меняет положение в обход состояния — пересчитываем
      // замечания, иначе они описывали бы прежнюю расстановку
      if (moved) recheckRef.current?.();
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
    // Пол доводим ровно до ВНЕШНЕЙ грани наружных стен. Стены нарисованы по
    // осям и толщиной 0.3 м торчат наружу на 0.15 м с каждой стороны; при
    // запасе 0.6 м пол вылезал из-под них видимой полосой паркета (нашлось
    // на снимке экрана, тестами такое не ловится).
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.3, H + 0.3), t.floorMat);
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

  // ---- восстановление при открытии страницы --------------------------------
  // Читается ОДИН раз. Три исхода различаются: ничего не сохранено — молчим и
  // показываем демо; прочитано — восстанавливаем и говорим об этом; не
  // читается — говорим прямо, потому что молчание тут значит «ваша работа
  // пропала, и мы не сказали».
  useEffect(() => {
    const r = loadLocal();
    if (r.kind === "ok") {
      applyProject(r.project);
      const when = new Date(r.project.savedAt);
      setRestoreNote(
        "Восстановлен ваш проект от "
        + when.toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
        + ". Нажмите «Начать заново», чтобы вернуться к демо.",
      );
    } else if (r.kind === "broken") {
      setWarnings([r.reason + " Показан демо-план."]);
    }
    // намеренно один раз при монтировании: перечитывать сохранённое поверх
    // работы человека нельзя
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- доставка мебели после пересборки сцены ------------------------------
  // Смена плана очищает слой декора, поэтому предметы ставятся ТОЛЬКО после
  // того, как эффект плана отработал. Иначе восстановленная мебель исчезала бы
  // молча — и это выглядело бы как «сохранилось не всё».
  useEffect(() => {
    if (!pendingRestore) return;
    const t = three.current;
    if (!t) return;
    const added: PlacedItem[] = [];
    for (const it of pendingRestore.placed) {
      const item = CATALOG.find((c) => c.id === it.catalogId);
      if (!item) continue; // предмет исчез из каталога — пропускаем, а не падаем
      const g = item.build();
      const uid = t.uidSeq++;
      g.userData.uid = uid;
      g.position.set(it.x, 0, it.z);
      g.rotation.y = it.rotY;
      t.gDecor.add(g);
      added.push({ uid, catalogId: item.id, name: item.name });
    }
    const lost = pendingRestore.placed.length - added.length;
    setPlaced(added);
    if (lost > 0) {
      setWarnings((w) => [...w, `Не удалось восстановить предметов: ${lost} — их больше нет в каталоге.`]);
    }
    setPendingRestore(null);
  }, [pendingRestore, plan]);

  // ---- синхронизация ref-ов -----------------------------------------------
  // Обработчики мыши создаются ОДИН раз вместе со сценой и не видят
  // последующих состояний, поэтому актуальные значения им передаются через
  // ref. Присваивать ref во время отрисовки нельзя: React вправе отрисовать
  // компонент, не показав результат (и делает это в строгом режиме), — тогда
  // сцена получила бы значение из отброшенного прохода. Поэтому эффектом.
  useEffect(() => { selRef.current = selectedUid; }, [selectedUid]);
  useEffect(() => { openingModeRef.current = openingMode; }, [openingMode]);

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

  // Клик по стене в режиме проёмов. План пересобирается целиком, поэтому
  // сцена перестроится сама (эффект на [plan]).
  const onOpeningClick = useCallback(
    (x: number, y: number, mode: "door" | "window" | "erase") => {
      const hit = nearestWall(plan, x, y, 0.7);
      if (!hit) {
        setWarnings(["Мимо стены — нажмите ближе к стене (не дальше 0.7 м)."]);
        return;
      }
      const r = mode === "erase"
        ? removeOpeningNear(plan, hit)
        : placeOpening(plan, hit, mode);
      if (r.ok) {
        setPlan(r.plan);
        setWarnings([]);
      } else {
        setWarnings([r.reason]);
      }
    },
    [plan],
  );

  // Привязка эффектом, а не во время отрисовки: см. блок синхронизации ref-ов.
  useEffect(() => { openingClickRef.current = onOpeningClick; }, [onOpeningClick]);

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

  // Экспорт модели в GLB — двоичный glTF, открывается в Blender, SketchUp,
  // 3ds Max и просмотрщике Windows. Экспортируются только ВИДИМЫЕ слои:
  // выключенный слой в файл не попадает, иначе подрядчик получил бы не то,
  // что видел на экране.
  const exportGlb = useCallback(() => {
    const t = three.current; if (!t) return;
    setExporting(true);
    const parts: THREE.Object3D[] = [];
    if (t.gWalls.visible) parts.push(t.gWalls);
    if (t.gRough.visible) parts.push(t.gRough);
    if (t.gFinish.visible) parts.push(t.gFinish);
    if (t.gDecor.visible) parts.push(t.gDecor);
    if (parts.length === 0) {
      setWarnings(["Все слои выключены — экспортировать нечего."]);
      setExporting(false);
      return;
    }
    new GLTFExporter().parse(
      parts,
      (res) => {
        try {
          const blob = res instanceof ArrayBuffer
            ? new Blob([res], { type: "model/gltf-binary" })
            : new Blob([JSON.stringify(res)], { type: "model/gltf+json" });
          const url = URL.createObjectURL(blob);
          const a2 = document.createElement("a");
          a2.href = url;
          a2.download = res instanceof ArrayBuffer ? "qspace.glb" : "qspace.gltf";
          a2.click();
          URL.revokeObjectURL(url);
          setWarnings([]);
        } finally {
          setExporting(false);
        }
      },
      // отказ показывается отказом, а не тишиной: человек нажал и ждёт файл
      (err) => {
        setWarnings(["Не удалось собрать GLB: " + String(err)]);
        setExporting(false);
      },
      { binary: true },
    );
  }, []);

  // ---- сохранение проекта --------------------------------------------------

  /** Снимок сцены: план, расставленная мебель, выбранная отделка, слои. */
  const snapshot = useCallback((): Project => {
    const t = three.current;
    const items: PlacedSnapshot[] = [];
    if (t) {
      for (const g of t.gDecor.children) {
        const uid = g.userData.uid as number;
        const rec = placed.find((x) => x.uid === uid);
        if (!rec) continue;
        items.push({
          catalogId: rec.catalogId,
          x: g.position.x,
          z: g.position.z,
          rotY: g.rotation.y,
        });
      }
    }
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      plan,
      placed: items,
      wallMatId,
      floorMatId,
      partition,
      layers,
    };
  }, [plan, placed, wallMatId, floorMatId, partition, layers]);

  /** Ставит сцену по сохранённому проекту. План идёт первым: он пересобирает сцену. */
  const applyProject = useCallback((pr: Project) => {
    setPlan(pr.plan);
    setWallMatId(pr.wallMatId);
    setFloorMatId(pr.floorMatId);
    setPartition(pr.partition);
    setLayers(pr.layers);
    // мебель ставится ПОСЛЕ пересборки сцены — иначе её сотрёт очистка слоёв
    setPendingRestore(pr);
  }, []);

  const saveProjectFile = useCallback(() => {
    const data = JSON.stringify(snapshot(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a2 = document.createElement("a");
    a2.href = url;
    a2.download = projectFileName();
    a2.click();
    URL.revokeObjectURL(url);
    setSaveNote("Проект выгружен файлом — его можно хранить и переносить.");
  }, [snapshot]);

  const openProjectFile = useCallback(async (f: File) => {
    const r = parseProjectFile(await f.text());
    if (!r.ok) {
      setWarnings([r.reason]);
      return;
    }
    applyProject(r.project);
    setWarnings([]);
    setSaveNote("Проект открыт из файла.");
  }, [applyProject]);

  const forgetSaved = useCallback(() => {
    clearLocal();
    setRestoreNote("");
    setSaveNote("Сохранённое в браузере удалено. Файлы проектов не тронуты.");
  }, []);

  // ---- автосохранение ------------------------------------------------------
  // С задержкой: перетаскивание мебели меняет состояние часто, а запись в
  // хранилище синхронная. Отказ показывается человеку, а не глотается: иначе
  // он будет уверен, что проект сохранён.
  useEffect(() => {
    if (pendingRestore) return; // не сохранять промежуточное состояние восстановления
    const id = setTimeout(() => {
      const r = saveLocal(snapshot());
      if (r.ok) setSaveNote("Сохранено в этом браузере. Для надёжности выгрузите файлом.");
      else setSaveNote(r.reason);
    }, 1200);
    return () => clearTimeout(id);
  }, [snapshot, pendingRestore]);

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

  // Комнаты и спецификация по ним. Пересчитываются вместе с планом: площадь
  // помещения — это то, по чему покупают плитку и обои, и она обязана
  // меняться, когда меняется план.
  const roomsInfo = useMemo(() => findRooms(plan), [plan]);
  const perRoom = useMemo(
    () => roomSpec(roomsInfo.rooms, WALL_HEIGHT),
    [roomsInfo],
  );

  const est = useMemo(() => {
    const w = generateWiring(plan);
    const pl = generatePlumbing(plan);
    return estimatePlan(plan, w, pl, generateLights(plan).length);
  }, [plan]);

  const S = styles;
  const catalogGroups = groups();

  // ---- проверка расстановки -------------------------------------------------
  // Пересчитывается при каждом изменении сцены. Читается ПОЛОЖЕНИЕ из three,
  // а не из состояния: мебель двигают мышью, и состояние о перетаскивании не
  // знает — иначе замечания отставали бы на один шаг и вводили в заблуждение.
  const [issues, setIssues] = useState<Issue[]>([]);
  const recheck = useCallback(() => {
    const t = three.current;
    if (!t) { setIssues([]); return; }
    const list: Placed[] = [];
    for (const g of t.gDecor.children) {
      const uid = g.userData.uid as number;
      const rec = placed.find((x) => x.uid === uid);
      if (!rec) continue;
      const item = itemById(rec.catalogId);
      if (!item) continue;
      list.push({ uid, name: item.name, x: g.position.x, y: g.position.z, rotY: g.rotation.y, size: item.size });
    }
    const clear = checkClearance(plan, list);
    // Проход считается отдельно: он отвечает на другой вопрос — не «влезет
    // ли», а «дойду ли». Замечания складываются в один список: человеку
    // важно увидеть все препятствия сразу, а не переключать вкладки.
    const pass = checkPassage(plan, list);
    setIssues([
      ...clear,
      ...pass.issues.map((p) => ({
        kind: "passage" as const,
        uids: [] as number[],
        text: p.text,
      })),
    ]);
  }, [placed, plan]);

  useEffect(() => { recheck(); }, [recheck]);
  useEffect(() => { recheckRef.current = recheck; }, [recheck]);


  return (
    <main style={S.page}>
      {/*
        На узком экране колонки складываются, и 3D-вид уезжает ПОД каталог:
        человек жмёт «+ Диван» и не видит результата (замер: 0 px вида).
        Поднимаем вид наверх и делаем его ниже, чтобы под ним оставалось место
        каталогу. Медиазапрос инлайновым стилем не выразить, поэтому scoped-блок;
        !important нужен, потому что высоту холста задаёт инлайновый стиль.
      */}
      <style>{`
        @media (max-width: 860px) {
          .qspace-canvas-wrap { order: -1; width: 100%; }
          .qspace-canvas-wrap > div { height: 42vh !important; }
        }
      `}</style>
      <header style={S.header}>
        <h1 style={S.h1}>QSpace — 3D-модельер помещений</h1>
        <p style={S.lead}>
          Загрузите план — чертёж из AutoCAD (DXF), векторный PDF или просто картинку
          (JPEG, PNG, скан). QSpace построит 3D-модель с тремя слоями: черновая отделка
          с разводкой электрики и труб, чистовая отделка, декор и мебель.
          Демо-квартира уже открыта ниже — покрутите её мышью.
        </p>
        <p style={S.note}>
          Что это даёт и чего не даёт. Разводка кабелей и труб —{" "}
          <strong>черновик по типовым нормам</strong> (розетки 0.3 м, выключатели 0.9 м,
          магистраль под потолком): ориентир для обсуждения с прорабом, не проектная
          документация. Из картинки стены распознаются <strong>предположительно</strong>:
          вы увидите их поверх своего плана и поправите до построения модели. У PDF и
          картинки нет масштаба внутри файла, поэтому мы спросим у вас длину большей
          стороны плана, а не станем угадывать. Окна и двери из чертежа не распознаются
          вовсе — их ставите вы, нажатием на стену.
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
        <button type="button" style={S.btn} onClick={saveProjectFile}>
          Сохранить проект (файл)
        </button>
        <label style={S.btnLabel}>
          Открыть проект
          <input
            type="file"
            accept=".json,.qspace.json,application/json"
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) openProjectFile(f); e.target.value = ""; }}
          />
        </label>
        <button
          type="button"
          style={S.btn}
          onClick={() => { forgetSaved(); setPlan(demoPlan()); setWarnings([]); setUnitLabel(""); }}
        >
          Начать заново
        </button>
        <button type="button" style={S.btn} onClick={exportGlb} disabled={exporting}>
          {exporting ? "Собираю GLB…" : "Скачать модель (GLB)"}
        </button>
        <span style={S.dims}>
          {plan.name} · {dims}{unitLabel ? ` · единицы: ${unitLabel}` : ""}
        </span>
      </section>

      {restoreNote && <p style={S.restoreNote} role="status">{restoreNote}</p>}
      {saveNote && <p style={S.saveNote} role="status">{saveNote}</p>}

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
              <h2 style={S.h2}>Тёплый пол</h2>
              <HeatingPanel rooms={roomsInfo.rooms} />

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

          <h2 style={S.h2}>Окна и двери</h2>
          <p style={S.hint}>
            Из чертежа и картинки приходят только стены — проёмы поставьте сами:
            выберите, что ставить, и нажмите на стену в 3D.
          </p>
          <div style={S.swatchRow} role="group" aria-label="Расстановка проёмов">
            {([
              ["door", "Дверь"],
              ["window", "Окно"],
              ["erase", "Убрать"],
            ] as const).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setOpeningMode((cur) => (cur === m ? "off" : m))}
                aria-pressed={openingMode === m}
                style={{
                  ...S.btn,
                  fontWeight: openingMode === m ? 700 : 400,
                  borderColor: openingMode === m ? "#2f5e2a" : "#c9c4bb",
                  background: openingMode === m ? "#eef4ea" : "#fff",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {openingMode !== "off" && (
            <p style={S.hint}>
              Режим включён: нажмите на стену в 3D-виде.
              {" "}Нажмите кнопку ещё раз, чтобы выйти.
            </p>
          )}

          <h2 style={S.h2}>Мебель и оборудование</h2>
          {catalogGroups.map((grp) => (
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

          {issues.length > 0 && (
            <>
              <h2 style={S.h2}>Проверка расстановки</h2>
              <ul style={S.issues}>
                {issues.map((it, i) => <li key={i}>{it.text}</li>)}
              </ul>
              <p style={S.hint}>
                Это подсказка, а не приговор: предметы меряются прямоугольником
                по габариту, поэтому круглый стол и угловой диван считаются с
                запасом. Посмотрите глазами.
              </p>
            </>
          )}

          <h2 style={S.h2}>Помещения</h2>
          {roomsInfo.rooms.length === 0 ? (
            <p style={S.hint}>
              {roomsInfo.warnings[0] ?? "Помещения не выделены."}
            </p>
          ) : (
            <>
              <table style={S.estTable}>
                <tbody>
                  {perRoom.lines.map((l) => (
                    <tr key={l.index}>
                      <td style={S.estTd}>
                        Помещение {l.index}
                        <br />
                        <span style={{ fontSize: 11.5, color: "#7a746b" }}>
                          покрытие {l.flooring.toFixed(1)} м² · стены {l.wallArea.toFixed(1)} м² ·
                          краска {l.paint.toFixed(1)} л · плинтус {l.skirting.toFixed(1)} м
                        </span>
                      </td>
                      <td style={S.estTdNum}>{l.area.toFixed(1)} м²</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={S.estTd}><strong>Итого по помещениям</strong></td>
                    <td style={S.estTdNum}><strong>{perRoom.totals.area.toFixed(1)} м²</strong></td>
                  </tr>
                </tbody>
              </table>
              <button
                type="button"
                style={{ ...S.btn, marginTop: 8 }}
                onClick={() => {
                  const text = roomSpecText(perRoom, plan.name);
                  navigator.clipboard?.writeText(text).then(
                    () => setSaveNote("Спецификация скопирована — вставьте её в сообщение подрядчику."),
                    // отказ показывается отказом: человек нажал и ждёт результата
                    () => setWarnings(["Браузер не дал скопировать. Выделите текст в спецификации вручную."]),
                  );
                }}
              >
                Скопировать спецификацию
              </button>
              <p style={S.hint}>
                Площадь стен считается по периметру БЕЗ вычета окон и дверей:
                завышение безопаснее — не хватит рулона хуже, чем останется лишний.
              </p>
            </>
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

        <div style={S.canvasWrap} className="qspace-canvas-wrap">
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
  btnLabel: {
    display: "inline-block", padding: "7px 12px", background: "#fff",
    border: "1px solid #c9c4bb", borderRadius: 8, cursor: "pointer",
    fontSize: 14, color: "#1f1d1a",
  },
  restoreNote: {
    fontSize: 13.5, color: "#2f5e2a", background: "#e6f0e2",
    border: "1px solid #b9d0af", borderRadius: 8,
    padding: "8px 12px", margin: "6px 0", fontWeight: 600,
  },
  saveNote: {
    fontSize: 13, color: "#3f5c3a", background: "#eef4ea",
    border: "1px solid #cfdec7", borderRadius: 8,
    padding: "6px 10px", margin: "6px 0",
  },
  scaleBox: {
    display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
    background: "#eef4ea", border: "1px solid #cfdec7", borderRadius: 8,
    padding: "10px 12px", margin: "8px 0",
  },
  scaleInput: {
    width: 90, padding: "6px 8px", border: "1px solid #b8c9ae",
    borderRadius: 6, fontSize: 14,
  },
  issues: {
    fontSize: 13, color: "#7a3f1f", background: "#fbeee2",
    border: "1px solid #eccfb2", borderRadius: 8,
    padding: "8px 12px 8px 26px", margin: "6px 0",
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
