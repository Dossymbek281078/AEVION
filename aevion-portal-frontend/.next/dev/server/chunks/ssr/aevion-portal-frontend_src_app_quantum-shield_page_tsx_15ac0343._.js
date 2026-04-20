module.exports = [
"[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>QuantumShieldPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/aevion-portal-frontend/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/aevion-portal-frontend/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
'use client';
;
;
const API = process.env.NEXT_PUBLIC_API_URL || 'https://aevion-production-a70c.up.railway.app';
// ── Mock Data (fallback when API is unavailable) ──────────────────
const MOCK_RECORDS = [
    {
        id: 'qs-001',
        originalSignatureId: 'sig-a1b2c3',
        fileName: 'patent_application_v3.pdf',
        createdAt: '2026-03-28T14:32:00Z',
        algorithm: 'Shamir Secret Sharing + Ed25519',
        totalShards: 3,
        threshold: 2,
        shards: [
            {
                id: 'sh-001a',
                index: 1,
                location: 'Author Vault',
                status: 'active',
                lastVerified: '2026-03-31T10:00:00Z'
            },
            {
                id: 'sh-001b',
                index: 2,
                location: 'AEVION Platform',
                status: 'active',
                lastVerified: '2026-03-31T10:00:00Z'
            },
            {
                id: 'sh-001c',
                index: 3,
                location: 'Witness Node',
                status: 'active',
                lastVerified: '2026-03-30T08:00:00Z'
            }
        ],
        status: 'protected',
        quantumResistanceLevel: 'Maximum'
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
            {
                id: 'sh-002a',
                index: 1,
                location: 'Author Vault',
                status: 'active',
                lastVerified: '2026-03-31T10:00:00Z'
            },
            {
                id: 'sh-002b',
                index: 2,
                location: 'AEVION Platform',
                status: 'offline',
                lastVerified: '2026-03-27T14:00:00Z'
            },
            {
                id: 'sh-002c',
                index: 3,
                location: 'Witness Node',
                status: 'active',
                lastVerified: '2026-03-30T08:00:00Z'
            }
        ],
        status: 'warning',
        quantumResistanceLevel: 'High'
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
            {
                id: 'sh-003a',
                index: 1,
                location: 'Author Vault',
                status: 'active',
                lastVerified: '2026-03-31T10:00:00Z'
            },
            {
                id: 'sh-003b',
                index: 2,
                location: 'AEVION Platform',
                status: 'active',
                lastVerified: '2026-03-31T10:00:00Z'
            },
            {
                id: 'sh-003c',
                index: 3,
                location: 'Witness Node',
                status: 'active',
                lastVerified: '2026-03-31T08:00:00Z'
            }
        ],
        status: 'protected',
        quantumResistanceLevel: 'Maximum'
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
            {
                id: 'sh-004a',
                index: 1,
                location: 'Author Vault',
                status: 'compromised',
                lastVerified: '2026-03-29T10:00:00Z'
            },
            {
                id: 'sh-004b',
                index: 2,
                location: 'AEVION Platform',
                status: 'offline',
                lastVerified: '2026-03-26T14:00:00Z'
            },
            {
                id: 'sh-004c',
                index: 3,
                location: 'Witness Node',
                status: 'active',
                lastVerified: '2026-03-31T08:00:00Z'
            }
        ],
        status: 'critical',
        quantumResistanceLevel: 'Degraded'
    }
];
// ── Helpers ─────────────────────────────────────────────────────────
function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}
// ── TopNav ──────────────────────────────────────────────────────────
function TopNav() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
        style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 28px',
            backgroundColor: '#fff',
            borderBottom: '1px solid #e8e8e8',
            position: 'sticky',
            top: 0,
            zIndex: 100
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                href: "/",
                style: {
                    fontSize: 20,
                    fontWeight: 700,
                    color: '#1a1a2e',
                    textDecoration: 'none',
                    letterSpacing: -0.5
                },
                children: "AEVION"
            }, void 0, false, {
                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                lineNumber: 122,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    display: 'flex',
                    gap: 24,
                    fontSize: 14,
                    fontWeight: 500
                },
                children: [
                    {
                        href: '/qright',
                        label: 'QRight'
                    },
                    {
                        href: '/qsign',
                        label: 'QSign'
                    },
                    {
                        href: '/quantum-shield',
                        label: 'Quantum Shield'
                    },
                    {
                        href: '/aevion-ip-bureau',
                        label: 'IP Bureau'
                    },
                    {
                        href: '/qtrade',
                        label: 'QTrade'
                    },
                    {
                        href: '/qcore',
                        label: 'QCoreAI'
                    },
                    {
                        href: '/cyberchess',
                        label: 'CyberChess'
                    }
                ].map((link)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                        href: link.href,
                        style: {
                            color: link.href === '/quantum-shield' ? '#4a6cf7' : '#555',
                            textDecoration: 'none',
                            transition: 'color 0.2s'
                        },
                        children: link.label
                    }, link.href, false, {
                        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                        lineNumber: 138,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                lineNumber: 128,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                href: "/auth",
                style: {
                    padding: '8px 20px',
                    borderRadius: 10,
                    backgroundColor: '#1a1a2e',
                    color: 'white',
                    fontSize: 13,
                    fontWeight: 500,
                    textDecoration: 'none'
                },
                children: "Sign In"
            }, void 0, false, {
                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                lineNumber: 147,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
        lineNumber: 116,
        columnNumber: 5
    }, this);
}
// ── Sub-components ──────────────────────────────────────────────────
function StatusBadge({ status }) {
    const config = {
        protected: {
            label: 'Protected',
            color: '#0a8f5c',
            bg: '#e6f7ef'
        },
        warning: {
            label: 'Warning',
            color: '#b8860b',
            bg: '#fff8e1'
        },
        critical: {
            label: 'Critical',
            color: '#c0392b',
            bg: '#fdecea'
        }
    };
    const c = config[status];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.3,
            color: c.color,
            backgroundColor: c.bg
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                style: {
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: c.color,
                    boxShadow: status === 'critical' ? `0 0 6px ${c.color}` : 'none',
                    animation: status === 'critical' ? 'pulse 1.5s infinite' : 'none'
                }
            }, void 0, false, {
                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                lineNumber: 173,
                columnNumber: 7
            }, this),
            c.label
        ]
    }, void 0, true, {
        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
        lineNumber: 167,
        columnNumber: 5
    }, this);
}
function ShardStatusDot({ status }) {
    const colors = {
        active: '#0a8f5c',
        offline: '#b8860b',
        compromised: '#c0392b'
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        style: {
            width: 9,
            height: 9,
            borderRadius: '50%',
            backgroundColor: colors[status],
            boxShadow: `0 0 4px ${colors[status]}40`,
            display: 'inline-block'
        }
    }, void 0, false, {
        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
        lineNumber: 186,
        columnNumber: 5
    }, this);
}
function ShardVisual({ shards, threshold }) {
    const activeCount = shards.filter((s)=>s.status === 'active').length;
    const isSecure = activeCount >= threshold;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                width: "140",
                height: "120",
                viewBox: "0 0 140 120",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                        x1: "70",
                        y1: "15",
                        x2: "25",
                        y2: "100",
                        stroke: isSecure ? '#0a8f5c30' : '#c0392b30',
                        strokeWidth: "1.5",
                        strokeDasharray: "4 3"
                    }, void 0, false, {
                        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                        lineNumber: 202,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                        x1: "70",
                        y1: "15",
                        x2: "115",
                        y2: "100",
                        stroke: isSecure ? '#0a8f5c30' : '#c0392b30',
                        strokeWidth: "1.5",
                        strokeDasharray: "4 3"
                    }, void 0, false, {
                        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                        lineNumber: 203,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                        x1: "25",
                        y1: "100",
                        x2: "115",
                        y2: "100",
                        stroke: isSecure ? '#0a8f5c30' : '#c0392b30',
                        strokeWidth: "1.5",
                        strokeDasharray: "4 3"
                    }, void 0, false, {
                        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                        lineNumber: 204,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                        transform: "translate(70,55)",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                d: "M0-18 L16-8 L13 12 L0 20 L-13 12 L-16-8 Z",
                                fill: isSecure ? '#0a8f5c15' : '#c0392b15',
                                stroke: isSecure ? '#0a8f5c' : '#c0392b',
                                strokeWidth: "1.5"
                            }, void 0, false, {
                                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                lineNumber: 207,
                                columnNumber: 11
                            }, this),
                            isSecure ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                d: "M-5 1 L-1 5 L6-3",
                                fill: "none",
                                stroke: "#0a8f5c",
                                strokeWidth: "2",
                                strokeLinecap: "round",
                                strokeLinejoin: "round"
                            }, void 0, false, {
                                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                lineNumber: 212,
                                columnNumber: 13
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
                                textAnchor: "middle",
                                dy: "4",
                                fill: "#c0392b",
                                fontSize: "14",
                                fontWeight: "bold",
                                children: "!"
                            }, void 0, false, {
                                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                lineNumber: 214,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                        lineNumber: 206,
                        columnNumber: 9
                    }, this),
                    shards.map((shard, i)=>{
                        const positions = [
                            {
                                x: 70,
                                y: 15
                            },
                            {
                                x: 25,
                                y: 100
                            },
                            {
                                x: 115,
                                y: 100
                            }
                        ];
                        const pos = positions[i];
                        const colors = {
                            active: '#0a8f5c',
                            offline: '#b8860b',
                            compromised: '#c0392b'
                        };
                        const color = colors[shard.status];
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                            transform: `translate(${pos.x},${pos.y})`,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                                    r: "14",
                                    fill: "white",
                                    stroke: color,
                                    strokeWidth: "2"
                                }, void 0, false, {
                                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                    lineNumber: 225,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                                    r: "5",
                                    fill: color,
                                    opacity: shard.status === 'active' ? 1 : 0.4
                                }, void 0, false, {
                                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                    lineNumber: 226,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
                                    y: "26",
                                    textAnchor: "middle",
                                    fontSize: "9",
                                    fill: "#666",
                                    fontWeight: "500",
                                    children: [
                                        "S",
                                        shard.index
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                    lineNumber: 227,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, shard.id, true, {
                            fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                            lineNumber: 224,
                            columnNumber: 13
                        }, this);
                    })
                ]
            }, void 0, true, {
                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                lineNumber: 201,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    fontSize: 11,
                    color: '#888',
                    textAlign: 'center'
                },
                children: [
                    activeCount,
                    "/",
                    shards.length,
                    " shards active · ",
                    threshold,
                    " required"
                ]
            }, void 0, true, {
                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                lineNumber: 235,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
        lineNumber: 200,
        columnNumber: 5
    }, this);
}
// ── Table styles ────────────────────────────────────────────────────
const thStyle = {
    textAlign: 'left',
    padding: '10px 14px',
    fontSize: 11,
    fontWeight: 600,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5
};
const tdStyle = {
    padding: '10px 14px',
    fontSize: 13,
    color: '#333'
};
// ── MetaItem ────────────────────────────────────────────────────────
function MetaItem({ label, value, mono }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    fontSize: 11,
                    color: '#888',
                    marginBottom: 3,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5
                },
                children: label
            }, void 0, false, {
                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                lineNumber: 255,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    fontSize: 13,
                    fontWeight: 500,
                    color: '#1a1a2e',
                    fontFamily: mono ? "'JetBrains Mono', monospace" : 'inherit'
                },
                children: value
            }, void 0, false, {
                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                lineNumber: 258,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
        lineNumber: 254,
        columnNumber: 5
    }, this);
}
// ── ActionButton ────────────────────────────────────────────────────
function ActionButton({ label, icon, primary, onClick }) {
    const icons = {
        check: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
            d: "M5 13l4 4L19 7"
        }, void 0, false, {
            fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
            lineNumber: 273,
            columnNumber: 12
        }, this),
        refresh: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                    d: "M1 4v6h6"
                }, void 0, false, {
                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                    lineNumber: 274,
                    columnNumber: 16
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                    d: "M23 20v-6h-6"
                }, void 0, false, {
                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                    lineNumber: 274,
                    columnNumber: 37
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                    d: "M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"
                }, void 0, false, {
                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                    lineNumber: 274,
                    columnNumber: 62
                }, this)
            ]
        }, void 0, true),
        download: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                    d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                }, void 0, false, {
                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                    lineNumber: 275,
                    columnNumber: 17
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                    d: "M7 10l5 5 5-5"
                }, void 0, false, {
                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                    lineNumber: 275,
                    columnNumber: 71
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                    d: "M12 15V3"
                }, void 0, false, {
                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                    lineNumber: 275,
                    columnNumber: 97
                }, this)
            ]
        }, void 0, true)
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        onClick: onClick,
        style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '9px 18px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            border: primary ? 'none' : '1px solid #ddd',
            backgroundColor: primary ? '#1a1a2e' : 'white',
            color: primary ? 'white' : '#444',
            transition: 'all 0.2s'
        },
        onMouseEnter: (e)=>{
            e.currentTarget.style.backgroundColor = primary ? '#2a2a4e' : '#f5f5f5';
        },
        onMouseLeave: (e)=>{
            e.currentTarget.style.backgroundColor = primary ? '#1a1a2e' : 'white';
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                width: "15",
                height: "15",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: "2",
                strokeLinecap: "round",
                strokeLinejoin: "round",
                children: icons[icon]
            }, void 0, false, {
                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                lineNumber: 297,
                columnNumber: 7
            }, this),
            label
        ]
    }, void 0, true, {
        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
        lineNumber: 279,
        columnNumber: 5
    }, this);
}
// ── RecordCard ──────────────────────────────────────────────────────
function RecordCard({ record, isExpanded, onToggle, onVerify }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        style: {
            backgroundColor: '#fff',
            borderRadius: 16,
            border: '1px solid #e8e8e8',
            overflow: 'hidden',
            transition: 'all 0.3s ease',
            boxShadow: isExpanded ? '0 8px 32px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.03)'
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                onClick: onToggle,
                style: {
                    padding: '20px 24px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    transition: 'background 0.2s'
                },
                onMouseEnter: (e)=>e.currentTarget.style.backgroundColor = '#fafafa',
                onMouseLeave: (e)=>e.currentTarget.style.backgroundColor = 'transparent',
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            backgroundColor: '#f0f4ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        },
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                            width: "20",
                            height: "20",
                            viewBox: "0 0 24 24",
                            fill: "none",
                            stroke: "#4a6cf7",
                            strokeWidth: "2",
                            strokeLinecap: "round",
                            strokeLinejoin: "round",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                    d: "M12 2L3 7v10l9 5 9-5V7l-9-5z"
                                }, void 0, false, {
                                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                    lineNumber: 334,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                    d: "M12 22V12"
                                }, void 0, false, {
                                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                    lineNumber: 335,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                    d: "M3 7l9 5 9-5"
                                }, void 0, false, {
                                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                    lineNumber: 336,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                            lineNumber: 333,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                        lineNumber: 328,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            flex: 1,
                            minWidth: 0
                        },
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                style: {
                                    fontSize: 15,
                                    fontWeight: 600,
                                    color: '#1a1a2e',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                },
                                children: record.fileName
                            }, void 0, false, {
                                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                lineNumber: 341,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                style: {
                                    fontSize: 12,
                                    color: '#888',
                                    marginTop: 2
                                },
                                children: [
                                    formatDate(record.createdAt),
                                    " · ID: ",
                                    record.id
                                ]
                            }, void 0, true, {
                                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                lineNumber: 347,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                        lineNumber: 340,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(StatusBadge, {
                        status: record.status
                    }, void 0, false, {
                        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                        lineNumber: 352,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                        width: "20",
                        height: "20",
                        viewBox: "0 0 24 24",
                        fill: "none",
                        stroke: "#aaa",
                        strokeWidth: "2",
                        strokeLinecap: "round",
                        style: {
                            transition: 'transform 0.3s ease',
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                        },
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                            d: "M6 9l6 6 6-6"
                        }, void 0, false, {
                            fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                            lineNumber: 360,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                        lineNumber: 354,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                lineNumber: 318,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    maxHeight: isExpanded ? 600 : 0,
                    overflow: 'hidden',
                    transition: 'max-height 0.4s ease'
                },
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    style: {
                        padding: '0 24px 24px',
                        borderTop: '1px solid #f0f0f0'
                    },
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            style: {
                                display: 'grid',
                                gridTemplateColumns: '1fr 160px',
                                gap: 24,
                                paddingTop: 20
                            },
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            style: {
                                                display: 'grid',
                                                gridTemplateColumns: '1fr 1fr',
                                                gap: 16,
                                                marginBottom: 24
                                            },
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(MetaItem, {
                                                    label: "Algorithm",
                                                    value: record.algorithm
                                                }, void 0, false, {
                                                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                                    lineNumber: 376,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(MetaItem, {
                                                    label: "Quantum Resistance",
                                                    value: record.quantumResistanceLevel
                                                }, void 0, false, {
                                                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                                    lineNumber: 377,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(MetaItem, {
                                                    label: "Threshold",
                                                    value: `${record.threshold} of ${record.totalShards}`
                                                }, void 0, false, {
                                                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                                    lineNumber: 378,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(MetaItem, {
                                                    label: "Signature ID",
                                                    value: record.originalSignatureId,
                                                    mono: true
                                                }, void 0, false, {
                                                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                                    lineNumber: 379,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                            lineNumber: 375,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            style: {
                                                fontSize: 13,
                                                fontWeight: 600,
                                                color: '#1a1a2e',
                                                marginBottom: 10
                                            },
                                            children: "Shard Details"
                                        }, void 0, false, {
                                            fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                            lineNumber: 382,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            style: {
                                                borderRadius: 10,
                                                border: '1px solid #eee',
                                                overflow: 'hidden'
                                            },
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                                                style: {
                                                    width: '100%',
                                                    borderCollapse: 'collapse',
                                                    fontSize: 13
                                                },
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                            style: {
                                                                backgroundColor: '#f8f9fb'
                                                            },
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                    style: thStyle,
                                                                    children: "#"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                                                    lineNumber: 389,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                    style: thStyle,
                                                                    children: "Location"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                                                    lineNumber: 390,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                    style: thStyle,
                                                                    children: "Status"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                                                    lineNumber: 391,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                    style: thStyle,
                                                                    children: "Last Verified"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                                                    lineNumber: 392,
                                                                    columnNumber: 23
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                                            lineNumber: 388,
                                                            columnNumber: 21
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                                        lineNumber: 387,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                                        children: record.shards.map((shard)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                                style: {
                                                                    borderTop: '1px solid #f0f0f0'
                                                                },
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                        style: tdStyle,
                                                                        children: [
                                                                            "S",
                                                                            shard.index
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                                                        lineNumber: 398,
                                                                        columnNumber: 25
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                        style: tdStyle,
                                                                        children: shard.location
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                                                        lineNumber: 399,
                                                                        columnNumber: 25
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                        style: tdStyle,
                                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            style: {
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                gap: 6
                                                                            },
                                                                            children: [
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ShardStatusDot, {
                                                                                    status: shard.status
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                                                                    lineNumber: 402,
                                                                                    columnNumber: 29
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                    style: {
                                                                                        textTransform: 'capitalize'
                                                                                    },
                                                                                    children: shard.status
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                                                                    lineNumber: 403,
                                                                                    columnNumber: 29
                                                                                }, this)
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                                                            lineNumber: 401,
                                                                            columnNumber: 27
                                                                        }, this)
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                                                        lineNumber: 400,
                                                                        columnNumber: 25
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                        style: {
                                                                            ...tdStyle,
                                                                            color: '#888'
                                                                        },
                                                                        children: timeAgo(shard.lastVerified)
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                                                        lineNumber: 406,
                                                                        columnNumber: 25
                                                                    }, this)
                                                                ]
                                                            }, shard.id, true, {
                                                                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                                                lineNumber: 397,
                                                                columnNumber: 23
                                                            }, this))
                                                    }, void 0, false, {
                                                        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                                        lineNumber: 395,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                                lineNumber: 386,
                                                columnNumber: 17
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                            lineNumber: 385,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                    lineNumber: 374,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: '#fafbfc',
                                        borderRadius: 12,
                                        padding: 16
                                    },
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ShardVisual, {
                                        shards: record.shards,
                                        threshold: record.threshold
                                    }, void 0, false, {
                                        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                        lineNumber: 418,
                                        columnNumber: 15
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                    lineNumber: 414,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                            lineNumber: 370,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            style: {
                                display: 'flex',
                                gap: 10,
                                marginTop: 20,
                                paddingTop: 16,
                                borderTop: '1px solid #f0f0f0'
                            },
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ActionButton, {
                                    label: "Verify Shards",
                                    icon: "check",
                                    primary: true,
                                    onClick: ()=>onVerify(record.id)
                                }, void 0, false, {
                                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                    lineNumber: 426,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ActionButton, {
                                    label: "Reshare Secret",
                                    icon: "refresh"
                                }, void 0, false, {
                                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                    lineNumber: 427,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ActionButton, {
                                    label: "Download Certificate",
                                    icon: "download"
                                }, void 0, false, {
                                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                    lineNumber: 428,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                            lineNumber: 422,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                    lineNumber: 369,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                lineNumber: 365,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
        lineNumber: 311,
        columnNumber: 5
    }, this);
}
// ── StatCard ────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        style: {
            backgroundColor: '#fff',
            borderRadius: 14,
            border: '1px solid #e8e8e8',
            padding: '20px 22px',
            flex: 1,
            minWidth: 160
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    fontSize: 11,
                    color: '#888',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginBottom: 8
                },
                children: label
            }, void 0, false, {
                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                lineNumber: 446,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    fontSize: 28,
                    fontWeight: 700,
                    color,
                    lineHeight: 1.1
                },
                children: value
            }, void 0, false, {
                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                lineNumber: 449,
                columnNumber: 7
            }, this),
            sub && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    fontSize: 12,
                    color: '#aaa',
                    marginTop: 4
                },
                children: sub
            }, void 0, false, {
                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                lineNumber: 452,
                columnNumber: 15
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
        lineNumber: 441,
        columnNumber: 5
    }, this);
}
function QuantumShieldPage() {
    const [records, setRecords] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [expandedId, setExpandedId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(true);
    const [filter, setFilter] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('all');
    const [verifyingId, setVerifyingId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        async function fetchRecords() {
            try {
                const res = await fetch(`${API}/api/quantum-shield`);
                if (!res.ok) throw new Error('API unavailable');
                const data = await res.json();
                setRecords(data.records || []);
            } catch  {
                // Fallback to mock data
                setRecords(MOCK_RECORDS);
            } finally{
                setLoading(false);
            }
        }
        fetchRecords();
    }, []);
    async function handleVerify(id) {
        setVerifyingId(id);
        try {
            const res = await fetch(`${API}/api/quantum-shield/${id}/verify`, {
                method: 'POST'
            });
            if (res.ok) {
                // Refresh shard timestamps locally
                setRecords((prev)=>prev.map((r)=>{
                        if (r.id !== id) return r;
                        return {
                            ...r,
                            shards: r.shards.map((s)=>s.status === 'active' ? {
                                    ...s,
                                    lastVerified: new Date().toISOString()
                                } : s)
                        };
                    }));
            }
        } catch  {
        // Silent fail — demo mode
        } finally{
            setVerifyingId(null);
        }
    }
    const filtered = filter === 'all' ? records : records.filter((r)=>r.status === filter);
    const stats = {
        total: records.length,
        protected: records.filter((r)=>r.status === 'protected').length,
        warning: records.filter((r)=>r.status === 'warning').length,
        critical: records.filter((r)=>r.status === 'critical').length,
        totalShards: records.reduce((sum, r)=>sum + r.totalShards, 0),
        activeShards: records.reduce((sum, r)=>sum + r.shards.filter((s)=>s.status === 'active').length, 0)
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        translate: "no",
        suppressHydrationWarning: true,
        style: {
            minHeight: '100vh',
            backgroundColor: '#f5f6f8',
            fontFamily: "'DM Sans', -apple-system, sans-serif"
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("style", {
                children: `
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
      `
            }, void 0, false, {
                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                lineNumber: 522,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(TopNav, {}, void 0, false, {
                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                lineNumber: 540,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
                    padding: '48px 0 60px',
                    position: 'relative',
                    overflow: 'hidden'
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            position: 'absolute',
                            inset: 0,
                            opacity: 0.06,
                            backgroundImage: `linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)`,
                            backgroundSize: '40px 40px'
                        }
                    }, void 0, false, {
                        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                        lineNumber: 547,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            position: 'absolute',
                            top: -100,
                            right: -100,
                            width: 400,
                            height: 400,
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(74,108,247,0.15) 0%, transparent 70%)'
                        }
                    }, void 0, false, {
                        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                        lineNumber: 552,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            maxWidth: 960,
                            margin: '0 auto',
                            padding: '0 24px',
                            position: 'relative'
                        },
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: 14,
                                marginBottom: 12
                            },
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    style: {
                                        width: 48,
                                        height: 48,
                                        borderRadius: 14,
                                        background: 'linear-gradient(135deg, #4a6cf7, #6366f1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 4px 16px rgba(74,108,247,0.3)'
                                    },
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                        width: "24",
                                        height: "24",
                                        viewBox: "0 0 24 24",
                                        fill: "none",
                                        stroke: "white",
                                        strokeWidth: "2",
                                        strokeLinecap: "round",
                                        strokeLinejoin: "round",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                                d: "M12 2L3 7v10l9 5 9-5V7l-9-5z"
                                            }, void 0, false, {
                                                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                                lineNumber: 566,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                                d: "M12 22V12"
                                            }, void 0, false, {
                                                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                                lineNumber: 567,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                                d: "M3 7l9 5 9-5"
                                            }, void 0, false, {
                                                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                                lineNumber: 568,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                        lineNumber: 565,
                                        columnNumber: 15
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                    lineNumber: 559,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                            style: {
                                                fontSize: 28,
                                                fontWeight: 700,
                                                color: 'white',
                                                margin: 0,
                                                letterSpacing: -0.5
                                            },
                                            children: "Quantum Shield"
                                        }, void 0, false, {
                                            fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                            lineNumber: 572,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            style: {
                                                fontSize: 14,
                                                color: 'rgba(255,255,255,0.55)',
                                                margin: 0
                                            },
                                            children: "Shamir's Secret Sharing · Post-quantum IP protection"
                                        }, void 0, false, {
                                            fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                            lineNumber: 575,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                    lineNumber: 571,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                            lineNumber: 558,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                        lineNumber: 557,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                lineNumber: 543,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    maxWidth: 960,
                    margin: '-30px auto 0',
                    padding: '0 24px 60px',
                    position: 'relative'
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            display: 'flex',
                            gap: 14,
                            marginBottom: 28,
                            animation: 'fadeIn 0.5s ease',
                            flexWrap: 'wrap'
                        },
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(StatCard, {
                                label: "Total Records",
                                value: stats.total,
                                sub: `${stats.totalShards} shards total`,
                                color: "#1a1a2e"
                            }, void 0, false, {
                                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                lineNumber: 587,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(StatCard, {
                                label: "Protected",
                                value: stats.protected,
                                color: "#0a8f5c"
                            }, void 0, false, {
                                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                lineNumber: 588,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(StatCard, {
                                label: "Warnings",
                                value: stats.warning,
                                color: "#b8860b"
                            }, void 0, false, {
                                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                lineNumber: 589,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(StatCard, {
                                label: "Critical",
                                value: stats.critical,
                                sub: stats.critical > 0 ? 'Action needed' : undefined,
                                color: "#c0392b"
                            }, void 0, false, {
                                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                lineNumber: 590,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                        lineNumber: 586,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 20,
                            flexWrap: 'wrap',
                            gap: 12
                        },
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                style: {
                                    display: 'flex',
                                    gap: 8
                                },
                                children: [
                                    'all',
                                    'protected',
                                    'warning',
                                    'critical'
                                ].map((f)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        className: `qs-filter-btn ${filter === f ? 'active' : ''}`,
                                        onClick: ()=>setFilter(f),
                                        children: [
                                            f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1),
                                            f !== 'all' && ` ${records.filter((r)=>r.status === f).length}`
                                        ]
                                    }, f, true, {
                                        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                        lineNumber: 597,
                                        columnNumber: 15
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                lineNumber: 595,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                style: {
                                    fontSize: 13,
                                    color: '#888'
                                },
                                children: [
                                    stats.activeShards,
                                    "/",
                                    stats.totalShards,
                                    " shards online"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                lineNumber: 607,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                        lineNumber: 594,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 14
                        },
                        children: loading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                            children: [
                                1,
                                2,
                                3
                            ].map((i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "qs-loading-card"
                                }, i, false, {
                                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                    lineNumber: 615,
                                    columnNumber: 33
                                }, this))
                        }, void 0, false) : filtered.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            style: {
                                textAlign: 'center',
                                padding: 60,
                                color: '#888',
                                backgroundColor: '#fff',
                                borderRadius: 16,
                                border: '1px solid #e8e8e8'
                            },
                            children: [
                                "No records found with status “",
                                filter,
                                "”"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                            lineNumber: 617,
                            columnNumber: 13
                        }, this) : filtered.map((record, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                style: {
                                    animation: `fadeIn 0.4s ease ${i * 0.08}s both`
                                },
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aevion$2d$portal$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(RecordCard, {
                                    record: record,
                                    isExpanded: expandedId === record.id,
                                    onToggle: ()=>setExpandedId(expandedId === record.id ? null : record.id),
                                    onVerify: handleVerify
                                }, void 0, false, {
                                    fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                    lineNumber: 626,
                                    columnNumber: 17
                                }, this)
                            }, record.id, false, {
                                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                                lineNumber: 625,
                                columnNumber: 15
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                        lineNumber: 613,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
                lineNumber: 584,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/aevion-portal-frontend/src/app/quantum-shield/page.tsx",
        lineNumber: 517,
        columnNumber: 5
    }, this);
}
}),
];

//# sourceMappingURL=aevion-portal-frontend_src_app_quantum-shield_page_tsx_15ac0343._.js.map