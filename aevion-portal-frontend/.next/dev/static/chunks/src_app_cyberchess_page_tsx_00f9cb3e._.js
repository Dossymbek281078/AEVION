(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/app/cyberchess/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>CyberChessPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$chess$2e$js$2f$dist$2f$esm$2f$chess$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/chess.js/dist/esm/chess.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
const API_BASE = ("TURBOPACK compile-time value", "http://localhost:4001") || "http://localhost:4001";
function CyberChessPage() {
    _s();
    const [players, setPlayers] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loadingPlayers, setLoadingPlayers] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [playersErr, setPlayersErr] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [newPlayerName, setNewPlayerName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [whiteId, setWhiteId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [blackId, setBlackId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [gameId, setGameId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [game, setGame] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [moves, setMoves] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loadingGame, setLoadingGame] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [gameErr, setGameErr] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [uciMove, setUciMove] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("e2e4");
    const [addingMove, setAddingMove] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [selectedFrom, setSelectedFrom] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [selectedPiece, setSelectedPiece] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const lastMove = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CyberChessPage.useMemo[lastMove]": ()=>{
            return moves.length ? moves[moves.length - 1] : null;
        }
    }["CyberChessPage.useMemo[lastMove]"], [
        moves
    ]);
    const lastFromTo = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CyberChessPage.useMemo[lastFromTo]": ()=>{
            const uci = lastMove?.uci || null;
            if (!uci || uci.length < 4) return null;
            const from = uci.slice(0, 2);
            const to = uci.slice(2, 4);
            return {
                from,
                to
            };
        }
    }["CyberChessPage.useMemo[lastFromTo]"], [
        lastMove
    ]);
    const fenBoard = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CyberChessPage.useMemo[fenBoard]": ()=>{
            const fen = game?.fen || "";
            const placement = fen.split(" ")[0] || "";
            if (!placement) return null;
            const ranks = placement.split("/");
            if (ranks.length !== 8) return null;
            const board = Array.from({
                length: 8
            }, {
                "CyberChessPage.useMemo[fenBoard].board": ()=>Array.from({
                        length: 8
                    }, {
                        "CyberChessPage.useMemo[fenBoard].board": ()=>null
                    }["CyberChessPage.useMemo[fenBoard].board"])
            }["CyberChessPage.useMemo[fenBoard].board"]);
            for(let r = 0; r < 8; r++){
                const rank = ranks[r] || "";
                let c = 0;
                for(let i = 0; i < rank.length; i++){
                    const ch = rank[i];
                    if (ch >= "1" && ch <= "8") {
                        const n = Number(ch);
                        for(let k = 0; k < n; k++){
                            board[r][c] = null;
                            c++;
                        }
                        continue;
                    }
                    if (c < 8) {
                        board[r][c] = ch;
                        c++;
                    }
                }
            }
            const activeColor = (fen.split(" ")[1] || "w") === "b" ? "b" : "w";
            return {
                board,
                activeColor
            };
        }
    }["CyberChessPage.useMemo[fenBoard]"], [
        game?.fen
    ]);
    const chessForLegal = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CyberChessPage.useMemo[chessForLegal]": ()=>{
            if (!game?.fen) return null;
            try {
                return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$chess$2e$js$2f$dist$2f$esm$2f$chess$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Chess"](game.fen);
            } catch  {
                return null;
            }
        }
    }["CyberChessPage.useMemo[chessForLegal]"], [
        game?.fen
    ]);
    const legalMoves = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CyberChessPage.useMemo[legalMoves]": ()=>{
            if (!chessForLegal) return [];
            return chessForLegal.moves({
                verbose: true
            });
        }
    }["CyberChessPage.useMemo[legalMoves]"], [
        chessForLegal
    ]);
    const legalToByFrom = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CyberChessPage.useMemo[legalToByFrom]": ()=>{
            const map = new Map();
            for (const m of legalMoves){
                const from = m?.from;
                const to = m?.to;
                if (!from || !to) continue;
                if (!map.has(from)) map.set(from, new Set());
                map.get(from).add(to);
            }
            return map;
        }
    }["CyberChessPage.useMemo[legalToByFrom]"], [
        legalMoves
    ]);
    const legalDestSet = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CyberChessPage.useMemo[legalDestSet]": ()=>{
            if (!selectedFrom) return new Set();
            return legalToByFrom.get(selectedFrom) || new Set();
        }
    }["CyberChessPage.useMemo[legalDestSet]"], [
        selectedFrom,
        legalToByFrom
    ]);
    const activeSide = fenBoard?.activeColor || "w";
    const algebraFromRC = (r, c)=>{
        const file = String.fromCharCode("a".charCodeAt(0) + c);
        const rank = String(8 - r);
        return `${file}${rank}`;
    };
    const pieceToSymbol = {
        P: "♙",
        p: "♟",
        N: "♘",
        n: "♞",
        B: "♗",
        b: "♝",
        R: "♖",
        r: "♜",
        Q: "♕",
        q: "♛",
        K: "♔",
        k: "♚"
    };
    const submitUci = async (rawUci)=>{
        if (!gameId) return;
        const raw = rawUci.trim();
        if (!raw) return;
        try {
            setAddingMove(true);
            setGameErr(null);
            const res = await fetch(`${API_BASE}/api/cyberchess/games/${gameId}/moves`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    uci: raw
                })
            });
            const data = await res.json().catch(()=>null);
            if (!res.ok) {
                throw new Error(data?.error || data?.details || "Ошибка добавления хода");
            }
            await loadGame(gameId);
        } catch (e) {
            setGameErr(e?.message || "Ошибка добавления хода");
        } finally{
            setAddingMove(false);
        }
    };
    const loadPlayers = async ()=>{
        try {
            setLoadingPlayers(true);
            setPlayersErr(null);
            const res = await fetch(`${API_BASE}/api/cyberchess/players`);
            const data = await res.json().catch(()=>null);
            if (!res.ok) throw new Error(data?.error || "Ошибка загрузки игроков");
            setPlayers(data?.items || []);
        } catch (e) {
            setPlayersErr(e?.message || "Ошибка загрузки игроков");
        } finally{
            setLoadingPlayers(false);
        }
    };
    const loadGame = async (id)=>{
        try {
            setLoadingGame(true);
            setGameErr(null);
            const res = await fetch(`${API_BASE}/api/cyberchess/games/${id}`);
            const data = await res.json().catch(()=>null);
            if (!res.ok) throw new Error(data?.error || "Ошибка загрузки игры");
            setGame(data?.game || null);
            setMoves(data?.moves || []);
        } catch (e) {
            setGameErr(e?.message || "Ошибка загрузки игры");
        } finally{
            setLoadingGame(false);
        }
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "CyberChessPage.useEffect": ()=>{
            loadPlayers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }
    }["CyberChessPage.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "CyberChessPage.useEffect": ()=>{
            if (!players.length) return;
            if (!whiteId) setWhiteId(players[0].id);
            if (!blackId && players[1]) setBlackId(players[1].id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }
    }["CyberChessPage.useEffect"], [
        players
    ]);
    const canCreatePlayer = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CyberChessPage.useMemo[canCreatePlayer]": ()=>{
            return Boolean(newPlayerName.trim());
        }
    }["CyberChessPage.useMemo[canCreatePlayer]"], [
        newPlayerName
    ]);
    const createPlayer = async (e)=>{
        e.preventDefault();
        if (!canCreatePlayer) return;
        const name = newPlayerName.trim();
        setPlayersErr(null);
        const res = await fetch(`${API_BASE}/api/cyberchess/players`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name
            })
        });
        const data = await res.json().catch(()=>null);
        if (!res.ok) {
            setPlayersErr(data?.error || data?.details || "Ошибка создания игрока");
            return;
        }
        setNewPlayerName("");
        await loadPlayers();
    };
    const createGame = async ()=>{
        if (!whiteId || !blackId) {
            setGameErr("Выбери White и Black");
            return;
        }
        if (whiteId === blackId) {
            setGameErr("White и Black не должны совпадать");
            return;
        }
        setGameErr(null);
        setGameId(null);
        setGame(null);
        setMoves([]);
        const res = await fetch(`${API_BASE}/api/cyberchess/games`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                whitePlayerId: whiteId,
                blackPlayerId: blackId
            })
        });
        const data = await res.json().catch(()=>null);
        if (!res.ok) {
            setGameErr(data?.error || "Ошибка создания игры");
            return;
        }
        const id = data?.id;
        setGameId(id);
        await loadGame(id);
    };
    const addMove = async ()=>{
        if (!uciMove.trim()) {
            setGameErr("Введите uci (например e2e4)");
            return;
        }
        await submitUci(uciMove);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        style: {
            padding: 24,
            maxWidth: 980
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                style: {
                                    fontSize: 26,
                                    marginBottom: 6
                                },
                                children: "CyberChess"
                            }, void 0, false, {
                                fileName: "[project]/src/app/cyberchess/page.tsx",
                                lineNumber: 307,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                style: {
                                    color: "#666",
                                    marginTop: 0
                                },
                                children: "MVP: игроки, игры, запись ходов и состояние (FEN)."
                            }, void 0, false, {
                                fileName: "[project]/src/app/cyberchess/page.tsx",
                                lineNumber: 308,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/cyberchess/page.tsx",
                        lineNumber: 306,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            display: "flex",
                            gap: 10,
                            alignItems: "center"
                        },
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                            href: "/",
                            style: {
                                color: "#0a5"
                            },
                            children: "Globus"
                        }, void 0, false, {
                            fileName: "[project]/src/app/cyberchess/page.tsx",
                            lineNumber: 313,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/app/cyberchess/page.tsx",
                        lineNumber: 312,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/cyberchess/page.tsx",
                lineNumber: 305,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                style: {
                    border: "1px solid #ddd",
                    borderRadius: 12,
                    padding: 14,
                    marginTop: 18
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        style: {
                            fontSize: 18,
                            marginBottom: 10
                        },
                        children: "1) Игроки"
                    }, void 0, false, {
                        fileName: "[project]/src/app/cyberchess/page.tsx",
                        lineNumber: 327,
                        columnNumber: 9
                    }, this),
                    playersErr ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            color: "crimson",
                            marginBottom: 10
                        },
                        children: playersErr
                    }, void 0, false, {
                        fileName: "[project]/src/app/cyberchess/page.tsx",
                        lineNumber: 330,
                        columnNumber: 11
                    }, this) : null,
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                        onSubmit: createPlayer,
                        style: {
                            display: "grid",
                            gap: 10
                        },
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                value: newPlayerName,
                                onChange: (e)=>setNewPlayerName(e.target.value),
                                placeholder: "Имя игрока (например Alice)",
                                style: {
                                    padding: 10,
                                    borderRadius: 8,
                                    border: "1px solid #ccc"
                                }
                            }, void 0, false, {
                                fileName: "[project]/src/app/cyberchess/page.tsx",
                                lineNumber: 334,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "submit",
                                disabled: !canCreatePlayer || loadingPlayers,
                                style: {
                                    padding: 10,
                                    borderRadius: 8,
                                    border: "1px solid #111",
                                    background: !canCreatePlayer || loadingPlayers ? "#888" : "#111",
                                    color: "#fff",
                                    width: 220
                                },
                                children: "Создать игрока"
                            }, void 0, false, {
                                fileName: "[project]/src/app/cyberchess/page.tsx",
                                lineNumber: 344,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/cyberchess/page.tsx",
                        lineNumber: 333,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            marginTop: 12
                        },
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                style: {
                                    color: "#666",
                                    fontSize: 13,
                                    marginBottom: 8
                                },
                                children: [
                                    "Список игроков (",
                                    players.length,
                                    ")"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/cyberchess/page.tsx",
                                lineNumber: 361,
                                columnNumber: 11
                            }, this),
                            loadingPlayers ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: "Загрузка…"
                            }, void 0, false, {
                                fileName: "[project]/src/app/cyberchess/page.tsx",
                                lineNumber: 365,
                                columnNumber: 13
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                style: {
                                    display: "grid",
                                    gap: 10
                                },
                                children: players.map((p)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        style: {
                                            border: "1px solid #eee",
                                            borderRadius: 10,
                                            padding: 12,
                                            background: "#fff"
                                        },
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                style: {
                                                    fontWeight: 800
                                                },
                                                children: p.name
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/cyberchess/page.tsx",
                                                lineNumber: 378,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                style: {
                                                    color: "#666",
                                                    fontSize: 12,
                                                    marginTop: 4
                                                },
                                                children: [
                                                    "id: ",
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        style: {
                                                            fontFamily: "monospace"
                                                        },
                                                        children: p.id
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/cyberchess/page.tsx",
                                                        lineNumber: 380,
                                                        columnNumber: 25
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/app/cyberchess/page.tsx",
                                                lineNumber: 379,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, p.id, true, {
                                        fileName: "[project]/src/app/cyberchess/page.tsx",
                                        lineNumber: 369,
                                        columnNumber: 17
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/src/app/cyberchess/page.tsx",
                                lineNumber: 367,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/cyberchess/page.tsx",
                        lineNumber: 360,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/cyberchess/page.tsx",
                lineNumber: 319,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                style: {
                    border: "1px solid #ddd",
                    borderRadius: 12,
                    padding: 14,
                    marginTop: 18
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        style: {
                            fontSize: 18,
                            marginBottom: 10
                        },
                        children: "2) Игра"
                    }, void 0, false, {
                        fileName: "[project]/src/app/cyberchess/page.tsx",
                        lineNumber: 397,
                        columnNumber: 9
                    }, this),
                    gameErr ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            color: "crimson",
                            marginBottom: 10
                        },
                        children: gameErr
                    }, void 0, false, {
                        fileName: "[project]/src/app/cyberchess/page.tsx",
                        lineNumber: 400,
                        columnNumber: 11
                    }, this) : null,
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            display: "grid",
                            gap: 10,
                            gridTemplateColumns: "1fr 1fr"
                        },
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        style: {
                                            color: "#666",
                                            fontSize: 12,
                                            marginBottom: 6
                                        },
                                        children: "White"
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/cyberchess/page.tsx",
                                        lineNumber: 405,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                        value: whiteId,
                                        onChange: (e)=>setWhiteId(e.target.value),
                                        style: {
                                            width: "100%",
                                            padding: 10,
                                            borderRadius: 8,
                                            border: "1px solid #ccc"
                                        },
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: "",
                                                children: "—"
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/cyberchess/page.tsx",
                                                lineNumber: 411,
                                                columnNumber: 15
                                            }, this),
                                            players.map((p)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: p.id,
                                                    children: p.name
                                                }, p.id, false, {
                                                    fileName: "[project]/src/app/cyberchess/page.tsx",
                                                    lineNumber: 413,
                                                    columnNumber: 17
                                                }, this))
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/app/cyberchess/page.tsx",
                                        lineNumber: 406,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/cyberchess/page.tsx",
                                lineNumber: 404,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        style: {
                                            color: "#666",
                                            fontSize: 12,
                                            marginBottom: 6
                                        },
                                        children: "Black"
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/cyberchess/page.tsx",
                                        lineNumber: 420,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                        value: blackId,
                                        onChange: (e)=>setBlackId(e.target.value),
                                        style: {
                                            width: "100%",
                                            padding: 10,
                                            borderRadius: 8,
                                            border: "1px solid #ccc"
                                        },
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: "",
                                                children: "—"
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/cyberchess/page.tsx",
                                                lineNumber: 426,
                                                columnNumber: 15
                                            }, this),
                                            players.map((p)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: p.id,
                                                    children: p.name
                                                }, p.id, false, {
                                                    fileName: "[project]/src/app/cyberchess/page.tsx",
                                                    lineNumber: 428,
                                                    columnNumber: 17
                                                }, this))
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/app/cyberchess/page.tsx",
                                        lineNumber: 421,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/cyberchess/page.tsx",
                                lineNumber: 419,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/cyberchess/page.tsx",
                        lineNumber: 403,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            marginTop: 10
                        },
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: createGame,
                            style: {
                                padding: 10,
                                borderRadius: 8,
                                border: "1px solid #0a5",
                                background: "#0a5",
                                color: "#fff",
                                width: 220
                            },
                            children: "Создать игру"
                        }, void 0, false, {
                            fileName: "[project]/src/app/cyberchess/page.tsx",
                            lineNumber: 437,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/app/cyberchess/page.tsx",
                        lineNumber: 436,
                        columnNumber: 9
                    }, this),
                    gameId ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            marginTop: 14
                        },
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                style: {
                                    color: "#666",
                                    fontSize: 13,
                                    marginBottom: 8
                                },
                                children: [
                                    "Game id: ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        style: {
                                            fontFamily: "monospace"
                                        },
                                        children: gameId
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/cyberchess/page.tsx",
                                        lineNumber: 456,
                                        columnNumber: 24
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/cyberchess/page.tsx",
                                lineNumber: 455,
                                columnNumber: 13
                            }, this),
                            loadingGame ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: "Загрузка игры…"
                            }, void 0, false, {
                                fileName: "[project]/src/app/cyberchess/page.tsx",
                                lineNumber: 460,
                                columnNumber: 15
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                style: {
                                    display: "grid",
                                    gap: 12
                                },
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    style: {
                                        display: "grid",
                                        gridTemplateColumns: "320px 1fr",
                                        gap: 14,
                                        alignItems: "start"
                                    },
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            style: {
                                                border: "1px solid #eee",
                                                borderRadius: 10,
                                                padding: 12,
                                                background: "#fff"
                                            },
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    style: {
                                                        fontWeight: 800,
                                                        marginBottom: 8
                                                    },
                                                    children: "Доска"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/cyberchess/page.tsx",
                                                    lineNumber: 479,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    style: {
                                                        color: "#666",
                                                        fontSize: 12,
                                                        marginBottom: 10
                                                    },
                                                    children: "Клик: выбери From → затем To (поддержка promotion: по умолчанию `q`)."
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/cyberchess/page.tsx",
                                                    lineNumber: 480,
                                                    columnNumber: 21
                                                }, this),
                                                fenBoard ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    style: {
                                                        width: 300,
                                                        height: 300,
                                                        display: "grid",
                                                        gridTemplateColumns: "repeat(8, 1fr)",
                                                        borderRadius: 10,
                                                        overflow: "hidden",
                                                        boxShadow: "0 14px 40px rgba(0,0,0,0.18)"
                                                    },
                                                    children: fenBoard.board.map((row, r)=>row.map((piece, c)=>{
                                                            const isDark = (r + c) % 2 === 1;
                                                            const bg = isDark ? "#b58863" : "#f0d9b5";
                                                            const square = algebraFromRC(r, c);
                                                            const isSelected = selectedFrom === square;
                                                            const isLegalDest = selectedFrom && legalDestSet.has(square);
                                                            const isActivePiece = piece ? (piece === piece.toUpperCase() ? "w" : "b") === activeSide : false;
                                                            const isLastFrom = lastFromTo?.from === square;
                                                            const isLastTo = lastFromTo?.to === square;
                                                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                type: "button",
                                                                onClick: ()=>{
                                                                    // Проверяем выбор "From" по активной стороне хода.
                                                                    if (!piece) {
                                                                        if (!selectedFrom) return;
                                                                        // если кликнули по пустой клетке после выбора From
                                                                        if (!legalDestSet.has(square)) {
                                                                            setGameErr("Нелегальный ход. Выбирай подсвеченную клетку.");
                                                                            return;
                                                                        }
                                                                        const uci = `${selectedFrom}${square}`;
                                                                        const p = selectedPiece || "";
                                                                        const isPawn = p.toLowerCase() === "p";
                                                                        const toRank = Number(square[1]);
                                                                        const shouldPromote = isPawn && (toRank === 8 || toRank === 1);
                                                                        const uciFinal = shouldPromote ? `${uci}q` : uci;
                                                                        setSelectedFrom(null);
                                                                        setSelectedPiece(null);
                                                                        setGameErr(null);
                                                                        submitUci(uciFinal);
                                                                        return;
                                                                    }
                                                                    if (!selectedFrom) {
                                                                        if (!isActivePiece) {
                                                                            setGameErr(`Сейчас ход: ${activeSide === "w" ? "белых" : "чёрных"}. Выберите фигуру нужного цвета.`);
                                                                            return;
                                                                        }
                                                                        setSelectedFrom(square);
                                                                        setSelectedPiece(piece);
                                                                        setGameErr(null);
                                                                        return;
                                                                    }
                                                                    // Second click = To
                                                                    if (!legalDestSet.has(square)) {
                                                                        setGameErr("Нелегальный ход. Выбирай подсвеченную клетку.");
                                                                        return;
                                                                    }
                                                                    const uciBase = `${selectedFrom}${square}`;
                                                                    const isPawn = (selectedPiece || "").toLowerCase() === "p";
                                                                    const toRank = Number(square[1]);
                                                                    const shouldPromote = isPawn && (toRank === 8 || toRank === 1);
                                                                    const uciFinal = shouldPromote ? `${uciBase}q` : uciBase;
                                                                    setSelectedFrom(null);
                                                                    setSelectedPiece(null);
                                                                    setGameErr(null);
                                                                    submitUci(uciFinal);
                                                                },
                                                                style: {
                                                                    padding: 0,
                                                                    border: "none",
                                                                    width: "100%",
                                                                    height: "100%",
                                                                    background: bg,
                                                                    cursor: "pointer",
                                                                    borderRadius: 0,
                                                                    boxShadow: isSelected ? "inset 0 0 0 3px rgba(0,170,85,0.95)" : isLastTo ? "inset 0 0 0 3px rgba(255,90,0,0.55), 0 0 18px rgba(255,90,0,0.18)" : isLastFrom ? "inset 0 0 0 3px rgba(255,215,0,0.55)" : isLegalDest ? "inset 0 0 0 3px rgba(0,120,255,0.35)" : isActivePiece ? "inset 0 0 0 2px rgba(0,170,85,0.18)" : "none",
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "center",
                                                                    fontSize: 26,
                                                                    lineHeight: 1,
                                                                    fontWeight: 800,
                                                                    color: piece ? piece === piece.toUpperCase() ? "#f9fafb" : "#111827" : "#111827",
                                                                    textShadow: piece ? piece === piece.toUpperCase() ? isDark ? "0 1px 0 rgba(0,0,0,0.45), 0 3px 10px rgba(0,0,0,0.25)" : "0 1px 0 rgba(0,0,0,0.35), 0 3px 10px rgba(0,0,0,0.18)" : isDark ? "0 1px 0 rgba(255,255,255,0.22), 0 3px 10px rgba(255,255,255,0.12)" : "0 1px 0 rgba(0,0,0,0.55), 0 3px 10px rgba(0,0,0,0.18)" : "none"
                                                                },
                                                                title: square,
                                                                children: piece ? pieceToSymbol[piece] : ""
                                                            }, square, false, {
                                                                fileName: "[project]/src/app/cyberchess/page.tsx",
                                                                lineNumber: 510,
                                                                columnNumber: 31
                                                            }, this);
                                                        }))
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/cyberchess/page.tsx",
                                                    lineNumber: 485,
                                                    columnNumber: 23
                                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    style: {
                                                        color: "#666"
                                                    },
                                                    children: "FEN недоступен"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/cyberchess/page.tsx",
                                                    lineNumber: 623,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    style: {
                                                        marginTop: 10,
                                                        color: "#666",
                                                        fontSize: 12
                                                    },
                                                    children: [
                                                        "Активный ход: ",
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                                            children: fenBoard?.activeColor === "w" ? "Белые" : "Чёрные"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/cyberchess/page.tsx",
                                                            lineNumber: 627,
                                                            columnNumber: 37
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/app/cyberchess/page.tsx",
                                                    lineNumber: 626,
                                                    columnNumber: 21
                                                }, this),
                                                lastFromTo ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    style: {
                                                        marginTop: 6,
                                                        color: "#666",
                                                        fontSize: 12
                                                    },
                                                    children: [
                                                        "Последний ход:",
                                                        " ",
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                                            style: {
                                                                fontFamily: "monospace"
                                                            },
                                                            children: [
                                                                lastFromTo.from,
                                                                " → ",
                                                                lastFromTo.to
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/app/cyberchess/page.tsx",
                                                            lineNumber: 632,
                                                            columnNumber: 25
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/app/cyberchess/page.tsx",
                                                    lineNumber: 630,
                                                    columnNumber: 23
                                                }, this) : null
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/app/cyberchess/page.tsx",
                                            lineNumber: 471,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            style: {
                                                display: "grid",
                                                gap: 12
                                            },
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    style: {
                                                        border: "1px solid #eee",
                                                        borderRadius: 10,
                                                        padding: 12,
                                                        background: "#fff"
                                                    },
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            style: {
                                                                fontWeight: 800
                                                            },
                                                            children: [
                                                                "Статус: ",
                                                                game?.status || "—"
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/app/cyberchess/page.tsx",
                                                            lineNumber: 641,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            style: {
                                                                color: "#666",
                                                                fontSize: 12,
                                                                marginTop: 6
                                                            },
                                                            children: "FEN:"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/cyberchess/page.tsx",
                                                            lineNumber: 642,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            style: {
                                                                fontFamily: "monospace",
                                                                fontSize: 12,
                                                                marginTop: 6,
                                                                wordBreak: "break-all"
                                                            },
                                                            children: game?.fen || "—"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/cyberchess/page.tsx",
                                                            lineNumber: 645,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/app/cyberchess/page.tsx",
                                                    lineNumber: 640,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    style: {
                                                        border: "1px solid #eee",
                                                        borderRadius: 10,
                                                        padding: 12,
                                                        background: "#fff"
                                                    },
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            style: {
                                                                fontWeight: 800,
                                                                marginBottom: 8
                                                            },
                                                            children: "Добавить ход"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/cyberchess/page.tsx",
                                                            lineNumber: 651,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            style: {
                                                                display: "flex",
                                                                gap: 10,
                                                                alignItems: "center",
                                                                flexWrap: "wrap"
                                                            },
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                    value: uciMove,
                                                                    onChange: (e)=>setUciMove(e.target.value),
                                                                    placeholder: "uci (например e2e4)",
                                                                    style: {
                                                                        padding: 10,
                                                                        borderRadius: 8,
                                                                        border: "1px solid #ccc",
                                                                        flex: "1 1 220px"
                                                                    }
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/app/cyberchess/page.tsx",
                                                                    lineNumber: 653,
                                                                    columnNumber: 21
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                    type: "button",
                                                                    onClick: addMove,
                                                                    disabled: addingMove,
                                                                    style: {
                                                                        padding: "10px 12px",
                                                                        borderRadius: 8,
                                                                        border: "1px solid #111",
                                                                        background: addingMove ? "#888" : "#111",
                                                                        color: "#fff",
                                                                        width: 220,
                                                                        cursor: addingMove ? "not-allowed" : "pointer"
                                                                    },
                                                                    children: addingMove ? "Добавляем..." : "Отправить ход"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/app/cyberchess/page.tsx",
                                                                    lineNumber: 664,
                                                                    columnNumber: 21
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/app/cyberchess/page.tsx",
                                                            lineNumber: 652,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            style: {
                                                                color: "#666",
                                                                fontSize: 12,
                                                                marginTop: 8
                                                            },
                                                            children: "Поддерживается `uci` (например `e2e4`, `e7e8q`)."
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/cyberchess/page.tsx",
                                                            lineNumber: 681,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/app/cyberchess/page.tsx",
                                                    lineNumber: 650,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    style: {
                                                        border: "1px solid #eee",
                                                        borderRadius: 10,
                                                        padding: 12,
                                                        background: "#fff"
                                                    },
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            style: {
                                                                fontWeight: 800,
                                                                marginBottom: 8
                                                            },
                                                            children: [
                                                                "Ходы (",
                                                                moves.length,
                                                                ")"
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/app/cyberchess/page.tsx",
                                                            lineNumber: 687,
                                                            columnNumber: 19
                                                        }, this),
                                                        moves.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            style: {
                                                                color: "#666"
                                                            },
                                                            children: "Пока нет ходов."
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/cyberchess/page.tsx",
                                                            lineNumber: 691,
                                                            columnNumber: 21
                                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            style: {
                                                                display: "grid",
                                                                gap: 8
                                                            },
                                                            children: moves.map((m)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    style: {
                                                                        border: "1px solid #f2f2f2",
                                                                        borderRadius: 10,
                                                                        padding: 10
                                                                    },
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            style: {
                                                                                display: "flex",
                                                                                justifyContent: "space-between",
                                                                                gap: 10
                                                                            },
                                                                            children: [
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                    style: {
                                                                                        fontWeight: 800
                                                                                    },
                                                                                    children: [
                                                                                        "ply #",
                                                                                        m.ply
                                                                                    ]
                                                                                }, void 0, true, {
                                                                                    fileName: "[project]/src/app/cyberchess/page.tsx",
                                                                                    lineNumber: 704,
                                                                                    columnNumber: 29
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                    style: {
                                                                                        color: "#666",
                                                                                        fontSize: 12
                                                                                    },
                                                                                    children: new Date(m.createdAt).toLocaleString()
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/src/app/cyberchess/page.tsx",
                                                                                    lineNumber: 707,
                                                                                    columnNumber: 29
                                                                                }, this)
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/src/app/cyberchess/page.tsx",
                                                                            lineNumber: 703,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            style: {
                                                                                marginTop: 6,
                                                                                fontFamily: "monospace",
                                                                                fontSize: 12,
                                                                                color: "#666"
                                                                            },
                                                                            children: [
                                                                                "uci: ",
                                                                                m.uci || "—"
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/src/app/cyberchess/page.tsx",
                                                                            lineNumber: 711,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            style: {
                                                                                marginTop: 4,
                                                                                fontFamily: "monospace",
                                                                                fontSize: 12,
                                                                                color: "#666"
                                                                            },
                                                                            children: [
                                                                                "san: ",
                                                                                m.san || "—"
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/src/app/cyberchess/page.tsx",
                                                                            lineNumber: 714,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        m.fenAfter ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            style: {
                                                                                marginTop: 6,
                                                                                fontFamily: "monospace",
                                                                                fontSize: 11,
                                                                                color: "#999",
                                                                                wordBreak: "break-all"
                                                                            },
                                                                            children: [
                                                                                "fenAfter: ",
                                                                                m.fenAfter
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/src/app/cyberchess/page.tsx",
                                                                            lineNumber: 718,
                                                                            columnNumber: 29
                                                                        }, this) : null
                                                                    ]
                                                                }, m.id, true, {
                                                                    fileName: "[project]/src/app/cyberchess/page.tsx",
                                                                    lineNumber: 695,
                                                                    columnNumber: 25
                                                                }, this))
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/cyberchess/page.tsx",
                                                            lineNumber: 693,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/app/cyberchess/page.tsx",
                                                    lineNumber: 686,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/app/cyberchess/page.tsx",
                                            lineNumber: 639,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/cyberchess/page.tsx",
                                    lineNumber: 463,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/app/cyberchess/page.tsx",
                                lineNumber: 462,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/cyberchess/page.tsx",
                        lineNumber: 454,
                        columnNumber: 11
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            marginTop: 14,
                            color: "#666",
                            fontSize: 13
                        },
                        children: "Создай игру, чтобы начать записывать ходы."
                    }, void 0, false, {
                        fileName: "[project]/src/app/cyberchess/page.tsx",
                        lineNumber: 733,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/cyberchess/page.tsx",
                lineNumber: 389,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/cyberchess/page.tsx",
        lineNumber: 304,
        columnNumber: 5
    }, this);
}
_s(CyberChessPage, "UgkEKL3ZxmY8EWRRqWk3UJH8F5k=");
_c = CyberChessPage;
var _c;
__turbopack_context__.k.register(_c, "CyberChessPage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_app_cyberchess_page_tsx_00f9cb3e._.js.map