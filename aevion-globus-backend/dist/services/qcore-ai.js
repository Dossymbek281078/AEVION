import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
let prisma = null;
function getPrisma() {
    if (prisma)
        return prisma;
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL || typeof DATABASE_URL !== "string") {
        throw new Error("DATABASE_URL is missing or not a string. Check .env");
    }
    const pool = new Pool({ connectionString: DATABASE_URL });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });
    return prisma;
}
function getAnthropic() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey)
        throw new Error("ANTHROPIC_API_KEY is missing. Check .env");
    return new Anthropic({ apiKey });
}
export async function createChat(userId, title) {
    const db = getPrisma();
    return db.aiChat.create({
        data: { userId, title: title ?? "New Chat" },
    });
}
export async function getUserChats(userId) {
    const db = getPrisma();
    return db.aiChat.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, model: true, createdAt: true, updatedAt: true },
    });
}
export async function getChatMessages(chatId, userId) {
    const db = getPrisma();
    const chat = await db.aiChat.findFirst({ where: { id: chatId, userId } });
    if (!chat)
        throw new Error("Chat not found");
    return db.aiMessage.findMany({
        where: { chatId },
        orderBy: { createdAt: "asc" },
    });
}
export async function deleteChat(chatId, userId) {
    const db = getPrisma();
    const chat = await db.aiChat.findFirst({ where: { id: chatId, userId } });
    if (!chat)
        throw new Error("Chat not found");
    await db.aiChat.delete({ where: { id: chatId } });
    return { ok: true };
}
export async function sendMessage(chatId, userId, content) {
    const db = getPrisma();
    const chat = await db.aiChat.findFirst({ where: { id: chatId, userId } });
    if (!chat)
        throw new Error("Chat not found");
    await db.aiMessage.create({ data: { chatId, role: "user", content } });
    const history = await db.aiMessage.findMany({
        where: { chatId },
        orderBy: { createdAt: "asc" },
        take: 50,
    });
    const messages = history.map((m) => ({
        role: m.role,
        content: m.content,
    }));
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
        model: chat.model,
        max_tokens: 4096,
        system: "You are QCoreAI, the intelligent assistant of the AEVION platform. You help users with coding, content creation, music, cinema, and anything else they need. Be helpful, creative, and concise. Respond in the same language the user writes in.",
        messages,
    });
    const assistantContent = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n");
    await db.aiMessage.create({ data: { chatId, role: "assistant", content: assistantContent } });
    if (history.length <= 2) {
        const titleSlice = content.length > 60 ? content.slice(0, 57) + "..." : content;
        await db.aiChat.update({ where: { id: chatId }, data: { title: titleSlice } });
    }
    await db.aiChat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
    return { role: "assistant", content: assistantContent };
}
export async function streamMessage(chatId, userId, content, onChunk, onDone, onError) {
    const db = getPrisma();
    const chat = await db.aiChat.findFirst({ where: { id: chatId, userId } });
    if (!chat) {
        onError("Chat not found");
        return;
    }
    await db.aiMessage.create({ data: { chatId, role: "user", content } });
    const history = await db.aiMessage.findMany({
        where: { chatId },
        orderBy: { createdAt: "asc" },
        take: 50,
    });
    const messages = history.map((m) => ({
        role: m.role,
        content: m.content,
    }));
    const anthropic = getAnthropic();
    let fullResponse = "";
    try {
        const stream = anthropic.messages.stream({
            model: chat.model,
            max_tokens: 4096,
            system: "You are QCoreAI, the intelligent assistant of the AEVION platform. You help users with coding, content creation, music, cinema, and anything else they need. Be helpful, creative, and concise. Respond in the same language the user writes in.",
            messages,
        });
        stream.on("text", (text) => {
            fullResponse += text;
            onChunk(text);
        });
        await stream.finalMessage();
        await db.aiMessage.create({ data: { chatId, role: "assistant", content: fullResponse } });
        if (history.length <= 2) {
            const titleSlice = content.length > 60 ? content.slice(0, 57) + "..." : content;
            await db.aiChat.update({ where: { id: chatId }, data: { title: titleSlice } });
        }
        await db.aiChat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
        onDone(fullResponse);
    }
    catch (err) {
        onError(err.message ?? "Unknown error");
    }
}
//# sourceMappingURL=qcore-ai.js.map