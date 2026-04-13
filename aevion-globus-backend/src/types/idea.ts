export interface IdeaPatent {
  id: string;           // внутренний ID записи
  title: string;        // название идеи
  description: string;  // описание идеи
  authorName?: string;  // имя автора (необязательно)
  authorEmail?: string; // email автора (необязательно)
  createdAt: string;    // ISO-время регистрации
  contentHash: string;  // SHA-256 хэш содержимого идеи
}
