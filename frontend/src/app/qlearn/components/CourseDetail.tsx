"use client";

import React, { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

/**
 * Экран курса: уроки, чтение урока, отметка прогресса, завершение и сертификат.
 *
 * До 23.08.2026 на сайте этого не было вовсе. Сайт звал 8 ручек модуля из 25:
 * посмотреть каталог, записаться, поставить закладку. Открыть урок было
 * НЕЛЬЗЯ — кнопка «продолжить» просто прокручивала страницу к карточке курса,
 * и в коде рядом стоял комментарий «no dedicated detail page yet».
 *
 * Модуль при этом продаётся за $15/мес и входит в medium/full/enterprise.
 *
 * Все ответы читаются через res.ok: пустой список уроков при упавшем хранилище
 * означал бы «курс пуст», а это неправда — бэкенд в таком случае отвечает 503
 * с объяснением, и его надо показать, а не превратить в пустоту.
 */

export interface LessonRef {
  id: string;
  title: string;
  order: number;
  duration: number;
}

interface LessonFull extends LessonRef {
  courseId: string;
  content: string;
  videoUrl: string;
}

interface CourseFull {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  price: number;
  enrollmentCount: number;
}

interface Certificate {
  certificateNumber: string;
  courseTitle: string;
  completedAt: string;
}

const wrap: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 20,
  marginBottom: 24,
};

const backBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#0d9488",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 700,
  padding: 0,
  marginBottom: 14,
};

const primaryBtn: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "none",
  background: "linear-gradient(135deg, #0d9488 0%, #7c3aed 100%)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};

const quietBtn: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  background: "#fff",
  color: "#0f172a",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};

const noticeStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 8,
  background: "#fef3c7",
  border: "1px solid #fde68a",
  color: "#92400e",
  fontSize: 13,
  marginBottom: 14,
};

/** Разобрать ответ так, чтобы сбой не превратился в пустоту. */
async function readJson(res: Response): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }
  return { ok: res.ok, data };
}

function errorText(data: Record<string, unknown>, fallback: string): string {
  const w = typeof data.warning === "string" ? data.warning : null;
  const e = typeof data.error === "string" ? data.error : null;
  return w ?? e ?? fallback;
}

export default function CourseDetail({
  courseId,
  token,
  onBack,
}: {
  courseId: string;
  token: string | null;
  onBack: () => void;
}) {
  const [course, setCourse] = useState<CourseFull | null>(null);
  const [lessons, setLessons] = useState<LessonRef[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [openLesson, setOpenLesson] = useState<LessonFull | null>(null);
  const [lessonError, setLessonError] = useState<string | null>(null);

  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(apiUrl(`/api/qlearn/courses/${courseId}`));
      const { ok, data } = await readJson(res);
      if (!ok) {
        // Сбой загрузки — это НЕ «курс пуст». Пустой экран здесь читался бы
        // как «уроков нет», и человек ушёл бы с оплаченного курса.
        setLoadError(errorText(data, "Не удалось загрузить курс. Попробуйте позже."));
        return;
      }
      setCourse((data.course as CourseFull) ?? null);
      setLessons(Array.isArray(data.lessons) ? (data.lessons as LessonRef[]) : []);
    } catch {
      setLoadError("Сеть недоступна. Курс не загружен.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  const loadMine = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(apiUrl("/api/qlearn/me/enrollments"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const { ok, data } = await readJson(res);
      if (!ok) return;
      const list = Array.isArray(data.enrollments) ? data.enrollments : [];
      const mine = list.find(
        (e) => (e as { courseId?: string }).courseId === courseId,
      ) as { id?: string; progress?: number } | undefined;
      if (!mine?.id) return;
      setEnrollmentId(mine.id);
      setProgress(Number(mine.progress ?? 0));
      const certRes = await fetch(apiUrl(`/api/qlearn/enrollments/${mine.id}/certificate`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const cert = await readJson(certRes);
      if (cert.ok && cert.data.certificate) setCertificate(cert.data.certificate as Certificate);
    } catch {
      /* состояние обучения не критично для показа курса */
    }
  }, [courseId, token]);

  useEffect(() => {
    void load();
    void loadMine();
  }, [load, loadMine]);

  const readLesson = async (lessonId: string) => {
    setLessonError(null);
    try {
      const res = await fetch(apiUrl(`/api/qlearn/courses/${courseId}/lessons/${lessonId}`));
      const { ok, data } = await readJson(res);
      if (!ok) {
        setLessonError(errorText(data, "Урок не открылся. Попробуйте позже."));
        return;
      }
      setOpenLesson((data.lesson as LessonFull) ?? null);
    } catch {
      setLessonError("Сеть недоступна. Урок не открылся.");
    }
  };

  /** Отметить долю пройденного. Сервер — источник правды, экран ждёт ответа. */
  const markProgress = async (value: number) => {
    if (!enrollmentId || !token) {
      setNotice("Запишитесь на курс, чтобы отмечать прогресс.");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(apiUrl(`/api/qlearn/enrollments/${enrollmentId}/progress`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ progress: value }),
      });
      const { ok, data } = await readJson(res);
      if (!ok) {
        // Экран НЕ меняем: иначе провал сохранения выглядит как сохранение.
        setNotice(errorText(data, "Прогресс не сохранён."));
        return;
      }
      const saved = (data.enrollment as { progress?: number } | undefined)?.progress;
      setProgress(Number(saved ?? value));
      if (Number(saved ?? value) === 100) await claimCertificate();
    } catch {
      setNotice("Сеть недоступна. Прогресс не сохранён.");
    } finally {
      setBusy(false);
    }
  };

  const claimCertificate = async () => {
    if (!enrollmentId || !token) return;
    try {
      const res = await fetch(apiUrl(`/api/qlearn/enrollments/${enrollmentId}/complete`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const { ok, data } = await readJson(res);
      if (!ok) {
        setNotice(errorText(data, "Сертификат пока не выдан."));
        return;
      }
      if (data.certificate) setCertificate(data.certificate as Certificate);
    } catch {
      setNotice("Сеть недоступна. Сертификат не запрошен.");
    }
  };

  if (loading) {
    return (
      <div style={wrap}>
        <button onClick={onBack} style={backBtn}>← К каталогу</button>
        <div style={{ color: "#64748b", fontSize: 14 }}>Загружаем курс…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={wrap}>
        <button onClick={onBack} style={backBtn}>← К каталогу</button>
        <div style={noticeStyle}>{loadError}</div>
        <button onClick={() => void load()} style={quietBtn}>Попробовать снова</button>
      </div>
    );
  }

  if (openLesson) {
    return (
      <div style={wrap}>
        <button onClick={() => setOpenLesson(null)} style={backBtn}>← К урокам курса</button>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: "0 0 10px" }}>
          {openLesson.title}
        </h2>
        {openLesson.duration > 0 && (
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
            {openLesson.duration} мин
          </div>
        )}
        <div
          style={{
            fontSize: 15,
            lineHeight: 1.65,
            color: "#334155",
            whiteSpace: "pre-wrap",
            marginBottom: 20,
          }}
        >
          {openLesson.content || "У этого урока пока нет текста."}
        </div>
        {notice && <div style={noticeStyle}>{notice}</div>}
        <LessonFooter
          lessons={lessons}
          current={openLesson}
          progress={progress}
          busy={busy}
          onMark={markProgress}
          onOpen={readLesson}
        />
      </div>
    );
  }

  return (
    <div style={wrap}>
      <button onClick={onBack} style={backBtn}>← К каталогу</button>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "0 0 6px" }}>
        {course?.title ?? "Курс"}
      </h2>
      {course?.description && (
        <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, marginBottom: 16 }}>
          {course.description}
        </div>
      )}

      {enrollmentId && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ height: 8, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "linear-gradient(90deg, #0d9488, #7c3aed)",
                transition: "width 0.3s",
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginTop: 6 }}>
            Пройдено {progress}%
          </div>
        </div>
      )}

      {certificate && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: "#f0fdfa",
            border: "1px solid #ccfbf1",
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, color: "#0f766e" }}>
            Сертификат выдан
          </div>
          <div style={{ fontSize: 13, color: "#334155", marginTop: 4 }}>
            Номер {certificate.certificateNumber}
          </div>
        </div>
      )}

      {notice && <div style={noticeStyle}>{notice}</div>}
      {lessonError && <div style={noticeStyle}>{lessonError}</div>}

      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 10px" }}>
        Уроки {lessons.length > 0 && <span style={{ color: "#94a3b8" }}>· {lessons.length}</span>}
      </h3>

      {lessons.length === 0 ? (
        <div style={{ fontSize: 14, color: "#64748b" }}>
          Автор ещё не добавил уроки в этот курс.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lessons.map((l, i) => (
            <button
              key={l.id}
              onClick={() => void readLesson(l.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#fff",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "#f1f5f9",
                  color: "#0f172a",
                  fontSize: 12,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: 14, color: "#0f172a", fontWeight: 600, flex: 1 }}>
                {l.title}
              </span>
              {l.duration > 0 && (
                <span style={{ fontSize: 12, color: "#94a3b8" }}>{l.duration} мин</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Низ урока: перейти к следующему и отметить пройденное.
 *
 * Доля считается по НОМЕРУ урока в списке, а не «плюс сколько-то процентов»:
 * иначе повторное нажатие на том же уроке накручивало бы прогресс.
 */
function LessonFooter({
  lessons,
  current,
  progress,
  busy,
  onMark,
  onOpen,
}: {
  lessons: LessonRef[];
  current: LessonFull;
  progress: number;
  busy: boolean;
  onMark: (value: number) => void;
  onOpen: (lessonId: string) => void;
}) {
  const index = lessons.findIndex((l) => l.id === current.id);
  const total = lessons.length || 1;
  const share = Math.round(((index + 1) / total) * 100);
  const next = index >= 0 && index + 1 < lessons.length ? lessons[index + 1] : null;
  const alreadyCounted = progress >= share;

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <button
        onClick={() => onMark(share)}
        disabled={busy || alreadyCounted}
        style={{
          ...primaryBtn,
          opacity: busy || alreadyCounted ? 0.5 : 1,
          cursor: busy || alreadyCounted ? "default" : "pointer",
        }}
      >
        {alreadyCounted ? "Урок засчитан" : busy ? "Сохраняем…" : "Отметить пройденным"}
      </button>
      {next && (
        <button onClick={() => onOpen(next.id)} style={quietBtn}>
          Следующий урок →
        </button>
      )}
      <span style={{ fontSize: 12, color: "#94a3b8" }}>
        Урок {index + 1} из {lessons.length}
      </span>
    </div>
  );
}
