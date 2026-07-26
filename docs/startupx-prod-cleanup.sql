-- StartupX — разовая уборка тестовых заявок в проде.
--
-- Контекст: до 2026-07-26 ежедневный смоук публиковал заявку и никогда её не
-- убирал, поэтому в проде оказалось 19 строк вида «Smoke Idea …». Начиная с
-- PR по ветке feat/startupx-tiers смоук снимает свою заявку сам (DELETE
-- /api/startupx/ideas/:id?token=…), так что заново это не накопится.
--
-- Запускать в Railway → Postgres → Query. СНАЧАЛА первый запрос (посмотреть,
-- что именно попадёт под уборку), и только потом второй.

-- 1. Что будет снято:
SELECT id, title, stage, created_at
FROM startup_ideas
WHERE visibility = 'public'
  AND (title LIKE 'Smoke Idea %' OR title LIKE 'Smoke listing %')
ORDER BY id;

-- 2. Уборка. Не DELETE: строки помечаются снятыми — так же, как когда заявку
--    снимает основатель. Отклики и отпечатки авторства остаются на месте.
-- UPDATE startup_ideas
--    SET visibility = 'withdrawn'
--  WHERE visibility = 'public'
--    AND (title LIKE 'Smoke Idea %' OR title LIKE 'Smoke listing %');

-- 3. Проверка — в публичной ленте должно остаться только настоящее:
-- SELECT COUNT(*) FROM startup_ideas WHERE visibility = 'public';
