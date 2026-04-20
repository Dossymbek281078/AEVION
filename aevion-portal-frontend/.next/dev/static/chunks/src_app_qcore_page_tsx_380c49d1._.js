(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/app/qcore/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>QCorePage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
const API = ("TURBOPACK compile-time truthy", 1) ? `${"TURBOPACK compile-time value", "http://localhost:4001"}/api/qcore` : "TURBOPACK unreachable";
const WS_URL = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_WS_URL || "ws://localhost:4001/ws/qcore";
const USER_ID = "test-user-1";
function CodeBlock({ code, lang }) {
    _s();
    const [copied, setCopied] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        style: {
            position: "relative",
            margin: "12px 0",
            borderRadius: 10,
            overflow: "hidden",
            background: "#0d1117",
            border: "1px solid #21262d"
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 12px",
                    background: "#161b22",
                    fontSize: 11,
                    color: "#8b949e"
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: lang || "code"
                    }, void 0, false, {
                        fileName: "[project]/src/app/qcore/page.tsx",
                        lineNumber: 17,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>{
                            navigator.clipboard.writeText(code);
                            setCopied(true);
                            setTimeout(()=>setCopied(false), 2000);
                        },
                        style: {
                            background: "none",
                            border: "1px solid #30363d",
                            borderRadius: 6,
                            color: "#8b949e",
                            padding: "2px 10px",
                            cursor: "pointer",
                            fontSize: 11
                        },
                        children: copied ? "Copied!" : "Copy"
                    }, void 0, false, {
                        fileName: "[project]/src/app/qcore/page.tsx",
                        lineNumber: 18,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/qcore/page.tsx",
                lineNumber: 16,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("pre", {
                style: {
                    margin: 0,
                    padding: 14,
                    overflowX: "auto",
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: "#c9d1d9"
                },
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("code", {
                    children: code
                }, void 0, false, {
                    fileName: "[project]/src/app/qcore/page.tsx",
                    lineNumber: 23,
                    columnNumber: 115
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/app/qcore/page.tsx",
                lineNumber: 23,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/qcore/page.tsx",
        lineNumber: 15,
        columnNumber: 5
    }, this);
}
_s(CodeBlock, "NE86rL3vg4NVcTTWDavsT0hUBJs=");
_c = CodeBlock;
function renderContent(text) {
    const parts = [];
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    let key = 0;
    while((match = codeBlockRegex.exec(text)) !== null){
        if (match.index > lastIndex) {
            parts.push(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                dangerouslySetInnerHTML: {
                    __html: formatInline(text.slice(lastIndex, match.index))
                }
            }, key++, false, {
                fileName: "[project]/src/app/qcore/page.tsx",
                lineNumber: 36,
                columnNumber: 18
            }, this));
        }
        parts.push(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CodeBlock, {
            lang: match[1],
            code: match[2].trimEnd()
        }, key++, false, {
            fileName: "[project]/src/app/qcore/page.tsx",
            lineNumber: 38,
            columnNumber: 16
        }, this));
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
        parts.push(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            dangerouslySetInnerHTML: {
                __html: formatInline(text.slice(lastIndex))
            }
        }, key++, false, {
            fileName: "[project]/src/app/qcore/page.tsx",
            lineNumber: 42,
            columnNumber: 16
        }, this));
    }
    return parts;
}
function formatInline(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, '<code style="background:#1e293b;padding:2px 6px;border-radius:4px;font-size:12px">$1</code>').replace(/\n/g, "<br/>");
}
function QCorePage() {
    _s1();
    const [chats, setChats] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [activeChatId, setActiveChatId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [messages, setMessages] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [input, setInput] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [streaming, setStreaming] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [streamText, setStreamText] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [sidebarOpen, setSidebarOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const wsRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const bottomRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const inputRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "QCorePage.useEffect": ()=>{
            loadChats();
        }
    }["QCorePage.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "QCorePage.useEffect": ()=>{
            bottomRef.current?.scrollIntoView({
                behavior: "smooth"
            });
        }
    }["QCorePage.useEffect"], [
        messages,
        streamText
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "QCorePage.useEffect": ()=>{
            if (inputRef.current) {
                inputRef.current.style.height = "auto";
                inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 150) + "px";
            }
        }
    }["QCorePage.useEffect"], [
        input
    ]);
    async function loadChats() {
        const res = await fetch(`${API}/chats`, {
            headers: {
                "x-user-id": USER_ID
            }
        });
        setChats(await res.json());
    }
    async function loadMessages(chatId) {
        const res = await fetch(`${API}/chats/${chatId}/messages`, {
            headers: {
                "x-user-id": USER_ID
            }
        });
        setMessages(await res.json());
        setActiveChatId(chatId);
    }
    async function createChat() {
        const res = await fetch(`${API}/chats`, {
            method: "POST",
            headers: {
                "x-user-id": USER_ID,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({})
        });
        const chat = await res.json();
        setChats((p)=>[
                chat,
                ...p
            ]);
        setActiveChatId(chat.id);
        setMessages([]);
        inputRef.current?.focus();
    }
    function connectWS() {
        return new Promise((resolve)=>{
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                resolve(wsRef.current);
                return;
            }
            const ws = new WebSocket(WS_URL);
            ws.onopen = ()=>{
                ws.send(JSON.stringify({
                    type: "auth",
                    userId: USER_ID
                }));
                wsRef.current = ws;
                setTimeout(()=>resolve(ws), 100);
            };
            ws.onclose = ()=>{
                wsRef.current = null;
            };
        });
    }
    async function sendMessage() {
        if (!input.trim() || !activeChatId || streaming) return;
        const userMsg = input.trim();
        setInput("");
        setMessages((p)=>[
                ...p,
                {
                    role: "user",
                    content: userMsg
                }
            ]);
        setStreaming(true);
        setStreamText("");
        const ws = await connectWS();
        const handler = (event)=>{
            const data = JSON.parse(event.data);
            if (data.type === "chunk") setStreamText((p)=>p + data.text);
            if (data.type === "stream_end") {
                setMessages((p)=>[
                        ...p,
                        {
                            role: "assistant",
                            content: data.content
                        }
                    ]);
                setStreamText("");
                setStreaming(false);
                ws.removeEventListener("message", handler);
                loadChats();
            }
            if (data.type === "error") {
                setStreamText("");
                setStreaming(false);
                setMessages((p)=>[
                        ...p,
                        {
                            role: "assistant",
                            content: "Error: " + data.message
                        }
                    ]);
                ws.removeEventListener("message", handler);
            }
        };
        ws.addEventListener("message", handler);
        ws.send(JSON.stringify({
            type: "message",
            chatId: activeChatId,
            content: userMsg
        }));
    }
    async function deleteChat(chatId) {
        await fetch(`${API}/chats/${chatId}`, {
            method: "DELETE",
            headers: {
                "x-user-id": USER_ID
            }
        });
        setChats((p)=>p.filter((c)=>c.id !== chatId));
        if (activeChatId === chatId) {
            setActiveChatId(null);
            setMessages([]);
        }
    }
    const activeChat = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "QCorePage.useMemo[activeChat]": ()=>chats.find({
                "QCorePage.useMemo[activeChat]": (c)=>c.id === activeChatId
            }["QCorePage.useMemo[activeChat]"])
    }["QCorePage.useMemo[activeChat]"], [
        chats,
        activeChatId
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        style: {
            display: "flex",
            height: "calc(100vh - 49px)",
            background: "#0a0e1a",
            color: "#e2e8f0"
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    width: sidebarOpen ? 280 : 0,
                    overflow: "hidden",
                    transition: "width 0.3s",
                    background: "#0f1629",
                    borderRight: "1px solid #1e293b",
                    display: "flex",
                    flexDirection: "column"
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            padding: 16,
                            borderBottom: "1px solid #1e293b"
                        },
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: createChat,
                            style: {
                                width: "100%",
                                padding: "10px 0",
                                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                                border: "none",
                                borderRadius: 10,
                                color: "#fff",
                                fontWeight: 600,
                                fontSize: 14,
                                cursor: "pointer"
                            },
                            children: "+ New Chat"
                        }, void 0, false, {
                            fileName: "[project]/src/app/qcore/page.tsx",
                            lineNumber: 134,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/app/qcore/page.tsx",
                        lineNumber: 133,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            flex: 1,
                            overflowY: "auto"
                        },
                        children: chats.map((chat)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                onClick: ()=>loadMessages(chat.id),
                                style: {
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "12px 16px",
                                    cursor: "pointer",
                                    transition: "background 0.2s",
                                    background: activeChatId === chat.id ? "#1e293b" : "transparent",
                                    borderLeft: activeChatId === chat.id ? "3px solid #6366f1" : "3px solid transparent"
                                },
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        style: {
                                            fontSize: 13,
                                            flex: 1,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                            color: activeChatId === chat.id ? "#fff" : "#94a3b8"
                                        },
                                        children: chat.title
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/qcore/page.tsx",
                                        lineNumber: 149,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: (e)=>{
                                            e.stopPropagation();
                                            deleteChat(chat.id);
                                        },
                                        style: {
                                            background: "none",
                                            border: "none",
                                            color: "#475569",
                                            cursor: "pointer",
                                            fontSize: 14,
                                            padding: "0 4px"
                                        },
                                        children: "✕"
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/qcore/page.tsx",
                                        lineNumber: 152,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, chat.id, true, {
                                fileName: "[project]/src/app/qcore/page.tsx",
                                lineNumber: 143,
                                columnNumber: 13
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/src/app/qcore/page.tsx",
                        lineNumber: 141,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            padding: 12,
                            borderTop: "1px solid #1e293b",
                            textAlign: "center",
                            fontSize: 11,
                            color: "#475569"
                        },
                        children: "QCoreAI · Powered by Claude"
                    }, void 0, false, {
                        fileName: "[project]/src/app/qcore/page.tsx",
                        lineNumber: 157,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/qcore/page.tsx",
                lineNumber: 129,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    position: "relative"
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            padding: "10px 20px",
                            borderBottom: "1px solid #1e293b",
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            background: "#0d1220"
                        },
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>setSidebarOpen(!sidebarOpen),
                                style: {
                                    background: "none",
                                    border: "none",
                                    color: "#64748b",
                                    cursor: "pointer",
                                    fontSize: 18
                                },
                                children: "☰"
                            }, void 0, false, {
                                fileName: "[project]/src/app/qcore/page.tsx",
                                lineNumber: 166,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                style: {
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: "#c4b5fd"
                                },
                                children: activeChat?.title || "QCoreAI"
                            }, void 0, false, {
                                fileName: "[project]/src/app/qcore/page.tsx",
                                lineNumber: 168,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/qcore/page.tsx",
                        lineNumber: 165,
                        columnNumber: 9
                    }, this),
                    !activeChatId ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                        },
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            style: {
                                textAlign: "center"
                            },
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    style: {
                                        fontSize: 56,
                                        marginBottom: 12
                                    },
                                    children: "🧠"
                                }, void 0, false, {
                                    fileName: "[project]/src/app/qcore/page.tsx",
                                    lineNumber: 174,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                    style: {
                                        fontSize: 36,
                                        fontWeight: 800,
                                        marginBottom: 8,
                                        background: "linear-gradient(135deg, #6366f1, #a78bfa, #c084fc)",
                                        WebkitBackgroundClip: "text",
                                        WebkitTextFillColor: "transparent"
                                    },
                                    children: "QCoreAI"
                                }, void 0, false, {
                                    fileName: "[project]/src/app/qcore/page.tsx",
                                    lineNumber: 175,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    style: {
                                        color: "#64748b",
                                        fontSize: 16,
                                        marginBottom: 24
                                    },
                                    children: "Your intelligent assistant on AEVION platform"
                                }, void 0, false, {
                                    fileName: "[project]/src/app/qcore/page.tsx",
                                    lineNumber: 178,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    style: {
                                        display: "flex",
                                        gap: 12,
                                        justifyContent: "center",
                                        flexWrap: "wrap"
                                    },
                                    children: [
                                        "Write code",
                                        "Create content",
                                        "Analyze data",
                                        "Brainstorm ideas"
                                    ].map((t)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            style: {
                                                padding: "8px 16px",
                                                background: "#1e293b",
                                                borderRadius: 20,
                                                fontSize: 13,
                                                color: "#94a3b8",
                                                border: "1px solid #334155"
                                            },
                                            children: t
                                        }, t, false, {
                                            fileName: "[project]/src/app/qcore/page.tsx",
                                            lineNumber: 181,
                                            columnNumber: 19
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/src/app/qcore/page.tsx",
                                    lineNumber: 179,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: createChat,
                                    style: {
                                        marginTop: 32,
                                        padding: "12px 32px",
                                        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                                        border: "none",
                                        borderRadius: 12,
                                        color: "#fff",
                                        fontWeight: 600,
                                        fontSize: 15,
                                        cursor: "pointer"
                                    },
                                    children: "Start a conversation"
                                }, void 0, false, {
                                    fileName: "[project]/src/app/qcore/page.tsx",
                                    lineNumber: 184,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/app/qcore/page.tsx",
                            lineNumber: 173,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/app/qcore/page.tsx",
                        lineNumber: 172,
                        columnNumber: 11
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                style: {
                                    flex: 1,
                                    overflowY: "auto",
                                    padding: "24px 0"
                                },
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    style: {
                                        maxWidth: 800,
                                        margin: "0 auto",
                                        padding: "0 20px"
                                    },
                                    children: [
                                        messages.map((msg, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                style: {
                                                    marginBottom: 24,
                                                    display: "flex",
                                                    gap: 12,
                                                    flexDirection: msg.role === "user" ? "row-reverse" : "row"
                                                },
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        style: {
                                                            width: 32,
                                                            height: 32,
                                                            borderRadius: "50%",
                                                            flexShrink: 0,
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            fontSize: 14,
                                                            background: msg.role === "user" ? "#4f46e5" : "linear-gradient(135deg, #6366f1, #a78bfa)",
                                                            color: "#fff"
                                                        },
                                                        children: msg.role === "user" ? "U" : "Q"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/qcore/page.tsx",
                                                        lineNumber: 199,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        style: {
                                                            maxWidth: "75%",
                                                            padding: "12px 16px",
                                                            borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                                                            background: msg.role === "user" ? "#4f46e5" : "#1a1f35",
                                                            border: msg.role === "user" ? "none" : "1px solid #1e293b",
                                                            fontSize: 14,
                                                            lineHeight: 1.7,
                                                            color: "#e2e8f0"
                                                        },
                                                        children: renderContent(msg.content)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/qcore/page.tsx",
                                                        lineNumber: 206,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, i, true, {
                                                fileName: "[project]/src/app/qcore/page.tsx",
                                                lineNumber: 198,
                                                columnNumber: 19
                                            }, this)),
                                        streaming && streamText && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            style: {
                                                marginBottom: 24,
                                                display: "flex",
                                                gap: 12
                                            },
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    style: {
                                                        width: 32,
                                                        height: 32,
                                                        borderRadius: "50%",
                                                        flexShrink: 0,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        fontSize: 14,
                                                        background: "linear-gradient(135deg, #6366f1, #a78bfa)",
                                                        color: "#fff"
                                                    },
                                                    children: "Q"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/qcore/page.tsx",
                                                    lineNumber: 218,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    style: {
                                                        maxWidth: "75%",
                                                        padding: "12px 16px",
                                                        borderRadius: "16px 16px 16px 4px",
                                                        background: "#1a1f35",
                                                        border: "1px solid #1e293b",
                                                        fontSize: 14,
                                                        lineHeight: 1.7
                                                    },
                                                    children: [
                                                        renderContent(streamText),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            style: {
                                                                display: "inline-block",
                                                                width: 8,
                                                                height: 18,
                                                                background: "#6366f1",
                                                                borderRadius: 2,
                                                                marginLeft: 2,
                                                                animation: "pulse 1s infinite"
                                                            }
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/qcore/page.tsx",
                                                            lineNumber: 221,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/app/qcore/page.tsx",
                                                    lineNumber: 219,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/app/qcore/page.tsx",
                                            lineNumber: 217,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            ref: bottomRef
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/qcore/page.tsx",
                                            lineNumber: 225,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/qcore/page.tsx",
                                    lineNumber: 196,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/app/qcore/page.tsx",
                                lineNumber: 195,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                style: {
                                    borderTop: "1px solid #1e293b",
                                    padding: "16px 20px",
                                    background: "#0d1220"
                                },
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    style: {
                                        maxWidth: 800,
                                        margin: "0 auto",
                                        display: "flex",
                                        gap: 12,
                                        alignItems: "flex-end"
                                    },
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                            ref: inputRef,
                                            value: input,
                                            onChange: (e)=>setInput(e.target.value),
                                            onKeyDown: (e)=>{
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    sendMessage();
                                                }
                                            },
                                            placeholder: "Message QCoreAI...",
                                            disabled: streaming,
                                            rows: 1,
                                            style: {
                                                flex: 1,
                                                background: "#151b2e",
                                                border: "1px solid #1e293b",
                                                borderRadius: 12,
                                                padding: "12px 16px",
                                                color: "#e2e8f0",
                                                fontSize: 14,
                                                resize: "none",
                                                outline: "none",
                                                maxHeight: 150,
                                                lineHeight: 1.5,
                                                fontFamily: "inherit"
                                            }
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/qcore/page.tsx",
                                            lineNumber: 232,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: sendMessage,
                                            disabled: streaming || !input.trim(),
                                            style: {
                                                padding: "12px 20px",
                                                background: streaming || !input.trim() ? "#1e293b" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                                                border: "none",
                                                borderRadius: 12,
                                                color: streaming || !input.trim() ? "#475569" : "#fff",
                                                fontWeight: 600,
                                                fontSize: 14,
                                                cursor: streaming || !input.trim() ? "default" : "pointer",
                                                transition: "all 0.2s"
                                            },
                                            children: streaming ? "⏳" : "Send"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/qcore/page.tsx",
                                            lineNumber: 243,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/qcore/page.tsx",
                                    lineNumber: 231,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/app/qcore/page.tsx",
                                lineNumber: 230,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/qcore/page.tsx",
                lineNumber: 163,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("style", {
                children: `
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
        textarea::placeholder { color: #475569; }
      `
            }, void 0, false, {
                fileName: "[project]/src/app/qcore/page.tsx",
                lineNumber: 257,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/qcore/page.tsx",
        lineNumber: 127,
        columnNumber: 5
    }, this);
}
_s1(QCorePage, "14tYFvQtbVkB7jOKhH3yz79GIsI=");
_c1 = QCorePage;
var _c, _c1;
__turbopack_context__.k.register(_c, "CodeBlock");
__turbopack_context__.k.register(_c1, "QCorePage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_app_qcore_page_tsx_380c49d1._.js.map