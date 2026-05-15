'use client';

import { useState, useEffect, useRef } from 'react';
import { apiUrl } from '@/lib/apiBase';

interface Exercise {
  id: string;
  title: string;
  description: string;
  category: string;
  durationSec: number;
  steps: string[];
}

const CATEGORY_COLORS: Record<string, string> = {
  breathing: '#3b82f6',
  grounding: '#10b981',
  gratitude: '#f59e0b',
  mindfulness: '#8b5cf6',
  cognitive: '#ec4899',
};

interface Props {
  exercise: Exercise;
  userId?: string;
}

export default function ExerciseCard({ exercise, userId = 'anonymous' }: Props) {
  const [state, setState] = useState<'idle' | 'active' | 'done'>('idle');
  const [timeLeft, setTimeLeft] = useState(exercise.durationSec);
  const [streak, setStreak] = useState<number | null>(null);
  const [totalDone, setTotalDone] = useState<number | null>(null);
  const [completing, setCompleting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const color = CATEGORY_COLORS[exercise.category] || '#7c3aed';

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function startExercise() {
    setState('active');
    setTimeLeft(exercise.durationSec);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setState('done');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function stopExercise() {
    if (timerRef.current) clearInterval(timerRef.current);
    setState('idle');
    setTimeLeft(exercise.durationSec);
  }

  async function completeExercise() {
    setCompleting(true);
    try {
      const res = await fetch(apiUrl(`/api/qgood/exercises/${exercise.id}/complete`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const data = await res.json() as { streak?: number; total_done?: number };
        setStreak(data.streak ?? null);
        setTotalDone(data.total_done ?? null);
      }
    } catch {
      // silent
    } finally {
      setCompleting(false);
      setState('idle');
      setTimeLeft(exercise.durationSec);
    }
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        padding: '20px',
        border: `2px solid ${state === 'active' ? color : '#e8d5f5'}`,
        transition: 'border-color 0.2s',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Category badge */}
      <span
        style={{
          position: 'absolute', top: 12, right: 12,
          padding: '2px 10px', borderRadius: 10,
          background: color + '20', color: color,
          fontSize: 11, fontWeight: 600,
        }}
      >
        {exercise.category}
      </span>

      <h3 style={{ color: '#1f2937', fontSize: 16, fontWeight: 700, marginBottom: 6, paddingRight: 80 }}>
        {exercise.title}
      </h3>
      <p style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
        {exercise.description}
      </p>

      {/* Steps */}
      <ol style={{ margin: '0 0 16px 0', paddingLeft: 18, fontSize: 13, color: '#374151', lineHeight: 1.8 }}>
        {exercise.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>

      {/* Timer display when active */}
      {state === 'active' && (
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 36, fontWeight: 700, color }}>
            {minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds}с`}
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>осталось</div>
        </div>
      )}

      {/* Streak/total info */}
      {(streak !== null || totalDone !== null) && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          {streak !== null && (
            <span style={{ fontSize: 12, color: '#7c3aed', background: '#ede9fe', padding: '3px 10px', borderRadius: 10 }}>
              🔥 {streak} дн. подряд
            </span>
          )}
          {totalDone !== null && (
            <span style={{ fontSize: 12, color: '#059669', background: '#d1fae5', padding: '3px 10px', borderRadius: 10 }}>
              ✓ Всего: {totalDone}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        {state === 'idle' && (
          <button
            onClick={startExercise}
            style={{
              flex: 1, padding: '10px', borderRadius: 10,
              background: color, color: '#fff', fontWeight: 600,
              border: 'none', cursor: 'pointer', fontSize: 14,
            }}
          >
            Начать
          </button>
        )}
        {state === 'active' && (
          <button
            onClick={stopExercise}
            style={{
              flex: 1, padding: '10px', borderRadius: 10,
              background: '#f3f4f6', color: '#374151', fontWeight: 600,
              border: 'none', cursor: 'pointer', fontSize: 14,
            }}
          >
            Стоп
          </button>
        )}
        {(state === 'active' || state === 'done') && (
          <button
            onClick={completeExercise}
            disabled={completing}
            style={{
              flex: 1, padding: '10px', borderRadius: 10,
              background: '#16a34a', color: '#fff', fontWeight: 600,
              border: 'none', cursor: completing ? 'wait' : 'pointer', fontSize: 14,
            }}
          >
            {completing ? 'Сохраняю…' : '✓ Завершено'}
          </button>
        )}
      </div>
    </div>
  );
}
