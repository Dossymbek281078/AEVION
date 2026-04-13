"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4001";

type Project = {
  id: string;
  code: string;
  name: string;
  description: string;
  kind: string;
  status: string;
  priority: number;
  tags: string[];
};

type ModuleHealth = {
  implemented: boolean;
  status: string;
  endpoints: string[];
  frontendPath?: string | null;
  details: string;
};

type HealthResponse = {
  code: string;
  project: Project;
  module: ModuleHealth;
};

export default function ProjectDetailsPage() {
  const params = useParams();
  const id = useMemo(() => {
    const raw = params?.id;
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw)) return raw[0] ?? "";
    return "";
  }, [params]);

  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`${API_BASE}/api/projects/${id}/health`);
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(body?.error || "Не удалось загрузить проект");
        }
        setData(body as HealthResponse);
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  if (loading) return <div style={{ padding: 20 }}>Загрузка…</div>;
  if (err) return <div style={{ padding: 20 }}>Ошибка: {err}</div>;
  if (!data) return <div style={{ padding: 20 }}>Проект не найден</div>;

  const { project, module } = data;

  return (
    <main style={{ padding: 24, maxWidth: 980 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, marginBottom: 6 }}>{project.name}</h1>
          <div style={{ color: "#666", fontSize: 13 }}>
            {project.code} • {project.kind} • status: {project.status}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/" style={{ color: "#0a5" }}>
            Назад
          </Link>
          {module.implemented && module.frontendPath ? (
            <Link
              href={module.frontendPath}
              style={{
                color: "#0a5",
                textDecoration: "none",
                border: "1px solid #0a5",
                borderRadius: 8,
                padding: "8px 12px",
                display: "inline-block",
                fontSize: 13,
              }}
            >
              Открыть модуль
            </Link>
          ) : null}
        </div>
      </div>

      <p style={{ color: "#333", marginTop: 14 }}>{project.description}</p>

      <section
        style={{
          marginTop: 22,
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 14,
        }}
      >
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Модуль</h2>
        <div style={{ color: "#666" }}>
          implemented: <b>{String(module.implemented)}</b>
        </div>
        <div style={{ marginTop: 6, color: "#666" }}>
          status: <b>{module.status}</b>
        </div>
        <div style={{ marginTop: 10 }}>{module.details}</div>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>
            Доступные endpoints
          </div>
          {module.endpoints.length === 0 ? (
            <div style={{ color: "#666" }}>Пока нет.</div>
          ) : (
            <div style={{ fontFamily: "monospace", fontSize: 12 }}>
              {module.endpoints.map((ep) => (
                <div key={ep} style={{ padding: "2px 0" }}>
                  {ep}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

