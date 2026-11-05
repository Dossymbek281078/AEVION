"use client";

import { useState } from "react";
import s from "./primer.module.css";
import { DAY_NAMES, HOURS, SAMPLES, SERVICES, busyHours, formatTenge, parseInquiry } from "./primerLogic";

const CONTACT_HREF = "https://aevion-agency-site.vercel.app/?c=agency-primer#contact";
const START_OUT = "Запись появится здесь и в расписании мастера.";

function nowHM() {
  const d = new Date();
  return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
}
function dayAt(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
}

type Msg = { text: string; me?: boolean };
type Step = "service" | "day" | "time" | "name" | "done" | "noslots";
type Booking = { service?: string; dayText?: string; hour?: string };

function FormBlock() {
  const [name, setName] = useState("Арман");
  const [phone, setPhone] = useState("+7 701 000 00 00");
  const [service, setService] = useState("Стрижка + борода");
  const [when, setWhen] = useState("завтра после 18:00");
  const [out, setOut] = useState("Здесь появится уведомление, как только клиент нажмёт «Записаться».");

  return (
    <div className={s.pair}>
      <div className={s.box}>
        <span className={s.tag}>так видит клиент · сайт</span>
        <b>Барбершоп «Ножницы»</b> · Алматы, пример
        <table className={s.price}>
          <tbody>
            {Object.entries(SERVICES).map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td>{formatTenge(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <form
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            setOut(
              "🔔 Новая заявка с сайта · " + nowHM() + "\n\n" +
                "Имя: " + name.trim() + "\nТелефон: " + phone.trim() + "\nУслуга: " + service + " (" + formatTenge(SERVICES[service]) + ")\n" +
                "Когда удобно: " + (when.trim() || "не указал") + "\n\n[Позвонить]  [Написать в WhatsApp]  [Записать]",
            );
          }}
        >
          <label htmlFor="f1n">Имя</label>
          <input id="f1n" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
          <label htmlFor="f1p">Телефон</label>
          <input id="f1p" required maxLength={20} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <label htmlFor="f1s">Услуга</label>
          <select id="f1s" value={service} onChange={(e) => setService(e.target.value)}>
            {Object.keys(SERVICES).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
          <label htmlFor="f1t">Когда удобно</label>
          <input id="f1t" maxLength={40} value={when} onChange={(e) => setWhen(e.target.value)} />
          <button type="submit" className={s.btn}>Записаться</button>
        </form>
      </div>
      <div className={s.box}>
        <span className={s.tag}>так видит владелец · Telegram</span>
        <div className={s.tg} id="f1out">{out}</div>
        <p className={s.note}>Без этого заявка с сайта уходит на почту, которую никто не открывает, или не уходит вовсе.</p>
      </div>
    </div>
  );
}

function BotBlock() {
  const greeting: Msg = { text: "Здравствуйте! Я бот барбершопа «Ножницы». Запишу вас за минуту. Какая услуга?" };
  const [msgs, setMsgs] = useState<Msg[]>([greeting]);
  const [step, setStep] = useState<Step>("service");
  const [book, setBook] = useState<Booking>({});
  const [dayIdx, setDayIdx] = useState<number | null>(null);
  const [newHour, setNewHour] = useState<string | undefined>();
  const [out, setOut] = useState(START_OUT);
  const [nameIn, setNameIn] = useState("");

  const say = (...m: Msg[]) => setMsgs((p) => [...p, ...m]);
  const dayOptions = [0, 1, 2].map((i) => {
    const nm = DAY_NAMES[dayAt(i).getDay()];
    return { text: i === 0 ? "Сегодня" : i === 1 ? "Завтра" : nm[0].toUpperCase() + nm.slice(1), i };
  });

  function freeHours(i: number) {
    const busy = busyHours(i);
    let free = HOURS.filter((h) => !busy.has(h));
    if (i === 0) {
      const now = new Date().getHours();
      free = free.filter((h) => parseInt(h, 10) > now);
    }
    return free;
  }

  function restart() {
    setMsgs([greeting]);
    setStep("service");
    setBook({});
    setDayIdx(null);
    setNewHour(undefined);
    setOut(START_OUT);
    setNameIn("");
  }

  function pickService(k: string) {
    setBook({ service: k });
    say({ text: k, me: true }, { text: k + " — " + formatTenge(SERVICES[k]) + ", около часа. На какой день?" });
    setStep("day");
  }

  function pickDay(d: { text: string; i: number }) {
    setBook((b) => ({ ...b, dayText: d.text }));
    setDayIdx(d.i);
    if (!freeHours(d.i).length) {
      say({ text: d.text, me: true }, { text: "На этот день свободного времени уже нет. Выберите другой." });
      setStep("noslots");
      return;
    }
    say({ text: d.text, me: true }, { text: "Свободно: выберите время. Занятое я не показываю." });
    setStep("time");
  }

  function pickHour(h: string) {
    setBook((b) => ({ ...b, hour: h }));
    say({ text: h, me: true }, { text: "Как вас зовут?" });
    setStep("name");
  }

  function submitName(e: React.FormEvent) {
    e.preventDefault();
    const v = nameIn.trim();
    if (!v || !book.service || !book.dayText || !book.hour) return;
    const nm = v.slice(0, 40);
    say(
      { text: v, me: true },
      {
        text:
          "Спасибо, " + nm + "! Записал вас: " + book.service + ", " + book.dayText.toLowerCase() + " в " + book.hour +
          ". За 2 часа пришлю напоминание. Если планы изменятся — нажмите «Перенести».",
      },
    );
    setNewHour(book.hour);
    setOut(
      "📅 Новая запись через бота · " + nowHM() + "\n\n" + nm + " · " + book.service + " (" + formatTenge(SERVICES[book.service]) + ")\n" +
        book.dayText + ", " + book.hour + " · мастер Ерлан\nНапоминание клиенту: за 2 часа",
    );
    setStep("done");
  }

  const busy = dayIdx === null ? new Set<string>() : busyHours(dayIdx);
  let dayLabel = "Выберите день в чате";
  if (dayIdx !== null) {
    const d = dayAt(dayIdx);
    dayLabel = "Мастер Ерлан · " + DAY_NAMES[d.getDay()] + ", " + d.getDate() + "." + ("0" + (d.getMonth() + 1)).slice(-2);
  }

  return (
    <div className={s.pair}>
      <div className={s.box}>
        <span className={s.tag}>так видит клиент · чат с ботом</span>
        <div className={s.chat} aria-live="polite" data-testid="chat">
          {msgs.map((m, i) => (
            <div key={i} className={m.me ? `${s.msg} ${s.me}` : s.msg}>{m.text}</div>
          ))}
        </div>
        <div className={s.quick}>
          {step === "service" &&
            Object.keys(SERVICES).map((k) => (
              <button key={k} type="button" onClick={() => pickService(k)}>{k}</button>
            ))}
          {(step === "day" || step === "noslots") &&
            dayOptions
              .filter((d) => step === "day" || d.i !== dayIdx)
              .map((d) => (
                <button key={d.i} type="button" onClick={() => pickDay(d)}>{d.text}</button>
              ))}
          {step === "time" &&
            dayIdx !== null &&
            freeHours(dayIdx).slice(0, 8).map((h) => (
              <button key={h} type="button" onClick={() => pickHour(h)}>{h}</button>
            ))}
          {step === "done" && <button type="button" onClick={restart}>Начать заново</button>}
        </div>
        {step === "name" && (
          <form onSubmit={submitName} className={s.chatForm}>
            <input maxLength={40} aria-label="Ответ боту" placeholder="Ваше имя" value={nameIn} onChange={(e) => setNameIn(e.target.value)} />
            <button type="submit" className={s.btn}>Отправить</button>
          </form>
        )}
      </div>
      <div className={s.box}>
        <span className={s.tag}>так видит владелец · расписание</span>
        <div className={s.dayName}>{dayLabel}</div>
        <div className={s.slots}>
          {dayIdx !== null &&
            HOURS.map((h) => (
              <div key={h} className={h === newHour ? s.slotNew : busy.has(h) ? s.slotBusy : undefined}>{h}</div>
            ))}
        </div>
        <div className={s.tg} style={{ marginTop: 10 }} data-testid="botOut">{out}</div>
        <p className={s.note}>Бот отвечает ночью и в выходные, занятое время не предлагает, за 2 часа напоминает клиенту.</p>
      </div>
    </div>
  );
}

function DraftBlock() {
  const [text, setText] = useState(
    "Здравствуйте! Сколько у вас стоит стрижка с бородой? Можно в субботу после 6? Меня зовут Данияр",
  );
  const [parsed, setParsed] = useState(() => parseInquiry(text));
  const pick = (i: number) => {
    setText(SAMPLES[i]);
    setParsed(parseInquiry(SAMPLES[i]));
  };

  return (
    <div className={s.pair}>
      <div className={s.box}>
        <span className={s.tag}>пришло от клиента</span>
        <textarea id="ai" rows={5} value={text} onChange={(e) => setText(e.target.value)} aria-label="Обращение клиента" />
        <div className={s.samples}>
          Ещё примеры:{" "}
          {["ребёнок", "только борода", "без деталей"].map((label, i) => (
            <span key={label}>
              {i > 0 && " · "}
              <a
                role="button"
                tabIndex={0}
                data-s={i}
                onClick={() => pick(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    pick(i);
                  }
                }}
              >
                {label}
              </a>
            </span>
          ))}
        </div>
        <button id="aiBtn" type="button" className={s.btn} onClick={() => setParsed(parseInquiry(text))}>
          Подготовить ответ
        </button>
      </div>
      <div className={s.box}>
        <span className={s.tag}>черновик для администратора</span>
        <dl data-testid="aiCard">
          {parsed.card.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div className={s.draft} data-testid="aiDraft">{parsed.draft}</div>
      </div>
    </div>
  );
}

export function PrimerView() {
  return (
    <div lang="ru" className={s.root}>
      <header className={s.header}>
        <div className={s.wrap}>
          <div className={s.brand}>
            <a href="https://aevion-agency-site.vercel.app/?c=agency-primer">
              AEVION <span>Automation</span>
            </a>
          </div>
        </div>
      </header>
      <main className={s.wrap}>
        <h1>Как это выглядит у вашего клиента — и у вас</h1>
        <p className={s.lead}>
          Три вещи, которые мы делаем малому бизнесу за несколько дней. Пример собран на вымышленном барбершопе «Ножницы».
          Нажимайте как клиент: справа видно, что в ту же секунду получает владелец.
        </p>
        <p className={s.note}>
          Это демонстрация: ничего никуда не отправляется, данные не сохраняются. У настоящего клиента заявка уходит
          владельцу в Telegram или WhatsApp, а запись попадает в его расписание.
        </p>

        <h2>1. Сайт-визитка, с которой заявка не теряется</h2>
        <FormBlock />

        <h2>2. Бот записи в WhatsApp или Telegram</h2>
        <BotBlock />

        <h2>3. Готовый ответ на обращение клиента</h2>
        <DraftBlock />
        <p className={s.note}>
          В этом примере ответ собирается простыми правилами прямо в браузере. У клиента его пишет ИИ-модель по его прайсу,
          графику и манере общения, а администратор только проверяет и отправляет. Чего нет в обращении, черновик не
          выдумывает — он задаёт вопрос.
        </p>

        <div className={s.endbox}>
          <h2 style={{ margin: 0 }}>Хотите так же для своего бизнеса?</h2>
          <p>Напишите, чем вы занимаетесь и где сейчас теряются заявки. Ответим в течение дня и покажем пример на вашей нише.</p>
          <a className={s.cta} href={CONTACT_HREF}>Оставить заявку</a>
        </div>
      </main>
      <footer className={s.footer}>
        <div className={s.wrap}>
          AEVION Automation — подразделение платформы <a href="https://aevion.app">AEVION</a>. Барбершоп «Ножницы» вымышлен.
        </div>
      </footer>
    </div>
  );
}
