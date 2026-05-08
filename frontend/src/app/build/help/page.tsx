import type { Metadata } from "next";
import Link from "next/link";
import { HelpClient } from "./HelpClient";

export const metadata: Metadata = {
  title: "QBuild Help — FAQ for workers and employers",
  description: "Frequently asked questions about AEVION QBuild construction recruiting platform.",
};

const FAQ_WORKERS = [
  {
    q: "Как найти вакансию и откликнуться?",
    a: "Перейдите в раздел «Vacancies». Используйте фильтры по городу, навыку, зарплате. Нажмите «Quick apply» прямо из списка или откройте вакансию для полной формы с вопросами.",
  },
  {
    q: "Что такое Trial Job?",
    a: "Платное тестовое задание от работодателя. После одобрения вашего отклика работодатель может предложить Trial — небольшую оплачиваемую задачу, чтобы убедиться в навыках. После выполнения получаете оплату.",
  },
  {
    q: "Как получить значок ✓ Verified?",
    a: "Перейдите в «Profile» → раздел «Verification badge» → нажмите «Request verification». Прикрепите ссылку на LinkedIn, портфолио или сертификаты. Мы проверяем в течение 1-2 рабочих дней.",
  },
  {
    q: "Что такое AEV cashback?",
    a: "При оплате заказов (подписка, Trial задания) начисляется 2% в нативных токенах AEV. Их можно \"claim\" в AEV-кошелёк через раздел «Pricing».",
  },
  {
    q: "Как настроить Job Alert?",
    a: "В разделе «Profile» → «Job alerts» задайте ключевые слова и навыки. При появлении новой вакансии, совпадающей с вашими условиями, вы получите письмо.",
  },
  {
    q: "Кто видит мой профиль?",
    a: "Публичный профиль /build/u/[id] виден всем. Зайдите в Profile → «Open public profile» чтобы посмотреть как вас видят работодатели.",
  },
];

const FAQ_EMPLOYERS = [
  {
    q: "Как создать проект и добавить вакансии?",
    a: "Нажмите «New project», опишите объект и бюджет. После создания — кнопка «+ Add vacancy» появится прямо на странице проекта.",
  },
  {
    q: "Сколько стоит публикация вакансии?",
    a: "0 ₽. Бесплатно на всех тарифах. Мы берём комиссию Pay-per-Hire (от 6% на Gold-уровне) только при найме.",
  },
  {
    q: "Что такое AI-скоринг заявок?",
    a: "Если в вакансии есть вопросы, Claude AI оценивает каждый ответ кандидата по 100-балльной шкале. Оценка и красные флаги видны на карточке заявки.",
  },
  {
    q: "Как выгрузить все заявки в Excel?",
    a: "Откройте страницу вакансии → раздел «Applications» → кнопка «↓ CSV». Файл содержит имена, email, город, AI-score, статус.",
  },
  {
    q: "Как boost вакансии работает?",
    a: "Boost закрепляет вакансию в топе ленты /build/vacancies на 7 дней. 1 boost = 990 ₽. На плане Pro — 5 boost/мес включено.",
  },
  {
    q: "Как верифицировать кандидата?",
    a: "В разделе Admin → Users найдите кандидата и нажмите «verify». Значок ✓ появится на его публичном профиле.",
  },
];

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <Link href="/build" className="text-xs text-slate-400 hover:underline">← QBuild</Link>
        <h1 className="mt-3 text-3xl font-extrabold text-white">Help & FAQ</h1>
        <p className="mt-2 text-sm text-slate-400">Answers to the most common questions.</p>
        <HelpClient workers={FAQ_WORKERS} employers={FAQ_EMPLOYERS} />
      </div>
    </main>
  );
}
