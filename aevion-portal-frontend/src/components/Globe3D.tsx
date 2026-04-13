"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export interface AppDot {
  id: string;
  label: string;
  lat: number;
  lon: number;
  color: string;
  href: string;
}

// All 29 projects based around Astana, Kazakhstan (51.1°N, 71.4°E)
// Spread in a cluster so they don't overlap
const APPS: AppDot[] = [
  // Core
  { id: "globus", label: "GLOBUS", lat: 51.1, lon: 71.4, color: "#4f46e5", href: "/" },
  { id: "qcoreai", label: "QCoreAI", lat: 51.6, lon: 72.2, color: "#8b5cf6", href: "/qcore" },
  { id: "qright", label: "QRight", lat: 50.6, lon: 70.5, color: "#16a34a", href: "/qright" },
  { id: "qsign", label: "QSign", lat: 51.9, lon: 70.1, color: "#2563eb", href: "/qsign" },
  { id: "aipb", label: "IP Bureau", lat: 50.2, lon: 72.8, color: "#7c3aed", href: "/aevion-ip-bureau" },
  // Products
  { id: "multichat", label: "Multichat", lat: 52.4, lon: 73.5, color: "#a855f7", href: "/qcore" },
  { id: "qfusionai", label: "QFusionAI", lat: 52.8, lon: 71.0, color: "#6366f1", href: "#" },
  { id: "qtradeoffline", label: "QTradeOffline", lat: 49.8, lon: 69.5, color: "#0d9488", href: "/qtrade" },
  { id: "qpaynet", label: "QPayNet", lat: 50.0, lon: 73.8, color: "#059669", href: "#" },
  { id: "qmaskcard", label: "QMaskCard", lat: 49.5, lon: 71.8, color: "#0891b2", href: "#" },
  { id: "veilnetx", label: "VeilNetX", lat: 52.2, lon: 68.5, color: "#7c3aed", href: "#" },
  { id: "cyberchess", label: "CyberChess", lat: 50.8, lon: 68.0, color: "#475569", href: "/cyberchess" },
  { id: "healthai", label: "HealthAI", lat: 53.2, lon: 72.5, color: "#dc2626", href: "#" },
  { id: "qlife", label: "QLife", lat: 53.5, lon: 70.5, color: "#e11d48", href: "#" },
  { id: "qgood", label: "QGood", lat: 49.2, lon: 68.5, color: "#f59e0b", href: "#" },
  { id: "psyapp", label: "PsyApp", lat: 48.8, lon: 70.8, color: "#d97706", href: "#" },
  { id: "qpersona", label: "QPersona", lat: 53.0, lon: 68.0, color: "#ec4899", href: "#" },
  { id: "kids-ai", label: "Kids AI", lat: 48.5, lon: 73.2, color: "#f97316", href: "#" },
  { id: "voice-of-earth", label: "Voice of Earth", lat: 52.6, lon: 74.5, color: "#eab308", href: "#" },
  { id: "startup-exchange", label: "StartupX", lat: 49.5, lon: 74.5, color: "#84cc16", href: "#" },
  { id: "deepsan", label: "DeepSan", lat: 48.2, lon: 72.0, color: "#06b6d4", href: "#" },
  { id: "mapreality", label: "MapReality", lat: 53.8, lon: 73.8, color: "#14b8a6", href: "#" },
  { id: "z-tide", label: "Z-Tide", lat: 48.0, lon: 69.5, color: "#a78bfa", href: "#" },
  { id: "qcontract", label: "QContract", lat: 54.0, lon: 69.5, color: "#f43f5e", href: "#" },
  { id: "shadownet", label: "ShadowNet", lat: 47.5, lon: 71.5, color: "#334155", href: "#" },
  { id: "lifebox", label: "LifeBox", lat: 54.5, lon: 71.5, color: "#10b981", href: "#" },
  { id: "qchaingov", label: "QChainGov", lat: 47.8, lon: 73.5, color: "#8b5cf6", href: "#" },
  // Music & Cinema
  { id: "ai-music", label: "AI Music", lat: 51.4, lon: 69.0, color: "#f97316", href: "/ai-music" },
  { id: "ai-cinema", label: "AI Cinema", lat: 50.4, lon: 74.0, color: "#ec4899", href: "/ai-cinema" },
];

function latLonToVec3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

export default function Globe3D({ onSelectApp }: { onSelectApp?: (app: AppDot) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const prevMouse = useRef({ x: 0, y: 0 });
  const rotationVel = useRef({ x: 0, y: 0 });
  const labelsRef = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const w = container.clientWidth;
    const h = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    camera.position.z = 3.2;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const globe = new THREE.Group();
    // Start rotated to show Kazakhstan
    globe.rotation.y = -1.25;
    globe.rotation.x = 0.15;
    scene.add(globe);

    const textureLoader = new THREE.TextureLoader();
    const earthTexture = textureLoader.load("/textures/earth.png");
    earthTexture.colorSpace = THREE.SRGBColorSpace;

    const sphereGeo = new THREE.SphereGeometry(1, 64, 64);
    const sphereMat = new THREE.MeshStandardMaterial({ map: earthTexture, roughness: 0.8, metalness: 0.0 });
    globe.add(new THREE.Mesh(sphereGeo, sphereMat));

    // Atmosphere
    const glowGeo = new THREE.SphereGeometry(1.04, 64, 64);
    const glowMat = new THREE.ShaderMaterial({
      vertexShader: `varying vec3 vNormal; void main() { vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 vNormal; void main() { float i = pow(0.6 - dot(vNormal, vec3(0,0,1)), 2.0); gl_FragColor = vec4(0.4, 0.6, 1.0, 1.0) * i * 0.5; }`,
      blending: THREE.AdditiveBlending, side: THREE.BackSide, transparent: true,
    });
    globe.add(new THREE.Mesh(glowGeo, glowMat));

    // Dots
    const dotGroup = new THREE.Group();
    globe.add(dotGroup);

    APPS.forEach((app) => {
      const pos = latLonToVec3(app.lat, app.lon, 1.015);
      const dotGeo = new THREE.SphereGeometry(0.012, 12, 12);
      const dotMat = new THREE.MeshBasicMaterial({ color: app.color });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(pos);
      dot.userData = app;
      dotGroup.add(dot);

      const glowDotGeo = new THREE.SphereGeometry(0.025, 12, 12);
      const glowDotMat = new THREE.MeshBasicMaterial({ color: app.color, transparent: true, opacity: 0.2 });
      const gd = new THREE.Mesh(glowDotGeo, glowDotMat);
      gd.position.copy(pos);
      dotGroup.add(gd);
    });

    // Labels
    labelsRef.current = [];
    APPS.forEach((app) => {
      const label = document.createElement("div");
      label.textContent = app.label;
      label.style.cssText = `position:absolute;pointer-events:auto;cursor:pointer;font-size:9px;font-weight:600;color:${app.color};background:rgba(255,255,255,0.93);padding:2px 7px;border-radius:6px;border:1px solid ${app.color}30;white-space:nowrap;transition:opacity 0.3s,transform 0.3s;box-shadow:0 1px 4px rgba(0,0,0,0.06);`;
      label.addEventListener("click", () => { if (onSelectApp) onSelectApp(app); else if (app.href !== "#") window.location.href = app.href; });
      label.addEventListener("mouseenter", () => { label.style.transform = "translate(-50%, -140%) scale(1.15)"; label.style.fontSize = "11px"; label.style.zIndex = "100"; });
      label.addEventListener("mouseleave", () => { label.style.transform = "translate(-50%, -130%)"; label.style.fontSize = "9px"; label.style.zIndex = "1"; });
      container.appendChild(label);
      labelsRef.current.push(label);
    });

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 2.0));
    const sun = new THREE.DirectionalLight(0xffffff, 2.5);
    sun.position.set(5, 3, 5);
    scene.add(sun);
    scene.add(new THREE.DirectionalLight(0xaabbff, 0.8).translateX(-5));

    // Interaction
    const onDown = (e: MouseEvent) => { isDragging.current = true; prevMouse.current = { x: e.clientX, y: e.clientY }; rotationVel.current = { x: 0, y: 0 }; };
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - prevMouse.current.x;
      const dy = e.clientY - prevMouse.current.y;
      rotationVel.current = { x: dy * 0.003, y: dx * 0.003 };
      globe.rotation.y += dx * 0.005;
      globe.rotation.x += dy * 0.005;
      globe.rotation.x = Math.max(-1.2, Math.min(1.2, globe.rotation.x));
      prevMouse.current = { x: e.clientX, y: e.clientY };
    };
    const onUp = () => { isDragging.current = false; };

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const onClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(dotGroup.children);
      if (hits.length > 0 && hits[0].object.userData?.href) {
        const app = hits[0].object.userData as AppDot;
        if (onSelectApp) onSelectApp(app);
        else if (app.href !== "#") window.location.href = app.href;
      }
    };

    renderer.domElement.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    renderer.domElement.addEventListener("click", onClick);

    let frameId: number;
    let time = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      time += 0.016;

      if (!isDragging.current) {
        globe.rotation.y += 0.001;
        globe.rotation.y += rotationVel.current.y;
        globe.rotation.x += rotationVel.current.x;
        rotationVel.current.x *= 0.95;
        rotationVel.current.y *= 0.95;
      }

      APPS.forEach((app, i) => {
        const pos = latLonToVec3(app.lat, app.lon, 1.05);
        const worldPos = pos.clone();
        globe.localToWorld(worldPos);
        const screenPos = worldPos.clone().project(camera);
        const label = labelsRef.current[i];
        if (label) {
          const x = (screenPos.x * 0.5 + 0.5) * w;
          const y = (-screenPos.y * 0.5 + 0.5) * h;
          const dotWorld = latLonToVec3(app.lat, app.lon, 1.01);
          globe.localToWorld(dotWorld);
          const camDir = new THREE.Vector3();
          camera.getWorldDirection(camDir);
          const dotDir = dotWorld.clone().sub(camera.position).normalize();
          const facing = dotDir.dot(camDir);
          label.style.left = x + "px";
          label.style.top = y + "px";
          label.style.transform = "translate(-50%, -130%)";
          label.style.opacity = facing < 0.3 ? "0" : String(Math.min(1, (facing - 0.3) * 3));
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => { const nw = container.clientWidth; const nh = container.clientHeight; camera.aspect = nw / nh; camera.updateProjectionMatrix(); renderer.setSize(nw, nh); };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameId);
      renderer.domElement.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      renderer.domElement.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
      labelsRef.current.forEach(l => l.remove());
      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [onSelectApp]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", borderRadius: 16, cursor: "grab" }} />;
}