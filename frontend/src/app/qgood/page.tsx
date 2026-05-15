'use client';

import { useState, useEffect } from 'react';
import { apiUrl } from '@/lib/apiBase';
import MoodCheckIn from './components/MoodCheckIn';
import AiChat from './components/AiChat';
import MoodTrend from './components/MoodTrend';
import ExerciseCard from './components/ExerciseCard';

const USER_ID = 'demo-user';

interface Exercise {
  id: string;
  title: string;
  description: string;
  category: string;
  durationSec: number;
  steps: string[];
}

const NAV_TABS = [
  { id: 'mood', label: '🌡️ Настроение' },
  { id: 'chat', label: '💬 Собеседник' },
  { id: 'exercises', label: '🧘 Упражнения' },
  { id: 'trend', label: '📈 Динамика' },
];

export default function QGoodPage() {
  const [tab, setTab] = useState<'mood' | 'chat' | 'exercises' | 'trend'>('mood');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [moodRefreshKey, setMoodRefreshKey] = useState(0);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  useEffect(() => {
    // Check backend health
    fetch(apiUrl('/api/qgood/health'))
      .then(r => setBackendOk(r.ok))
      .catch(() => setBackendOk(false));

    // Load exercises
    fetch(apiUrl('/api/qgood/exercises'))
      .then(r => r.json())
      .then((d: { exercises?: Exercise[] }) => setExercises(d.exercises || []))
      .catch(() => setExercises([]));
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #fdf6ff 0%, #fff7f0 50%, #f0f9ff 100%)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(90deg, #7c3aed 0%, #9d4edd 50%, #c26ef7 100%)',
          padding: '32px 24px 24px',
          color: '#fff',
        }}
      >
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>
                AEVION · QGOOD
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Mind, supported. 💜</h1>
              <p style={{ fontSize: 14, opacity: 0.85, margin: '6px 0 0', lineHeight: 1.5 }}>
                Психологический собеседник · Трекер настроения · Упражнения для ума
              </p>
            </div>
            {backendOk !== null && (
              <div
                style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: backendOk ? '#4ade80' : '#f87171',
                  boxShadow: backendOk ? '0 0 8px #4ade80' : 'none',
                }}
                title={backendOk ? 'Backend online' : 'Backend offline'}
              />
            )}
          </div>
        </div>
      </div>

      {/* Nav tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8d5f5', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', overflowX: 'auto' }}>
          {NAV_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
              style={{
                padding: '14px 20px',
                border: 'none',
                borderBottom: tab === t.id ? '3px solid #7c3aed' : '3px solid transparent',
                background: 'none',
                color: tab === t.id ? '#7c3aed' : '#6b7280',
                fontWeight: tab === t.id ? 700 : 400,
                fontSize: 14,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>

        {/* Mood Check-In tab */}
        {tab === 'mood' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <MoodCheckIn
              userId={USER_ID}
              onLogged={() => setMoodRefreshKey(k => k + 1)}
            />
            <MoodTrend userId={USER_ID} refreshKey={moodRefreshKey} />
          </div>
        )}

        {/* AI Chat tab */}
        {tab === 'chat' && (
          <div>
            <div
              style={{
                background: '#fef3c7',
                border: '1px solid #fcd34d',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 13,
                color: '#92400e',
                marginBottom: 16,
                lineHeight: 1.5,
              }}
            >
              ⚠️ Это не замена профессиональной психологической помощи. При кризисных состояниях обратитесь к специалисту.
            </div>
            <AiChat userId={USER_ID} />
          </div>
        )}

        {/* Exercises tab */}
        {tab === 'exercises' && (
          <div>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
              Доказательно эффективные техники для управления стрессом и улучшения самочувствия.
            </p>
            {exercises.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>
                Загрузка упражнений…
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 16 }}>
                {exercises.map(ex => (
                  <ExerciseCard key={ex.id} exercise={ex} userId={USER_ID} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Trend tab */}
        {tab === 'trend' && (
          <MoodTrend userId={USER_ID} refreshKey={moodRefreshKey} />
        )}

      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '32px 16px', color: '#9ca3af', fontSize: 12 }}>
        QGood — Psychology & Mental Health · AEVION Ecosystem
        <br />
        Не является медицинским устройством или заменой психотерапии.
      </div>
    </div>
  );
}
