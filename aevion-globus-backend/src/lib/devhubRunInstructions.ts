/**
 * The "how do I run this" note that goes into an exported project.
 *
 * Export used to hand over a folder and nothing else: the ZIP carried the
 * files plus aevion-export.json, so whether it could be started at all — and
 * with which command — was left to the person who downloaded it.
 *
 * Everything here is derived from the files actually in the project. Nothing
 * is assumed: if there is no package.json we say the project cannot be
 * installed as-is rather than printing an npm command that will fail, and the
 * dev command is read out of the manifest's own scripts.
 */

export interface ExportedFile {
  path: string;
  content: string;
}

function readManifest(files: ExportedFile[]): { path: string; json: any } | null {
  const f = files.find((x) => x.path === "package.json" || x.path.endsWith("/package.json"));
  if (!f) return null;
  try {
    return { path: f.path, json: JSON.parse(f.content) };
  } catch {
    return { path: f.path, json: null }; // present but unparseable — say so
  }
}

export function buildRunInstructions(args: {
  projectName: string;
  stack: string;
  files: ExportedFile[];
}): string {
  const { projectName, stack, files } = args;
  const manifest = readManifest(files);
  const lines: string[] = [`# ${projectName} — как запустить`, ""];

  if (stack === "static" && !manifest) {
    const html = files.find((f) => /(^|\/)index\.html?$/i.test(f.path));
    lines.push(
      "Это статический сайт — сборка не нужна.",
      "",
      html
        ? `Откройте \`${html.path}\` в браузере, либо поднимите локальный сервер:`
        : "Локальный сервер для файлов этой папки:",
      "",
      "```bash",
      "npx serve .",
      "```",
      "",
    );
  } else if (stack === "python" || files.some((f) => /(^|\/)requirements\.txt$/.test(f.path))) {
    // A Python project has no package.json and never will; telling its owner
    // the folder "cannot be installed as-is" was simply wrong — my own bug,
    // from writing the note around the JS case only.
    const req = files.find((f) => /(^|\/)requirements\.txt$/.test(f.path));
    const entry = files.find((f) => /(^|\/)(main|app|server)\.py$/.test(f.path)) || files.find((f) => f.path.endsWith(".py"));
    lines.push("```bash", "python -m venv .venv", "source .venv/bin/activate  # Windows: .venv\\Scripts\\activate");
    if (req) lines.push(`pip install -r ${req.path}`);
    else lines.push("# зависимостей не объявлено — requirements.txt в проекте нет");
    if (entry) lines.push(`python ${entry.path}`);
    lines.push("```", "");
    if (!req) {
      lines.push(
        "Файла `requirements.txt` нет: если код что-то импортирует помимо стандартной библиотеки,",
        "запуск упадёт на первом импорте. Попросите DevHub собрать его — модель видит ваши импорты.",
        "",
      );
    }
  } else if (!manifest) {
    // The honest case. Guessing dependencies here would produce a manifest
    // that installs and then fails at import time — worse than none.
    lines.push(
      "⚠️ В проекте нет `package.json`, поэтому запустить его как есть нельзя:",
      "неизвестно, какие зависимости ему нужны.",
      "",
      "Откройте проект в DevHub и попросите сгенерировать манифест —",
      "модель видит реальные импорты ваших файлов и соберёт зависимости по ним.",
      "Мы сознательно не пишем `package.json` за вас: угаданный список хуже отсутствующего.",
      "",
    );
  } else if (!manifest.json) {
    lines.push(
      `⚠️ \`${manifest.path}\` не разбирается как JSON — почините его перед установкой.`,
      "",
    );
  } else {
    const scripts: Record<string, string> = manifest.json.scripts || {};
    const runFirst = ["dev", "start", "serve"].find((s) => scripts[s]);
    const build = scripts.build ? "npm run build" : null;
    lines.push("```bash", "npm install", runFirst ? `npm run ${runFirst}` : "# в package.json нет команды запуска (scripts.dev/start)", "```", "");
    if (build) lines.push(`Сборка для продакшена: \`${build}\`.`, "");
    const deps = Object.keys(manifest.json.dependencies || {});
    if (deps.length) lines.push(`Зависимости: ${deps.slice(0, 12).join(", ")}${deps.length > 12 ? ` и ещё ${deps.length - 12}` : ""}.`, "");
  }

  const envFiles = files.filter((f) => /(^|\/)\.env(\..+)?$/.test(f.path));
  if (envFiles.length) {
    lines.push(
      `В архиве есть ${envFiles.map((f) => `\`${f.path}\``).join(", ")} — проверьте, что там нет ключей, прежде чем делиться папкой.`,
      "",
    );
  }

  const dbSchema = files.find((f) => f.path === "db/schema.sql" || f.path.endsWith("/db/schema.sql"));
  if (dbSchema) {
    lines.push(
      `Проекту нужна база: схема в \`${dbSchema.path}\`, строка подключения ожидается в \`DATABASE_URL\`.`,
      "Строку из DevHub (вкладка Env Vars) сюда не переносили — она указывает на базу, живущую в AEVION.",
      "",
    );
  }

  lines.push(`Стек: ${stack}. Экспортировано из AEVION DevHub — код ваш, без привязки к платформе.`, "");
  return lines.join("\n");
}
