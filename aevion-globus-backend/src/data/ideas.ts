import type { IdeaPatent } from "../types/idea";

// Временное хранилище идей в памяти процесса.
// Позже можно заменить на БД (PostgreSQL / Prisma).
export const ideas: IdeaPatent[] = [];
