'use client';

import { useState } from 'react';
import { apiUrl } from '@/lib/apiBase';

const EMOTIONS = [
  { id: 'happy', label: 'Радость', emoji: '😊' },
  { id: 'calm', label: 'Спокойствие', emoji: '😌' },
  { id: 'anxious', label: 'Тревога', emoji: '😰' },
  { id: 'sad', label: 'Грусть', emoji: '😔' },
  { id: 'angry', label: 'Злость', emoji: '😠' },
  { id: 'tired', label: 'Усталость', emoji: '😴' },
  { id: 'neutral', label: 'Нейтрально', emoji: '😐' },
];

function scoreEmoji(score: number): string {
  if (score <= 2) return '😞';
  if (score <= 4) return '😕';
  if (score <= 6) return '😐';
  if (score <= 8) return '🙂';
  return '😄';
}

interface Props {
  userId?: string;
  onLogged?: () => void;
}

export default function MoodCheckIn({ userId = 'anonymous', onLogged }: Props) {
  const [score, setScore] = useState(5);
  const [emotion, setEmotion] = useState('');
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/api/qgood/mood'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score, emotion: emotion || undefined, context: context || undefined, userId }),
      });
      if (!res.ok) throw new Error('Ошибка сохранения');
      setSuccess(true);
      setContext('');
      setTimeout(() => { setSuccess(false); onLogged?.(); }, 1500);
    } catch {
      setError('Не удалось сохранить. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: '#fdf6ff', borderRadius: 16, padding: '24px', border: '1px solid #e8d5f5' }}>
      <h2 style={{ color: '#6b21a8', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
        Как вы себя чувствуете?
      </h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14, color: '#7c3aed' }}>
            <span>Плохо</span>
            <span style={{ fontSize: 28 }}>{scoreEmoji(score)} {score}</span>
            <span>Отлично</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={score}
            onChange={e => setScore(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#7c3aed', cursor: 'pointer' }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>Эмоция (необязательно)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {EMOTIONS.map(em => (
              <button
                key={em.id}
                type="button"
                onClick={() => setEmotion(emotion === em.id ? '' : em.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: '1.5px solid',
                  borderColor: emotion === em.id ? '#7c3aed' : '#e8d5f5',
                  background: emotion === em.id ? '#ede9fe' : '#fff',
                  color: emotion === em.id ? '#6b21a8' : '#6b7280',
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {em.emoji} {em.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="Что происходит? (необязательно)"
            rows={2}
            maxLength={500}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 14px',
              borderRadius: 10, border: '1.5px solid #e8d5f5',
              fontSize: 14, color: '#374151', resize: 'vertical',
              fontFamily: 'inherit', outline: 'none',
            }}
          />
        </div>

        {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <button
          type="submit"
          disabled={loading || success}
          style={{
            width: '100%', padding: '12px', borderRadius: 10,
            background: success ? '#16a34a' : '#7c3aed',
            color: '#fff', fontWeight: 600, fontSize: 15,
            border: 'none', cursor: loading ? 'wait' : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {success ? '✓ Сохранено!' : loading ? 'Сохраняю…' : 'Зафиксировать'}
        </button>
      </form>
    </div>
  );
}
