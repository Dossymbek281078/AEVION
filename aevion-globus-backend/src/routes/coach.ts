import { Router } from "express";

const router = Router();

router.post("/chat", async (req, res) => {
  try {
    const { system, messages } = req.body;
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key || key.includes("ВАШ_КЛЮЧ")) {
      return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured on server" });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: system || "",
        messages: messages || [],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    res.json(data);
  } catch (e: any) {
    console.error("[coach]", e);
    res.status(500).json({ error: e.message || "Internal error" });
  }
});

export { router as coachRouter };