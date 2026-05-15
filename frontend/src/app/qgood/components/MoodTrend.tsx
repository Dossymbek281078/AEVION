'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiUrl } from '@/lib/apiBase';

interface MoodEntry {
  id: number;
  score: number;
  emotion: string | null;
  logged_at: string;
}

interface Trends {
  avg_score: number | null;
  total_entries: number;
  emotion_frequency: Array<{ emotion: string; freq: number }>;
  daily: Array<{ day: string; avg_score: number }>;
}

function scoreEmoji(score: number | null): string {
  if (score === null) return '❓';
  if (score <= 2) return '😞';
  if (score <= 4) return '😕';
  if (score <= 6) return '😐';
  if (score <= 8) return '🙂';
  return '😄';
}

function scoreColor(score: number): string {
  if (score <= 3) return '#ef4444';
  if (score <= 5) return '#f59e0b';
  if (score <= 7) return '#10b981';
  return '#7c3aed';
}

interface Props {
  userId?: string;
  refreshKey?: number;
}

export default function MoodTrend({ userId = 'anonymous', refreshKey = 0 }: Props) {
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, tRes] = await Promise.all([
        fetch(apiUrl(`/api/qgood/mood?limit=7&userId=${encodeURIComponent(userId)}`)),
        fetch(apiUrl(`/api/qgood/mood/trends?userId=${encodeURIComponent(userId)}`)),
      ]);
      if (mRes.ok) {
        const d = await mRes.json() as { moods?: MoodEntry[] };
        setMoods(d.moods || []);
      }
      if (tRes.ok) {
        setTrends(await tRes.json() as Trends);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  if (loading) {
    return (
      <div style={{ background: '#fdf6ff', borderRadius: 16, padding: '24px', border: '1px solid #e8d5f5' }}>
        <div style={{ color: '#9ca3af', fontSize: 14 }}>Загрузка…</div>
      </div>
    );
  }

  const avg = trends?.avg_score ?? null;

  return (
    <div style={{ background: '#fdf6ff', borderRadius: 16, padding: '24px', border: '1px solid #e8d5f5' }}>
      <h2 style={{ color: '#6b21a8', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
        Динамика настроения (7 дней)
      </h2>

      {moods.length === 0 ? (
        <div style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>
          Нет записей. Зафиксируйте первое настроение!
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 48 }}>{scoreEmoji(avg)}</div>
            <div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>Средний балл за 7 дней</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#6b21a8' }}>
                {avg !== null ? avg.toFixed(1) : '—'} / 10
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>{trends?.total_entries ?? 0} записей</div>
            </div>
          </div>

          {/* Mini bar chart */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 60, marginBottom: 16 }}>
            {moods.slice().reverse().map((m, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div
                  title={`${m.score}/10 — ${new Date(m.logged_at).toLocaleDateString('ru')}`}
                  style={{
                    width: '100%', borderRadius: 4,
                    height: `${(m.score / 10) * 50}px`,
                    background: scoreColor(m.score),
                    transition: 'height 0.3s',
                    minHeight: 4,
                  }}
                />
                <div style={{ fontSize: 10, color: '#9ca3af' }}>
                  {new Date(m.logged_at).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
                </div>
              </div>
            ))}
          </div>

          {/* Emotion frequency */}
          {trends && trends.emotion_frequency.length > 0 && (
            <div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>Частые эмоции</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {trends.emotion_frequency.map((ef) => (
                  <span
                    key={ef.emotion}
                    style={{
                      padding: '3px 10px', borderRadius: 12,
                      background: '#ede9fe', color: '#6b21a8',
                      fontSize: 12, fontWeight: 500,
                    }}
                  >
                    {ef.emotion} ×{ef.freq}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
