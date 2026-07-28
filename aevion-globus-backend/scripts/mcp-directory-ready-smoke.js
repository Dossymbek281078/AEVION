// Наш собственный MCP-сервер — это заявка в каталог коннекторов Anthropic,
// то есть витрина перед каждым пользователем Claude. Требования каталога
// (проверены по их документации 28.07.2026) жёсткие и проверяются машиной:
// у КАЖДОГО инструмента обязаны быть title и подсказка readOnlyHint или
// destructiveHint. Без них заявку отклоняют на шаге «Tools».
//
// До 28.07.2026 сервер жил на проде вообще без единой проверки: ни один смок
// его не открывал. Поэтому здесь не только аннотации, но и то, что он вообще
// отвечает по протоколу и что инструмент реально работает, а не только числится
// в списке.

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");
const MCP = `${BASE}/api/mcp-demo`;

let failures = 0;
function check(label, pass, detail) {
  if (!pass) failures++;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${detail ? `\n        ${detail}` : ""}`);
}

async function rpc(method, params, id) {
  const res = await fetch(MCP, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) }),
  });
  if (!res.ok) throw new Error(`${method} → HTTP ${res.status}`);
  return res.json();
}

(async () => {
  console.log(`  MCP = ${MCP}`);

  const init = await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "aevion-directory-readiness", version: "1" },
  }, 1);
  check(
    "сервер отвечает на initialize и называет себя",
    Boolean(init?.result?.serverInfo?.name),
    `serverInfo=${JSON.stringify(init?.result?.serverInfo ?? null)}`,
  );

  const listed = await rpc("tools/list", null, 2);
  const tools = listed?.result?.tools ?? [];
  check("инструменты перечислены", tools.length > 0, `их ${tools.length}`);

  // Требование каталога: title у каждого инструмента.
  const noTitle = tools.filter((t) => !t.title && !t.annotations?.title).map((t) => t.name);
  check(
    "у каждого инструмента есть title",
    noTitle.length === 0,
    noTitle.length ? `без title: ${noTitle.join(", ")}` : "",
  );

  // Требование каталога: явная подсказка о характере инструмента.
  const noHint = tools
    .filter((t) => {
      const a = t.annotations ?? {};
      return a.readOnlyHint === undefined && a.destructiveHint === undefined;
    })
    .map((t) => t.name);
  check(
    "у каждого инструмента есть readOnlyHint или destructiveHint",
    noHint.length === 0,
    noHint.length ? `без подсказок: ${noHint.join(", ")}` : "",
  );

  // Инструмент, который числится, но не работает, хуже отсутствующего:
  // ревьюер каталога вызывает их вручную.
  const called = await rpc("tools/call", { name: "list_modules", arguments: {} }, 3);
  const text = called?.result?.content?.[0]?.text ?? "";
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* ниже упадёт понятнее */ }
  check(
    "list_modules реально отвечает данными реестра",
    Boolean(parsed && typeof parsed.count === "number" && Array.isArray(parsed.modules)),
    `получено ${text.slice(0, 80)}…`,
  );

  // Число модулей в MCP обязано совпадать с публичным реестром — иначе клиент
  // Claude увидит одну картину, а сайт другую.
  const statsRes = await fetch(`${BASE}/api/aevion/stats`, { headers: { accept: "application/json" } });
  const stats = statsRes.ok ? await statsRes.json() : null;
  check(
    "счёт модулей в MCP совпадает с реестром",
    Boolean(stats) && parsed?.count === stats.total,
    `MCP=${parsed?.count}, реестр=${stats?.total}`,
  );

  console.log(failures === 0
    ? `\nPASS — сервер готов к подаче: ${tools.length} инструментов, все аннотированы`
    : `\nFAIL — ${failures} несоответствий требованиям каталога`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => {
  console.log(`\nFAIL — ${err.message}`);
  process.exit(1);
});
