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
  runtime?: { tier: string; hint?: string };
};

type QRightObject = {
  id: string;
  title: string;
  country?: string;
  city?: string;
};

type Marker = {
  key: string;
  type: "project" | "qright";
  label: string;
  sublabel?: string;
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
  const [label, setLabel] = useState<{
    text: string;
    sub?: string;
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

      return {
        key: `project:${p.id}`,
        type: "project",
        label: p.code,
        sublabel:
          g.city +
          ", " +
          g.country +
          (p.runtime?.tier ? ` • ${tierShort(p.runtime.tier)}` : ""),
        href,
        country: g.country,
        city: g.city,
        lat: g.lat,
        lon: g.lon,
        color: isFocus ? 0xffcc66 : isAwardPin ? 0xff44cc : 0x66c2ff,
        size: isFocus ? 6 : isAwardPin ? 5 : 4,
      };
    });

    const objectMarkers: Marker[] = qrightObjects.map((o) => {
      const g = objectGeo(o);
      return {
        key: `qright:${o.id}`,
        type: "qright",
        label: o.title,
        sublabel: g.city + ", " + g.country,
        href: `/bureau?objectId=${encodeURIComponent(o.id)}`,
        country: g.country,
        city: g.city,
        lat: g.lat,
        lon: g.lon,
        color: 0x44ff99,
        size: 4,
      };
    });

    return [...projectMarkers, ...objectMarkers];
  }, [projects, qrightObjects, focusProjectIds]);

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
    camera.position.set(0, 0, 248);

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
    const markerMeshes: Array<{ mesh: THREE.Mesh; marker: Marker }> = [];

    for (const m of markers) {
      const p = geoFromLatLon(m.lat, m.lon, radius + 1.2);
      const markerGeo = new THREE.SphereGeometry(m.size, 16, 16);
      const markerMat = new THREE.MeshBasicMaterial({ color: m.color });
      const mesh = new THREE.Mesh(markerGeo, markerMat);
      mesh.position.set(p.x, p.y, p.z);
      mesh.userData = { key: m.key };
      earthGroup.add(mesh);
      markerMeshes.push({ mesh, marker: m });
    }

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

    const onMouseMove = (ev: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(
        markerMeshes.map((x) => x.mesh),
        false
      );

      if (!intersects.length) {
        setLabel(null);
        isHovering = false;
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
        text: found.marker.label,
        sub: found.marker.sublabel,
        screenX: sx,
        screenY: sy,
        marker: found.marker,
      };
      labelRef.current = nextLabel;
      setLabel(nextLabel);
      isHovering = true;
    };

    const onClick = () => {
      const cur = labelRef.current;
      if (!cur) return;
      if (!cur.marker.href) return;
      onNavigateRef.current(cur.marker.href);
      onSelectLocationRef.current({
        country: cur.marker.country,
        city: cur.marker.city,
      });
    };

    const animate = (t: number) => {
      raf = requestAnimationFrame(animate);
      const dt = t - lastTime;
      lastTime = t;

      if (!isHovering) {
        earthGroup.rotation.y += dt * 0.000028 * 60;
      }

      renderer.render(scene, camera);
    };

    window.addEventListener("resize", resize);
    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("click", onClick);

    requestAnimationFrame(() => resize());

    raf = requestAnimationFrame(animate);

    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", resize);
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("click", onClick);
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

  return (
    <div style={{ position: "relative", width: "100%", minHeight: 520, height: 520 }}>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: 520,
          minHeight: 520,
          borderRadius: 9999,
          border: "1px solid rgba(40,55,90,0.45)",
          overflow: "hidden",
          background:
            "radial-gradient(ellipse 120% 100% at 50% 35%, #0c1528 0%, #02040a 55%, #000005 100%)",
          boxShadow:
            "inset 0 0 80px rgba(60,100,180,0.12), 0 24px 48px rgba(0,0,0,0.35)",
        }}
      />

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

      {label ? (
        <div
          style={{
            position: "absolute",
            left: label.screenX,
            top: label.screenY,
            transform: "translate(-50%, -110%)",
            pointerEvents: "none",
            maxWidth: 320,
          }}
        >
          <div
            style={{
              background: "rgba(12,18,32,0.88)",
              border: "1px solid rgba(120,160,220,0.35)",
              borderRadius: 14,
              padding: "10px 12px",
              boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
              backdropFilter: "blur(10px)",
            }}
          >
            <div style={{ fontWeight: 850, fontSize: 13, color: "#f0f4ff" }}>
              {label.text}
            </div>
            {label.sub ? (
              <div style={{ marginTop: 4, fontSize: 12, color: "#a8b8d8" }}>
                {label.sub}
              </div>
            ) : null}
            <div style={{ marginTop: 8, fontSize: 12, color: "#7a8fb0" }}>
              click: open / select location
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
