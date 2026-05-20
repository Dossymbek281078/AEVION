import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Офлайн — AEVION CyberChess',
  description: 'Играй в шахматы AEVION даже без сети.',
};

// Полностью статическая страница — SW кэширует её при install и отдаёт
// из кэша когда сеть недоступна. Никаких client hooks/API — чистый HTML.
export default function CyberChessOfflinePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background:
          'radial-gradient(ellipse at top, #0f1729 0%, #0a0e1a 60%, #05070d 100%)',
        color: '#e2e8f0',
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'rgba(15, 23, 42, 0.78)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          borderRadius: 18,
          padding: '32px 28px',
          boxShadow:
            '0 0 0 1px rgba(16,185,129,0.08), 0 20px 60px rgba(0,0,0,0.6), 0 0 80px rgba(16,185,129,0.12)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <span
            aria-hidden
            style={{
              fontSize: 28,
              filter: 'drop-shadow(0 0 12px rgba(16,185,129,0.7))',
            }}
          >
            ♞
          </span>
          <span
            style={{
              fontSize: 12,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: '#10b981',
              fontWeight: 600,
            }}
          >
            AEVION · CyberChess
          </span>
        </div>

        <h1
          style={{
            fontSize: 26,
            lineHeight: 1.2,
            margin: '0 0 10px',
            color: '#f8fafc',
            fontWeight: 700,
          }}
        >
          Нет сети — играем оффлайн с AI
        </h1>

        <p style={{ margin: '0 0 22px', color: '#94a3b8', fontSize: 15 }}>
          Соединение потеряно, но партия продолжается. Запускай встроенного
          движка и играй против AI прямо сейчас.
        </p>

        <a
          href="/cyberchess"
          style={{
            display: 'inline-block',
            padding: '12px 22px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#04110b',
            fontWeight: 700,
            fontSize: 15,
            borderRadius: 10,
            textDecoration: 'none',
            boxShadow: '0 0 24px rgba(16,185,129,0.45)',
            letterSpacing: 0.3,
          }}
        >
          ▶ Играть оффлайн
        </a>

        <div
          style={{
            marginTop: 28,
            padding: '16px 18px',
            background: 'rgba(2, 6, 23, 0.55)',
            border: '1px solid rgba(148, 163, 184, 0.18)',
            borderRadius: 12,
          }}
        >
          <p
            style={{
              margin: '0 0 10px',
              fontSize: 12,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: '#64748b',
              fontWeight: 600,
            }}
          >
            Доступно без сети
          </p>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 14,
              color: '#cbd5e1',
              lineHeight: 1.7,
            }}
          >
            <li>Игра против AI (Stockfish, любой уровень)</li>
            <li>Сохранённые в кэше пазлы</li>
            <li>Анализ позиции локальным движком</li>
            <li>Просмотр истории партий из локального хранилища</li>
          </ul>
        </div>

        <p
          style={{
            marginTop: 22,
            marginBottom: 0,
            fontSize: 13,
            color: '#64748b',
            lineHeight: 1.5,
          }}
        >
          Когда сеть вернётся — рейтинг, новые партии и история автоматически
          синхронизируются с сервером.
        </p>
      </section>
    </main>
  );
}
