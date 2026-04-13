import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { createChat, getUserChats, getChatMessages, deleteChat, sendMessage } from "../services/qcore-ai";

const router = Router();

function requireUser(req: Request, res: Response, next: NextFunction): void {
  const userId = req.headers["x-user-id"] as string | undefined;
  if (!userId) { res.status(401).json({ error: "x-user-id header required" }); return; }
  (req as any).userId = userId;
  next();
}

router.use(requireUser);

function uid(req: Request): string { return (req as any).userId; }

router.post("/chats", async (req: Request, res: Response) => {
  try {
    const { title } = req.body ?? {};
    const chat = await createChat(uid(req), title);
    res.status(201).json(chat);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/chats", async (req: Request, res: Response) => {
  try { res.json(await getUserChats(uid(req))); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/chats/:id/messages", async (req: Request, res: Response) => {
  try { res.json(await getChatMessages(req.params["id"]!, uid(req))); }
  catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete("/chats/:id", async (req: Request, res: Response) => {
  try { res.json(await deleteChat(req.params["id"]!, uid(req))); }
  catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.post("/chats/:id/message", async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content) { res.status(400).json({ error: "content required" }); return; }
    const reply = await sendMessage(req.params["id"]!, uid(req), content);
    res.json(reply);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export { router as qcoreRouter };