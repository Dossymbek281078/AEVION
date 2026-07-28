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

---

## ⚠️ Дев-сервер открывать через `localhost`, а не `127.0.0.1`

Next 16 блокирует кросс-оригинные запросы к своим дев-ресурсам. Открытая как
`http://127.0.0.1:PORT` страница приходит целой по HTML, но клиентские чанки
режутся — приложение **не гидрируется**: состояние не работает, кнопки не
отвечают, запросов к API нет. Ошибки в консоли при этом НЕТ.

Замер 28.07.2026 на одной и той же странице и одном и том же сервере:

| Адрес | Узлов с React-фибером |
|---|---|
| `http://127.0.0.1:3049/qevents` | 3 из 193 |
| `http://localhost:3049/qevents` | **184 из 221** |

Признак в логе дев-сервера, по которому это опознаётся:

```
⚠ Blocked cross-origin request to Next.js dev resource /__nextjs_font/... from "127.0.0.1".
```

Строка помечена предупреждением и говорит про шрифт, поэтому её легко пролистать —
но она называет ровно причину. Если нужен другой origin, есть `allowedDevOrigins`
в `next.config.ts`; проще открывать `localhost`.

**Как за секунду проверить, что страница вообще живая** (в консоли браузера):

```js
[...document.querySelectorAll('*')]
  .filter(el => Object.keys(el).some(k => k.startsWith('__react'))).length
```

Ноль или единицы — перед вами мёртвая разметка, выводы о поведении делать нельзя.

## Проверки этого пакета

```bash
npm run check:compare-links   # ссылки карточек /compare ведут на живые страницы
npx vitest run                # тесты, включая правила таблицы сравнения и UI QEvents
```
