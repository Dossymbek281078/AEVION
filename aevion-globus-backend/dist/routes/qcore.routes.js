import { Router } from "express";
import { createChat, getUserChats, getChatMessages, deleteChat, sendMessage } from "../services/qcore-ai.js";
const router = Router();
function requireUser(req, res, next) {
    const userId = req.headers["x-user-id"];
    if (!userId) {
        res.status(401).json({ error: "x-user-id header required" });
        return;
    }
    req.userId = userId;
    next();
}
router.use(requireUser);
function uid(req) { return req.userId; }
router.post("/chats", async (req, res) => {
    try {
        const { title } = req.body ?? {};
        const chat = await createChat(uid(req), title);
        res.status(201).json(chat);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get("/chats", async (req, res) => {
    try {
        res.json(await getUserChats(uid(req)));
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get("/chats/:id/messages", async (req, res) => {
    try {
        res.json(await getChatMessages(req.params["id"], uid(req)));
    }
    catch (e) {
        res.status(404).json({ error: e.message });
    }
});
router.delete("/chats/:id", async (req, res) => {
    try {
        res.json(await deleteChat(req.params["id"], uid(req)));
    }
    catch (e) {
        res.status(404).json({ error: e.message });
    }
});
router.post("/chats/:id/message", async (req, res) => {
    try {
        const { content } = req.body;
        if (!content) {
            res.status(400).json({ error: "content required" });
            return;
        }
        const reply = await sendMessage(req.params["id"], uid(req), content);
        res.json(reply);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
export { router as qcoreRouter };
//# sourceMappingURL=qcore.routes.js.map