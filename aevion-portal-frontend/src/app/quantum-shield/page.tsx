'use client';

import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://aevion-production-a70c.up.railway.app';

// ── Types ──────────────────────────────────────────────────────────
interface ShardInfo {
  id: string;
  index: number;
  location: string;
  status: 'active' | 'compromised' | 'offline';
  lastVerified: string;
}

interface ShieldRecord {
  id: string;
  originalSignatureId: string;
  fileName: string;
  createdAt: string;
  algorithm: string;
  totalShards: number;
  threshold: number;
  shards: ShardInfo[];
  status: 'protected' | 'warning' | 'critical';
  quantumResistanceLevel: string;
}

// ── Mock Data (fallback when API is unavailable) ──────────────────
const MOCK_RECORDS: ShieldRecord[] = [
  {
    id: 'qs-001',
    originalSignatureId: 'sig-a1b2c3',
    fileName: 'patent_application_v3.pdf',
    createdAt: '2026-03-28T14:32:00Z',
    algorithm: 'Shamir Secret Sharing + Ed25519',
    totalShards: 3,
    threshold: 2,
    shards: [
      { id: 'sh-001a', index: 1, location: 'Author Vault', status: 'active', lastVerified: '2026-03-31T10:00:00Z' },
      { id: 'sh-001b', index: 2, location: 'AEVION Platform', status: 'active', lastVerified: '2026-03-31T10:00:00Z' },
      { id: 'sh-001c', index: 3, location: 'Witness Node', status: 'active', lastVerified: '2026-03-30T08:00:00Z' },
    ],
    status: 'protected',
    quantumResistanceLevel: 'Maximum',
  },
  {
    id: 'qs-002',
    originalSignatureId: 'sig-d4e5f6',
    fileName: 'music_composition_final.mp3',
    createdAt: '2026-03-25T09:15:00Z',
    algorithm: 'Shamir Secret Sharing + Ed25519',
    totalShards: 3,
    threshold: 2,
    shards: [
      { id: 'sh-002a', index: 1, location: 'Author Vault', status: 'active', lastVerified: '2026-03-31T10:00:00Z' },
      { id: 'sh-002b', index: 2, location: 'AEVION Platform', status: 'offline', lastVerified: '2026-03-27T14:00:00Z' },
      { id: 'sh-002c', index: 3, location: 'Witness Node', status: 'active', lastVerified: '2026-03-30T08:00:00Z' },
    ],
    status: 'warning',
    quantumResistanceLevel: 'High',
  },
  {
    id: 'qs-003',
    originalSignatureId: 'sig-g7h8i9',
    fileName: 'source_code_v1.2.zip',
    createdAt: '2026-03-20T16:45:00Z',
    algorithm: 'Shamir Secret Sharing + Ed25519',
    totalShards: 3,
    threshold: 2,
    shards: [
      { id: 'sh-003a', index: 1, location: 'Author Vault', status: 'active', lastVerified: '2026-03-31T10:00:00Z' },
      { id: 'sh-003b', index: 2, location: 'AEVION Platform', status: 'active', lastVerified: '2026-03-31T10:00:00Z' },
      { id: 'sh-003c', index: 3, location: 'Witness Node', status: 'active', lastVerified: '2026-03-31T08:00:00Z' },
    ],
    status: 'protected',
    quantumResistanceLevel: 'Maximum',
  },
  {
    id: 'qs-004',
    originalSignatureId: 'sig-j0k1l2',
    fileName: 'design_mockup_hero.fig',
    createdAt: '2026-03-18T11:20:00Z',
    algorithm: 'Shamir Secret Sharing + Ed25519',
    totalShards: 3,
    threshold: 2,
    shards: [
      { id: 'sh-004a', index: 1, location: 'Author Vault', status: 'compromised', lastVerified: '2026-03-29T10:00:00Z' },
      { id: 'sh-004b', index: 2, location: 'AEVION Platform', status: 'offline', lastVerified: '2026-03-26T14:00:00Z' },
      { id: 'sh-004c', index: 3, location: 'Witness Node', status: 'active', lastVerified: '2026-03-31T08:00:00Z' },
    ],
    status: 'critical',
    quantumResistanceLevel: 'Degraded',
  },
];

// ── Helpers ─────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── TopNav ──────────────────────────────────────────────────────────
function TopNav() {
  return (
    <nav style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 28px',
      backgroundColor: '#fff', borderBottom: '1px solid #e8e8e8',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <a href="/" style={{
        fontSize: 20, fontWeight: 700, color: '#1a1a2e',
        textDecoration: 'none', letterSpacing: -0.5,
      }}>
        AEVION
      </a>
      <div style={{ display: 'flex', gap: 24, fontSize: 14, fontWeight: 500 }}>
        {[
          { href: '/qright', label: 'QRight' },
          { href: '/qsign', label: 'QSign' },
          { href: '/quantum-shield', label: 'Quantum Shield' },
          { href: '/aevion-ip-bureau', label: 'IP Bureau' },
          { href: '/qtrade', label: 'QTrade' },
          { href: '/qcore', label: 'QCoreAI' },
          { href: '/cyberchess', label: 'CyberChess' },
        ].map(link => (
          <a key={link.href} href={link.href} style={{
            color: link.href === '/quantum-shield' ? '#4a6cf7' : '#555',
            textDecoration: 'none',
            transition: 'color 0.2s',
          }}>
            {link.label}
          </a>
        ))}
      </div>
      <a href="/auth" style={{
        padding: '8px 20px', borderRadius: 10,
        backgroundColor: '#1a1a2e', color: 'white',
        fontSize: 13, fontWeight: 500, textDecoration: 'none',
      }}>
        Sign In
      </a>
    </nav>
  );
}

// ── Sub-components ──────────────────────────────────────────────────
function StatusBadge({ status }: { status: ShieldRecord['status'] }) {
  const config = {
    protected: { label: 'Protected', color: '#0a8f5c', bg: '#e6f7ef' },
    warning:   { label: 'Warning',   color: '#b8860b', bg: '#fff8e1' },
    critical:  { label: 'Critical',  color: '#c0392b', bg: '#fdecea' },
  };
  const c = config[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', borderRadius: 20,
      fontSize: 12, fontWeight: 600, letterSpacing: 0.3,
      color: c.color, backgroundColor: c.bg,
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%', backgroundColor: c.color,
        boxShadow: status === 'critical' ? `0 0 6px ${c.color}` : 'none',
        animation: status === 'critical' ? 'pulse 1.5s infinite' : 'none',
      }} />
      {c.label}
    </span>
  );
}

function ShardStatusDot({ status }: { status: ShardInfo['status'] }) {
  const colors = { active: '#0a8f5c', offline: '#b8860b', compromised: '#c0392b' };
  return (
    <span style={{
      width: 9, height: 9, borderRadius: '50%',
      backgroundColor: colors[status],
      boxShadow: `0 0 4px ${colors[status]}40`,
      display: 'inline-block',
    }} />
  );
}

function ShardVisual({ shards, threshold }: { shards: ShardInfo[]; threshold: number }) {
  const activeCount = shards.filter(s => s.status === 'active').length;
  const isSecure = activeCount >= threshold;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <svg width="140" height="120" viewBox="0 0 140 120">
        <line x1="70" y1="15" x2="25" y2="100" stroke={isSecure ? '#0a8f5c30' : '#c0392b30'} strokeWidth="1.5" strokeDasharray="4 3" />
        <line x1="70" y1="15" x2="115" y2="100" stroke={isSecure ? '#0a8f5c30' : '#c0392b30'} strokeWidth="1.5" strokeDasharray="4 3" />
        <line x1="25" y1="100" x2="115" y2="100" stroke={isSecure ? '#0a8f5c30' : '#c0392b30'} strokeWidth="1.5" strokeDasharray="4 3" />

        <g transform="translate(70,55)">
          <path d="M0-18 L16-8 L13 12 L0 20 L-13 12 L-16-8 Z"
            fill={isSecure ? '#0a8f5c15' : '#c0392b15'}
            stroke={isSecure ? '#0a8f5c' : '#c0392b'}
            strokeWidth="1.5" />
          {isSecure ? (
            <path d="M-5 1 L-1 5 L6-3" fill="none" stroke="#0a8f5c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <text textAnchor="middle" dy="4" fill="#c0392b" fontSize="14" fontWeight="bold">!</text>
          )}
        </g>

        {shards.map((shard, i) => {
          const positions = [{ x: 70, y: 15 }, { x: 25, y: 100 }, { x: 115, y: 100 }];
          const pos = positions[i];
          const colors: Record<string, string> = { active: '#0a8f5c', offline: '#b8860b', compromised: '#c0392b' };
          const color = colors[shard.status];
          return (
            <g key={shard.id} transform={`translate(${pos.x},${pos.y})`}>
              <circle r="14" fill="white" stroke={color} strokeWidth="2" />
              <circle r="5" fill={color} opacity={shard.status === 'active' ? 1 : 0.4} />
              <text y="26" textAnchor="middle" fontSize="9" fill="#666" fontWeight="500">
                S{shard.index}
              </text>
            </g>
          );
        })}
      </svg>

      <div style={{ fontSize: 11, color: '#888', textAlign: 'center' }}>
        {activeCount}/{shards.length} shards active · {threshold} required
      </div>
    </div>
  );
}

// ── Table styles ────────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '10px 14px', fontSize: 11,
  fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5,
};
const tdStyle: React.CSSProperties = {
  padding: '10px 14px', fontSize: 13, color: '#333',
};

// ── MetaItem ────────────────────────────────────────────────────────
function MetaItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 500, color: '#1a1a2e',
        fontFamily: mono ? "'JetBrains Mono', monospace" : 'inherit',
      }}>
        {value}
      </div>
    </div>
  );
}

// ── ActionButton ────────────────────────────────────────────────────
function ActionButton({ label, icon, primary, onClick }: {
  label: string; icon: string; primary?: boolean; onClick?: () => void;
}) {
  const icons: Record<string, React.ReactNode> = {
    check: <path d="M5 13l4 4L19 7" />,
    refresh: <><path d="M1 4v6h6" /><path d="M23 20v-6h-6" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></>,
  };

  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '9px 18px', borderRadius: 10,
        fontSize: 13, fontWeight: 500, cursor: 'pointer',
        border: primary ? 'none' : '1px solid #ddd',
        backgroundColor: primary ? '#1a1a2e' : 'white',
        color: primary ? 'white' : '#444',
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = primary ? '#2a2a4e' : '#f5f5f5';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = primary ? '#1a1a2e' : 'white';
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {icons[icon]}
      </svg>
      {label}
    </button>
  );
}

// ── RecordCard ──────────────────────────────────────────────────────
function RecordCard({ record, isExpanded, onToggle, onVerify }: {
  record: ShieldRecord; isExpanded: boolean; onToggle: () => void; onVerify: (id: string) => void;
}) {
  return (
    <div style={{
      backgroundColor: '#fff', borderRadius: 16,
      border: '1px solid #e8e8e8', overflow: 'hidden',
      transition: 'all 0.3s ease',
      boxShadow: isExpanded ? '0 8px 32px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.03)',
    }}>
      {/* Header */}
      <div
        onClick={onToggle}
        style={{
          padding: '20px 24px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 16,
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fafafa')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          backgroundColor: '#f0f4ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a6cf7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />
            <path d="M12 22V12" />
            <path d="M3 7l9 5 9-5" />
          </svg>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, fontWeight: 600, color: '#1a1a2e',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {record.fileName}
          </div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            {formatDate(record.createdAt)} · ID: {record.id}
          </div>
        </div>

        <StatusBadge status={record.status} />

        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="#aaa" strokeWidth="2" strokeLinecap="round"
          style={{
            transition: 'transform 0.3s ease',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      {/* Expanded */}
      <div style={{
        maxHeight: isExpanded ? 600 : 0,
        overflow: 'hidden', transition: 'max-height 0.4s ease',
      }}>
        <div style={{ padding: '0 24px 24px', borderTop: '1px solid #f0f0f0' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 160px',
            gap: 24, paddingTop: 20,
          }}>
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <MetaItem label="Algorithm" value={record.algorithm} />
                <MetaItem label="Quantum Resistance" value={record.quantumResistanceLevel} />
                <MetaItem label="Threshold" value={`${record.threshold} of ${record.totalShards}`} />
                <MetaItem label="Signature ID" value={record.originalSignatureId} mono />
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 10 }}>
                Shard Details
              </div>
              <div style={{ borderRadius: 10, border: '1px solid #eee', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fb' }}>
                      <th style={thStyle}>#</th>
                      <th style={thStyle}>Location</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Last Verified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {record.shards.map(shard => (
                      <tr key={shard.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                        <td style={tdStyle}>S{shard.index}</td>
                        <td style={tdStyle}>{shard.location}</td>
                        <td style={tdStyle}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <ShardStatusDot status={shard.status} />
                            <span style={{ textTransform: 'capitalize' }}>{shard.status}</span>
                          </span>
                        </td>
                        <td style={{ ...tdStyle, color: '#888' }}>{timeAgo(shard.lastVerified)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: '#fafbfc', borderRadius: 12, padding: 16,
            }}>
              <ShardVisual shards={record.shards} threshold={record.threshold} />
            </div>
          </div>

          <div style={{
            display: 'flex', gap: 10, marginTop: 20, paddingTop: 16,
            borderTop: '1px solid #f0f0f0',
          }}>
            <ActionButton label="Verify Shards" icon="check" primary onClick={() => onVerify(record.id)} />
            <ActionButton label="Reshare Secret" icon="refresh" />
            <ActionButton label="Download Certificate" icon="download" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── StatCard ────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div style={{
      backgroundColor: '#fff', borderRadius: 14,
      border: '1px solid #e8e8e8', padding: '20px 22px',
      flex: 1, minWidth: 160,
    }}>
      <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────
export default function QuantumShieldPage() {
  const [records, setRecords] = useState<ShieldRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'protected' | 'warning' | 'critical'>('all');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRecords() {
      try {
        const res = await fetch(`${API}/api/quantum-shield`);
        if (!res.ok) throw new Error('API unavailable');
        const data = await res.json();
        setRecords(data.records || []);
      } catch {
        // Fallback to mock data
        setRecords(MOCK_RECORDS);
      } finally {
        setLoading(false);
      }
    }
    fetchRecords();
  }, []);

  async function handleVerify(id: string) {
    setVerifyingId(id);
    try {
      const res = await fetch(`${API}/api/quantum-shield/${id}/verify`, { method: 'POST' });
      if (res.ok) {
        // Refresh shard timestamps locally
        setRecords(prev => prev.map(r => {
          if (r.id !== id) return r;
          return {
            ...r,
            shards: r.shards.map(s =>
              s.status === 'active' ? { ...s, lastVerified: new Date().toISOString() } : s
            ),
          };
        }));
      }
    } catch {
      // Silent fail — demo mode
    } finally {
      setVerifyingId(null);
    }
  }

  const filtered = filter === 'all' ? records : records.filter(r => r.status === filter);

  const stats = {
    total: records.length,
    protected: records.filter(r => r.status === 'protected').length,
    warning: records.filter(r => r.status === 'warning').length,
    critical: records.filter(r => r.status === 'critical').length,
    totalShards: records.reduce((sum, r) => sum + r.totalShards, 0),
    activeShards: records.reduce((sum, r) => sum + r.shards.filter(s => s.status === 'active').length, 0),
  };

  return (
    <div translate="no" suppressHydrationWarning style={{
      minHeight: '100vh',
      backgroundColor: '#f5f6f8',
      fontFamily: "'DM Sans', -apple-system, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .qs-filter-btn {
          padding: 8px 18px; border-radius: 10; font-size: 13px; font-weight: 500;
          cursor: pointer; border: 1px solid #e0e0e0; background: white; color: #666; transition: all 0.2s;
        }
        .qs-filter-btn:hover { border-color: #bbb; background: #fafafa; }
        .qs-filter-btn.active { background: #1a1a2e; color: white; border-color: #1a1a2e; }
        .qs-loading-card {
          height: 80px; border-radius: 16px;
          background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
          background-size: 200% 100%; animation: shimmer 1.5s infinite;
        }
      `}</style>

      <TopNav />

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        padding: '48px 0 60px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.06,
          backgroundImage: `linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }} />
        <div style={{
          position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(74,108,247,0.15) 0%, transparent 70%)',
        }} />

        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'linear-gradient(135deg, #4a6cf7, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(74,108,247,0.3)',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />
                <path d="M12 22V12" />
                <path d="M3 7l9 5 9-5" />
              </svg>
            </div>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', margin: 0, letterSpacing: -0.5 }}>
                Quantum Shield
              </h1>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', margin: 0 }}>
                Shamir&apos;s Secret Sharing · Post-quantum IP protection
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 960, margin: '-30px auto 0', padding: '0 24px 60px', position: 'relative' }}>
        {/* Stats */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 28, animation: 'fadeIn 0.5s ease', flexWrap: 'wrap' }}>
          <StatCard label="Total Records" value={stats.total} sub={`${stats.totalShards} shards total`} color="#1a1a2e" />
          <StatCard label="Protected" value={stats.protected} color="#0a8f5c" />
          <StatCard label="Warnings" value={stats.warning} color="#b8860b" />
          <StatCard label="Critical" value={stats.critical} sub={stats.critical > 0 ? 'Action needed' : undefined} color="#c0392b" />
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['all', 'protected', 'warning', 'critical'] as const).map(f => (
              <button
                key={f}
                className={`qs-filter-btn ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                {f !== 'all' && ` ${records.filter(r => r.status === f).length}`}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 13, color: '#888' }}>
            {stats.activeShards}/{stats.totalShards} shards online
          </div>
        </div>

        {/* Records */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {loading ? (
            <>{[1,2,3].map(i => <div key={i} className="qs-loading-card" />)}</>
          ) : filtered.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: 60, color: '#888',
              backgroundColor: '#fff', borderRadius: 16, border: '1px solid #e8e8e8',
            }}>
              No records found with status &ldquo;{filter}&rdquo;
            </div>
          ) : (
            filtered.map((record, i) => (
              <div key={record.id} style={{ animation: `fadeIn 0.4s ease ${i * 0.08}s both` }}>
                <RecordCard
                  record={record}
                  isExpanded={expandedId === record.id}
                  onToggle={() => setExpandedId(expandedId === record.id ? null : record.id)}
                  onVerify={handleVerify}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
