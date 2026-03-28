"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl, getBackendOrigin } from "@/lib/apiBase";
import Globus3D from "./components/Globus3D";
import Globus3DPlaceholder from "./components/Globus3DPlaceholder";
import { PlanetPulse } from "./components/PlanetPulse";

type ModuleRuntime = {
  tier: "mvp_live" | "platform_api" | "portal_only";
  primaryPath: string | null;
  apiHints: string[];
  hint: string;
};

type GlobusProject = {
  id: string;
  code: string;
  name: string;
  description: string;
  kind: string;
  status: string;
  priority: number;
  tags: string[];
  runtime?: ModuleRuntime;
};

const btnPrimary: CSSProperties = {
  display: "inline-block",
  padding: "12px 20px",
  borderRadius: 12,
  background: "#0d9488",
  color: "#fff",
  fontWeight: 800,
  textDecoration: "none",
  fontSize: 15,
  border: "none",
  boxShadow: "0 4px 14px rgba(13,148,136,0.35)",
};

const btnGhost: CSSProperties = {
  display: "inline-block",
  padding: "12px 20px",
  borderRadius: 12,
  background: "rgba(255,255,255,0.12)",
  color: "#fff",
  fontWeight: 700,
  textDecoration: "none",
  fontSize: 15,
  border: "1px solid rgba(255,255,255,0.35)",
};

export default function HomePage() {
  /** Только после mount: избегаем гонок ref/layout и проблем с отдельным async-чанком `dynamic()`. */
  const [globeClient, setGlobeClient] = useState(false);
  useEffect(() => {
    setGlobeClient(true);
  }, []);

  const [projects, setProjects] = useState<GlobusProject[]>([]);
  const [qrightObjects, setQRightObjects] = useState<
    Array<{ id: string; title: string; country?: string; city?: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [qrightError, setQrightError] = useState<string | null>(null);
  const [planetStats, setPlanetStats] = useState<{
    eligibleParticipants: number;
    distinctVotersAllTime: number;
    certifiedArtifactVersions: number;
    submissions: number;
  } | null>(null);

  const [selectedGeo, setSelectedGeo] = useState<{
    country?: string;
    city?: string;
  }>({});

  const navigate = useCallback((href: string) => {
    window.location.href = href;
  }, []);

  const onSelectLocation = useCallback((geo: { country?: string; city?: string }) => {
    setSelectedGeo(geo);
  }, []);

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      setProjectsError(null);
      setQrightError(null);

      try {
        const [pr, qr, ps] = await Promise.all([
          fetch(apiUrl("/api/globus/projects")),
          fetch(apiUrl("/api/qright/objects")),
          fetch(apiUrl("/api/planet/stats")).catch(() => null),
        ]);

        if (pr.ok) {
          const projectsData = await pr.json().catch(() => ({}));
          setProjects(projectsData.items || []);
        } else {
          setProjects([]);
          setProjectsError("Не удалось загрузить узлы Globus (/api/globus/projects).");
        }

        if (qr.ok) {
          const objectsData = await qr.json().catch(() => ({}));
          setQRightObjects(objectsData.items || []);
        } else {
          setQRightObjects([]);
          setQrightError("Маркеры QRight на глобусе недоступны (/api/qright/objects).");
        }

        if (ps && ps.ok) {
          const pj = await ps.json().catch(() => null);
          if (pj) {
            setPlanetStats({
              eligibleParticipants: pj.eligibleParticipants ?? 0,
              distinctVotersAllTime: pj.distinctVotersAllTime ?? 0,
              certifiedArtifactVersions: pj.certifiedArtifactVersions ?? 0,
              submissions: pj.submissions ?? 0,
            });
          }
        }
      } catch {
        setProjects([]);
        setQRightObjects([]);
        setProjectsError(
          "Сеть: backend недоступен. Запустите API на порту 4001 — фронт по умолчанию проксирует запросы через /api-backend.",
        );
        setQrightError("Те же условия для QRight.");
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const sortedProjects = useMemo(() => {
    const priority: Record<string, number> = {
      qright: -10,
      qsign: -9,
      "aevion-ip-bureau": -8,
      globus: -7,
      qcoreai: -6,
      "multichat-engine": -5,
    };

    return [...projects].sort((a, b) => {
      const ap = priority[a.id] ?? 0;
      const bp = priority[b.id] ?? 0;
      if (ap !== bp) return ap - bp;
      return a.name.localeCompare(b.name);
    });
  }, [projects]);

  const globeProjectsForMap = useMemo(() => {
    const awardIds = new Set(["aevion-awards-music", "aevion-awards-film"]);
    const pins: GlobusProject[] = [
      {
        id: "aevion-awards-music",
        code: "AWM",
        name: "Премия — музыка",
        description: "AEVION Music Awards (Planet, тип music)",
        kind: "product",
        status: "in_progress",
        priority: 2,
        tags: ["awards", "music", "planet"],
        runtime: {
          tier: "mvp_live",
          primaryPath: "/awards/music",
          apiHints: [],
          hint: "Витрина премии",
        },
      },
      {
        id: "aevion-awards-film",
        code: "AWF",
        name: "Премия — кино",
        description: "AEVION Film Awards (Planet, тип movie)",
        kind: "product",
        status: "in_progress",
        priority: 2,
        tags: ["awards", "film", "planet"],
        runtime: {
          tier: "mvp_live",
          primaryPath: "/awards/film",
          apiHints: [],
          hint: "Витрина премии",
        },
      },
    ];
    const rest = sortedProjects.filter((p) => !awardIds.has(p.id));
    return [...pins, ...rest];
  }, [sortedProjects]);

  const focusCount = 3;
  const focusIds = useMemo(
    () => sortedProjects.slice(0, focusCount).map((p) => p.id),
    [sortedProjects]
  );

  const directLinks: Record<string, string> = useMemo(
    () => ({
      qright: "/qright",
      qsign: "/qsign",
      "aevion-ip-bureau": "/bureau",
      qtradeoffline: "/qtrade",
      qcoreai: "/qcoreai",
      "multichat-engine": "/multichat-engine",
    }),
    []
  );

  const tierStyle = (tier: ModuleRuntime["tier"] | undefined) => {
    if (tier === "mvp_live")
      return { bg: "rgba(10,120,60,0.12)", fg: "#064", label: "LIVE" };
    if (tier === "platform_api")
      return { bg: "rgba(0,80,180,0.12)", fg: "#024", label: "API" };
    return { bg: "rgba(100,100,100,0.1)", fg: "#444", label: "HUB" };
  };

  const backendOrigin = getBackendOrigin();

  return (
    <main style={{ padding: 0 }}>
      <section
        style={{
          background: "linear-gradient(145deg, #0f172a 0%, #115e59 48%, #0d9488 100%)",
          color: "#fff",
          padding: "44px 24px 52px",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div
            style={{
              display: "inline-block",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "6px 12px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            Продуктовый MVP · готово к демонстрации
          </div>
          <h1
            style={{
              fontSize: "clamp(26px, 4.5vw, 42px)",
              fontWeight: 800,
              lineHeight: 1.12,
              margin: "18px 0 14px",
              maxWidth: 920,
              letterSpacing: "-0.03em",
            }}
          >
            Инфраструктура доверия для цифровых активов и интеллектуальной собственности
          </h1>
          <p
            style={{
              fontSize: "clamp(15px, 2vw, 18px)",
              opacity: 0.93,
              maxWidth: 760,
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Единый контур для инвестиционной и партнёрской оценки: идентичность, реестр объектов,
            криптоподпись, патентное бюро и слой compliance — на интерактивной карте экосистемы с{" "}
            <strong>27 продуктовыми узлами</strong> и открытыми API.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 28 }}>
            <Link href="/auth" style={btnPrimary}>
              Начать с идентичности (Auth)
            </Link>
            <Link href="/qright" style={btnGhost}>
              Реестр QRight
            </Link>
            <Link href="/awards/music" style={btnGhost}>
              Премия — музыка
            </Link>
            <Link href="/awards/film" style={btnGhost}>
              Премия — кино
            </Link>
            <Link
              href="/demo"
              style={{
                ...btnGhost,
                border: "2px solid rgba(255,255,255,0.55)",
                background: "rgba(255,255,255,0.18)",
              }}
            >
              Полная демонстрация →
            </Link>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: 12,
              marginTop: 40,
            }}
          >
            {[
              { k: "Узлов на карте", v: loading ? "…" : String(projects.length) },
              { k: "Записей QRight", v: loading ? "…" : String(qrightObjects.length) },
              { k: "Planet участников", v: planetStats ? String(planetStats.eligibleParticipants) : "…" },
              { k: "Сертифицировано", v: planetStats ? String(planetStats.certifiedArtifactVersions) : "…" },
              { k: "Заявок Planet", v: planetStats ? String(planetStats.submissions) : "…" },
              { k: "Стек", v: "Next + Node + PG" },
            ].map((row) => (
              <div
                key={row.k}
                style={{
                  padding: "14px 16px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.14)",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.75, textTransform: "uppercase" }}>
                  {row.k}
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{row.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 14,
            marginBottom: 28,
          }}
        >
          {[
            {
              t: "QRight",
              d: "Реестр объектов с хешем содержимого и привязкой к владельцу и локации.",
              href: "/qright",
            },
            {
              t: "QSign",
              d: "Целостность данных через HMAC — тот же формат payload, что и в бюро.",
              href: "/qsign",
            },
            {
              t: "IP Bureau",
              d: "Подпись и проверка карточек реестра — готовность к сертификату.",
              href: "/bureau",
            },
            {
              t: "Planet",
              d: "Compliance, evidence root и прозрачность для регуляторного рассказа.",
              href: "/planet",
            },
            {
              t: "Премия — музыка",
              d: "Витрина AEVION Music Awards: подача в Planet (music) и голоса участников.",
              href: "/awards/music",
            },
            {
              t: "Премия — кино",
              d: "Витрина AEVION Film Awards: подача в Planet (movie) и голоса участников.",
              href: "/awards/film",
            },
          ].map((c) => (
            <Link
              key={c.t}
              href={c.href}
              style={{
                textDecoration: "none",
                color: "inherit",
                padding: 18,
                borderRadius: 16,
                border: "1px solid rgba(15,23,42,0.1)",
                background: "#fff",
                boxShadow: "0 2px 12px rgba(15,23,42,0.06)",
                display: "block",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 16, color: "#0f172a", marginBottom: 8 }}>{c.t}</div>
              <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{c.d}</div>
            </Link>
          ))}
        </section>

        {planetStats ? (
          <section
            style={{
              marginBottom: 20,
              padding: "18px 20px",
              borderRadius: 16,
              border: "1px solid rgba(15,118,110,0.2)",
              background: "linear-gradient(135deg, rgba(15,118,110,0.06), rgba(99,102,241,0.04))",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 20 }}>🌍</span>
              <div style={{ fontWeight: 900, fontSize: 15, color: "#0f766e" }}>
                Planet Ecosystem — live
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 10,
                marginBottom: 14,
              }}
            >
              {[
                { label: "Участников (Y)", value: planetStats.eligibleParticipants },
                { label: "Голосовавших", value: planetStats.distinctVotersAllTime },
                { label: "Заявок", value: planetStats.submissions },
                { label: "Сертификатов", value: planetStats.certifiedArtifactVersions },
              ].map((m) => (
                <div
                  key={m.label}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(15,118,110,0.15)",
                    background: "rgba(255,255,255,0.7)",
                  }}
                >
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>{m.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#0f766e", marginTop: 4 }}>{m.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link
                href="/planet"
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  background: "#0f766e",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                Planet Lab →
              </Link>
              <Link
                href="/awards"
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(15,118,110,0.3)",
                  color: "#0f766e",
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                Премии Awards →
              </Link>
              <Link
                href="/awards/music"
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(124,58,237,0.3)",
                  color: "#4c1d95",
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                🎵 Музыка
              </Link>
              <Link
                href="/awards/film"
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(180,83,9,0.3)",
                  color: "#92400e",
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                🎬 Кино
              </Link>
            </div>
          </section>
        ) : null}

        <PlanetPulse />

        {projectsError ? (
          <div
            style={{
              marginBottom: 14,
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(180,40,40,0.08)",
              border: "1px solid rgba(180,40,40,0.25)",
              color: "#611",
              lineHeight: 1.5,
            }}
          >
            <b>Список узлов:</b> {projectsError}
            <div style={{ marginTop: 6, fontSize: 13, color: "#722" }}>
              Глобус справа всё равно отображается. Запустите backend на 4001; при необходимости задайте{" "}
              <code>BACKEND_PROXY_TARGET</code> в сборке и <code>NEXT_PUBLIC_API_BASE_URL</code> для прямого URL.
            </div>
          </div>
        ) : null}

        <div
          style={{
            marginBottom: 16,
            padding: "14px 16px",
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,0.1)",
            background: "linear-gradient(135deg, rgba(10,90,60,0.06), rgba(0,60,120,0.05))",
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8, color: "#111" }}>
            Демо-контур «волна 1»
          </div>
          <div style={{ fontSize: 14, color: "#444", marginBottom: 10 }}>
            Auth → QRight → QSign → Bureau. Слева каталог узлов, справа глобус (липкий столбец).
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { href: "/auth", label: "1 · Auth" },
              { href: "/qright", label: "2 · QRight" },
              { href: "/qsign", label: "3 · QSign" },
              { href: "/bureau", label: "4 · Bureau" },
            ].map((x) => (
              <Link
                key={x.href}
                href={x.href}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #111",
                  textDecoration: "none",
                  color: "#111",
                  fontWeight: 700,
                  fontSize: 13,
                  background: "#fff",
                }}
              >
                {x.label}
              </Link>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 18, color: "#475569", fontSize: 15 }}>
          Интерактивный 3D Globus: узлы кликабельны. Любой из модулей открывает тот же продуктовый контур на
          странице узла.
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 18,
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <section style={{ flex: "1 1 420px", minWidth: 0, order: 1 }}>
            <div style={{ fontSize: 14, color: "#64748b", marginBottom: 12 }}>
              Каталог экосистемы:{" "}
              <b style={{ color: "#0f172a" }}>{loading ? "…" : projects.length}</b>
              {loading ? (
                <span style={{ marginLeft: 8, color: "#94a3b8" }}>загрузка…</span>
              ) : null}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link
                href="/qright"
                style={{
                  border: "1px solid #0f172a",
                  borderRadius: 10,
                  padding: "10px 12px",
                  textDecoration: "none",
                  color: "#0f172a",
                  fontWeight: 650,
                }}
              >
                QRight
              </Link>
              <Link
                href="/qsign"
                style={{
                  border: "1px solid #0f172a",
                  borderRadius: 10,
                  padding: "10px 12px",
                  textDecoration: "none",
                  color: "#0f172a",
                  fontWeight: 650,
                }}
              >
                QSign
              </Link>
              <Link
                href="/bureau"
                style={{
                  border: "1px solid #0f172a",
                  borderRadius: 10,
                  padding: "10px 12px",
                  textDecoration: "none",
                  color: "#0f172a",
                  fontWeight: 650,
                }}
              >
                IP Bureau
              </Link>
              <Link
                href="/planet"
                style={{
                  border: "1px solid #0f172a",
                  borderRadius: 10,
                  padding: "10px 12px",
                  textDecoration: "none",
                  color: "#0f172a",
                  fontWeight: 650,
                }}
              >
                Planet
              </Link>
              <Link
                href="/qcoreai"
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  padding: "10px 12px",
                  textDecoration: "none",
                  color: "#475569",
                  fontWeight: 650,
                }}
              >
                QCoreAI
              </Link>
              <Link
                href="/auth"
                style={{
                  border: "1px solid #0f172a",
                  borderRadius: 10,
                  padding: "10px 12px",
                  textDecoration: "none",
                  color: "#0f172a",
                  fontWeight: 650,
                }}
              >
                Auth
              </Link>
              <a
                href={`${backendOrigin}/api/openapi.json`}
                target="_blank"
                rel="noreferrer"
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  padding: "10px 12px",
                  textDecoration: "none",
                  color: "#475569",
                  fontWeight: 650,
                }}
              >
                OpenAPI
              </a>
              <a
                href={`${backendOrigin}/api/modules/status`}
                target="_blank"
                rel="noreferrer"
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  padding: "10px 12px",
                  textDecoration: "none",
                  color: "#475569",
                  fontWeight: 650,
                }}
              >
                Modules
              </a>
            </div>

            <div style={{ marginTop: 14, color: "#64748b", lineHeight: 1.5, fontSize: 13 }}>
              Данные из API; поле <code>runtime</code> — для мониторинга и интеграций.
            </div>

            <div
              style={{
                marginTop: 18,
                maxHeight: 340,
                overflowY: "auto",
                paddingRight: 6,
              }}
            >
              {sortedProjects.map((p) => {
                const ts = tierStyle(p.runtime?.tier);
                const hasPlanet = p.tags?.includes("planet") || p.tags?.includes("awards") ||
                  ["qright", "qsign", "aevion-ip-bureau"].includes(p.id);
                return (
                  <div key={p.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Link
                        href={directLinks[p.id] ?? `/${p.id}`}
                        style={{ color: "#0f172a", textDecoration: "none", fontWeight: 600 }}
                      >
                        {p.code}: {p.name}
                      </Link>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "2px 6px",
                          borderRadius: 6,
                          background: ts.bg,
                          color: ts.fg,
                        }}
                      >
                        {ts.label}
                      </span>
                      {hasPlanet ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: "2px 6px",
                            borderRadius: 6,
                            background: "rgba(15,118,110,0.12)",
                            color: "#0f766e",
                          }}
                        >
                          🌍 PLANET
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {p.kind} • {p.status}
                      {p.runtime?.hint ? ` — ${p.runtime.hint}` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section
            style={{
              flex: "0 1 420px",
              width: "100%",
              maxWidth: 560,
              minWidth: 280,
              order: 2,
              position: "sticky",
              top: 72,
              alignSelf: "flex-start",
            }}
          >
            {qrightError ? (
              <div
                style={{
                  marginBottom: 10,
                  fontSize: 12,
                  color: "#844",
                  padding: "8px 10px",
                  borderRadius: 10,
                  background: "rgba(180,120,0,0.08)",
                  border: "1px solid rgba(180,120,0,0.2)",
                }}
              >
                {qrightError}
              </div>
            ) : null}
            {globeClient ? (
              <Globus3D
                projects={globeProjectsForMap}
                qrightObjects={qrightObjects}
                focusProjectIds={focusIds}
                onNavigate={navigate}
                onSelectLocation={onSelectLocation}
              />
            ) : (
              <Globus3DPlaceholder />
            )}

            <div style={{ marginTop: 12, color: "#64748b", lineHeight: 1.6, fontSize: 14 }}>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Globus · справа</div>
              <div>
                Локация:{" "}
                <b style={{ color: "#0f172a" }}>
                  {(selectedGeo.city || "—") + (selectedGeo.country ? `, ${selectedGeo.country}` : "")}
                </b>
              </div>
              <button
                type="button"
                onClick={() => {
                  const c = selectedGeo.country || "";
                  const ci = selectedGeo.city || "";
                  const qs = new URLSearchParams();
                  if (c) qs.set("country", c);
                  if (ci) qs.set("city", ci);
                  const href = `/qright${qs.toString() ? `?${qs.toString()}` : ""}`;
                  navigate(href);
                }}
                style={{
                  marginTop: 10,
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "none",
                  background: "#0f172a",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 14,
                }}
              >
                Создать объект в QRight здесь
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
