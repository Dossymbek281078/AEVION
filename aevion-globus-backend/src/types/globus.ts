export type GlobusProjectKind =
  | "core"        // базовая инфраструктура AEVION
  | "product"     // отдельный продукт/приложение
  | "service"     // сервисный модуль
  | "experiment"; // R&D / эксперимент

export type GlobusProjectStatus =
  | "idea"
  | "planning"
  | "in_progress"
  | "mvp"
  | "launched";

export interface GlobusProject {
  id: string;                // внутренний ID
  code: string;              // короткий код (QRIGHT, QSIGN и т.п.)
  name: string;              // имя проекта
  description: string;       // краткое описание
  kind: GlobusProjectKind;   // тип проекта
  status: GlobusProjectStatus;
  priority: number;          // 1–5, где 1 — самый высокий приоритет
  tags: string[];            // свободные теги
  createdAt: string;         // ISO-строка
  updatedAt: string;         // ISO-строка
}
