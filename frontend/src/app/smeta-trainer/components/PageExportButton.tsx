"use client";

export function PageExportButton() {
  function handleExport() {
    if (typeof window === "undefined") return;

    // Collect all smeta-trainer related localStorage entries
    const snapshot: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      source: "AEVION Сметный тренажёр РК",
    };

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (
          key.startsWith("aevion-smeta") ||
          key.startsWith("smeta_trainer") ||
          key.startsWith("aevion-lesson") ||
          key.startsWith("aevion-sr-") ||
          key.startsWith("aevion-streak")
        ) {
          const raw = localStorage.getItem(key);
          if (raw) {
            try {
              snapshot[key] = JSON.parse(raw);
            } catch {
              snapshot[key] = raw;
            }
          }
        }
      }
    } catch {}

    const json = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = `smeta_trainer_export_${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 text-slate-700 rounded-lg hover:border-emerald-400 hover:text-emerald-700 transition-colors dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
      title="Скачать текущее состояние сметы и прогресс в JSON"
    >
      📥 Скачать смету (JSON)
    </button>
  );
}
