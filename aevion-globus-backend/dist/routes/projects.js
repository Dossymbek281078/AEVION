import { Router } from "express";
import { projects } from "../data/projects.js";
export const projectsRouter = Router();
function getModuleHealth(code) {
    switch (code) {
        case "qtradeoffline":
            return {
                implemented: true,
                status: "ready",
                endpoints: [
                    "GET /api/qtrade/accounts",
                    "POST /api/qtrade/accounts",
                    "POST /api/qtrade/topup",
                    "POST /api/qtrade/transfer",
                ],
                frontendPath: "/qtrade",
                details: "MVP: счета, пополнение и переводы (in-memory).",
            };
        case "qright":
            return {
                implemented: true,
                status: "db-backed",
                endpoints: ["GET /api/qright/objects", "POST /api/qright/objects"],
                frontendPath: "/qright",
                details: "MVP: реестр объектов QRight (PostgreSQL + Prisma).",
            };
        case "qsign":
            return {
                implemented: true,
                status: "ready",
                endpoints: ["POST /api/qsign/sign", "POST /api/qsign/verify"],
                frontendPath: "/qsign",
                details: "MVP: подпись и проверка целостности (HMAC-SHA256).",
            };
        default: {
            const project = projects.find((p) => p.id === code);
            return {
                implemented: false,
                status: project?.status ?? "planned",
                endpoints: [],
                frontendPath: `/projects/${code}`,
                details: "Пока реализована только витрина проекта. Остальные модули будут подключены по мере разработки.",
            };
        }
    }
}
// GET /api/projects/:code/health
projectsRouter.get("/:code/health", (req, res) => {
    const { code } = req.params;
    const project = projects.find((p) => p.id === code);
    if (!project) {
        return res.status(404).json({ error: "Project not found", code });
    }
    const moduleHealth = getModuleHealth(code);
    return res.json({
        code,
        project: {
            id: project.id,
            code: project.code,
            name: project.name,
            description: project.description,
            kind: project.kind,
            status: project.status,
            priority: project.priority,
            tags: project.tags,
        },
        module: moduleHealth,
    });
});
//# sourceMappingURL=projects.js.map