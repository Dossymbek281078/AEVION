import "dotenv/config";
export declare function createChat(userId: string, title?: string): Promise<{
    model: string;
    id: string;
    title: string;
    createdAt: Date;
    userId: string;
    updatedAt: Date;
}>;
export declare function getUserChats(userId: string): Promise<{
    model: string;
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
}[]>;
export declare function getChatMessages(chatId: string, userId: string): Promise<{
    id: string;
    createdAt: Date;
    chatId: string;
    role: string;
    content: string;
}[]>;
export declare function deleteChat(chatId: string, userId: string): Promise<{
    ok: boolean;
}>;
export declare function sendMessage(chatId: string, userId: string, content: string): Promise<{
    role: string;
    content: string;
}>;
export declare function streamMessage(chatId: string, userId: string, content: string, onChunk: (text: string) => void, onDone: (full: string) => void, onError: (err: string) => void): Promise<void>;
//# sourceMappingURL=qcore-ai.d.ts.map