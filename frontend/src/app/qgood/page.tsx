'use client';

import { useState, useEffect } from 'react';
import { apiUrl } from '@/lib/apiBase';
import MvpConceptBoard from '@/components/MvpConceptBoard';
import MoodCheckIn from './components/MoodCheckIn';
import AiChat from './components/AiChat';
import MoodTrend from './components/MoodTrend';
import ExerciseCard from './components/ExerciseCard';
import ModulePricingChip from '@/components/ModulePricingChip';

const USER_ID = 'demo-user';

interface Exercise {
  id: string;
  title: string;
  description: string;
  category: string;
  durationSec: number;
  steps: string[];
}

interface CharityStats {
  total_campaigns: number;
  active_campaigns: number;
  total_raised_cents: string | number;
  total_donors: number;
  currency: string;
}

function fmtMoney(cents: string | number): string {
  const n = typeof cents === 'string' ? parseInt(cents, 10) : cents;
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat('en-US').format(Math.round(n / 100));
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
  const [charity, setCharity] = useState<CharityStats | null>(null);

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

    // Load charity stats (the donation platform half of this module)
    fetch(apiUrl('/api/qgood/stats'))
      .then(r => (r.ok ? r.json() : null))
      .then((d: CharityStats | null) => { if (d) setCharity(d); })
      .catch(() => {});
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
          <div style={{ marginTop: 12 }}>
            <ModulePricingChip moduleId="qgood" theme="dark" />
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

      {/* Charity side — the donation platform that lives under this module but
          was previously unreachable from the landing (orphaned subpages). */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px 8px' }}>
        <div style={{ background: '#fff', border: '1px solid #e8d5f5', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(124,58,237,0.06)' }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#7c3aed' }}>💜 Благотворительность</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
              Прозрачные кампании · matching-пулы удваивают пожертвования · цепочка донатов проверяема
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 16 }}>
            <GoodStat label="Кампаний" value={charity ? String(charity.total_campaigns) : undefined} />
            <GoodStat label="Активных" value={charity ? String(charity.active_campaigns) : undefined} />
            <GoodStat label="Собрано" value={charity ? `$${fmtMoney(charity.total_raised_cents)}` : undefined} />
            <GoodStat label="Доноров" value={charity ? String(charity.total_donors) : undefined} />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="/qgood/campaigns" style={{ padding: '10px 16px', borderRadius: 10, background: '#7c3aed', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              Все кампании →
            </a>
            <a href="/qgood/matching-pools" style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #d8b4fe', color: '#7c3aed', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              Matching pools →
            </a>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px 32px' }}>
        <MvpConceptBoard
          moduleId="qgood"
          noun="concept/messages"
          accent="rose"
          sectionTitle="Mental health concept board"
          sectionHint="Какие практики действительно помогают? Какие сценарии должны быть в AI-терапевте?"
          titleField="idea"
          summaryField="rationale"
          fields={[
            { key: "idea", label: "Идея / практика", placeholder: "напр.: 5-минутный body scan вечером", required: true },
            { key: "rationale", label: "Почему это работает", type: "textarea", placeholder: "Что меняется в состоянии, источник / личный опыт" },
            { key: "author", label: "Псевдоним (необязательно)", placeholder: "anon" },
          ]}
        />
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

function GoodStat({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div style={{ background: '#faf5ff', border: '1px solid #f0e0ff', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#7c3aed' }}>{value ?? '…'}</div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}
