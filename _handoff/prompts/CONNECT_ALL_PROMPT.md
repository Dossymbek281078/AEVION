# Cursor Chat Prompt: Connect modules (общий проект)

Цель:
- Соединить модули AEVION в общий “проектный” контур: навигация, общие страницы, общий формат ошибок/тестов.

Текущий набор модулей:
- QRight: `aevion-portal-frontend/src/app/qright/page.tsx`, backend `/api/qright/...`
- QSign: `aevion-portal-frontend/src/app/qsign/page.tsx`, backend `/api/qsign/...`
- Globus v1: `aevion-portal-frontend/src/app/page.tsx`, backend `/api/globus/...`
- Auth: далее по приоритету.

Правила склейки:
1. Не переписывай архитектуру — только “обвязка”.
2. Сохраняй существующие роуты и ответы backend.
3. Добавляй новые общие UI-элементы по минимуму (не Tailwind/не новые зависимости).

План проверок:
1. Состояние backend: все нужные endpoints отвечают 200/201.
2. Состояние frontend: все страницы `/`, `/qright`, `/qsign`, `/qtrade` открываются 200.
3. Persist: после перезапуска backend QRight данные сохраняются.

