// @ts-nocheck — three@0.183 ships without complete typings; runtime API matches classic Three.js.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

function buildStarField(count: number) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 420 + Math.random() * 180;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.55,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true,
    depthWrite: false,
  });
  return new THREE.Points(geo, mat);
}

const MIN_DIST = 130;
const MAX_DIST = 360;
const MIN_PITCH = -1.1;
const MAX_PITCH = 1.1;
const DEFAULT_YAW = 0;
const DEFAULT_PITCH = 0.22;
const DEFAULT_DIST = 248;

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
  const [autoRotate, setAutoRotate] = useState(true);
  const autoRotateRef = useRef(autoRotate);
  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  /** Внешний "пульт" камеры — кнопки UI меняют ref, animate подхватит на след. кадре. */
  const yawRef = useRef(DEFAULT_YAW);
  const pitchRef = useRef(DEFAULT_PITCH);
  const distanceRef = useRef(DEFAULT_DIST);
  /** Целевая позиция при click-to-focus; tween идёт в animate. */
  const targetYawRef = useRef<number | null>(null);
  const targetPitchRef = useRef<number | null>(null);
  const targetDistRef = useRef<number | null>(null);

  const [focused, setFocused] = useState<Marker | null>(null);
  const focusedRef = useRef<Marker | null>(null);
  useEffect(() => {
    focusedRef.current = focused;
  }, [focused]);

  /** Поиск и фильтр. Не пересоздаём сцену — меняем opacity у уже созданных мешей. */
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | MarkerCategory>("all");

  /** Узкий экран — компактный layout overlay'ев. */
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 600px)");
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  const markerMeshesRef = useRef<
    Array<{ mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; marker: Marker }>
  >([]);
  const pulseMeshByKeyRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const arcsRef = useRef<
    Array<{
      line: THREE.Line;
      geo: THREE.BufferGeometry;
      total: number;
      fromKey: string;
      toKey: string;
    }>
  >([]);

  const [label, setLabel] = useState<{
    screenX: number;
    screenY: number;
    marker: Marker;
  } | null>(null);
  const labelRef = useRef<typeof label>(null);

  useEffect(() => {
    labelRef.current = label;
  }, [label]);

  const onNavigateRef = useRef(onNavigate);
  const onSelectLocationRef = useRef(onSelectLocation);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
    onSelectLocationRef.current = onSelectLocation;
  }, [onNavigate, onSelectLocation]);

  /** Прокси для onPointerUp — функция определена ниже, но обёртка стабильна. */
  const focusMarkerRef = useRef<(m: Marker) => void>(() => {});

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

  /** На тач-устройстве увеличиваем хитбоксы маркеров для удобства попадания. */
  useEffect(() => {
    const k = isNarrow ? 1.35 : 1;
    for (const item of markerMeshesRef.current) {
      item.mesh.scale.setScalar(k);
    }
  }, [isNarrow, markers]);

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
      item.mesh.visible = v;
      visibleByKey.set(item.marker.key, v);
    }
    for (const [key, pulseMesh] of pulseMeshByKeyRef.current) {
      pulseMesh.visible = visibleByKey.get(key) === true;
    }
    for (const a of arcsRef.current) {
      a.line.visible =
        visibleByKey.get(a.fromKey) === true &&
        visibleByKey.get(a.toKey) === true;
    }
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

    const stars = buildStarField(2200);
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

    const applyEarthMaterial = () => {
      if (!albedoTex) return;
      albedoTex.colorSpace = THREE.SRGBColorSpace;
      albedoTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      if (normalTex) {
        normalTex.colorSpace = THREE.NoColorSpace;
      }
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
      },
      () => bumpApply()
    );
    loadTextureChain(
      loader,
      EARTH_TEXTURE_CANDIDATES.normal,
      (t) => {
        normalTex = t;
        bumpApply();
      },
      () => {
        normalTex = null;
        bumpApply();
      }
    );
    loadTextureChain(
      loader,
      EARTH_TEXTURE_CANDIDATES.specular,
      (t) => {
        specTex = t;
        bumpApply();
      },
      () => {
        specTex = null;
        bumpApply();
      }
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
      },
      () => {
        cloudMesh.visible = false;
      }
    );

    // Soft outer halo (space-photo look; typings for ShaderMaterial are incomplete in this repo).
    const haloGeo = new THREE.SphereGeometry(radius * 1.14, 56, 56);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x66aaff,
      transparent: true,
      opacity: 0.11,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
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

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const markerMeshes: Array<{
      mesh: THREE.Mesh;
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
      const p = geoFromLatLon(m.lat, m.lon, radius + 1.2);
      const markerGeo = new THREE.SphereGeometry(m.size, 16, 16);
      const markerMat = new THREE.MeshBasicMaterial({
        color: m.color,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(markerGeo, markerMat);
      mesh.position.set(p.x, p.y, p.z);
      mesh.userData = { key: m.key };
      earthGroup.add(mesh);
      markerMeshes.push({ mesh, mat: markerMat, marker: m });

      if (m.category === "focus" || m.category === "award") {
        const pulseGeo = new THREE.SphereGeometry(m.size, 18, 18);
        const pulseMat = new THREE.MeshBasicMaterial({
          color: m.color,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
        });
        const pulse = new THREE.Mesh(pulseGeo, pulseMat);
        pulse.position.set(p.x, p.y, p.z);
        earthGroup.add(pulse);
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
    const arcConnections: Array<{ from: string; to: string; color: number }> = [
      { from: "auth", to: "qright", color: 0x5eead4 },
      { from: "qright", to: "qsign", color: 0x5eead4 },
      { from: "qsign", to: "aevion-ip-bureau", color: 0x5eead4 },
      { from: "aevion-ip-bureau", to: "aevion-bank", color: 0x5eead4 },
      { from: "planet", to: "aevion-awards-music", color: 0xe879f9 },
      { from: "planet", to: "aevion-awards-film", color: 0xe879f9 },
      { from: "qcoreai", to: "multichat-engine", color: 0x7dd3fc },
    ];

    const markerByProjectId = new Map<string, Marker>();
    for (const m of markers) {
      if (m.type === "project") {
        const id = m.key.replace(/^project:/, "");
        markerByProjectId.set(id, m);
      }
    }

    const arcs: typeof arcsRef.current = [];
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

      arcs.push({
        line,
        geo,
        total: points.length,
        fromKey: a.key,
        toKey: b.key,
      });
    }
    arcsRef.current = arcs;
    const arcStartTime = performance.now();
    const ARC_DRAW_MS = 1400;

    const hemi = new THREE.HemisphereLight(0x9eb6ff, 0x080810, 0.55);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 1.35);
    sun.position.set(260, 80, 180);
    scene.add(sun);

    const ambient = new THREE.AmbientLight(0xffffff, 0.12);
    scene.add(ambient);

    let raf = 0;
    let isHovering = false;
    let lastTime = 0;

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
        return;
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
        }
      }
    };

    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const factor = Math.exp(ev.deltaY * 0.0015);
      distanceRef.current = clampDist(distanceRef.current * factor);
    };

    const onPointerLeave = () => {
      if (!dragging) {
        setLabel(null);
        isHovering = false;
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
  };
  useEffect(() => {
    focusMarkerRef.current = focusOnMarker;
  });

  /** ESC закрывает focus-режим. */
  useEffect(() => {
    if (!focused) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        targetYawRef.current = null;
        targetPitchRef.current = null;
        targetDistRef.current = null;
        setFocused(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focused]);
  const zoom = (factor: number) => {
    distanceRef.current = Math.max(
      MIN_DIST,
      Math.min(MAX_DIST, distanceRef.current * factor),
    );
  };

  return (
    <div
      role="region"
      aria-label="AEVION ecosystem 3D globe — drag to rotate, scroll to zoom"
      style={{
        position: "relative",
        width: "100%",
        minHeight: globeHeight,
        height: globeHeight,
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
            placeholder="Search"
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

      {!initError && !isNarrow ? (
        <div
          style={{
            position: "absolute",
            top: 64,
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
        </div>
      ) : null}

      {!initError ? (
        <div
          style={{
            position: "absolute",
            top: 64,
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
            title="Reset view"
            aria-label="Reset view"
            onClick={resetView}
            style={ctrlBtn}
          >
            ⌂
          </button>
        </div>
      ) : null}

      {!initError ? (
        <div
          style={{
            position: "absolute",
            left: 14,
            bottom: 14,
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
          drag · scroll to zoom
        </div>
      ) : null}

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
            </div>
          </div>
        );
      })() : null}
    </div>
  );
}
