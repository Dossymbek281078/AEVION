// @ts-nocheck — three@0.183 ships without complete typings; runtime API matches classic Three.js.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { feature as topoFeature } from "topojson-client";
import countriesData from "world-atlas/countries-110m.json";

type Project = {
  id: string;
  code: string;
  name: string;
  description?: string;
  kind?: string;
  status?: string;
  tags?: string[];
  runtime?: { tier: string; hint?: string };
};

type QRightObject = {
  id: string;
  title: string;
  country?: string;
  city?: string;
};

type MarkerCategory = "product" | "award" | "infra" | "qright" | "focus";

type Marker = {
  key: string;
  type: "project" | "qright";
  /** Короткая метка (например, code "QR"). */
  label: string;
  /** Полное имя — заголовок ховер-карты. */
  title: string;
  description?: string;
  category: MarkerCategory;
  categoryLabel: string;
  icon: string;
  /** "LIVE", "API", "HUB" — иначе skip. */
  statusLabel?: string;
  tags?: string[];
  href?: string;
  country?: string;
  city?: string;
  lat: number;
  lon: number;
  color: number;
  size: number;
};

/** Несколько источников: threejs.org + зеркало репо three.js (если первый недоступен). */
const EARTH_TEXTURE_CANDIDATES = {
  albedo: [
    "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg",
    "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_atmos_2048.jpg",
  ],
  normal: [
    "https://threejs.org/examples/textures/planets/earth_normal_2048.jpg",
    "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_normal_2048.jpg",
  ],
  specular: [
    "https://threejs.org/examples/textures/planets/earth_specular_2048.jpg",
    "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_specular_2048.jpg",
  ],
  clouds: [
    "https://threejs.org/examples/textures/planets/earth_clouds_1024.png",
    "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_clouds_1024.png",
  ],
  night: [
    "https://threejs.org/examples/textures/planets/earth_lights_2048.png",
    "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_lights_2048.png",
  ],
} as const;

function loadTextureChain(
  loader: THREE.TextureLoader,
  urls: readonly string[],
  onSuccess: (t: THREE.Texture) => void,
  onExhausted?: () => void
) {
  let i = 0;
  const next = () => {
    if (i >= urls.length) {
      onExhausted?.();
      return;
    }
    const url = urls[i++];
    loader.load(url, onSuccess, undefined, () => next());
  };
  next();
}

function hashToUnit(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return ((h >>> 0) % 1000000) / 1000000;
}

function geoFromLatLon(lat: number, lon: number, radius: number) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;

  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);

  return { x, y, z };
}

let borderVerticesCache: Float32Array | null = null;
let borderVerticesBuildStarted = false;

/** Кэш country-полигонов для point-in-polygon на ховере. */
type CountryCacheEntry = {
  name: string;
  bbox: [number, number, number, number]; // [west, south, east, north]
  rings: number[][][]; // массив полигонов (для MultiPolygon), каждый = массив колец, ring = [[lon,lat], ...]
};
let countriesCache: CountryCacheEntry[] | null = null;
let countriesCacheBuildStarted = false;

function pointInRing(lon: number, lat: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0],
      yi = ring[i][1];
    const xj = ring[j][0],
      yj = ring[j][1];
    if (
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function findCountryAt(lat: number, lon: number): string | null {
  if (!countriesCache) return null;
  for (const c of countriesCache) {
    const [w, s, e, n] = c.bbox;
    if (lat < s || lat > n) continue;
    // Учёт wrap по долготе для стран на 180°.
    if (w <= e ? lon < w || lon > e : lon < w && lon > e) continue;
    for (const polygon of c.rings) {
      // polygon[0] = outer ring; ignore holes для 110m carto.
      if (pointInRing(lon, lat, polygon[0])) return c.name;
    }
  }
  return null;
}

function pointToLatLon(p: THREE.Vector3): [number, number] {
  const len = p.length() || 1;
  const x = p.x / len;
  const y = p.y / len;
  const z = p.z / len;
  const lat = Math.asin(Math.max(-1, Math.min(1, y))) * (180 / Math.PI);
  let lon = Math.atan2(z, -x) * (180 / Math.PI) - 180;
  while (lon < -180) lon += 360;
  while (lon > 180) lon -= 360;
  return [lat, lon];
}

function buildCountriesIfNeeded() {
  if (countriesCache) return;
  if (countriesCacheBuildStarted) return;
  countriesCacheBuildStarted = true;

  try {
    const topoRoot = countriesData as Parameters<typeof topoFeature>[0];
    const countriesObj = (
      countriesData as { objects: { countries: Parameters<typeof topoFeature>[1] } }
    ).objects.countries;
    const geojson = topoFeature(topoRoot, countriesObj) as FeatureCollection;

    const entries: CountryCacheEntry[] = [];
    for (const f of geojson.features) {
      const name: string =
        (f.properties as Record<string, unknown> | null)?.name as string ??
        (f.properties as Record<string, unknown> | null)?.NAME as string ??
        "Unknown";
      const geom = f.geometry;
      if (!geom) continue;

      const polys: number[][][] = [];
      let west = 180, south = 90, east = -180, north = -90;

      const processRing = (ring: number[][]) => {
        for (const [lon, lat] of ring) {
          if (lon < west) west = lon;
          if (lon > east) east = lon;
          if (lat < south) south = lat;
          if (lat > north) north = lat;
        }
      };

      if (geom.type === "Polygon") {
        const poly = geom as Polygon;
        if (!poly.coordinates?.length) continue;
        polys.push(poly.coordinates[0]);
        processRing(poly.coordinates[0]);
      } else if (geom.type === "MultiPolygon") {
        const mp = geom as MultiPolygon;
        if (!mp.coordinates?.length) continue;
        for (const poly of mp.coordinates) {
          if (!poly?.length) continue;
          polys.push(poly[0]);
          processRing(poly[0]);
        }
      } else {
        continue;
      }

      entries.push({
        name,
        bbox: [west, south, east, north],
        rings: polys.map((ring) => [ring]),
      });
    }

    countriesCache = entries;
  } catch {
    countriesCache = [];
  }
}

function projectGeo(projectId: string) {
  const known: Record<
    string,
    { country: string; city: string; lat: number; lon: number }
  > = {
    qright: { country: "Russia", city: "Moscow", lat: 55.7558, lon: 37.6173 },
    qsign: { country: "Germany", city: "Berlin", lat: 52.52, lon: 13.405 },
    "aevion-ip-bureau": {
      country: "France",
      city: "Paris",
      lat: 48.8566,
      lon: 2.3522,
    },
    globus: { country: "Turkey", city: "Istanbul", lat: 41.0082, lon: 28.9784 },
    qcoreai: { country: "UK", city: "London", lat: 51.5074, lon: -0.1278 },
    "multichat-engine": {
      country: "Netherlands",
      city: "Amsterdam",
      lat: 52.3676,
      lon: 4.9041,
    },
    "aevion-awards-music": {
      country: "United States",
      city: "Nashville",
      lat: 36.1627,
      lon: -86.7816,
    },
    "aevion-awards-film": {
      country: "United States",
      city: "Los Angeles",
      lat: 34.0522,
      lon: -118.2437,
    },
  };

  if (known[projectId]) return known[projectId];
  const u1 = hashToUnit(projectId + ":lat");
  const u2 = hashToUnit(projectId + ":lon");
  const lat = -50 + u1 * 100;
  const lon = -170 + u2 * 340;
  return { country: "World", city: "AEVION Hub", lat, lon };
}

function tierShort(tier: string) {
  if (tier === "mvp_live") return "LIVE";
  if (tier === "platform_api") return "API";
  return "HUB";
}

function objectGeo(obj: QRightObject) {
  const country = obj.country?.trim() || "World";
  const city = obj.city?.trim() || "Unknown";

  const knownCities: Record<string, { lat: number; lon: number }> = {
    Moscow: { lat: 55.7558, lon: 37.6173 },
    Berlin: { lat: 52.52, lon: 13.405 },
    Paris: { lat: 48.8566, lon: 2.3522 },
    Istanbul: { lat: 41.0082, lon: 28.9784 },
  };

  const key = city in knownCities ? city : "";
  if (key) return { lat: knownCities[key].lat, lon: knownCities[key].lon, country, city };

  const u1 = hashToUnit(country + ":" + city + ":lat");
  const u2 = hashToUnit(country + ":" + city + ":lon");
  const lat = -60 + u1 * 120;
  const lon = -180 + u2 * 360;
  return { lat, lon, country, city };
}

function randomSpherePositions(count: number, rMin: number, rMax: number) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = rMin + Math.random() * (rMax - rMin);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  return positions;
}

function buildStarField() {
  const group = new THREE.Group();

  // Dim — основное полотно (1800).
  {
    const pos = randomSpherePositions(1800, 420, 600);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.4,
      transparent: true,
      opacity: 0.65,
      sizeAttenuation: true,
      depthWrite: false,
    });
    group.add(new THREE.Points(geo, mat));
  }

  // Medium — слегка голубоватые (350).
  {
    const pos = randomSpherePositions(350, 430, 580);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xc4d8ff,
      size: 0.7,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
      depthWrite: false,
    });
    group.add(new THREE.Points(geo, mat));
  }

  // Bright — крупные с per-vertex hue (from cool blue до warm yellow).
  {
    const N = 70;
    const pos = randomSpherePositions(N, 440, 560);
    const colors = new Float32Array(N * 3);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const h = (40 + Math.random() * 200) / 360;
      const s = 0.18 + Math.random() * 0.18;
      const l = 0.78 + Math.random() * 0.14;
      c.setHSL(h, s, l);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 1.4,
      transparent: true,
      opacity: 1,
      sizeAttenuation: true,
      depthWrite: false,
      vertexColors: true,
    });
    group.add(new THREE.Points(geo, mat));
  }

  return group;
}

const MIN_DIST = 130;
const MAX_DIST = 360;
const MIN_PITCH = -1.1;
const MAX_PITCH = 1.1;
const DEFAULT_YAW = 0;
const DEFAULT_PITCH = 0.22;
const DEFAULT_DIST = 248;

const VIEW_STORAGE_KEY = "aevion:globus:view:v1";
type SavedView = {
  yaw?: number;
  pitch?: number;
  distance?: number;
  filter?: string;
  autoRotate?: boolean;
};
function readSavedView(): SavedView | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as SavedView;
    return obj && typeof obj === "object" ? obj : null;
  } catch {
    return null;
  }
}

/** URL-сериализация ракурса: ?view=yaw,pitch,distance&filter=... */
function readViewFromUrl(): SavedView | null {
  if (typeof window === "undefined") return null;
  try {
    const sp = new URLSearchParams(window.location.search);
    const v = sp.get("view");
    const f = sp.get("filter");
    const out: SavedView = {};
    if (v) {
      const [y, p, d] = v.split(",").map((s) => parseFloat(s));
      if (!Number.isNaN(y)) out.yaw = y;
      if (!Number.isNaN(p)) out.pitch = p;
      if (!Number.isNaN(d)) out.distance = d;
    }
    if (f) out.filter = f;
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

export default function Globus3D({
  projects,
  qrightObjects,
  focusProjectIds,
  onNavigate,
  onSelectLocation,
}: {
  projects: Array<Project & { id: string }>;
  qrightObjects: QRightObject[];
  focusProjectIds?: string[];
  onNavigate: (href: string) => void;
  onSelectLocation: (geo: { country?: string; city?: string }) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState<boolean>(
    () => readSavedView()?.autoRotate ?? true,
  );
  /** Если в URL переданы view-параметры — auto-rotate отключаем (юзер пришёл по ссылке). */
  const autoRotateRef = useRef(autoRotate);
  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  /** Внешний "пульт" камеры — refs инициализируются из localStorage один раз. */
  const yawRef = useRef(DEFAULT_YAW);
  const pitchRef = useRef(DEFAULT_PITCH);
  const distanceRef = useRef(DEFAULT_DIST);
  const viewLoadedRef = useRef(false);
  if (!viewLoadedRef.current) {
    viewLoadedRef.current = true;
    // URL имеет приоритет над localStorage — пользователь пришёл по shared link.
    const fromUrl = readViewFromUrl();
    const saved = fromUrl ?? readSavedView();
    if (saved) {
      if (typeof saved.yaw === "number") yawRef.current = saved.yaw;
      if (typeof saved.pitch === "number") {
        pitchRef.current = Math.max(MIN_PITCH, Math.min(MAX_PITCH, saved.pitch));
      }
      if (typeof saved.distance === "number") {
        distanceRef.current = Math.max(
          MIN_DIST,
          Math.min(MAX_DIST, saved.distance),
        );
      }
    }
  }
  /** Целевая позиция при click-to-focus; tween идёт в animate. */
  const targetYawRef = useRef<number | null>(null);
  const targetPitchRef = useRef<number | null>(null);
  const targetDistRef = useRef<number | null>(null);

  const [focused, setFocused] = useState<Marker | null>(null);
  const focusedRef = useRef<Marker | null>(null);
  useEffect(() => {
    focusedRef.current = focused;
  }, [focused]);

  const [tour, setTour] = useState(false);
  const tourRef = useRef(tour);
  useEffect(() => {
    tourRef.current = tour;
  }, [tour]);

  /** Texture loading progress — albedo / normal / specular / clouds / night. */
  const TEX_TOTAL = 5;
  const [texLoaded, setTexLoaded] = useState(0);

  /** Поиск и фильтр. Не пересоздаём сцену — меняем opacity у уже созданных мешей. */
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | MarkerCategory>(() => {
    const v = readViewFromUrl()?.filter ?? readSavedView()?.filter;
    if (v === "all" || v === "product" || v === "award" || v === "qright" || v === "infra" || v === "focus") {
      return v;
    }
    return "all";
  });
  const filterRef = useRef(filter);
  useEffect(() => {
    filterRef.current = filter;
  }, [filter]);

  /** Узкий экран — компактный layout overlay'ев. */
  const [isNarrow, setIsNarrow] = useState(false);
  const isNarrowRef = useRef(isNarrow);
  useEffect(() => {
    isNarrowRef.current = isNarrow;
  }, [isNarrow]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 600px)");
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  const markerMeshesRef = useRef<
    Array<{
      mesh: THREE.Mesh;
      group: THREE.Group;
      mat: THREE.MeshBasicMaterial;
      marker: Marker;
    }>
  >([]);
  const pulseMeshByKeyRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const arcsRef = useRef<
    Array<{
      line: THREE.Line;
      geo: THREE.BufferGeometry;
      total: number;
      fromKey: string;
      toKey: string;
      curve: THREE.QuadraticBezierCurve3;
      label: string;
      color: string;
    }>
  >([]);
  /** Tooltip-DOM для дуги; обновляем напрямую в animate. */
  const arcTooltipRef = useRef<HTMLDivElement | null>(null);
  /** Координаты курсора в координатах globe-контейнера (pointer move). */
  const cursorXYRef = useRef<{ x: number; y: number } | null>(null);
  /** DOM-overlay подписи над focus/award маркерами; обновляются прямо через style в animate. */
  const sparseLabelsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  /** Mini-map: камера-индикатор (cx/cy обновляется в animate). */
  const miniCamDotRef = useRef<SVGCircleElement | null>(null);

  const [label, setLabel] = useState<{
    screenX: number;
    screenY: number;
    marker: Marker;
  } | null>(null);
  const labelRef = useRef<typeof label>(null);

  /** Country name detected by globe-surface point-in-polygon (shown as floating badge). */
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const hoveredCountryRef = useRef<string | null>(null);
  const [topCountries, setTopCountries] = useState<Array<[string, number]>>([]);

  useEffect(() => {
    labelRef.current = label;
  }, [label]);

  const onNavigateRef = useRef(onNavigate);
  const onSelectLocationRef = useRef(onSelectLocation);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
    onSelectLocationRef.current = onSelectLocation;
  }, [onNavigate, onSelectLocation]);

  /** Рефы на сеттеры — чтобы Three.js-обработчики могли менять search/filter без эффекта-зависимости. */
  const setQueryRef = useRef(setQuery);
  const setFilterToAllRef = useRef(() => setFilter("all"));
  useEffect(() => {
    setQueryRef.current = setQuery;
    setFilterToAllRef.current = () => setFilter("all");
  });

  /** Прокси для onPointerUp — функция определена ниже, но обёртка стабильна. */
  const focusMarkerRef = useRef<(m: Marker) => void>(() => {});

  /** Persist (debounced) — yaw/pitch/distance/filter/autoRotate. */
  const persistTimerRef = useRef<number | null>(null);
  const persistView = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        VIEW_STORAGE_KEY,
        JSON.stringify({
          yaw: yawRef.current,
          pitch: pitchRef.current,
          distance: distanceRef.current,
          filter: filterRef.current,
          autoRotate: autoRotateRef.current,
        }),
      );
    } catch {}
  }, []);
  const persistViewDebounced = useCallback(() => {
    if (typeof window === "undefined") return;
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      persistView();
    }, 600);
  }, [persistView]);
  const persistViewRef = useRef(persistViewDebounced);
  useEffect(() => {
    persistViewRef.current = persistViewDebounced;
  }, [persistViewDebounced]);
  // Немедленное сохранение при изменении filter / autoRotate.
  useEffect(() => {
    persistView();
  }, [filter, autoRotate, persistView]);

  const markers = useMemo<Marker[]>(() => {
    const projectMarkers: Marker[] = projects.map((p) => {
      const g = projectGeo(p.id);
      const isFocus = focusProjectIds?.includes(p.id);
      const isAwardPin = p.id === "aevion-awards-music" || p.id === "aevion-awards-film";
      const baseHref =
        p.id === "qright"
          ? "/qright"
          : p.id === "qsign"
            ? "/qsign"
            : p.id === "aevion-ip-bureau"
              ? "/bureau"
              : p.id === "qtradeoffline"
                ? "/qtrade"
                : p.id === "qcoreai"
                  ? "/qcoreai"
                  : p.id === "multichat-engine"
                    ? "/multichat-engine"
                    : `/${p.id}`;

      const qs = new URLSearchParams();
      if (g.country) qs.set("country", g.country);
      if (g.city) qs.set("city", g.city);
      const href = qs.toString() ? `${baseHref}?${qs.toString()}` : baseHref;

      const category: MarkerCategory = isFocus
        ? "focus"
        : isAwardPin
          ? "award"
          : p.kind === "infra"
            ? "infra"
            : "product";
      const categoryLabel =
        category === "focus"
          ? "Focus"
          : category === "award"
            ? "Award"
            : category === "infra"
              ? "Infra"
              : "Product";
      const icon =
        category === "focus"
          ? "★"
          : category === "award"
            ? "🏆"
            : category === "infra"
              ? "⚙"
              : "🚀";

      const color =
        category === "focus"
          ? 0xfbbf24
          : category === "award"
            ? 0xe879f9
            : category === "infra"
              ? 0x94a3b8
              : 0x7dd3fc;
      const size =
        category === "focus" ? 5 : category === "award" ? 4.5 : category === "infra" ? 3 : 4;

      return {
        key: `project:${p.id}`,
        type: "project",
        label: p.code,
        title: p.name,
        description: p.description || p.runtime?.hint,
        category,
        categoryLabel,
        icon,
        statusLabel: p.runtime?.tier ? tierShort(p.runtime.tier) : undefined,
        tags: p.tags,
        href,
        country: g.country,
        city: g.city,
        lat: g.lat,
        lon: g.lon,
        color,
        size,
      };
    });

    const objectMarkers: Marker[] = qrightObjects.map((o) => {
      const g = objectGeo(o);
      return {
        key: `qright:${o.id}`,
        type: "qright",
        label: o.title,
        title: o.title,
        description: "QRight registry record — content hash, author, geolocation.",
        category: "qright",
        categoryLabel: "QRight",
        icon: "💎",
        statusLabel: "REGISTERED",
        href: `/bureau?objectId=${encodeURIComponent(o.id)}`,
        country: g.country,
        city: g.city,
        lat: g.lat,
        lon: g.lon,
        color: 0x34d399,
        size: 3.5,
      };
    });

    return [...projectMarkers, ...objectMarkers];
  }, [projects, qrightObjects, focusProjectIds]);

  /** Применяем поиск + фильтр без пересоздания сцены: меняем mesh.visible. */
  useEffect(() => {
    const q = query.trim().toLowerCase();
    const matches = (m: Marker) => {
      if (filter !== "all" && m.category !== filter) return false;
      if (!q) return true;
      const inField = (s?: string) => !!s && s.toLowerCase().includes(q);
      return (
        inField(m.title) ||
        inField(m.label) ||
        inField(m.country) ||
        inField(m.city) ||
        (m.tags?.some((t) => inField(t)) ?? false)
      );
    };
    const visibleByKey = new Map<string, boolean>();
    for (const item of markerMeshesRef.current) {
      const v = matches(item.marker);
      item.group.visible = v;
      // Также на head — иначе raycaster найдёт скрытый маркер (он проверяет only-self).
      item.mesh.visible = v;
      visibleByKey.set(item.marker.key, v);
    }
    // Pulse уже внутри group → автоматически скрыт; просто синхронизируем.
    for (const [key, pulseMesh] of pulseMeshByKeyRef.current) {
      pulseMesh.visible = visibleByKey.get(key) === true;
    }
    for (const a of arcsRef.current) {
      a.line.visible =
        visibleByKey.get(a.fromKey) === true &&
        visibleByKey.get(a.toKey) === true;
    }
  }, [query, filter, markers]);

  /** Auto-focus при единственном совпадении поиска. */
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q && filter === "all") return;
    // Считаем матчи и собираем единственный.
    const inField = (s?: string) => !!s && s.toLowerCase().includes(q);
    let count = 0;
    let single: Marker | null = null;
    for (const m of markers) {
      if (filter !== "all" && m.category !== filter) continue;
      if (q) {
        if (
          !(
            inField(m.title) ||
            inField(m.label) ||
            inField(m.country) ||
            inField(m.city) ||
            (m.tags?.some((t) => inField(t)) ?? false)
          )
        ) {
          continue;
        }
      }
      count++;
      if (count > 1) {
        single = null;
        break;
      }
      single = m;
    }
    if (count !== 1 || !single) return;
    if (focusedRef.current?.key === single.key) return;
    const target = single;
    const tm = window.setTimeout(() => {
      focusMarkerRef.current(target);
    }, 700);
    return () => window.clearTimeout(tm);
  }, [query, filter, markers]);

  const visibleMatchCount = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (filter === "all" && !q) return markers.length;
    let n = 0;
    for (const m of markers) {
      if (filter !== "all" && m.category !== filter) continue;
      if (!q) {
        n++;
        continue;
      }
      const inField = (s?: string) => !!s && s.toLowerCase().includes(q);
      if (
        inField(m.title) ||
        inField(m.label) ||
        inField(m.country) ||
        inField(m.city) ||
        (m.tags?.some((t) => inField(t)) ?? false)
      ) {
        n++;
      }
    }
    return n;
  }, [markers, query, filter]);

  const counts = useMemo(() => {
    let live = 0;
    let api = 0;
    let awards = 0;
    let infra = 0;
    for (const p of projects) {
      if (p.id === "aevion-awards-music" || p.id === "aevion-awards-film") {
        awards++;
        continue;
      }
      if (p.kind === "infra") infra++;
      const tier = p.runtime?.tier;
      if (tier === "mvp_live") live++;
      else if (tier === "platform_api") api++;
    }
    return {
      nodes: projects.length,
      live,
      api,
      awards,
      infra,
      qright: qrightObjects.length,
    };
  }, [projects, qrightObjects]);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    setInitError(null);

    while (el.firstChild) el.removeChild(el.firstChild);

    try {
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      return {
        width: w > 8 ? w : 520,
        height: h > 8 ? h : 520,
      };
    };

    let { width, height } = measure();

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.verticalAlign = "top";
    el.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 2000);

    /** Орбита: угол вокруг Y (yaw), угол подъёма (pitch), радиус (distance). */
    const updateCamera = () => {
      const yaw = yawRef.current;
      const pitch = pitchRef.current;
      const d = distanceRef.current;
      const cp = Math.cos(pitch);
      camera.position.set(
        d * Math.sin(yaw) * cp,
        d * Math.sin(pitch),
        d * Math.cos(yaw) * cp,
      );
      camera.lookAt(0, 0, 0);
    };
    updateCamera();

    const stars = buildStarField();
    scene.add(stars);

    const earthGroup = new THREE.Group();
    scene.add(earthGroup);

    const radius = 95;
    const globeGeo = new THREE.SphereGeometry(radius, 96, 96);
    const globeMat = new THREE.MeshPhongMaterial({
      color: 0x8899aa,
      shininess: 12,
      specular: new THREE.Color(0x111111),
    });
    const globe = new THREE.Mesh(globeGeo, globeMat);
    earthGroup.add(globe);

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");

    let albedoTex: THREE.Texture | null = null;
    let normalTex: THREE.Texture | null = null;
    let specTex: THREE.Texture | null = null;
    let nightTex: THREE.Texture | null = null;

    setTexLoaded(0);
    let loadedCount = 0;
    const oneTexDone = () => {
      loadedCount++;
      setTexLoaded(loadedCount);
    };

    /** Sun direction в world space — глобус в (0,0,0), sun в фиксированной позиции. */
    const sunWorldDir = new THREE.Vector3(260, 80, 180).normalize();

    const applyEarthMaterial = () => {
      if (!albedoTex) return;
      albedoTex.colorSpace = THREE.SRGBColorSpace;
      albedoTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      if (normalTex) {
        normalTex.colorSpace = THREE.NoColorSpace;
      }

      // Если есть night-карта — собираем кастомный shader с day/night миксом.
      if (nightTex) {
        nightTex.colorSpace = THREE.SRGBColorSpace;
        nightTex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

        const shaderMat = new THREE.ShaderMaterial({
          uniforms: {
            dayMap: { value: albedoTex },
            nightMap: { value: nightTex },
            normalMap: { value: normalTex },
            useNormalMap: { value: normalTex ? 1 : 0 },
            sunDir: { value: sunWorldDir.clone() },
          },
          vertexShader: [
            "varying vec2 vUv;",
            "varying vec3 vWorldNormal;",
            "void main() {",
            "  vUv = uv;",
            "  vWorldNormal = normalize(mat3(modelMatrix) * normal);",
            "  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);",
            "}",
          ].join("\n"),
          fragmentShader: [
            "uniform sampler2D dayMap;",
            "uniform sampler2D nightMap;",
            "uniform sampler2D normalMap;",
            "uniform float useNormalMap;",
            "uniform vec3 sunDir;",
            "varying vec2 vUv;",
            "varying vec3 vWorldNormal;",
            "void main() {",
            "  vec3 day = texture2D(dayMap, vUv).rgb;",
            "  vec3 night = texture2D(nightMap, vUv).rgb;",
            "  // Лёгкий perturbation нормали по normalMap (если есть).",
            "  vec3 N = normalize(vWorldNormal);",
            "  if (useNormalMap > 0.5) {",
            "    vec3 nm = texture2D(normalMap, vUv).rgb * 2.0 - 1.0;",
            "    N = normalize(N + nm * 0.18);",
            "  }",
            "  float dotNL = dot(N, sunDir);",
            "  // Smooth terminator: -0.12 (полная ночь) → 0.22 (полный день).",
            "  float t = smoothstep(-0.12, 0.22, dotNL);",
            "  // Ambient + diffuse на дневной стороне.",
            "  vec3 dayLit = day * (0.18 + 0.92 * max(dotNL, 0.0));",
            "  // Ночные огни — ярче в темноте, гасятся к терминатору.",
            "  vec3 nightLit = night * (1.5 - t * 1.4);",
            "  // Лёгкий синий тон ночной поверхности (без огней).",
            "  vec3 nightDark = day * 0.04 + vec3(0.012, 0.018, 0.045);",
            "  vec3 col = mix(nightDark + nightLit, dayLit, t);",
            "  gl_FragColor = vec4(col, 1.0);",
            "}",
          ].join("\n"),
        });
        globe.material = shaderMat;
        return;
      }

      // Fallback — обычный Phong (если night текстура не подгрузилась).
      const mat = new THREE.MeshPhongMaterial({
        map: albedoTex,
        specular: new THREE.Color(0x111122),
        shininess: 18,
      });
      if (normalTex) {
        mat.normalMap = normalTex;
        mat.normalScale = new THREE.Vector2(0.55, 0.55);
      }
      if (specTex) {
        mat.specularMap = specTex;
      }
      globe.material = mat;
    };

    const bumpApply = () => {
      applyEarthMaterial();
    };

    loadTextureChain(
      loader,
      EARTH_TEXTURE_CANDIDATES.albedo,
      (t) => {
        albedoTex = t;
        bumpApply();
        oneTexDone();
      },
      () => {
        bumpApply();
        oneTexDone();
      },
    );
    loadTextureChain(
      loader,
      EARTH_TEXTURE_CANDIDATES.normal,
      (t) => {
        normalTex = t;
        bumpApply();
        oneTexDone();
      },
      () => {
        normalTex = null;
        bumpApply();
        oneTexDone();
      },
    );
    loadTextureChain(
      loader,
      EARTH_TEXTURE_CANDIDATES.specular,
      (t) => {
        specTex = t;
        bumpApply();
        oneTexDone();
      },
      () => {
        specTex = null;
        bumpApply();
        oneTexDone();
      },
    );

    // Clouds (slightly larger, transparent; rotate with Earth).
    const cloudGeo = new THREE.SphereGeometry(radius * 1.008, 80, 80);
    const cloudMat = new THREE.MeshPhongMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    earthGroup.add(cloudMesh);

    loadTextureChain(
      loader,
      EARTH_TEXTURE_CANDIDATES.clouds,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        cloudMesh.material = new THREE.MeshPhongMaterial({
          map: tex,
          transparent: true,
          opacity: 0.88,
          depthWrite: false,
          specular: new THREE.Color(0x000000),
          shininess: 0,
        });
        oneTexDone();
      },
      () => {
        cloudMesh.visible = false;
        oneTexDone();
      },
    );

    loadTextureChain(
      loader,
      EARTH_TEXTURE_CANDIDATES.night,
      (t) => {
        nightTex = t;
        bumpApply();
        oneTexDone();
      },
      () => {
        nightTex = null;
        bumpApply();
        oneTexDone();
      },
    );

    // Fresnel-атмосфера: яркий ободок по краям планеты (космический look).
    const haloGeo = new THREE.SphereGeometry(radius * 1.18, 64, 64);
    const haloMat = new THREE.ShaderMaterial({
      vertexShader: [
        "varying vec3 vNormal;",
        "varying vec3 vViewDir;",
        "void main() {",
        "  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);",
        "  vNormal = normalize(normalMatrix * normal);",
        "  vViewDir = normalize(-mvPosition.xyz);",
        "  gl_Position = projectionMatrix * mvPosition;",
        "}",
      ].join("\n"),
      fragmentShader: [
        "varying vec3 vNormal;",
        "varying vec3 vViewDir;",
        "uniform vec3 glowColor;",
        "uniform vec3 rimColor;",
        "uniform float power;",
        "uniform float strength;",
        "void main() {",
        "  float facing = max(dot(vNormal, vViewDir), 0.0);",
        "  float fresnel = pow(1.0 - facing, power);",
        "  vec3 col = mix(glowColor, rimColor, fresnel);",
        "  gl_FragColor = vec4(col, fresnel * strength);",
        "}",
      ].join("\n"),
      uniforms: {
        glowColor: { value: new THREE.Color(0x4a7fb8) },
        rimColor: { value: new THREE.Color(0xa5d8ff) },
        power: { value: 2.6 },
        strength: { value: 1.15 },
      },
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    earthGroup.add(halo);

    // Latitude / longitude — subtle (photo-like scenes rarely show a strong grid).
    const gridGroup = new THREE.Group();
    earthGroup.add(gridGroup);
    const gridMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.08,
    });

    const lineCount = 9;
    for (let i = 1; i < lineCount; i++) {
      const lat = -60 + (120 * i) / lineCount;
      const pts: THREE.Vector3[] = [];
      for (let j = 0; j <= 64; j++) {
        const lon = -180 + (360 * j) / 64;
        const p = geoFromLatLon(lat, lon, radius + 0.15);
        pts.push(new THREE.Vector3(p.x, p.y, p.z));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      gridGroup.add(new THREE.Line(geo, gridMat));
    }

    for (let i = 1; i < lineCount; i++) {
      const lon = -160 + (320 * i) / lineCount;
      const pts: THREE.Vector3[] = [];
      for (let j = 0; j <= 64; j++) {
        const lat = -85 + (170 * j) / 64;
        const p = geoFromLatLon(lat, lon, radius + 0.15);
        pts.push(new THREE.Vector3(p.x, p.y, p.z));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      gridGroup.add(new THREE.Line(geo, gridMat));
    }

    const buildBordersIfNeeded = () => {
      if (borderVerticesCache) return;
      if (borderVerticesBuildStarted) return;
      borderVerticesBuildStarted = true;

      try {
        const topoRoot = countriesData as Parameters<typeof topoFeature>[0];
        const countriesObj = (
          countriesData as { objects: { countries: Parameters<typeof topoFeature>[1] } }
        ).objects.countries;
        const geojson = topoFeature(topoRoot, countriesObj) as FeatureCollection;

        const vertices: number[] = [];
        const stride = 3;
        const radiusOffset = 0.55;

        const toVec = (lon: number, lat: number) => {
          const p = geoFromLatLon(lat, lon, radius + radiusOffset);
          return [p.x, p.y, p.z];
        };

        for (const f of geojson.features) {
          const geom = f.geometry;
          if (!geom) continue;

          if (geom.type === "Polygon") {
            const poly = geom as Polygon;
            const rings = poly.coordinates;
            if (!rings?.length) continue;
            const ring0 = rings[0];
            for (let i = 0; i < ring0.length - 1; i += stride) {
              const a = ring0[i];
              const b = ring0[i + 1];
              if (!a || !b) continue;
              const va = toVec(a[0], a[1]);
              const vb = toVec(b[0], b[1]);
              vertices.push(va[0], va[1], va[2], vb[0], vb[1], vb[2]);
            }
          } else if (geom.type === "MultiPolygon") {
            const mp = geom as MultiPolygon;
            const polys = mp.coordinates;
            if (!polys?.length) continue;
            for (const poly of polys) {
              if (!poly?.length) continue;
              const ring0 = poly[0];
              if (!ring0) continue;
              for (let i = 0; i < ring0.length - 1; i += stride) {
                const a = ring0[i];
                const b = ring0[i + 1];
                if (!a || !b) continue;
                const va = toVec(a[0], a[1]);
                const vb = toVec(b[0], b[1]);
                vertices.push(va[0], va[1], va[2], vb[0], vb[1], vb[2]);
              }
            }
          }
        }

        borderVerticesCache = new Float32Array(vertices);
      } catch {
        borderVerticesCache = new Float32Array();
      }
    };

    buildBordersIfNeeded();

    if (borderVerticesCache && borderVerticesCache.length > 0) {
      const borderMat = new THREE.LineBasicMaterial({
        color: 0x223344,
        transparent: true,
        opacity: 0.45,
      });

      const borderGeom = new THREE.BufferGeometry();
      borderGeom.setAttribute(
        "position",
        new THREE.BufferAttribute(borderVerticesCache, 3)
      );
      const borders = new THREE.LineSegments(borderGeom, borderMat);
      earthGroup.add(borders);
    }

    // Density heatmap — постоянный нежный контур стран, в которых есть наши маркеры.
    const presenceOutlineGroup = new THREE.Group();
    earthGroup.add(presenceOutlineGroup);

    // Hovered-country outline — светящийся контур поверх borders, пересоздаётся при смене страны.
    const countryOutlineGroup = new THREE.Group();
    earthGroup.add(countryOutlineGroup);

    const countryOutlineMat = new THREE.LineBasicMaterial({
      color: 0x4cc1ff,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    });
    countryOutlineMat.blending = THREE.AdditiveBlending;

    let lastHighlightedCountry: string | null = null;
    const setCountryHighlight = (countryName: string | null) => {
      if (countryName === lastHighlightedCountry) return;
      lastHighlightedCountry = countryName;
      // Освобождаем прошлые линии страны.
      while (countryOutlineGroup.children.length > 0) {
        const child = countryOutlineGroup.children[0] as THREE.Object3D & {
          geometry?: { dispose?: () => void };
        };
        countryOutlineGroup.remove(child);
        child.geometry?.dispose?.();
      }
      if (!countryName) return;
      buildCountriesIfNeeded();
      if (!countriesCache) return;
      const entry = countriesCache.find((c) => c.name === countryName);
      if (!entry) return;

      for (const polygon of entry.rings) {
        const ring = polygon[0];
        if (!ring || ring.length < 2) continue;
        // Линия контура — чуть выше borders, чтобы не утонула.
        const linePts: THREE.Vector3[] = [];
        for (const [lon, lat] of ring) {
          const p = geoFromLatLon(lat, lon, radius + 0.95);
          linePts.push(new THREE.Vector3(p.x, p.y, p.z));
        }
        const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
        const line = new THREE.LineLoop(lineGeo, countryOutlineMat);
        line.renderOrder = 5;
        countryOutlineGroup.add(line);
      }
    };

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const markerMeshes: Array<{
      mesh: THREE.Mesh;
      group: THREE.Group;
      mat: THREE.MeshBasicMaterial;
      marker: Marker;
    }> = [];
    const pulseMeshes: Array<{
      mesh: THREE.Mesh;
      mat: THREE.MeshBasicMaterial;
      baseSize: number;
      offset: number;
      markerKey: string;
    }> = [];
    const pulseMeshByKey = new Map<string, THREE.Mesh>();

    let focusIndex = 0;
    for (const m of markers) {
      const surface = geoFromLatLon(m.lat, m.lon, radius);
      const normal = new THREE.Vector3(surface.x, surface.y, surface.z).normalize();
      const pinHeight = m.size * 2.0;
      const groupPos = new THREE.Vector3(surface.x, surface.y, surface.z).add(
        normal.clone().multiplyScalar(pinHeight * 0.5),
      );

      const group = new THREE.Group();
      group.position.copy(groupPos);
      group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      earthGroup.add(group);

      const markerMat = new THREE.MeshBasicMaterial({
        color: m.color,
        transparent: true,
        opacity: 1,
      });

      // Конус — стержень pin (smaller end вверху, к head).
      const coneGeo = new THREE.CylinderGeometry(0, m.size * 0.5, pinHeight * 0.85, 16);
      const cone = new THREE.Mesh(coneGeo, markerMat);
      cone.position.y = -pinHeight * 0.075;
      group.add(cone);

      // Head — сфера на верхушке (raycast target).
      const headGeo = new THREE.SphereGeometry(m.size * 0.85, 18, 18);
      const head = new THREE.Mesh(headGeo, markerMat);
      head.position.y = pinHeight * 0.4;
      head.userData = { key: m.key };
      group.add(head);

      markerMeshes.push({ mesh: head, group, mat: markerMat, marker: m });

      if (m.category === "focus" || m.category === "award") {
        const pulseGeo = new THREE.SphereGeometry(m.size * 1.05, 18, 18);
        const pulseMat = new THREE.MeshBasicMaterial({
          color: m.color,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
        });
        const pulse = new THREE.Mesh(pulseGeo, pulseMat);
        pulse.position.y = pinHeight * 0.4; // у головки
        group.add(pulse);
        pulseMeshes.push({
          mesh: pulse,
          mat: pulseMat,
          baseSize: m.size,
          offset: focusIndex * 0.35,
          markerKey: m.key,
        });
        pulseMeshByKey.set(m.key, pulse);
        focusIndex++;
      }
    }
    markerMeshesRef.current = markerMeshes;
    pulseMeshByKeyRef.current = pulseMeshByKey;

    // Connection arcs — пайплайн между ключевыми нодами.
    const arcConnections: Array<{
      from: string;
      to: string;
      color: number;
      label: string;
    }> = [
      { from: "auth", to: "qright", color: 0x5eead4, label: "Identity → IP" },
      { from: "qright", to: "qsign", color: 0x5eead4, label: "Sign record" },
      { from: "qsign", to: "aevion-ip-bureau", color: 0x5eead4, label: "Certify" },
      { from: "aevion-ip-bureau", to: "aevion-bank", color: 0x5eead4, label: "Earn royalties" },
      { from: "planet", to: "aevion-awards-music", color: 0xe879f9, label: "Submit · Vote" },
      { from: "planet", to: "aevion-awards-film", color: 0xe879f9, label: "Submit · Vote" },
      { from: "qcoreai", to: "multichat-engine", color: 0x7dd3fc, label: "AI → Chat" },
    ];

    const markerByProjectId = new Map<string, Marker>();
    for (const m of markers) {
      if (m.type === "project") {
        const id = m.key.replace(/^project:/, "");
        markerByProjectId.set(id, m);
      }
    }

    const arcs: typeof arcsRef.current = [];
    const arcParticles: Array<{
      mesh: THREE.Mesh;
      mat: THREE.MeshBasicMaterial;
      curve: THREE.QuadraticBezierCurve3;
      offset: number;
      arcIdx: number;
    }> = [];
    const PARTICLES_PER_ARC = 3;
    for (const link of arcConnections) {
      const a = markerByProjectId.get(link.from);
      const b = markerByProjectId.get(link.to);
      if (!a || !b) continue;

      const pa = geoFromLatLon(a.lat, a.lon, radius + 1.5);
      const pb = geoFromLatLon(b.lat, b.lon, radius + 1.5);
      const start = new THREE.Vector3(pa.x, pa.y, pa.z);
      const end = new THREE.Vector3(pb.x, pb.y, pb.z);
      const midDir = start
        .clone()
        .add(end)
        .normalize();
      const lift = 1.18 + Math.min(0.4, start.distanceTo(end) / (radius * 4));
      const control = midDir.multiplyScalar(radius * lift);
      const curve = new THREE.QuadraticBezierCurve3(start, control, end);
      const points = curve.getPoints(64);
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      geo.setDrawRange(0, 0);
      const mat = new THREE.LineBasicMaterial({
        color: link.color,
        transparent: true,
        opacity: 0.78,
      });
      const line = new THREE.Line(geo, mat);
      earthGroup.add(line);

      const arcIdx = arcs.length;
      arcs.push({
        line,
        geo,
        total: points.length,
        fromKey: a.key,
        toKey: b.key,
        curve,
        label: link.label,
        color: `#${link.color.toString(16).padStart(6, "0")}`,
      });

      // Частицы вдоль дуги — поток данных.
      for (let i = 0; i < PARTICLES_PER_ARC; i++) {
        const pGeo = new THREE.SphereGeometry(0.65, 10, 10);
        const pMat = new THREE.MeshBasicMaterial({
          color: link.color,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
        });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        earthGroup.add(pMesh);
        arcParticles.push({
          mesh: pMesh,
          mat: pMat,
          curve,
          offset: i / PARTICLES_PER_ARC,
          arcIdx,
        });
      }
    }
    arcsRef.current = arcs;
    const arcStartTime = performance.now();
    const ARC_DRAW_MS = 1400;

    // Density heatmap: outline стран, где у нас живут маркеры. Контур повторяется по
    // числу маркеров (через increment opacity), и игнорирует hover-overlay по renderOrder.
    {
      buildCountriesIfNeeded();
      if (countriesCache && countriesCache.length > 0) {
        const presenceCount = new Map<string, number>();
        for (const m of markers) {
          const name = findCountryAt(m.lat, m.lon);
          if (!name) continue;
          presenceCount.set(name, (presenceCount.get(name) ?? 0) + 1);
        }
        const sortedTop: Array<[string, number]> = [...presenceCount.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        setTopCountries(sortedTop);
        for (const [name, count] of presenceCount) {
          const entry = countriesCache.find((c) => c.name === name);
          if (!entry) continue;
          // Densitу — больше маркеров → ярче контур (clamped).
          const op = Math.min(0.55, 0.18 + 0.08 * count);
          const mat = new THREE.LineBasicMaterial({
            color: 0x6cd6ff,
            transparent: true,
            opacity: op,
            depthWrite: false,
          });
          mat.blending = THREE.AdditiveBlending;
          for (const polygon of entry.rings) {
            const ring = polygon[0];
            if (!ring || ring.length < 2) continue;
            const linePts: THREE.Vector3[] = [];
            for (const [lon, lat] of ring) {
              const p = geoFromLatLon(lat, lon, radius + 0.7);
              linePts.push(new THREE.Vector3(p.x, p.y, p.z));
            }
            const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
            const line = new THREE.LineLoop(lineGeo, mat);
            line.renderOrder = 3;
            presenceOutlineGroup.add(line);
          }
        }
      }
    }

    // Освещение для облаков и halo (globe — shader-based, не зависит от scene lights).
    // hemi пониже — иначе облака на ночной стороне светятся, разрушая terminator.
    const hemi = new THREE.HemisphereLight(0x6e8ed0, 0x040612, 0.18);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 1.55);
    sun.position.set(260, 80, 180);
    scene.add(sun);

    const ambient = new THREE.AmbientLight(0xffffff, 0.04);
    scene.add(ambient);

    let raf = 0;
    let isHovering = false;
    let lastTime = 0;
    let lastSunUpdate = -1000;

    /** Drag/inertia. */
    let dragging = false;
    let didDrag = false;
    let lastPx = 0;
    let lastPy = 0;
    let yawVel = 0;
    let pitchVel = 0;
    /** Pinch-zoom (для двух пальцев). */
    let pinchDist = 0;
    const activePointers = new Map<number, { x: number; y: number }>();

    const clampPitch = (p: number) =>
      Math.max(MIN_PITCH, Math.min(MAX_PITCH, p));
    const clampDist = (d: number) =>
      Math.max(MIN_DIST, Math.min(MAX_DIST, d));

    const resize = () => {
      const m = measure();
      renderer.setSize(m.width, m.height);
      camera.aspect = m.width / m.height;
      camera.updateProjectionMatrix();
    };

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => resize())
        : null;
    ro?.observe(el);

    /** Подсветка маркера и pop-up — отдельно от drag. */
    const updateHover = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -(((clientY - rect.top) / rect.height) * 2 - 1);

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(
        markerMeshes.map((x) => x.mesh),
        false
      );

      if (!intersects.length) {
        setLabel(null);
        isHovering = false;
        canvas.style.cursor = dragging ? "grabbing" : "grab";

        // Globe-surface country detection — raycast the globe sphere.
        buildCountriesIfNeeded();
        const globeHits = raycaster.intersectObject(globe, false);
        if (globeHits.length > 0) {
          const pt = globeHits[0].point;
          // Undo the earthGroup rotation (earthGroup has no rotation in this scene).
          const [lat, lon] = pointToLatLon(pt);
          const country = findCountryAt(lat, lon);
          if (country !== hoveredCountryRef.current) {
            hoveredCountryRef.current = country;
            setHoveredCountry(country);
            setCountryHighlight(country);
          }
        } else {
          if (hoveredCountryRef.current !== null) {
            hoveredCountryRef.current = null;
            setHoveredCountry(null);
            setCountryHighlight(null);
          }
        }
        return;
      }

      // If a marker is hovered, clear the country badge.
      if (hoveredCountryRef.current !== null) {
        hoveredCountryRef.current = null;
        setHoveredCountry(null);
        setCountryHighlight(null);
      }

      const top = intersects[0];
      const found = markerMeshes.find((x) => x.mesh === top.object);
      if (!found) return;

      const v = new THREE.Vector3();
      found.mesh.getWorldPosition(v);
      v.project(camera);
      const sx = (v.x * 0.5 + 0.5) * rect.width;
      const sy = (-v.y * 0.5 + 0.5) * rect.height;

      const nextLabel = {
        screenX: sx,
        screenY: sy,
        marker: found.marker,
      };
      labelRef.current = nextLabel;
      setLabel(nextLabel);
      isHovering = true;
      canvas.style.cursor = dragging ? "grabbing" : "pointer";
    };

    const onPointerDown = (ev: PointerEvent) => {
      // Юзер взял управление — отключаем тур.
      if (tourRef.current) setTour(false);
      activePointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (activePointers.size === 1) {
        dragging = true;
        didDrag = false;
        lastPx = ev.clientX;
        lastPy = ev.clientY;
        yawVel = 0;
        pitchVel = 0;
        canvas.style.cursor = "grabbing";
      } else if (activePointers.size === 2) {
        const pts = Array.from(activePointers.values());
        const dx = pts[0].x - pts[1].x;
        const dy = pts[0].y - pts[1].y;
        pinchDist = Math.hypot(dx, dy);
      }
      try {
        el.setPointerCapture(ev.pointerId);
      } catch {}
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (activePointers.has(ev.pointerId)) {
        activePointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      }

      if (activePointers.size === 2) {
        const pts = Array.from(activePointers.values());
        const dx = pts[0].x - pts[1].x;
        const dy = pts[0].y - pts[1].y;
        const dist = Math.hypot(dx, dy);
        if (pinchDist > 0) {
          const factor = pinchDist / dist;
          distanceRef.current = clampDist(distanceRef.current * factor);
        }
        pinchDist = dist;
        return;
      }

      if (!dragging) {
        const rect = el.getBoundingClientRect();
        cursorXYRef.current = {
          x: ev.clientX - rect.left,
          y: ev.clientY - rect.top,
        };
        updateHover(ev.clientX, ev.clientY);
        return;
      }

      const dx = ev.clientX - lastPx;
      const dy = ev.clientY - lastPy;
      lastPx = ev.clientX;
      lastPy = ev.clientY;

      if (Math.hypot(dx, dy) > 1) didDrag = true;

      const speed = 0.005;
      yawRef.current -= dx * speed;
      pitchRef.current = clampPitch(pitchRef.current + dy * speed);
      yawVel = -dx * speed * 0.9;
      pitchVel = dy * speed * 0.9;
    };

    const onPointerUp = (ev: PointerEvent) => {
      activePointers.delete(ev.pointerId);
      if (activePointers.size === 0) {
        dragging = false;
        canvas.style.cursor = isHovering ? "pointer" : "grab";
        persistViewRef.current();
      }
      if (activePointers.size < 2) pinchDist = 0;
      try {
        el.releasePointerCapture(ev.pointerId);
      } catch {}

      // Если перемещения не было — это клик: focus-режим вместо моментальной навигации.
      if (!didDrag) {
        const cur = labelRef.current;
        if (cur) {
          focusMarkerRef.current(cur.marker);
          onSelectLocationRef.current({
            country: cur.marker.country,
            city: cur.marker.city,
          });
        } else if (hoveredCountryRef.current) {
          // Клик по пустой стране → фильтр маркеров по стране через query (matches m.country).
          const c = hoveredCountryRef.current;
          setFilterToAllRef.current();
          setQueryRef.current(c);
          onSelectLocationRef.current({ country: c });
        }
      }
    };

    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const factor = Math.exp(ev.deltaY * 0.0015);
      distanceRef.current = clampDist(distanceRef.current * factor);
      persistViewRef.current();
    };

    const onPointerLeave = () => {
      if (!dragging) {
        setLabel(null);
        isHovering = false;
        cursorXYRef.current = null;
        if (hoveredCountryRef.current !== null) {
          hoveredCountryRef.current = null;
          setHoveredCountry(null);
          setCountryHighlight(null);
        }
      }
    };

    const animate = (t: number) => {
      raf = requestAnimationFrame(animate);
      const dt = t - lastTime;
      lastTime = t;

      // Click-to-focus tween — приоритетнее inertia/auto-rotate.
      const tY = targetYawRef.current;
      const tP = targetPitchRef.current;
      const tD = targetDistRef.current;
      const focusing =
        !dragging && (tY !== null || tP !== null || tD !== null);

      if (focusing) {
        const k = 0.085;
        if (tY !== null) {
          const d = tY - yawRef.current;
          yawRef.current += d * k;
          if (Math.abs(d) < 0.001) targetYawRef.current = null;
        }
        if (tP !== null) {
          const d = tP - pitchRef.current;
          pitchRef.current = clampPitch(pitchRef.current + d * k);
          if (Math.abs(d) < 0.001) targetPitchRef.current = null;
        }
        if (tD !== null) {
          const d = tD - distanceRef.current;
          distanceRef.current = clampDist(distanceRef.current + d * k);
          if (Math.abs(d) < 0.05) targetDistRef.current = null;
        }
        yawVel = 0;
        pitchVel = 0;
      } else if (!dragging) {
        if (Math.abs(yawVel) > 0.0005 || Math.abs(pitchVel) > 0.0005) {
          yawRef.current += yawVel;
          pitchRef.current = clampPitch(pitchRef.current + pitchVel);
          yawVel *= 0.92;
          pitchVel *= 0.92;
        } else if (autoRotateRef.current && !isHovering && !focusedRef.current) {
          yawRef.current += dt * 0.00018;
        }
      }

      // Облака чуть-чуть бегут всегда — оживляет сцену.
      cloudMesh.rotation.y += dt * 0.00004;

      // Dynamic sun: пересчитываем sunDir по реальному UTC раз в ~250мс,
      // чтобы day/night terminator плавно следовал за реальным временем.
      if (t - lastSunUpdate > 250) {
        lastSunUpdate = t;
        const now = new Date();
        const utcH =
          now.getUTCHours() +
          now.getUTCMinutes() / 60 +
          now.getUTCSeconds() / 3600;
        const lonSun = -(utcH - 12) * 15;
        const yearStart = Date.UTC(now.getUTCFullYear(), 0, 0);
        const doy = (now.getTime() - yearStart) / 86400000;
        const decDeg =
          23.45 * Math.sin(((doy - 81) * 2 * Math.PI) / 365.25);
        const sp = geoFromLatLon(decDeg, lonSun, 1);
        sunWorldDir.set(sp.x, sp.y, sp.z).normalize();
        const gm: any = globe.material;
        if (gm?.uniforms?.sunDir?.value) {
          gm.uniforms.sunDir.value.copy(sunWorldDir);
        }
        sun.position.copy(sunWorldDir).multiplyScalar(300);
      }

      // Дыхание контура страны под курсором — синусоида 1.4с.
      if (countryOutlineGroup.children.length > 0) {
        const phase = (t % 1400) / 1400;
        countryOutlineMat.opacity = 0.6 + 0.35 * Math.sin(phase * Math.PI * 2);
      }

      // Прорисовка дуг от 0 до total за ARC_DRAW_MS (только при первом рендере).
      if (arcs.length > 0) {
        const arcElapsed = (t - arcStartTime) / ARC_DRAW_MS;
        if (arcElapsed < 1) {
          const eased =
            arcElapsed <= 0
              ? 0
              : arcElapsed >= 1
                ? 1
                : 1 - Math.pow(1 - arcElapsed, 3); // ease-out cubic
          for (const a of arcs) {
            a.geo.setDrawRange(0, Math.floor(a.total * eased));
          }
        }
      }

      // Поток частиц вдоль дуг — оживляет связи.
      if (arcParticles.length > 0) {
        const arcElapsed = (t - arcStartTime) / ARC_DRAW_MS;
        const startedFlow = arcElapsed >= 0.5;
        for (const p of arcParticles) {
          const arc = arcs[p.arcIdx];
          if (!arc || !arc.line.visible || !startedFlow) {
            p.mesh.visible = false;
            continue;
          }
          p.mesh.visible = true;
          const phase = ((t * 0.0006 + p.offset) % 1 + 1) % 1;
          const pos = p.curve.getPointAt(phase);
          p.mesh.position.copy(pos);
          // sin envelope: 0 на концах, 1 в середине — частицы появляются из start, исчезают в end.
          p.mat.opacity = 0.92 * Math.sin(phase * Math.PI);
        }
      }

      // Pulse-кольца на focus/award — растущая полупрозрачная сфера, зацикленная.
      if (pulseMeshes.length > 0) {
        const PERIOD = 1700; // мс
        for (const p of pulseMeshes) {
          const phase = ((t + p.offset * PERIOD) % PERIOD) / PERIOD; // 0..1
          const scale = 1 + phase * 2.4; // 1 → 3.4
          p.mesh.scale.setScalar(scale);
          p.mat.opacity = 0.55 * (1 - phase) * (1 - phase);
        }
      }

      updateCamera();

      // Keyboard-selected outline — следует за выбранным маркером.
      {
        const sel = kbSelectedKeyRef.current;
        const outlineEl = kbOutlineRef.current;
        if (outlineEl) {
          if (!sel) {
            if (outlineEl.style.display !== "none")
              outlineEl.style.display = "none";
          } else {
            const item = markerMeshesRef.current.find(
              (x) => x.marker.key === sel,
            );
            if (!item || !item.group.visible) {
              if (outlineEl.style.display !== "none")
                outlineEl.style.display = "none";
            } else {
              const cw = canvas.clientWidth;
              const ch = canvas.clientHeight;
              const camDir = camera.position.clone().normalize();
              const tmp = new THREE.Vector3();
              const tmpDir = new THREE.Vector3();
              item.mesh.getWorldPosition(tmp);
              tmpDir.copy(tmp).normalize();
              const facing = tmpDir.dot(camDir);
              if (facing < 0.05) {
                if (outlineEl.style.display !== "none")
                  outlineEl.style.display = "none";
              } else {
                tmp.project(camera);
                const sx = (tmp.x * 0.5 + 0.5) * cw;
                const sy = (-tmp.y * 0.5 + 0.5) * ch;
                outlineEl.style.display = "block";
                outlineEl.style.left = `${sx}px`;
                outlineEl.style.top = `${sy}px`;
              }
            }
          }
        }
      }

      // Hover scale-bump на маркерах — плавный grow на hovered, shrink на остальных.
      {
        const hoveredKey = labelRef.current?.marker.key ?? null;
        const focusedKey = focusedRef.current?.key ?? null;
        const baseK = isNarrowRef.current ? 1.35 : 1;
        for (const item of markerMeshesRef.current) {
          const isHover = item.marker.key === hoveredKey;
          const isFocus = item.marker.key === focusedKey;
          const target = isHover ? baseK * 1.22 : isFocus ? baseK * 1.12 : baseK;
          const cur = item.group.scale.x;
          const next = cur + (target - cur) * 0.18;
          item.group.scale.setScalar(next);
        }
      }

      // Arc tooltip — если курсор близко к проекции середины видимой дуги.
      {
        const tipEl = arcTooltipRef.current;
        if (tipEl) {
          const cur = cursorXYRef.current;
          const labelExists = !!labelRef.current;
          if (!cur || labelExists || dragging) {
            if (tipEl.style.display !== "none") tipEl.style.display = "none";
          } else {
            const cw = canvas.clientWidth;
            const ch = canvas.clientHeight;
            const camDir = camera.position.clone().normalize();
            let bestDist = 999;
            let bestArc: typeof arcs[number] | null = null;
            let bestSx = 0;
            let bestSy = 0;
            const tmp = new THREE.Vector3();
            const tmpDir = new THREE.Vector3();
            for (const a of arcs) {
              if (!a.line.visible) continue;
              tmp.copy(a.curve.getPointAt(0.5));
              tmpDir.copy(tmp).normalize();
              if (tmpDir.dot(camDir) < 0.05) continue;
              tmp.project(camera);
              const sx = (tmp.x * 0.5 + 0.5) * cw;
              const sy = (-tmp.y * 0.5 + 0.5) * ch;
              const dist = Math.hypot(sx - cur.x, sy - cur.y);
              if (dist < 36 && dist < bestDist) {
                bestDist = dist;
                bestArc = a;
                bestSx = sx;
                bestSy = sy;
              }
            }
            if (bestArc) {
              const fromMarker = markerMeshesRef.current.find(
                (x) => x.marker.key === bestArc!.fromKey,
              )?.marker;
              const toMarker = markerMeshesRef.current.find(
                (x) => x.marker.key === bestArc!.toKey,
              )?.marker;
              const arrow = `${fromMarker?.label ?? "?"} → ${toMarker?.label ?? "?"}`;
              tipEl.style.display = "block";
              tipEl.style.left = `${bestSx}px`;
              tipEl.style.top = `${bestSy}px`;
              tipEl.style.borderColor = `${bestArc.color}aa`;
              tipEl.style.boxShadow = `0 8px 22px rgba(0,0,0,0.45), 0 0 14px ${bestArc.color}55`;
              tipEl.querySelector(".aev-arc-arrow")!.textContent = arrow;
              tipEl.querySelector(".aev-arc-label")!.textContent =
                bestArc.label;
              (tipEl.querySelector(".aev-arc-arrow") as HTMLElement).style.color =
                bestArc.color;
            } else {
              if (tipEl.style.display !== "none") tipEl.style.display = "none";
            }
          }
        }
      }

      // Mini-map camera dot — обновляем cx/cy без React re-render.
      if (miniCamDotRef.current) {
        let camLon = (yawRef.current * 180) / Math.PI - 90;
        while (camLon > 180) camLon -= 360;
        while (camLon < -180) camLon += 360;
        const camLat = (pitchRef.current * 180) / Math.PI;
        const cx = ((camLon + 180) / 360) * 120;
        const cy = ((90 - camLat) / 180) * 60;
        miniCamDotRef.current.setAttribute("cx", String(cx));
        miniCamDotRef.current.setAttribute("cy", String(cy));
      }

      // Sparse-метки над focus/award маркерами — backside cull + screen project.
      if (sparseLabelsRef.current.size > 0) {
        const cw = canvas.clientWidth;
        const ch = canvas.clientHeight;
        const camDir = camera.position.clone().normalize();
        const tmp = new THREE.Vector3();
        const tmpDir = new THREE.Vector3();
        for (const item of markerMeshesRef.current) {
          if (item.marker.category !== "focus" && item.marker.category !== "award") {
            continue;
          }
          const el = sparseLabelsRef.current.get(item.marker.key);
          if (!el) continue;
          if (!item.group.visible) {
            if (el.style.display !== "none") el.style.display = "none";
            continue;
          }
          item.mesh.getWorldPosition(tmp);
          tmpDir.copy(tmp).normalize();
          const facing = tmpDir.dot(camDir);
          if (facing < 0.08) {
            if (el.style.display !== "none") el.style.display = "none";
            continue;
          }
          tmp.project(camera);
          const sx = (tmp.x * 0.5 + 0.5) * cw;
          const sy = (-tmp.y * 0.5 + 0.5) * ch;
          el.style.display = "block";
          el.style.left = `${sx}px`;
          el.style.top = `${sy}px`;
          el.style.opacity = String(Math.min(1, (facing - 0.08) / 0.2));
        }
      }

      renderer.render(scene, camera);
    };

    canvas.style.cursor = "grab";

    window.addEventListener("resize", resize);
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("pointerleave", onPointerLeave);
    el.addEventListener("wheel", onWheel, { passive: false });

    requestAnimationFrame(() => resize());

    raf = requestAnimationFrame(animate);

    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", resize);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("pointerleave", onPointerLeave);
      el.removeEventListener("wheel", onWheel);
      cancelAnimationFrame(raf);

      // Освобождаем GPU-ресурсы — иначе hot-reload и ремаунт через смену markers
      // быстро забивают видеопамять.
      const disposed = new WeakSet<object>();
      const disposeMaterial = (m: any) => {
        if (!m || disposed.has(m)) return;
        disposed.add(m);
        if (typeof m.dispose === "function") m.dispose();
      };
      scene.traverse((obj: any) => {
        if (obj.geometry && !disposed.has(obj.geometry)) {
          disposed.add(obj.geometry);
          if (typeof obj.geometry.dispose === "function") obj.geometry.dispose();
        }
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(disposeMaterial);
          else disposeMaterial(obj.material);
        }
      });
      renderer.dispose();
      while (el.firstChild) el.removeChild(el.firstChild);
    };
    } catch (err) {
      console.error("[Globus3D] init failed", err);
      setInitError(err instanceof Error ? err.message : String(err));
      while (el.firstChild) el.removeChild(el.firstChild);
      return () => {};
    }
  }, [markers]);

  const ctrlSize = isNarrow ? 40 : 36;
  const ctrlBtn: CSSProperties = {
    width: ctrlSize,
    height: ctrlSize,
    borderRadius: 10,
    border: "1px solid rgba(120,160,220,0.35)",
    background: "rgba(12,18,32,0.78)",
    color: "#e8eefc",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
    backdropFilter: "blur(6px)",
    transition: "transform 0.12s ease, background 0.15s ease",
    touchAction: "manipulation",
  };

  const globeHeight = isNarrow ? 400 : 520;

  const resetView = () => {
    targetYawRef.current = null;
    targetPitchRef.current = null;
    targetDistRef.current = null;
    yawRef.current = DEFAULT_YAW;
    pitchRef.current = DEFAULT_PITCH;
    distanceRef.current = DEFAULT_DIST;
    setFocused(null);
    setTour(false);
    setQuery("");
    setFilter("all");
    setKbSelectedKey(null);
  };

  const focusOnMarker = (m: Marker) => {
    const phi = ((90 - m.lat) * Math.PI) / 180;
    const theta = ((m.lon + 180) * Math.PI) / 180;
    const x = -Math.sin(phi) * Math.cos(theta);
    const y = Math.cos(phi);
    const z = Math.sin(phi) * Math.sin(theta);
    let tYaw = Math.atan2(x, z);
    const tPitch = Math.atan2(y, Math.sqrt(x * x + z * z));
    // Wrap к ближайшему представителю — короткая дуга lerp.
    let dy = tYaw - yawRef.current;
    while (dy > Math.PI) dy -= 2 * Math.PI;
    while (dy < -Math.PI) dy += 2 * Math.PI;
    tYaw = yawRef.current + dy;
    targetYawRef.current = tYaw;
    targetPitchRef.current = Math.max(MIN_PITCH, Math.min(MAX_PITCH, tPitch));
    targetDistRef.current = 195;
    setAutoRotate(false);
    setFocused(m);
    persistViewDebounced();
  };
  useEffect(() => {
    focusMarkerRef.current = focusOnMarker;
  });

  /** Keyboard nav: стрелки = поворот, +/- = zoom, Tab/Shift+Tab = марк, Enter = focus. */
  const [kbSelectedKey, setKbSelectedKey] = useState<string | null>(null);
  const kbSelectedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    kbSelectedKeyRef.current = kbSelectedKey;
  }, [kbSelectedKey]);
  const kbOutlineRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          (target as HTMLElement).isContentEditable);
      if (isEditable) return;

      const kRot = 0.07;
      let handled = true;
      switch (e.key) {
        case "ArrowLeft":
          yawRef.current -= kRot;
          break;
        case "ArrowRight":
          yawRef.current += kRot;
          break;
        case "ArrowUp":
          pitchRef.current = Math.max(
            MIN_PITCH,
            Math.min(MAX_PITCH, pitchRef.current + kRot),
          );
          break;
        case "ArrowDown":
          pitchRef.current = Math.max(
            MIN_PITCH,
            Math.min(MAX_PITCH, pitchRef.current - kRot),
          );
          break;
        case "+":
        case "=":
          distanceRef.current = Math.max(
            MIN_DIST,
            Math.min(MAX_DIST, distanceRef.current * 0.9),
          );
          break;
        case "-":
        case "_":
          distanceRef.current = Math.max(
            MIN_DIST,
            Math.min(MAX_DIST, distanceRef.current / 0.9),
          );
          break;
        case "Tab": {
          const visible = markerMeshesRef.current.filter(
            (x) => x.group.visible,
          );
          if (visible.length === 0) {
            handled = false;
            break;
          }
          const curIdx = visible.findIndex(
            (x) => x.marker.key === kbSelectedKey,
          );
          const next = e.shiftKey
            ? (curIdx <= 0 ? visible.length - 1 : curIdx - 1)
            : (curIdx === -1 || curIdx >= visible.length - 1 ? 0 : curIdx + 1);
          setKbSelectedKey(visible[next].marker.key);
          break;
        }
        case "Enter":
        case " ": {
          if (!kbSelectedKey) {
            handled = false;
            break;
          }
          const item = markerMeshesRef.current.find(
            (x) => x.marker.key === kbSelectedKey,
          );
          if (item) focusMarkerRef.current(item.marker);
          break;
        }
        default:
          handled = false;
      }
      if (handled) {
        e.preventDefault();
        persistViewRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kbSelectedKey]);

  /** ESC закрывает focus-режим и тур. */
  useEffect(() => {
    if (!focused && !tour) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        targetYawRef.current = null;
        targetPitchRef.current = null;
        targetDistRef.current = null;
        setFocused(null);
        setTour(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focused, tour]);

  /** Tour mode — последовательный focus по приоритету. */
  const tourQueue = useMemo(() => {
    const order: Record<string, number> = {
      focus: 0,
      award: 1,
      product: 2,
      infra: 3,
      qright: 4,
    };
    return [...markers]
      .filter((m) => m.type === "project")
      .sort((a, b) => (order[a.category] ?? 9) - (order[b.category] ?? 9));
  }, [markers]);

  useEffect(() => {
    if (!tour) return;
    if (tourQueue.length === 0) return;
    let idx = 0;
    focusMarkerRef.current(tourQueue[0]);
    const tick = window.setInterval(() => {
      idx = (idx + 1) % tourQueue.length;
      focusMarkerRef.current(tourQueue[idx]);
    }, 3200);
    return () => window.clearInterval(tick);
  }, [tour, tourQueue]);
  const zoom = (factor: number) => {
    distanceRef.current = Math.max(
      MIN_DIST,
      Math.min(MAX_DIST, distanceRef.current * factor),
    );
  };

  const [shareToast, setShareToast] = useState<"copied" | "failed" | "locating" | "located" | "geo-failed" | null>(null);

  const flyToLatLon = (lat: number, lon: number, dist = 220) => {
    const phi = ((90 - lat) * Math.PI) / 180;
    const theta = ((lon + 180) * Math.PI) / 180;
    const x = -Math.sin(phi) * Math.cos(theta);
    const y = Math.cos(phi);
    const z = Math.sin(phi) * Math.sin(theta);
    let tYaw = Math.atan2(x, z);
    const tPitch = Math.atan2(y, Math.sqrt(x * x + z * z));
    let dy = tYaw - yawRef.current;
    while (dy > Math.PI) dy -= 2 * Math.PI;
    while (dy < -Math.PI) dy += 2 * Math.PI;
    tYaw = yawRef.current + dy;
    targetYawRef.current = tYaw;
    targetPitchRef.current = Math.max(MIN_PITCH, Math.min(MAX_PITCH, tPitch));
    targetDistRef.current = dist;
    setAutoRotate(false);
    persistViewDebounced();
  };

  const locateMe = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setShareToast("geo-failed");
      window.setTimeout(() => setShareToast(null), 2200);
      return;
    }
    setShareToast("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        flyToLatLon(pos.coords.latitude, pos.coords.longitude, 215);
        setShareToast("located");
        window.setTimeout(() => setShareToast(null), 1600);
      },
      () => {
        setShareToast("geo-failed");
        window.setTimeout(() => setShareToast(null), 2200);
      },
      { timeout: 6000, maximumAge: 5 * 60 * 1000 },
    );
  };
  const shareView = async () => {
    if (typeof window === "undefined") return;
    try {
      const sp = new URLSearchParams(window.location.search);
      sp.set(
        "view",
        `${yawRef.current.toFixed(3)},${pitchRef.current.toFixed(3)},${distanceRef.current.toFixed(1)}`,
      );
      if (filter !== "all") sp.set("filter", filter);
      else sp.delete("filter");
      const url = `${window.location.origin}${window.location.pathname}?${sp.toString()}`;
      await navigator.clipboard.writeText(url);
      setShareToast("copied");
      window.setTimeout(() => setShareToast(null), 1800);
    } catch {
      setShareToast("failed");
      window.setTimeout(() => setShareToast(null), 2200);
    }
  };

  return (
    <div
      role="region"
      aria-label="AEVION ecosystem 3D globe — drag to rotate, scroll to zoom, arrow keys, Tab between markers, Enter to focus"
      tabIndex={0}
      style={{
        position: "relative",
        width: "100%",
        minHeight: globeHeight,
        height: globeHeight,
        outline: "none",
      }}
    >
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: globeHeight,
          minHeight: globeHeight,
          borderRadius: isNarrow ? 22 : 9999,
          border: "1px solid rgba(40,55,90,0.45)",
          overflow: "hidden",
          background:
            "radial-gradient(ellipse 120% 100% at 50% 35%, #0c1528 0%, #02040a 55%, #000005 100%)",
          boxShadow:
            "inset 0 0 80px rgba(60,100,180,0.12), 0 24px 48px rgba(0,0,0,0.35)",
          touchAction: "none",
          userSelect: "none",
        }}
      />

      {!initError ? (
        <div
          style={{
            position: "absolute",
            top: 14,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 5,
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(12,18,32,0.78)",
            border: `1px solid ${visibleMatchCount === 0 ? "rgba(248,113,113,0.5)" : "rgba(120,160,220,0.28)"}`,
            borderRadius: 999,
            padding: "5px 6px 5px 12px",
            backdropFilter: "blur(8px)",
            boxShadow: "0 8px 22px rgba(0,0,0,0.4)",
          }}
        >
          <span style={{ fontSize: 12, opacity: 0.7 }}>🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isNarrow ? "Search" : "Try qright, awards…"}
            aria-label="Search projects"
            style={{
              width: isNarrow ? 90 : 130,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#f1f5ff",
              fontSize: 12,
              fontWeight: 600,
              padding: "4px 0",
            }}
          />
          {query ? (
            <button
              type="button"
              title="Clear"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "rgba(148,163,184,0.2)",
                color: "#cbd5e1",
                border: "none",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          ) : null}

          <span
            style={{
              width: 1,
              height: 18,
              background: "rgba(148,163,184,0.25)",
              margin: "0 2px",
            }}
          />

          {[
            { key: "all", label: "All", icon: "" },
            { key: "product", label: "Products", icon: "🚀" },
            { key: "award", label: "Awards", icon: "🏆" },
            { key: "qright", label: "QRight", icon: "💎" },
          ].map((c) => {
            const active = filter === c.key;
            // На узком экране показываем только иконки, чтобы тулбар не вылезал.
            const showText = !isNarrow || c.key === "all";
            return (
              <button
                key={c.key}
                type="button"
                title={c.label}
                aria-label={`Filter: ${c.label}`}
                onClick={() => setFilter(c.key as typeof filter)}
                style={{
                  height: 28,
                  padding: showText ? (c.icon ? "0 8px" : "0 10px") : "0 7px",
                  borderRadius: 999,
                  border: "1px solid transparent",
                  background: active ? "rgba(125,211,252,0.18)" : "transparent",
                  color: active ? "#bae6fd" : "#94a3b8",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.02em",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  touchAction: "manipulation",
                }}
              >
                {c.icon ? <span style={{ fontSize: 13 }}>{c.icon}</span> : null}
                {showText ? c.label : null}
              </button>
            );
          })}

          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: visibleMatchCount === 0 ? "#fca5a5" : "#94a3b8",
              padding: "0 8px 0 4px",
              minWidth: 28,
              textAlign: "right",
            }}
          >
            {visibleMatchCount}/{markers.length}
          </span>
        </div>
      ) : null}

      {!initError &&
      !isNarrow &&
      query.trim() === "" &&
      filter === "all" &&
      !focused &&
      !tour ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 53,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 4,
            fontSize: 10,
            color: "rgba(168,184,216,0.55)",
            fontWeight: 700,
            letterSpacing: "0.04em",
            pointerEvents: "none",
            background: "rgba(12,18,32,0.45)",
            padding: "2px 8px",
            borderRadius: 999,
            backdropFilter: "blur(2px)",
          }}
        >
          drag · ↑↓←→ · Tab · Enter to focus · Esc
        </div>
      ) : null}

      {!initError && !isNarrow ? (
        <div
          style={{
            position: "absolute",
            top: 84,
            left: 14,
            zIndex: 4,
            background: "rgba(12,18,32,0.7)",
            border: "1px solid rgba(120,160,220,0.22)",
            borderRadius: 12,
            padding: "10px 12px",
            backdropFilter: "blur(8px)",
            boxShadow: "0 8px 22px rgba(0,0,0,0.35)",
            pointerEvents: "none",
            minWidth: 144,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#7a8fb0",
              marginBottom: 6,
            }}
          >
            Legend
          </div>
          {[
            { c: "#7dd3fc", icon: "🚀", label: "Product" },
            { c: "#fbbf24", icon: "★", label: "Focus" },
            { c: "#e879f9", icon: "🏆", label: "Award" },
            { c: "#34d399", icon: "💎", label: "QRight" },
          ].map((row) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                marginTop: 3,
                fontSize: 12,
                color: "#cbd5e1",
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: row.c,
                  boxShadow: `0 0 8px ${row.c}aa`,
                }}
              />
              <span style={{ fontSize: 11, opacity: 0.75 }}>{row.icon}</span>
              <span style={{ fontWeight: 700 }}>{row.label}</span>
            </div>
          ))}

          {topCountries.length > 0 ? (
            <>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#7a8fb0",
                  marginTop: 12,
                  marginBottom: 6,
                  borderTop: "1px solid rgba(120,160,220,0.16)",
                  paddingTop: 10,
                }}
              >
                Top countries
              </div>
              {topCountries.map(([name, count]) => (
                <div
                  key={name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 14,
                    marginTop: 3,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: "#cbd5e1",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 110,
                    }}
                  >
                    {name}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: "#6cd6ff",
                      fontWeight: 900,
                    }}
                  >
                    {count}
                  </span>
                </div>
              ))}
            </>
          ) : null}
        </div>
      ) : null}

      {!initError ? (
        <div
          style={{
            position: "absolute",
            top: 84,
            right: 14,
            zIndex: 4,
            background: "rgba(12,18,32,0.7)",
            border: "1px solid rgba(120,160,220,0.22)",
            borderRadius: 12,
            padding: "10px 12px",
            backdropFilter: "blur(8px)",
            boxShadow: "0 8px 22px rgba(0,0,0,0.35)",
            pointerEvents: "none",
            display: "flex",
            flexDirection: "column",
            gap: 3,
            minWidth: 132,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#7a8fb0",
              marginBottom: 3,
            }}
          >
            Ecosystem
          </div>
          {(isNarrow
            ? [
                { k: "Nodes", v: counts.nodes, color: "#f1f5ff" },
                { k: "LIVE", v: counts.live, color: "#86efac" },
              ]
            : [
                { k: "Nodes", v: counts.nodes, color: "#f1f5ff" },
                { k: "LIVE", v: counts.live, color: "#86efac" },
                { k: "Awards", v: counts.awards, color: "#e879f9" },
                { k: "QRight", v: counts.qright, color: "#5eead4" },
              ]
          ).map((row) => (
            <div
              key={row.k}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 14,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: "#94a3b8",
                  fontWeight: 700,
                }}
              >
                {row.k}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: row.color,
                  fontWeight: 900,
                }}
              >
                {row.v}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {!initError ? (
        <div
          style={{
            position: "absolute",
            right: 14,
            bottom: 14,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            zIndex: 5,
          }}
        >
          <button
            type="button"
            title="Zoom in"
            aria-label="Zoom in"
            onClick={() => zoom(0.85)}
            style={ctrlBtn}
          >
            +
          </button>
          <button
            type="button"
            title="Zoom out"
            aria-label="Zoom out"
            onClick={() => zoom(1 / 0.85)}
            style={ctrlBtn}
          >
            −
          </button>
          <button
            type="button"
            title={autoRotate ? "Pause rotation" : "Auto-rotate"}
            aria-label={autoRotate ? "Pause rotation" : "Auto-rotate"}
            onClick={() => setAutoRotate((v) => !v)}
            style={{
              ...ctrlBtn,
              background: autoRotate ? "rgba(13,148,136,0.85)" : ctrlBtn.background,
              borderColor: autoRotate ? "rgba(94,234,212,0.6)" : ctrlBtn.border as string,
            }}
          >
            {autoRotate ? "❚❚" : "▶"}
          </button>
          <button
            type="button"
            title={tour ? "Stop tour" : "Auto-tour"}
            aria-label={tour ? "Stop tour" : "Auto-tour"}
            onClick={() => setTour((v) => !v)}
            style={{
              ...ctrlBtn,
              background: tour ? "rgba(124,58,237,0.85)" : ctrlBtn.background,
              borderColor: tour ? "rgba(196,181,253,0.6)" : ctrlBtn.border as string,
            }}
          >
            {tour ? "■" : "▷"}
          </button>
          <button
            type="button"
            title="Reset view"
            aria-label="Reset view"
            onClick={resetView}
            style={ctrlBtn}
          >
            ⌂
          </button>
          <button
            type="button"
            title="Copy share link"
            aria-label="Copy share link"
            onClick={shareView}
            style={ctrlBtn}
          >
            ⤴
          </button>
          <button
            type="button"
            title="Locate me"
            aria-label="Locate me"
            onClick={locateMe}
            style={ctrlBtn}
          >
            ⌖
          </button>
        </div>
      ) : null}

      {shareToast ? (
        <div
          role="status"
          style={{
            position: "absolute",
            right: 14,
            bottom: ctrlSize * 6 + 14 + 14,
            zIndex: 8,
            padding: "8px 12px",
            borderRadius: 10,
            background:
              shareToast === "copied" || shareToast === "located"
                ? "rgba(13,148,136,0.92)"
                : shareToast === "locating"
                  ? "rgba(56,128,236,0.92)"
                  : "rgba(220,38,38,0.92)",
            color: "#fff",
            fontWeight: 800,
            fontSize: 12,
            letterSpacing: "0.02em",
            boxShadow: "0 10px 28px rgba(0,0,0,0.45)",
            backdropFilter: "blur(6px)",
            pointerEvents: "none",
          }}
        >
          {shareToast === "copied"
            ? "Link copied ✓"
            : shareToast === "located"
              ? "Located you ✓"
              : shareToast === "locating"
                ? "Locating…"
                : shareToast === "geo-failed"
                  ? "Location unavailable"
                  : "Copy failed"}
        </div>
      ) : null}

      {!initError && !isNarrow ? (
        <div
          style={{
            position: "absolute",
            left: 14,
            bottom: 14,
            zIndex: 4,
            background: "rgba(8,12,24,0.78)",
            border: "1px solid rgba(120,160,220,0.25)",
            borderRadius: 8,
            padding: 4,
            pointerEvents: "none",
            backdropFilter: "blur(6px)",
            boxShadow: "0 8px 22px rgba(0,0,0,0.4)",
          }}
        >
          <svg
            width={120}
            height={60}
            viewBox="0 0 120 60"
            aria-hidden
            style={{ display: "block" }}
          >
            <defs>
              <linearGradient id="aev-mini-bg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#0c1524" />
                <stop offset="1" stopColor="#04070f" />
              </linearGradient>
            </defs>
            <rect
              x={0}
              y={0}
              width={120}
              height={60}
              fill="url(#aev-mini-bg)"
              rx={4}
            />
            {/* экватор + меридиан */}
            <line x1={0} x2={120} y1={30} y2={30} stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} strokeDasharray="2 2" />
            <line x1={60} x2={60} y1={0} y2={60} stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} strokeDasharray="2 2" />
            {markers.map((m) => {
              const cx = ((m.lon + 180) / 360) * 120;
              const cy = ((90 - m.lat) / 180) * 60;
              const color =
                m.category === "focus"
                  ? "#fbbf24"
                  : m.category === "award"
                    ? "#e879f9"
                    : m.category === "qright"
                      ? "#34d399"
                      : m.category === "infra"
                        ? "#94a3b8"
                        : "#7dd3fc";
              const r = m.category === "focus" || m.category === "award" ? 1.8 : 1.3;
              return (
                <circle
                  key={`mini:${m.key}`}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={color}
                  opacity={0.95}
                />
              );
            })}
            {/* Camera-индикатор: обновляется в animate. */}
            <circle
              ref={miniCamDotRef}
              cx={30}
              cy={30}
              r={4}
              fill="none"
              stroke="#f1f5ff"
              strokeWidth={1.4}
              opacity={0.9}
            />
            <circle
              ref={(el) => {
                // Дублирующая внутренняя точка, обновляется реактивно через cam-dot.
                // Не используется, оставлена пустой для эстетики.
                void el;
              }}
              r={1}
              fill="#f1f5ff"
              style={{ display: "none" }}
            />
          </svg>
          <div
            style={{
              fontSize: 9,
              color: "rgba(168,184,216,0.55)",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textAlign: "center",
              marginTop: 2,
              textTransform: "uppercase",
            }}
          >
            World map
          </div>
        </div>
      ) : null}

      {!initError ? (
        <div
          style={{
            position: "absolute",
            left: 14,
            bottom: isNarrow ? 14 : 96,
            zIndex: 4,
            fontSize: 11,
            color: "rgba(168,184,216,0.72)",
            background: "rgba(12,18,32,0.55)",
            border: "1px solid rgba(120,160,220,0.18)",
            borderRadius: 8,
            padding: "5px 9px",
            backdropFilter: "blur(4px)",
            pointerEvents: "none",
            letterSpacing: "0.02em",
          }}
        >
          {isNarrow ? "drag · pinch" : "drag · scroll · arrows · Tab"}
        </div>
      ) : null}

      {!initError && texLoaded < TEX_TOTAL ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 50,
            transform: "translateX(-50%)",
            zIndex: 5,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "rgba(8,12,24,0.85)",
            border: "1px solid rgba(120,160,220,0.28)",
            borderRadius: 999,
            padding: "6px 14px",
            backdropFilter: "blur(8px)",
            boxShadow: "0 8px 22px rgba(0,0,0,0.4)",
            pointerEvents: "none",
          }}
          aria-live="polite"
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#7dd3fc",
              boxShadow: "0 0 10px #7dd3fcaa",
              animation: "aev-globus-pulse 1.2s ease-in-out infinite",
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#cbd5e1",
              letterSpacing: "0.04em",
            }}
          >
            Loading textures
          </span>
          <div
            style={{
              width: 60,
              height: 4,
              borderRadius: 2,
              background: "rgba(255,255,255,0.1)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${(texLoaded / TEX_TOTAL) * 100}%`,
                height: "100%",
                background: "#7dd3fc",
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#bae6fd",
              minWidth: 26,
              textAlign: "right",
            }}
          >
            {texLoaded}/{TEX_TOTAL}
          </span>
        </div>
      ) : null}
      <style>{`@keyframes aev-globus-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.8); } }`}</style>

      {initError ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            textAlign: "center",
            background:
              "radial-gradient(ellipse 120% 100% at 50% 35%, rgba(12,21,40,0.97) 0%, rgba(2,4,10,0.98) 100%)",
            borderRadius: 9999,
            pointerEvents: "auto",
          }}
        >
          <div style={{ maxWidth: 360, color: "#c8d4f0", fontSize: 14, lineHeight: 1.55 }}>
            <div style={{ fontWeight: 850, color: "#fff", marginBottom: 10 }}>3D Globus недоступен</div>
            <div style={{ opacity: 0.92, marginBottom: 14 }}>{initError}</div>
            <div style={{ fontSize: 12, color: "#7a8fb0" }}>
              Проверьте WebGL в браузере или отключённые расширения. Карта узлов и Planet доступны по ссылкам ниже.
            </div>
          </div>
        </div>
      ) : null}

      {label && (!focused || label.marker.key !== focused.key) ? (() => {
        const m = label.marker;
        const accent =
          m.category === "focus"
            ? "#fbbf24"
            : m.category === "award"
              ? "#e879f9"
              : m.category === "qright"
                ? "#34d399"
                : m.category === "infra"
                  ? "#94a3b8"
                  : "#7dd3fc";
        const statusBg =
          m.statusLabel === "LIVE"
            ? "rgba(34,197,94,0.18)"
            : m.statusLabel === "API"
              ? "rgba(59,130,246,0.18)"
              : m.statusLabel === "REGISTERED"
                ? "rgba(20,184,166,0.18)"
                : "rgba(148,163,184,0.18)";
        const statusFg =
          m.statusLabel === "LIVE"
            ? "#86efac"
            : m.statusLabel === "API"
              ? "#93c5fd"
              : m.statusLabel === "REGISTERED"
                ? "#5eead4"
                : "#cbd5e1";
        const location =
          m.city && m.country
            ? `${m.city}, ${m.country}`
            : m.country || m.city || "";

        return (
          <div
            style={{
              position: "absolute",
              left: label.screenX,
              top: label.screenY,
              transform: "translate(-50%, calc(-100% - 14px))",
              pointerEvents: "none",
              width: 280,
              zIndex: 6,
              animation: "aev-hover-card-in 160ms ease-out",
            }}
          >
            <div
              style={{
                background:
                  "linear-gradient(180deg, rgba(15,23,42,0.94) 0%, rgba(8,12,24,0.92) 100%)",
                border: `1px solid ${accent}55`,
                borderRadius: 14,
                padding: "12px 14px 13px",
                boxShadow: `0 14px 44px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 24px ${accent}22`,
                backdropFilter: "blur(12px)",
              }}
            >
              {/* header: category chip + status */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "3px 8px",
                    borderRadius: 999,
                    background: `${accent}1f`,
                    color: accent,
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  <span style={{ fontSize: 11 }}>{m.icon}</span>
                  {m.categoryLabel}
                </span>
                {m.statusLabel ? (
                  <span
                    style={{
                      padding: "3px 7px",
                      borderRadius: 999,
                      background: statusBg,
                      color: statusFg,
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {m.statusLabel}
                  </span>
                ) : null}
              </div>

              {/* title */}
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 16,
                  color: "#f1f5ff",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.2,
                }}
              >
                {m.title}
              </div>
              {m.label && m.label !== m.title ? (
                <div
                  style={{
                    marginTop: 2,
                    fontSize: 11,
                    color: "#94a3b8",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                  }}
                >
                  {m.label}
                </div>
              ) : null}

              {/* location */}
              {location ? (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: "#a8b8d8",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span style={{ opacity: 0.7 }}>📍</span>
                  {location}
                </div>
              ) : null}

              {/* description */}
              {m.description ? (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: "#cbd5e1",
                    lineHeight: 1.45,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {m.description}
                </div>
              ) : null}

              {/* tags */}
              {m.tags && m.tags.length > 0 ? (
                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 4,
                  }}
                >
                  {m.tags.slice(0, 4).map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 6,
                        background: "rgba(148,163,184,0.12)",
                        color: "#cbd5e1",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}

              {/* CTA */}
              {m.href ? (
                <div
                  style={{
                    marginTop: 10,
                    paddingTop: 9,
                    borderTop: "1px solid rgba(148,163,184,0.14)",
                    fontSize: 12,
                    fontWeight: 800,
                    color: accent,
                    letterSpacing: "0.02em",
                  }}
                >
                  Click to focus →
                </div>
              ) : null}
            </div>

            {/* стрелочка вниз — на маркер */}
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: "7px solid transparent",
                borderRight: "7px solid transparent",
                borderTop: `7px solid ${accent}55`,
                margin: "-1px auto 0",
              }}
            />
          </div>
        );
      })() : null}

      {!initError && visibleMatchCount === 0 ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 6,
            background: "rgba(8,12,24,0.88)",
            border: "1px solid rgba(248,113,113,0.4)",
            borderRadius: 14,
            padding: "16px 18px",
            backdropFilter: "blur(10px)",
            boxShadow: "0 14px 40px rgba(0,0,0,0.45)",
            textAlign: "center",
            maxWidth: 280,
          }}
        >
          <div style={{ fontSize: 24, marginBottom: 6 }}>🔭</div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: "#fca5a5",
              marginBottom: 4,
            }}
          >
            Nothing found
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#94a3b8",
              marginBottom: 12,
              lineHeight: 1.5,
            }}
          >
            {query
              ? `No nodes match "${query}"${filter !== "all" ? ` in ${filter}` : ""}.`
              : `No nodes in this category.`}
          </div>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.3)",
              background: "rgba(148,163,184,0.12)",
              color: "#e8eefc",
              fontWeight: 800,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Clear filters
          </button>
        </div>
      ) : null}

      {/* Country badge — shown on globe-surface hover when no marker is hovered. */}
      {hoveredCountry && !label ? (
        <div
          aria-live="polite"
          style={{
            position: "absolute",
            bottom: 14,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 6,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(8,12,24,0.88)",
            border: "1px solid rgba(120,160,220,0.35)",
            borderRadius: 999,
            padding: "5px 12px 5px 9px",
            backdropFilter: "blur(8px)",
            boxShadow: "0 8px 22px rgba(0,0,0,0.42)",
            animation: "aev-hover-card-in 120ms ease-out",
          }}
        >
          <span style={{ fontSize: 13, opacity: 0.75 }}>🌍</span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: "#e2e8f8",
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
            }}
          >
            {hoveredCountry}
          </span>
          <span
            style={{
              fontSize: 10,
              color: "rgba(180,210,255,0.7)",
              marginLeft: 4,
              borderLeft: "1px solid rgba(120,160,220,0.28)",
              paddingLeft: 8,
              whiteSpace: "nowrap",
            }}
          >
            click → filter
          </span>
        </div>
      ) : null}

      {/* Arc-tooltip — при ховере на дугу (single DOM, обновляется в animate). */}
      <div
        ref={arcTooltipRef}
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transform: "translate(-50%, calc(-100% - 10px))",
          pointerEvents: "none",
          background: "rgba(8,12,24,0.92)",
          border: "1px solid rgba(120,160,220,0.4)",
          borderRadius: 10,
          padding: "6px 10px",
          backdropFilter: "blur(8px)",
          display: "none",
          zIndex: 5,
          whiteSpace: "nowrap",
          minWidth: 110,
        }}
      >
        <div
          className="aev-arc-arrow"
          style={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        />
        <div
          className="aev-arc-label"
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#cbd5e1",
            marginTop: 2,
          }}
        />
      </div>

      {/* Keyboard-focused marker outline — single overlay, передвигаемый в animate. */}
      <div
        ref={kbOutlineRef}
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 26,
          height: 26,
          marginLeft: -13,
          marginTop: -13,
          borderRadius: "50%",
          border: "2px dashed #f1f5ff",
          boxShadow: "0 0 0 4px rgba(241,245,255,0.18), 0 0 22px rgba(241,245,255,0.5)",
          pointerEvents: "none",
          display: "none",
          zIndex: 4,
          animation: "aev-globus-spin 5s linear infinite",
        }}
      />
      <style>{`
        @keyframes aev-globus-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes aev-focus-card-in {
          from { opacity: 0; transform: translateX(-50%) translateY(14px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes aev-hover-card-in {
          from { opacity: 0; transform: translate(-50%, calc(-100% - 4px)); }
          to   { opacity: 1; transform: translate(-50%, calc(-100% - 14px)); }
        }
      `}</style>

      {/* Sparse marker labels — постоянные подписи над focus/award (без ховера). */}
      {!initError
        ? markers
            .filter((m) => m.category === "focus" || m.category === "award")
            .map((m) => {
              const accent = m.category === "focus" ? "#fbbf24" : "#e879f9";
              return (
                <div
                  key={`sparse:${m.key}`}
                  ref={(el) => {
                    if (el) sparseLabelsRef.current.set(m.key, el);
                    else sparseLabelsRef.current.delete(m.key);
                  }}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    transform: "translate(-50%, calc(-100% - 8px))",
                    pointerEvents: "none",
                    background: "rgba(8,12,24,0.78)",
                    border: `1px solid ${accent}66`,
                    color: accent,
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: "0.06em",
                    padding: "2px 6px",
                    borderRadius: 6,
                    boxShadow: `0 4px 10px rgba(0,0,0,0.45), 0 0 12px ${accent}33`,
                    backdropFilter: "blur(4px)",
                    display: "none",
                    whiteSpace: "nowrap",
                    zIndex: 3,
                    transition: "opacity 0.15s ease",
                  }}
                >
                  {m.label}
                </div>
              );
            })
        : null}

      {focused ? (() => {
        const m = focused;
        const accent =
          m.category === "focus"
            ? "#fbbf24"
            : m.category === "award"
              ? "#e879f9"
              : m.category === "qright"
                ? "#34d399"
                : m.category === "infra"
                  ? "#94a3b8"
                  : "#7dd3fc";
        const statusBg =
          m.statusLabel === "LIVE"
            ? "rgba(34,197,94,0.18)"
            : m.statusLabel === "API"
              ? "rgba(59,130,246,0.18)"
              : m.statusLabel === "REGISTERED"
                ? "rgba(20,184,166,0.18)"
                : "rgba(148,163,184,0.18)";
        const statusFg =
          m.statusLabel === "LIVE"
            ? "#86efac"
            : m.statusLabel === "API"
              ? "#93c5fd"
              : m.statusLabel === "REGISTERED"
                ? "#5eead4"
                : "#cbd5e1";
        const location =
          m.city && m.country
            ? `${m.city}, ${m.country}`
            : m.country || m.city || "";

        return (
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 14,
              transform: "translateX(-50%)",
              width: "calc(100% - 100px)",
              maxWidth: 360,
              zIndex: 7,
              animation: "aev-focus-card-in 240ms ease-out",
            }}
          >
            <div
              style={{
                background:
                  "linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(8,12,24,0.96) 100%)",
                border: `1px solid ${accent}66`,
                borderRadius: 16,
                padding: "14px 16px",
                boxShadow: `0 18px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 32px ${accent}33`,
                backdropFilter: "blur(14px)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "3px 8px",
                    borderRadius: 999,
                    background: `${accent}22`,
                    color: accent,
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  <span style={{ fontSize: 11 }}>{m.icon}</span>
                  {m.categoryLabel}
                </span>
                {m.statusLabel ? (
                  <span
                    style={{
                      padding: "3px 7px",
                      borderRadius: 999,
                      background: statusBg,
                      color: statusFg,
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {m.statusLabel}
                  </span>
                ) : null}
                <span style={{ flex: 1 }} />
                <button
                  type="button"
                  title="Close (Esc)"
                  aria-label="Close"
                  onClick={() => {
                    targetYawRef.current = null;
                    targetPitchRef.current = null;
                    targetDistRef.current = null;
                    setFocused(null);
                  }}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "rgba(148,163,184,0.18)",
                    border: "none",
                    color: "#cbd5e1",
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: "pointer",
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>

              <div
                style={{
                  fontWeight: 900,
                  fontSize: 18,
                  color: "#f1f5ff",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.2,
                }}
              >
                {m.title}
              </div>
              {location ? (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    color: "#a8b8d8",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span style={{ opacity: 0.7 }}>📍</span>
                  {location}
                </div>
              ) : null}

              {m.description ? (
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 13,
                    color: "#cbd5e1",
                    lineHeight: 1.5,
                  }}
                >
                  {m.description}
                </div>
              ) : null}

              {m.tags && m.tags.length > 0 ? (
                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 4,
                  }}
                >
                  {m.tags.slice(0, 6).map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: 6,
                        background: "rgba(148,163,184,0.14)",
                        color: "#cbd5e1",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}

              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  gap: 8,
                }}
              >
                {m.href ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (m.href) onNavigateRef.current(m.href);
                    }}
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "none",
                      background: accent,
                      color: "#0b1020",
                      fontWeight: 900,
                      fontSize: 13,
                      cursor: "pointer",
                      letterSpacing: "0.01em",
                      boxShadow: `0 8px 22px ${accent}55`,
                    }}
                  >
                    Open {m.label || m.title} →
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    targetYawRef.current = null;
                    targetPitchRef.current = null;
                    targetDistRef.current = null;
                    setFocused(null);
                  }}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid rgba(148,163,184,0.3)",
                    background: "transparent",
                    color: "#cbd5e1",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontSize: 10,
                  color: "rgba(148,163,184,0.55)",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textAlign: "center",
                  textTransform: "uppercase",
                }}
              >
                Esc to close
              </div>
            </div>
          </div>
        );
      })() : null}
    </div>
  );
}
