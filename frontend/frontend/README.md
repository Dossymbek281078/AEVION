> # 🔴 МЁРТВАЯ КОПИЯ — НЕ РЕДАКТИРОВАТЬ
>
> Этот каталог `frontend/frontend/` не собирается, не публикуется и не
> импортируется ничем. Проверено 10.08.2026 поиском по ВСЕМУ репозиторию
> (`.ts`, `.tsx`, `.json`, `.yml`, `.mjs`, без `node_modules`): единственные ссылки на него —
> в тесте `frontend/src/lib/__tests__/dead-frontend-copy.test.ts`, который его стережёт.
> Сборки, конфиги и рабочие процессы о нём не знают вовсе. Лежит здесь с первого
> коммита платформы.
>
> **Чем он опасен.** Путь `frontend/src/...`, набранный из каталога `frontend`,
> попадает СЮДА. Правка уходит в никуда, а выглядит как сделанная. 28.07.2026
> отсюда дважды прочитали файл и едва не занесли неверные данные в отчёт;
> раньше сюда однажды ушла целая сборка. Текст ниже — стандартная заготовка
> `create-next-app`, из-за неё каталог и выглядит настоящим проектом.
>
> **Живой фронтенд — на уровень выше:** `frontend/src/`, `frontend/package.json`.
>
> Удаление каталога — решение основателя (правило про необратимое). Пока оно не
> принято, эта шапка существует, чтобы сюда не писали по ошибке.

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
