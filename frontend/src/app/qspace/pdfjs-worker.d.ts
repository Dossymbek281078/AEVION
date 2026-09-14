// Модуль обработчика pdf.js загружается ради побочного эффекта (globalThis.pdfjsWorker)
// и своих типов не публикует. Экспортов из него QSpace не берёт.
declare module "pdfjs-dist/build/pdf.worker.min.mjs";
