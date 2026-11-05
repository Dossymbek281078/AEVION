"use client";

import { useState } from "react";
import s from "../../primer/primer.module.css";
import { DAY_NAMES, HOURS, type Demo, buildDraft, busyHours, priceText } from "./demoLogic";

type Msg = { text: string; me?: boolean };

function Notice({ demo }: { demo: Demo }) {
  return (
    <p className={s.note} data-testid="demoNotice">
      <b>Это демо, а не официальный сайт «{demo.company}».</b> Его подготовила AEVION Automation с помощью ИИ, по открытым
      данным с <a href={demo.site} rel="nofollow noopener">сайта компании</a>. Компания демо не заказывала и не проверяла. Цены и
      услуги могли измениться: актуальные — на её сайте. Заявки и записи здесь никуда не отправляются и не сохраняются;
      свободное время условное.
    </p>
  );
}

function FormBlock({ demo }: { demo: Demo }) {
  const [name, setName] = useState("");
  const [service, setService] = useState(demo.services[0].name);
  const [when, setWhen] = useState("завтра после 18:00");
  const [out, setOut] = useState("Здесь появится уведомление, как только клиент нажмёт «Записаться».");
  return (
    <div className={s.pair}>
      <div className={s.box}>
        <span className={s.tag}>так видит клиент · сайт (демо)</span>
        <b>{demo.company}</b> · {demo.city}
        {demo.hours && <div className={s.dayName}>{demo.hours}</div>}
        <table className={s.price}>
          <tbody>
            {demo.services.map((x) => (
              <tr key={x.name}>
                <td>{x.name}</td>
                <td>{priceText(x)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <form
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            setOut(
              "🔔 Новая заявка с сайта (демо)\n\nИмя: " + name.trim() + "\nУслуга: " + service + "\nКогда удобно: " +
                (when.trim() || "не указал") + "\n\n[Позвонить]  [Написать в WhatsApp]  [Записать]",
            );
          }}
        >
          <label htmlFor="dn">Имя</label>
          <input id="dn" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Арман" />
          <label htmlFor="ds">Услуга</label>
          <select id="ds" value={service} onChange={(e) => setService(e.target.value)}>
            {demo.services.map((x) => (
              <option key={x.name}>{x.name}</option>
            ))}
          </select>
          <label htmlFor="dt">Когда удобно</label>
          <input id="dt" maxLength={40} value={when} onChange={(e) => setWhen(e.target.value)} />
          <button type="submit" className={s.btn}>Записаться</button>
        </form>
      </div>
      <div className={s.box}>
        <span className={s.tag}>так увидит владелец · Telegram</span>
        <div className={s.tg} data-testid="formOut">{out}</div>
      </div>
    </div>
  );
}

function BotBlock({ demo }: { demo: Demo }) {
  const hello: Msg = { text: "Здравствуйте! Это демо бота записи для «" + demo.company + "». Какая услуга нужна?" };
  const [msgs, setMsgs] = useState<Msg[]>([hello]);
  const [svc, setSvc] = useState("");
  const [dayIdx, setDayIdx] = useState<number | null>(null);
  const [hour, setHour] = useState("");
  const say = (...m: Msg[]) => setMsgs((p) => [...p, ...m]);
  const dayLabel = (i: number) => {
    if (i === 0) return "Сегодня";
    if (i === 1) return "Завтра";
    const d = new Date();
    d.setDate(d.getDate() + i);
    const nm = DAY_NAMES[d.getDay()];
    return nm[0].toUpperCase() + nm.slice(1);
  };
  const busy = dayIdx === null ? new Set<string>() : busyHours(dayIdx);
  const reset = () => {
    setMsgs([hello]);
    setSvc("");
    setDayIdx(null);
    setHour("");
  };
  return (
    <div className={s.pair}>
      <div className={s.box}>
        <span className={s.tag}>так видит клиент · чат с ботом (демо)</span>
        <div className={s.chat} aria-live="polite" data-testid="chat">
          {msgs.map((m, i) => (
            <div key={i} className={m.me ? `${s.msg} ${s.me}` : s.msg}>{m.text}</div>
          ))}
        </div>
        <div className={s.quick}>
          {!svc && demo.services.map((x) => (
            <button key={x.name} type="button" onClick={() => {
              setSvc(x.name);
              say({ text: x.name, me: true }, { text: x.name + " — " + priceText(x) + ". На какой день?" });
            }}>{x.name}</button>
          ))}
          {svc && dayIdx === null && [0, 1, 2].map((i) => (
            <button key={i} type="button" onClick={() => {
              setDayIdx(i);
              say({ text: dayLabel(i), me: true }, { text: "Свободно: выберите время. Занятое я не показываю." });
            }}>{dayLabel(i)}</button>
          ))}
          {dayIdx !== null && !hour && HOURS.filter((h) => !busy.has(h)).map((h) => (
            <button key={h} type="button" onClick={() => {
              setHour(h);
              say({ text: h, me: true }, { text: "Записал: " + svc + ", " + dayLabel(dayIdx).toLowerCase() + " в " + h + ". За 2 часа пришлю напоминание." });
            }}>{h}</button>
          ))}
          {hour && <button type="button" onClick={reset}>Начать заново</button>}
        </div>
      </div>
      <div className={s.box}>
        <span className={s.tag}>так увидит владелец · расписание</span>
        <div className={s.slots}>
          {dayIdx !== null && HOURS.map((h) => (
            <div key={h} className={h === hour ? s.slotNew : busy.has(h) ? s.slotBusy : undefined}>{h}</div>
          ))}
        </div>
        <div className={s.tg} style={{ marginTop: 10 }} data-testid="botOut">
          {hour ? "📅 Новая запись через бота (демо)\n\n" + svc + "\n" + dayLabel(dayIdx as number) + ", " + hour : "Запись появится здесь и в расписании."}
        </div>
      </div>
    </div>
  );
}

function DraftBlock({ demo }: { demo: Demo }) {
  const [text, setText] = useState(demo.sample);
  const [res, setRes] = useState(() => buildDraft(demo.sample, demo));
  return (
    <div className={s.pair}>
      <div className={s.box}>
        <span className={s.tag}>пришло от клиента (пример)</span>
        <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} aria-label="Обращение клиента" />
        <button type="button" className={s.btn} onClick={() => setRes(buildDraft(text, demo))}>Подготовить ответ</button>
      </div>
      <div className={s.box}>
        <span className={s.tag}>черновик для администратора</span>
        <dl data-testid="aiCard">
          {res.card.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div className={s.draft} data-testid="aiDraft">{res.draft}</div>
      </div>
    </div>
  );
}

const OFFER: Record<Demo["firstOffer"], string> = {
  site: "Начать мы предложили бы с сайта-визитки с заявками: 45 000 ₸ разово, 3–5 дней.",
  bot: "Начать мы предложили бы с бота записи: 40 000 ₸ разово, 5–7 дней.",
  ai: "Начать мы предложили бы с ИИ-черновиков ответов: настройка 45 000 ₸ и 10 000 ₸ в месяц.",
};

export function DemoView({ demo }: { demo: Demo }) {
  return (
    <div lang="ru" className={s.root}>
      <header className={s.header}>
        <div className={s.wrap}>
          <div className={s.brand}>AEVION <span>Automation</span> · демо</div>
        </div>
      </header>
      <main className={s.wrap}>
        <h1>Демо для «{demo.company}»: как могла бы идти запись</h1>
        <Notice demo={demo} />
        <p className={s.lead}>Что мы заметили на сайте: {demo.weakFact}. Нажимайте как клиент: в соседнем блоке видно, что получил бы владелец.</p>
        <h2>1. Страница с заявкой</h2>
        <FormBlock demo={demo} />
        <h2>2. Бот записи в WhatsApp или Telegram</h2>
        <BotBlock demo={demo} />
        <h2>3. Черновик ответа на обращение</h2>
        <DraftBlock demo={demo} />
        <p className={s.note}>Здесь черновик собирается простыми правилами в браузере. В настоящей работе его пишет ИИ-модель по вашему прайсу, а администратор проверяет и отправляет.</p>
        <div className={s.endbox}>
          <h2 style={{ margin: 0 }}>Цена и сроки</h2>
          <p>{OFFER[demo.firstOffer]}</p>
          <p>Сайт — 45 000 ₸. Бот — 40 000 ₸. ИИ-ответы — 45 000 ₸ и 10 000 ₸ в месяц; первый месяц бесплатно при заказе сайта или бота.</p>
          <p>Интересно — просто ответьте на письмо.</p>
        </div>
      </main>
      <footer className={s.footer}>
        <div className={s.wrap}>
          Сделано с ИИ · AEVION Automation, подразделение <a href="https://aevion.app">AEVION</a>. Не связано с «{demo.company}»;
          официальный сайт компании: <a href={demo.site} rel="nofollow noopener">{demo.site}</a>.
        </div>
      </footer>
    </div>
  );
}
