'use client';

import { useState, useRef, useEffect } from 'react';
import { apiUrl } from '@/lib/apiBase';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

interface Props {
  userId?: string;
}

export default function AiChat({ userId = 'anonymous' }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setError('');

    const userMsg: Message = { role: 'user', content: text, ts: Date.now() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const history = nextMessages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch(apiUrl('/api/qgood/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, userId, history: history.slice(0, -1) }),
      });
      const data = await res.json() as { reply?: string; error?: string };
      const reply = data.reply || 'Что-то пошло не так. Попробуйте снова.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply, ts: Date.now() }]);
    } catch {
      setError('Не удалось получить ответ. Проверьте соединение.');
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: '#fdf6ff', borderRadius: 16, padding: '24px', border: '1px solid #e8d5f5', display: 'flex', flexDirection: 'column', height: 420 }}>
      <h2 style={{ color: '#6b21a8', fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
        AI-собеседник
      </h2>

      <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', marginTop: 32 }}>
            Напишите, как вы себя чувствуете — я здесь, чтобы поддержать 💜
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '78%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: msg.role === 'user' ? '#7c3aed' : '#f3e8ff',
                color: msg.role === 'user' ? '#fff' : '#374151',
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              {msg.role === 'assistant' && (
                <div style={{ fontSize: 11, color: '#7c3aed', marginBottom: 4, fontWeight: 600 }}>
                  Психолог-ассистент
                </div>
              )}
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '10px 16px', borderRadius: '16px 16px 16px 4px', background: '#f3e8ff', color: '#7c3aed', fontSize: 14 }}>
              <span style={{ animation: 'pulse 1s infinite' }}>Печатаю…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{error}</div>}

      <form onSubmit={sendMessage} style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Напишите сообщение…"
          disabled={loading}
          maxLength={1000}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 10,
            border: '1.5px solid #e8d5f5', fontSize: 14,
            fontFamily: 'inherit', outline: 'none', color: '#374151',
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            padding: '10px 18px', borderRadius: 10,
            background: '#7c3aed', color: '#fff', fontWeight: 600,
            border: 'none', cursor: loading ? 'wait' : 'pointer',
            fontSize: 14, opacity: !input.trim() ? 0.5 : 1,
          }}
        >
          →
        </button>
      </form>
    </div>
  );
}
