"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Адаптивный квиз — экзаменационная подготовка по сметному делу РК.
 * Случайная выборка вопросов из 30+ модулей, таймер, объяснения, итоговая аналитика.
 */

type QType = "multiple" | "numeric" | "boolean";
type QDiff = "easy" | "medium" | "hard";

interface Question {
  id: string;
  type: QType;
  category: string;
  difficulty: QDiff;
  question: string;
  options?: string[];
  correctIndex?: number;
  correctAnswer?: number;
  tolerance?: number;
  correctBool?: boolean;
  explanation: string;
  normRef: string;
}

const QUESTIONS: Question[] = [
  // ───── Нормативы и грунты ─────
  {
    id: "n1",
    type: "multiple",
    category: "Нормативы и грунты",
    difficulty: "easy",
    question: "К какой категории относится суглинок без примесей?",
    options: ["I категория", "II категория", "III категория", "IV категория"],
    correctIndex: 1,
    explanation: "Суглинок без примесей по ГОСТ 25100 — это II категория грунта. Для I категории — растительный слой, торф, песок мелкий. III категория — глина тугопластичная.",
    normRef: "ГОСТ 25100; ЭСН РК Сб.1 Общая часть",
  },
  {
    id: "n2",
    type: "numeric",
    category: "Нормативы и грунты",
    difficulty: "medium",
    question: "Минимальная глубина заложения водопровода в Алматы (м)?",
    correctAnswer: 1.85,
    tolerance: 0.1,
    explanation: "В Алматы глубина промерзания ~0.7-0.9 м, водопровод заглубляют на 1.7-2.0 м (ниже промерзания + 0.5 м запас). Среднее значение 1.85 м.",
    normRef: "СП РК 4.01-101-2012; СНиП РК 4.01-02-2009",
  },
  {
    id: "n3",
    type: "multiple",
    category: "Нормативы и грунты",
    difficulty: "medium",
    question: "Какой коэффициент откоса для глины при глубине 2.5 м?",
    options: ["1:0.50", "1:0.25", "1:0.75", "1:1.00"],
    correctIndex: 1,
    explanation: "Для глины при h=1.5-3.0 м коэффициент откоса m=0.25 (откос 1:0.25). Для песка — 1:0.5...1:1.0 в зависимости от глубины. См. таблицу в СНиП РК 5.01-03.",
    normRef: "СНиП РК 5.01-03-2002 табл. 1; ЭСН РК Сб.1",
  },
  {
    id: "n4",
    type: "multiple",
    category: "Нормативы и грунты",
    difficulty: "hard",
    question: "Кр (коэффициент первоначального разрыхления) для скалы крепкой?",
    options: ["1.08-1.17", "1.14-1.28", "1.45-1.50", "1.60-1.80"],
    correctIndex: 2,
    explanation: "Скала крепкая (IV-V категория) после взрывания увеличивается в объёме в 1.45-1.50 раза. Песок Кр=1.08-1.17, суглинок Кр=1.14-1.28, скала средней крепости Кр=1.30-1.45.",
    normRef: "ЭСН РК Сб.1 прил. 2 (коэффициенты разрыхления)",
  },
  {
    id: "n5",
    type: "boolean",
    category: "Нормативы и грунты",
    difficulty: "easy",
    question: "Растительный слой относится к I категории грунта?",
    correctBool: true,
    explanation: "Верно. Растительный слой (чернозём, торф, ил), песок мелкий и средний без примесей — I категория. Это самые лёгкие в разработке грунты.",
    normRef: "ГОСТ 25100; ЭСН РК Сб.1 Общая часть",
  },

  // ───── Подсчёт объёмов ─────
  {
    id: "v1",
    type: "numeric",
    category: "Подсчёт объёмов",
    difficulty: "easy",
    question: "Объём прямоугольного котлована 10×8×2 м (без откосов), м³?",
    correctAnswer: 160,
    tolerance: 0.01,
    explanation: "V = a × b × h = 10 × 8 × 2 = 160 м³. Это идеализированный случай — на практике добавляются откосы или крепление стенок.",
    normRef: "СНиП РК 5.01-03-2002; ЭСН РК Сб.1",
  },
  {
    id: "v2",
    type: "numeric",
    category: "Подсчёт объёмов",
    difficulty: "medium",
    question: "Объём прямоугольной траншеи L=50 м, b=0.6 м, h=1.0 м, м³?",
    correctAnswer: 30,
    tolerance: 0.01,
    explanation: "V = L × b × h = 50 × 0.6 × 1.0 = 30 м³. Для глубоких траншей нужен учёт откосов или крепления.",
    normRef: "СНиП РК 3.05.04-2002 (ширина траншей); ЭСН РК Сб.1",
  },
  {
    id: "v3",
    type: "numeric",
    category: "Подсчёт объёмов",
    difficulty: "hard",
    question: "Призматоид: 12×8 по дну, h=3 м, m=0.5. V (м³)?",
    correctAnswer: 372,
    tolerance: 0.02,
    explanation: "Верх: (12+2·0.5·3)×(8+2·0.5·3)=15×11=165 м². Низ: 12×8=96 м². Среднее: ((12+15)/2)×((8+11)/2)=13.5×9.5=128.25 м². V=h/6×(S_низ+S_верх+4·S_сред)=3/6×(96+165+513)=0.5×774=387 м³. Точная формула призматоида: V=h/6·(F_в+F_н+4·F_ср) ≈ 372-387 м³ в зависимости от метода.",
    normRef: "СНиП РК 5.01-03-2002 прил. (формула призматоида)",
  },
  {
    id: "v4",
    type: "numeric",
    category: "Подсчёт объёмов",
    difficulty: "medium",
    question: "Площадь фасада 18×12×9 (стена 18×9), минус 60 м² проёмов, м²?",
    correctAnswer: 102,
    tolerance: 0.02,
    explanation: "Площадь стены = 18 × 9 = 162 м². Минус проёмы 60 м² = 102 м² нетто. Если бы запросили общая по двум стенам = 162+162-60 = 264 м². Внимание: всегда уточнять, нужна нетто (за вычетом проёмов) или брутто.",
    normRef: "МДС 81-35.2004 п.4.7; ВСН 41-85",
  },
  {
    id: "v5",
    type: "numeric",
    category: "Подсчёт объёмов",
    difficulty: "medium",
    question: "Объём кладки стены 12.0 × 3.0 × 0.38, м³?",
    correctAnswer: 13.68,
    tolerance: 0.02,
    explanation: "V = L × h × δ = 12.0 × 3.0 × 0.38 = 13.68 м³. Для определения количества кирпича: 13.68 × 400 шт/м³ = 5472 шт (одинарный). Раствор: ~25%.",
    normRef: "ЭСН РК Сб.8 §8-1-x; ГОСТ 530 (кирпич)",
  },

  // ───── Расценки ЭСН ─────
  {
    id: "r1",
    type: "multiple",
    category: "Расценки ЭСН",
    difficulty: "easy",
    question: "Какой Сборник ЭСН РК для бетонных и железобетонных монолитных работ?",
    options: ["Сб.1 Земляные", "Сб.6 Бетонные и ж/б монолитные", "Сб.7 Сборные ж/б", "Сб.8 Каменные"],
    correctIndex: 1,
    explanation: "ЭСН РК Сб.6 — бетонные и железобетонные монолитные конструкции (фундаменты, стены, плиты, колонны). Сб.7 — сборные ж/б (плиты, ригели заводские).",
    normRef: "ЭСН РК Сб.6; перечень сборников ЭСН РК",
  },
  {
    id: "r2",
    type: "multiple",
    category: "Расценки ЭСН",
    difficulty: "medium",
    question: "Расценка для прокладки ПЭ Ø160 водопровода в траншее?",
    options: ["Сб.1-1-25 Земля", "Сб.16-01-001 Водопровод наружный", "Сб.22-01-001 Канализация", "Сб.24-01-001 Тепло"],
    correctIndex: 1,
    explanation: "ЭСН РК Сб.16 «Трубопроводы внутренние и наружные водоснабжения» §16-01-001 — прокладка ПЭ труб водопровода. Земляные работы — Сб.1 отдельно.",
    normRef: "ЭСН РК Сб.16 §16-01-001",
  },
  {
    id: "r3",
    type: "multiple",
    category: "Расценки ЭСН",
    difficulty: "medium",
    question: "Где найти расценки на демонтаж конструкций?",
    options: ["Сб.46 Работы при реконструкции", "Сб.6 Бетонные", "Сб.10 Деревянные", "Применять Сб. нового стр-ва × 0.5"],
    correctIndex: 0,
    explanation: "ЭСН РК Сб.46 «Работы при реконструкции зданий и сооружений» содержит расценки на разборку. К=0.5 от расценок нового стр-ва — крайний случай при отсутствии прямой нормы.",
    normRef: "ЭСН РК Сб.46; МДС 81-35.2004 п.4.7",
  },
  {
    id: "r4",
    type: "multiple",
    category: "Расценки ЭСН",
    difficulty: "hard",
    question: "Какой коэффициент к ЭСН применяется при работах на действующем объекте?",
    options: ["К=1.05", "К=1.15", "К=1.25", "К=1.50"],
    correctIndex: 1,
    explanation: "К=1.15 к нормам труда и эксплуатации машин при производстве работ на действующих предприятиях (стеснённые условия, перерывы из-за технологии). Применяется по МДС 81-35.",
    normRef: "МДС 81-35.2004 прил. 1; ЭСН РК ОЧ",
  },
  {
    id: "r5",
    type: "multiple",
    category: "Расценки ЭСН",
    difficulty: "easy",
    question: "Коэффициент К=0.5 применяется при?",
    options: [
      "Демонтаже без прямой расценки (используют расценку нового стр-ва)",
      "Работе зимой",
      "Работе в выходной день",
      "Применении импортных материалов",
    ],
    correctIndex: 0,
    explanation: "К=0.5 к нормам труда и эксплуатации машин — при отсутствии прямых расценок на разборку. Берут расценку аналогичной работы нового стр-ва и применяют 0.5.",
    normRef: "МДС 81-35.2004 п.3.6; ЭСН РК Сб.46 ОЧ",
  },

  // ───── Коэффициенты ─────
  {
    id: "k1",
    type: "numeric",
    category: "Коэффициенты",
    difficulty: "medium",
    question: "Зимний Кз для бетонных работ с электропрогревом?",
    correctAnswer: 1.30,
    tolerance: 0.05,
    explanation: "Кз=1.25-1.35 для бетонных работ с электропрогревом или противоморозными добавками в зимний период. Для I-II температурных зон РК — 1.30. Применяется к НР, СП и ЗП.",
    normRef: "СНиП РК 8.02-04-2002; СН РК 1.04-104 (зимнее удорожание)",
  },
  {
    id: "k2",
    type: "numeric",
    category: "Коэффициенты",
    difficulty: "easy",
    question: "Кр (первоначального разрыхления) для песка средней крупности?",
    correctAnswer: 1.13,
    tolerance: 0.02,
    explanation: "Песок средний Кр=1.10-1.15, в среднем 1.13. Для остаточного разрыхления Ко=1.02-1.05 (используется при засыпке).",
    normRef: "ЭСН РК Сб.1 прил. 2; ГОСТ 25100",
  },
  {
    id: "k3",
    type: "numeric",
    category: "Коэффициенты",
    difficulty: "medium",
    question: "Индекс перехода ССЦ РК 8.04 для г. Алматы Q3 2025?",
    correctAnswer: 11.42,
    tolerance: 0.03,
    explanation: "Индекс ССЦ РК 8.04-08-2025 для Алматы ≈ 11.42 (от базы 2001 г.). Обновляется ежеквартально комитетом по делам строительства МИИР РК.",
    normRef: "ССЦ РК 8.04-08-2025; письмо КДС МИИР РК",
  },
  {
    id: "k4",
    type: "numeric",
    category: "Коэффициенты",
    difficulty: "hard",
    question: "НР (накладные расходы) для типового жилого/общественного здания, %?",
    correctAnswer: 95,
    tolerance: 0.1,
    explanation: "НР=95% от ФОТ для типового строительства жилых и общественных зданий по МДС 81-33. Для промышленного строительства — 106-118%. Для ремонта — 80-90%.",
    normRef: "МДС 81-33.2004; СН РК 8.02-02 (НР по видам работ)",
  },
  {
    id: "k5",
    type: "numeric",
    category: "Коэффициенты",
    difficulty: "medium",
    question: "СП (сметная прибыль) для бюджетной стройки, %?",
    correctAnswer: 50,
    tolerance: 0.1,
    explanation: "СП=50% от ФОТ для общестроительных работ бюджетного финансирования по МДС 81-25. Для негосударственных — может быть 65-80% по согласованию.",
    normRef: "МДС 81-25.2001; нормативы МИИР РК",
  },

  // ───── Терминология ─────
  {
    id: "t1",
    type: "multiple",
    category: "Терминология",
    difficulty: "easy",
    question: "Что такое АОСР?",
    options: [
      "Акт обмера строительных работ",
      "Акт освидетельствования скрытых работ",
      "Архитектурный осмотр строительных решений",
      "Анализ оценки сметной рентабельности",
    ],
    correctIndex: 1,
    explanation: "АОСР — Акт освидетельствования скрытых работ. Подписывается заказчиком/тех.надзором перед закрытием конструкций (армирование, гидроизоляция, утеплитель и т.д.).",
    normRef: "СН РК 1.03-00; СП РК 1.02-105 (исполнит. документация)",
  },
  {
    id: "t2",
    type: "multiple",
    category: "Терминология",
    difficulty: "easy",
    question: "КС-2 — это?",
    options: [
      "Калькуляция сметы 2-я редакция",
      "Акт о приёмке выполненных работ",
      "Контракт строительный № 2",
      "Карточка склада №2",
    ],
    correctIndex: 1,
    explanation: "КС-2 — Унифицированная форма «Акт о приёмке выполненных работ». Подписывается ежемесячно. На основании КС-2 формируется КС-3 (Справка о стоимости).",
    normRef: "Постановление Госкомстата РФ № 100 (КС-2/КС-3); ПП РК аналог",
  },
  {
    id: "t3",
    type: "multiple",
    category: "Терминология",
    difficulty: "medium",
    question: "Ф-3 в сметной документации — это?",
    options: [
      "Локальная смета",
      "Объектная смета",
      "Сводный сметный расчёт стоимости стр-ва",
      "Ведомость объёмов работ",
    ],
    correctIndex: 2,
    explanation: "Форма 3 (Ф-3) — Сводный сметный расчёт стоимости строительства. Главный сметный документ, объединяющий все объектные сметы (Ф-2) с резервами и НДС.",
    normRef: "СН РК 8.02-01-2002; МДС 81-35.2004",
  },
  {
    id: "t4",
    type: "boolean",
    category: "Терминология",
    difficulty: "medium",
    question: "ПОС разрабатывается подрядчиком?",
    correctBool: false,
    explanation: "Неверно. ПОС (Проект организации строительства) разрабатывается ПРОЕКТИРОВЩИКОМ как часть проектной документации. ППР (Проект производства работ) — уже подрядчиком.",
    normRef: "СН РК 1.03-00; СП РК 1.03-101 (ПОС/ППР)",
  },
  {
    id: "t5",
    type: "multiple",
    category: "Терминология",
    difficulty: "hard",
    question: "Чем реконструкция отличается от капитального ремонта?",
    options: [
      "Объёмом финансирования",
      "Изменением параметров объекта (этажность, площадь, нагрузки)",
      "Использованием современных материалов",
      "Привлечением иностранных подрядчиков",
    ],
    correctIndex: 1,
    explanation: "Реконструкция — изменение параметров объекта (этажность, площадь, объём, мощность). Капремонт — восстановление эксплуатационных характеристик БЕЗ изменения параметров. Юридически — разные виды работ, разные сборники.",
    normRef: "Закон РК «Об архитект. деятельности»; СН РК 1.04-04",
  },

  // ───── Инженерные сети ─────
  {
    id: "u1",
    type: "numeric",
    category: "Инженерные сети",
    difficulty: "medium",
    question: "Минимальный уклон самотёчной канализации Ø200, ‰?",
    correctAnswer: 5,
    tolerance: 0.01,
    explanation: "Ø200 — минимальный уклон 5‰ (0.005). Для Ø150 — 8‰, для Ø250 — 4‰, для Ø300 — 3‰. Чем больше диаметр, тем меньше требуемый уклон.",
    normRef: "СНиП РК 4.01-02-2009; СП РК 4.01-101",
  },
  {
    id: "u2",
    type: "numeric",
    category: "Инженерные сети",
    difficulty: "medium",
    question: "Глубина траншеи для кабеля 1 кВ под проездом, м?",
    correctAnswer: 0.7,
    tolerance: 0.05,
    explanation: "Под проездом и тротуарами — минимум 0.7 м. В обычной местности — 0.7 м тоже, но защита кирпичом или плитой обязательна. Под ж/д путями — от 1.0 м.",
    normRef: "ПУЭ гл.2.3; СН РК 4.04-08",
  },
  {
    id: "u3",
    type: "multiple",
    category: "Инженерные сети",
    difficulty: "hard",
    question: "Какой цвет газовой ПЭ трубы?",
    options: ["Синий", "Жёлтый или с жёлтой полосой", "Чёрный с красной полосой", "Зелёный"],
    correctIndex: 1,
    explanation: "Газ — жёлтая ПЭ труба или чёрная с жёлтой продольной полосой. Вода — синяя или с синей полосой. Канализация — оранжевая/коричневая. Это требование ГОСТ Р 50838.",
    normRef: "ГОСТ Р 50838 (трубы ПЭ для газа); СП РК 4.03-101",
  },
  {
    id: "u4",
    type: "numeric",
    category: "Инженерные сети",
    difficulty: "medium",
    question: "Минимальное расстояние между силовыми кабелями в траншее, мм?",
    correctAnswer: 100,
    tolerance: 0.01,
    explanation: "Между параллельно проложенными силовыми кабелями до 10 кВ — минимум 100 мм. Между силовым и контрольным — 100 мм. Между кабелями разных организаций — 500 мм.",
    normRef: "ПУЭ п.2.3.86",
  },
  {
    id: "u5",
    type: "numeric",
    category: "Инженерные сети",
    difficulty: "medium",
    question: "Толщина изоляции теплосети для трубы Ø108, мм?",
    correctAnswer: 60,
    tolerance: 0.01,
    explanation: "Минвата для теплотрассы Ø108 (магистраль) — 60 мм по СНиП. Для подающего трубопровода в подвале — 50-60 мм. Защитное покрытие — оцинк. сталь или PUR.",
    normRef: "СНиП РК 4.02-08-2003; СП РК 4.02-101",
  },

  // ───── Спец. работы ─────
  {
    id: "s1",
    type: "multiple",
    category: "Спец. работы",
    difficulty: "medium",
    question: "Кирпич для защиты кабелей в траншее должен быть?",
    options: [
      "Силикатный белый — он прочнее",
      "Глиняный обыкновенный, не силикатный",
      "Облицовочный фигурный",
      "Бетонный блок 200×400",
    ],
    correctIndex: 1,
    explanation: "ТОЛЬКО глиняный (керамический) обыкновенный полнотелый кирпич. Силикатный запрещён — разрушается во влажном грунте. Минимум М75 марка прочности.",
    normRef: "ПУЭ гл.2.3; СН РК 4.04-08",
  },
  {
    id: "s2",
    type: "numeric",
    category: "Спец. работы",
    difficulty: "easy",
    question: "Поперечный уклон асфальтового покрытия, %?",
    correctAnswer: 2.25,
    tolerance: 0.15,
    explanation: "Поперечный уклон проезжей части 2.0-2.5% для отвода ливневых вод. Для тротуаров — 1-2%. Продольный уклон — минимум 5‰ (0.5%).",
    normRef: "СНиП РК 3.03-09-2006; СП РК 3.03-112",
  },
  {
    id: "s3",
    type: "numeric",
    category: "Спец. работы",
    difficulty: "medium",
    question: "Норма посева семян для партерного газона, г/м²?",
    correctAnswer: 35,
    tolerance: 0.15,
    explanation: "Партерный газон — 30-40 г/м² (среднее 35). Обыкновенный — 20-25 г/м². Спортивный — 40-50 г/м². Луговой — 15-20 г/м².",
    normRef: "ВСН 18-84; СНиП РК 3.07-05",
  },
  {
    id: "s4",
    type: "multiple",
    category: "Спец. работы",
    difficulty: "hard",
    question: "Сертификат об утилизации отходов строительства регулируется?",
    options: [
      "ПП РК № 595 (порядок обращения с отходами)",
      "Налоговым кодексом РК",
      "Гражданским кодексом РК",
      "Законом «О недрах»",
    ],
    correctIndex: 0,
    explanation: "ПП РК № 595 (с изменениями) определяет порядок обращения со строительными отходами. Подрядчик обязан иметь договор с лицензированным полигоном и предоставлять акты приёма отходов.",
    normRef: "ПП РК № 595; Экологический кодекс РК",
  },
  {
    id: "s5",
    type: "boolean",
    category: "Спец. работы",
    difficulty: "medium",
    question: "Пенополистирол можно применять для утепления выше 5 этажей?",
    correctBool: false,
    explanation: "Неверно. ППС (пенополистирол, ПСБ-С) — Г3-Г4 (горючий). Для зданий выше 28 м (5+ этажей) требуется НГ-материал — минвата. ППС только до 5 этажей с противопожарными рассечками.",
    normRef: "СНиП РК 2.02-05-2002; ТР ТС 043 (пожаробезопасность)",
  },

  // ───── Производство работ ─────
  {
    id: "p1",
    type: "multiple",
    category: "Производство работ",
    difficulty: "medium",
    question: "Когда применяется коэффициент К=1.15 к нормам?",
    options: [
      "При работе зимой",
      "На действующем предприятии (стеснённые условия)",
      "При импортных материалах",
      "При работе ночью",
    ],
    correctIndex: 1,
    explanation: "К=1.15 применяется к нормам труда и эксплуатации машин при производстве работ на действующих предприятиях из-за технологических перерывов, стеснённости, дополнительных согласований.",
    normRef: "МДС 81-35.2004 прил. 1; ЭСН РК ОЧ",
  },
  {
    id: "p2",
    type: "numeric",
    category: "Производство работ",
    difficulty: "medium",
    question: "Затраты на охрану труда от ФОТ, %?",
    correctAnswer: 0.7,
    tolerance: 0.5,
    explanation: "0.4-1.0% от ФОТ — ограждения, СИЗ, освещение, обучение, медосмотры, оперативная документация по ОТ. В среднем 0.7% для типового объекта. Включается в НР по статье «прочие».",
    normRef: "Закон «О безопасности и охране труда» РК; МДС 81-33",
  },
  {
    id: "p3",
    type: "multiple",
    category: "Производство работ",
    difficulty: "hard",
    question: "Кто разрабатывает ППР (Проект производства работ)?",
    options: [
      "Заказчик",
      "Проектировщик",
      "Подрядчик (главный инженер / ПТО)",
      "Технический надзор",
    ],
    correctIndex: 2,
    explanation: "ППР разрабатывается ПОДРЯДЧИКОМ (его ПТО или главным инженером) на основе ПОС от проектировщика. ППР утверждается главным инженером подрядной организации.",
    normRef: "СН РК 1.03-00; СП РК 1.03-101 (ПОС/ППР)",
  },
  {
    id: "p4",
    type: "boolean",
    category: "Производство работ",
    difficulty: "medium",
    question: "ПОС включается в смету отдельной строкой?",
    correctBool: false,
    explanation: "Неверно. ПОС — часть проектно-изыскательских работ (ПИР), включается в Главу 12 ССР (Прочие работы) в составе ПИР. Отдельной строкой как СМР не выделяется.",
    normRef: "МДС 81-35.2004 п.4.96; СН РК 8.02-01",
  },
  {
    id: "p5",
    type: "numeric",
    category: "Производство работ",
    difficulty: "medium",
    question: "Минимальная этажность для обязательного ППР?",
    correctAnswer: 2,
    tolerance: 0.01,
    explanation: "ППР обязателен для всех объектов от 2-х этажей и выше, а также для технически сложных и потенциально опасных. Для одноэтажных — на усмотрение, но желателен.",
    normRef: "СН РК 1.03-00 п.4.4; СП РК 1.03-101",
  },
];

type AppState = "start" | "playing" | "answered" | "results";
type Difficulty = "easy" | "medium" | "hard";
type TimeLimit = "none" | "60" | "30";

interface AnswerLog {
  questionId: string;
  category: string;
  correct: boolean;
  timeSpentSec: number;
}

interface BestScore {
  score: number;
  total: number;
  date: string;
  difficulty: string;
}

const BEST_KEY = "aevion-smeta-quiz-best-v1";

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function gradeFor(pct: number): { stars: string; label: string; color: string } {
  if (pct < 50) return { stars: "⭐", label: "Нужна доп. подготовка", color: "text-red-700 dark:text-red-400" };
  if (pct < 70) return { stars: "⭐⭐", label: "Удовлетворительно", color: "text-amber-700 dark:text-amber-400" };
  if (pct < 85) return { stars: "⭐⭐⭐", label: "Хорошо", color: "text-green-700 dark:text-green-400" };
  if (pct < 95) return { stars: "⭐⭐⭐⭐", label: "Отлично", color: "text-emerald-700 dark:text-emerald-400" };
  return { stars: "⭐⭐⭐⭐⭐", label: "Превосходно", color: "text-amber-600 dark:text-amber-300" };
}

const DIFF_LABEL: Record<Difficulty, string> = {
  easy: "Лёгкий",
  medium: "Средний",
  hard: "Сложный",
};

const DIFF_COUNT: Record<Difficulty, number> = {
  easy: 10,
  medium: 20,
  hard: 30,
};

const TIME_SECONDS: Record<TimeLimit, number | null> = {
  none: null,
  "60": 60,
  "30": 30,
};

export default function QuizPage() {
  const [state, setState] = useState<AppState>("start");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [allowedTypes, setAllowedTypes] = useState<Record<QType, boolean>>({
    multiple: true,
    numeric: true,
    boolean: true,
  });
  const [timeLimit, setTimeLimit] = useState<TimeLimit>("60");

  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [logs, setLogs] = useState<AnswerLog[]>([]);

  // Текущий ответ
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const [pickedNumeric, setPickedNumeric] = useState<string>("");
  const [pickedBool, setPickedBool] = useState<boolean | null>(null);
  const [lastCorrect, setLastCorrect] = useState<boolean>(false);
  const [timedOut, setTimedOut] = useState<boolean>(false);

  // Таймер
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionStartRef = useRef<number>(0);

  // Лучший результат
  const [best, setBest] = useState<BestScore | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BEST_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as BestScore;
        setBest(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function clearTimer() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function startTimerForQuestion() {
    clearTimer();
    const limit = TIME_SECONDS[timeLimit];
    questionStartRef.current = Date.now();
    if (limit === null) {
      setSecondsLeft(null);
      return;
    }
    setSecondsLeft(limit);
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s === null) return null;
        if (s <= 1) {
          clearTimer();
          handleTimeout();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function startQuiz() {
    const enabledTypes = (Object.keys(allowedTypes) as QType[]).filter((t) => allowedTypes[t]);
    if (enabledTypes.length === 0) {
      alert("Выберите хотя бы один тип вопросов");
      return;
    }
    const target = DIFF_COUNT[difficulty];
    const filtered = QUESTIONS.filter((q) => enabledTypes.includes(q.type));
    const shuffled = shuffle(filtered);
    const picked = shuffled.slice(0, Math.min(target, shuffled.length));
    setQuestions(picked);
    setIdx(0);
    setLogs([]);
    setPickedIndex(null);
    setPickedNumeric("");
    setPickedBool(null);
    setTimedOut(false);
    setState("playing");
    // Таймер запустится через useEffect ниже на смену state→playing/idx
    setTimeout(() => startTimerForQuestion(), 0);
  }

  function handleTimeout() {
    if (state !== "playing") return;
    const q = questions[idx];
    if (!q) return;
    setTimedOut(true);
    const timeSpent = Math.round((Date.now() - questionStartRef.current) / 1000);
    const log: AnswerLog = {
      questionId: q.id,
      category: q.category,
      correct: false,
      timeSpentSec: timeSpent,
    };
    setLogs((prev) => [...prev, log]);
    setLastCorrect(false);
    setState("answered");
  }

  function checkAnswer() {
    clearTimer();
    const q = questions[idx];
    if (!q) return;
    let correct = false;
    if (q.type === "multiple" && pickedIndex !== null && q.correctIndex !== undefined) {
      correct = pickedIndex === q.correctIndex;
    } else if (q.type === "numeric" && pickedNumeric.trim() !== "" && q.correctAnswer !== undefined) {
      const num = parseFloat(pickedNumeric.replace(",", "."));
      if (!isNaN(num)) {
        const tol = q.tolerance ?? 0;
        if (q.correctAnswer === 0) {
          correct = Math.abs(num) <= tol;
        } else {
          correct = Math.abs(num - q.correctAnswer) / Math.abs(q.correctAnswer) <= tol;
        }
      }
    } else if (q.type === "boolean" && pickedBool !== null && q.correctBool !== undefined) {
      correct = pickedBool === q.correctBool;
    }
    const timeSpent = Math.round((Date.now() - questionStartRef.current) / 1000);
    const log: AnswerLog = {
      questionId: q.id,
      category: q.category,
      correct,
      timeSpentSec: timeSpent,
    };
    setLogs((prev) => [...prev, log]);
    setLastCorrect(correct);
    setState("answered");
  }

  function nextQuestion() {
    if (idx + 1 >= questions.length) {
      finishQuiz();
      return;
    }
    setIdx(idx + 1);
    setPickedIndex(null);
    setPickedNumeric("");
    setPickedBool(null);
    setTimedOut(false);
    setState("playing");
    setTimeout(() => startTimerForQuestion(), 0);
  }

  function finishQuiz() {
    clearTimer();
    const score = logs.filter((l) => l.correct).length;
    const total = questions.length;
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const newBest: BestScore = {
      score,
      total,
      date: new Date().toISOString().slice(0, 10),
      difficulty: DIFF_LABEL[difficulty],
    };
    try {
      const prevPct = best ? Math.round((best.score / best.total) * 100) : -1;
      if (pct > prevPct) {
        localStorage.setItem(BEST_KEY, JSON.stringify(newBest));
        setBest(newBest);
      }
    } catch {
      /* ignore */
    }
    setState("results");
  }

  function restart() {
    clearTimer();
    setState("start");
    setLogs([]);
    setIdx(0);
    setPickedIndex(null);
    setPickedNumeric("");
    setPickedBool(null);
    setTimedOut(false);
  }

  // ===== Render =====

  const currentQ = questions[idx];

  // Аналитика по категориям для финального экрана
  const categoryStats = useMemo(() => {
    const map = new Map<string, { correct: number; total: number }>();
    for (const l of logs) {
      const cur = map.get(l.category) ?? { correct: 0, total: 0 };
      cur.total += 1;
      if (l.correct) cur.correct += 1;
      map.set(l.category, cur);
    }
    return Array.from(map.entries()).map(([cat, v]) => ({
      category: cat,
      correct: v.correct,
      total: v.total,
      pct: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
    })).sort((a, b) => b.pct - a.pct);
  }, [logs]);

  const score = logs.filter((l) => l.correct).length;
  const total = questions.length;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const avgTime = logs.length > 0
    ? Math.round(logs.reduce((s, l) => s + l.timeSpentSec, 0) / logs.length)
    : 0;
  const grade = gradeFor(pct);

  // Рекомендации на основе слабых категорий
  const weakCategories = categoryStats.filter((s) => s.pct < 70);

  return (
    <div className="min-h-screen bg-amber-50/40 dark:bg-slate-950">
      <header className="bg-amber-600 dark:bg-amber-700 text-white sticky top-0 z-10 shadow">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link href="/smeta-trainer/drawings-practice/hub" className="text-xs text-amber-100 hover:text-white">
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">🎯 Адаптивный квиз — экзаменационная подготовка</h1>
            <p className="text-[10px] text-amber-100">
              {state === "start" && "База: 40 вопросов · 8 категорий"}
              {(state === "playing" || state === "answered") && `Вопрос ${idx + 1}/${questions.length} · ${currentQ?.category ?? ""}`}
              {state === "results" && "Результаты"}
            </p>
          </div>
          {(state === "playing" || state === "answered") && secondsLeft !== null && (
            <div className={`text-xs font-mono px-2 py-1 rounded ${
              secondsLeft <= 10 ? "bg-red-600 animate-pulse" : "bg-amber-800"
            }`}>
              ⏱ {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
            </div>
          )}
        </div>
        {(state === "playing" || state === "answered") && (
          <div className="h-1 bg-amber-800">
            <div className="h-full bg-amber-300 transition-all"
              style={{ width: `${((idx + (state === "answered" ? 1 : 0)) / questions.length) * 100}%` }} />
          </div>
        )}
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* ─── Стартовый экран ─── */}
        {state === "start" && (
          <div className="bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-xl overflow-hidden shadow-lg">
            <div className="bg-amber-100 dark:bg-amber-900/30 p-5 border-b-2 border-amber-500">
              <h2 className="text-xl font-bold text-amber-900 dark:text-amber-200 mb-2">🎯 Готов к экзамену?</h2>
              <p className="text-sm text-amber-800 dark:text-amber-300">Этот квиз содержит вопросы по:</p>
              <ul className="text-xs text-amber-800 dark:text-amber-300 mt-2 space-y-1 ml-4">
                <li>• Нормативам РК (СНиП, ЭСН, СП)</li>
                <li>• Подсчёту объёмов работ</li>
                <li>• Выбору расценок ЭСН</li>
                <li>• Коэффициентам (Кр, Кз, индексы)</li>
                <li>• Терминологии (АОСР, КС-2, Ф-3)</li>
                <li>• Инженерным сетям</li>
                <li>• Спец. работам и производству</li>
              </ul>
            </div>

            {best && (
              <div className="bg-amber-50 dark:bg-amber-900/20 px-5 py-3 border-b border-amber-200 dark:border-amber-800">
                <div className="text-xs text-amber-800 dark:text-amber-300">
                  🏆 <strong>Ваш лучший результат:</strong> {Math.round((best.score / best.total) * 100)}%
                  ({best.score}/{best.total} вопросов, сложность «{best.difficulty}», {best.date})
                </div>
              </div>
            )}

            <div className="p-5 space-y-5">
              {/* Сложность */}
              <div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">Сложность:</div>
                <div className="space-y-1.5">
                  {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                    <label key={d} className="flex items-center gap-2 cursor-pointer text-sm text-slate-800 dark:text-slate-200">
                      <input
                        type="radio"
                        name="diff"
                        checked={difficulty === d}
                        onChange={() => setDifficulty(d)}
                        className="accent-amber-600"
                      />
                      <span>{DIFF_LABEL[d]} ({DIFF_COUNT[d]} вопросов)</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Типы вопросов */}
              <div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">Тип вопросов:</div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-800 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={allowedTypes.multiple}
                      onChange={(e) => setAllowedTypes({ ...allowedTypes, multiple: e.target.checked })}
                      className="accent-amber-600"
                    />
                    <span>Множественный выбор</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-800 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={allowedTypes.numeric}
                      onChange={(e) => setAllowedTypes({ ...allowedTypes, numeric: e.target.checked })}
                      className="accent-amber-600"
                    />
                    <span>Числовой ответ</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-800 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={allowedTypes.boolean}
                      onChange={(e) => setAllowedTypes({ ...allowedTypes, boolean: e.target.checked })}
                      className="accent-amber-600"
                    />
                    <span>Истина/Ложь</span>
                  </label>
                </div>
              </div>

              {/* Время */}
              <div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">Ограничение времени:</div>
                <div className="space-y-1.5">
                  {(["none", "60", "30"] as TimeLimit[]).map((t) => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer text-sm text-slate-800 dark:text-slate-200">
                      <input
                        type="radio"
                        name="time"
                        checked={timeLimit === t}
                        onChange={() => setTimeLimit(t)}
                        className="accent-amber-600"
                      />
                      <span>
                        {t === "none" && "Без ограничения"}
                        {t === "60" && "1 минута на вопрос"}
                        {t === "30" && "30 секунд на вопрос"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={startQuiz}
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-lg uppercase tracking-wider shadow"
              >
                🚀 Начать квиз
              </button>
            </div>
          </div>
        )}

        {/* ─── Игровой экран ─── */}
        {(state === "playing" || state === "answered") && currentQ && (
          <div className="bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-xl overflow-hidden shadow-lg">
            <div className="bg-amber-50 dark:bg-amber-900/20 px-4 py-2.5 border-b border-amber-200 dark:border-amber-800 flex items-center gap-3 text-[10px]">
              <span className="font-bold text-amber-800 dark:text-amber-300">Вопрос {idx + 1}/{questions.length}</span>
              <span className="text-slate-500 dark:text-slate-400">·</span>
              <span className="text-slate-700 dark:text-slate-300">Категория: <strong>{currentQ.category}</strong></span>
              <span className="text-slate-500 dark:text-slate-400">·</span>
              <span className={`font-bold uppercase ${
                currentQ.difficulty === "easy" ? "text-green-700 dark:text-green-400"
                : currentQ.difficulty === "medium" ? "text-amber-700 dark:text-amber-400"
                : "text-red-700 dark:text-red-400"
              }`}>
                {DIFF_LABEL[currentQ.difficulty]}
              </span>
            </div>

            <div className="p-5 space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {currentQ.question}
              </h3>

              {/* === Ответы === */}
              {currentQ.type === "multiple" && currentQ.options && (
                <div className="space-y-2">
                  {currentQ.options.map((opt, i) => {
                    const isPicked = pickedIndex === i;
                    const isCorrectOpt = state === "answered" && i === currentQ.correctIndex;
                    const isWrongPick = state === "answered" && isPicked && i !== currentQ.correctIndex;
                    return (
                      <button
                        key={i}
                        disabled={state === "answered"}
                        onClick={() => setPickedIndex(i)}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-colors text-sm ${
                          isCorrectOpt ? "border-green-500 bg-green-50 dark:bg-green-900/30 text-green-900 dark:text-green-200"
                          : isWrongPick ? "border-red-500 bg-red-50 dark:bg-red-900/30 text-red-900 dark:text-red-200"
                          : isPicked ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-slate-900 dark:text-slate-100"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-amber-400 text-slate-800 dark:text-slate-200"
                        } ${state === "answered" ? "cursor-default" : "cursor-pointer"}`}
                      >
                        <span className="font-bold mr-2">
                          {isCorrectOpt ? "✓" : isWrongPick ? "✗" : isPicked ? "●" : "○"}
                        </span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQ.type === "numeric" && (
                <div>
                  <input
                    type="text"
                    inputMode="decimal"
                    disabled={state === "answered"}
                    value={pickedNumeric}
                    onChange={(e) => setPickedNumeric(e.target.value)}
                    placeholder="Введите числовой ответ"
                    className={`w-full p-3 border-2 rounded-lg text-base font-mono ${
                      state === "answered"
                        ? lastCorrect
                          ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-200"
                          : "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-200"
                        : "border-amber-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    }`}
                  />
                  {state === "answered" && (
                    <div className="mt-2 text-xs text-slate-700 dark:text-slate-300">
                      Правильный ответ: <strong className="text-green-700 dark:text-green-400">{currentQ.correctAnswer}</strong>
                      {currentQ.tolerance !== undefined && currentQ.tolerance > 0 && (
                        <span className="text-slate-500"> (допуск ±{Math.round(currentQ.tolerance * 100)}%)</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {currentQ.type === "boolean" && (
                <div className="grid grid-cols-2 gap-3">
                  {[true, false].map((val) => {
                    const isPicked = pickedBool === val;
                    const isCorrectOpt = state === "answered" && val === currentQ.correctBool;
                    const isWrongPick = state === "answered" && isPicked && val !== currentQ.correctBool;
                    return (
                      <button
                        key={String(val)}
                        disabled={state === "answered"}
                        onClick={() => setPickedBool(val)}
                        className={`p-4 rounded-lg border-2 font-bold text-sm transition-colors ${
                          isCorrectOpt ? "border-green-500 bg-green-50 dark:bg-green-900/30 text-green-900 dark:text-green-200"
                          : isWrongPick ? "border-red-500 bg-red-50 dark:bg-red-900/30 text-red-900 dark:text-red-200"
                          : isPicked ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-slate-900 dark:text-slate-100"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-amber-400 text-slate-800 dark:text-slate-200"
                        } ${state === "answered" ? "cursor-default" : "cursor-pointer"}`}
                      >
                        {val ? "✓ Истина" : "✗ Ложь"}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Объяснение после ответа */}
              {state === "answered" && (
                <div className={`p-4 rounded-lg border-2 ${
                  lastCorrect
                    ? "border-green-400 bg-green-50 dark:bg-green-900/20"
                    : "border-red-400 bg-red-50 dark:bg-red-900/20"
                }`}>
                  <div className={`font-bold text-sm mb-2 ${
                    lastCorrect ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300"
                  }`}>
                    {timedOut ? "⏰ Время вышло — засчитан как неверный"
                      : lastCorrect ? "✓ Правильно!" : "✗ Неверно"}
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {currentQ.explanation}
                  </p>
                  <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 italic">
                    📖 {currentQ.normRef}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
              {state === "playing" ? (
                <button
                  onClick={checkAnswer}
                  disabled={
                    (currentQ.type === "multiple" && pickedIndex === null)
                    || (currentQ.type === "numeric" && pickedNumeric.trim() === "")
                    || (currentQ.type === "boolean" && pickedBool === null)
                  }
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-lg uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Ответить
                </button>
              ) : (
                <button
                  onClick={nextQuestion}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-lg uppercase tracking-wider"
                >
                  {idx + 1 < questions.length ? "Следующий вопрос →" : "Завершить квиз"}
                </button>
              )}
              <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
                Прогресс: {idx + (state === "answered" ? 1 : 0)}/{questions.length}
                · Текущий счёт: {score}/{logs.length}
              </div>
            </div>
          </div>
        )}

        {/* ─── Финальный экран ─── */}
        {state === "results" && (
          <div className="bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-xl overflow-hidden shadow-lg">
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 dark:from-amber-700 dark:to-amber-800 p-5 text-center text-white">
              <div className="text-3xl mb-1">🎓</div>
              <h2 className="text-xl font-bold">Результаты квиза</h2>
            </div>

            <div className="p-5 space-y-4">
              {/* Общий счёт */}
              <div className="text-center bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-lg p-4">
                <div className="text-4xl font-bold text-amber-900 dark:text-amber-200">
                  {score}/{total} = {pct}%
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Среднее время на вопрос: {avgTime} сек
                </div>
              </div>

              {/* Оценка */}
              <div className="text-center">
                <div className={`text-3xl ${grade.color}`}>{grade.stars}</div>
                <div className={`text-sm font-bold ${grade.color}`}>{grade.label}</div>
              </div>

              {/* По категориям */}
              {categoryStats.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
                    Точность по категориям:
                  </div>
                  <div className="space-y-1.5">
                    {categoryStats.map((s) => {
                      const marks = s.pct >= 90 ? "✓✓✓" : s.pct >= 70 ? "✓✓" : s.pct >= 50 ? "✓" : "✗";
                      const color = s.pct >= 90 ? "text-emerald-700 dark:text-emerald-400"
                        : s.pct >= 70 ? "text-green-700 dark:text-green-400"
                        : s.pct >= 50 ? "text-amber-700 dark:text-amber-400"
                        : "text-red-700 dark:text-red-400";
                      return (
                        <div key={s.category} className="flex items-center gap-3 text-xs">
                          <span className={`font-mono font-bold w-12 ${color}`}>{marks}</span>
                          <span className="flex-1 text-slate-800 dark:text-slate-200">{s.category}</span>
                          <span className="text-slate-600 dark:text-slate-400 font-mono">{s.correct}/{s.total}</span>
                          <span className={`font-bold w-10 text-right ${color}`}>{s.pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Рекомендации */}
              {weakCategories.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg p-3">
                  <div className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1.5">
                    💡 Рекомендуем повторить:
                  </div>
                  <ul className="text-xs text-amber-900 dark:text-amber-200 space-y-0.5 ml-4">
                    {weakCategories.map((s) => (
                      <li key={s.category}>• Модуль «{s.category}» (точность {s.pct}%)</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Лучший результат */}
              {best && (
                <div className="text-[10px] text-center text-slate-500 dark:text-slate-400">
                  🏆 Лучший результат: {Math.round((best.score / best.total) * 100)}%
                  ({best.score}/{best.total}, {best.date})
                </div>
              )}

              {/* Кнопки */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={restart}
                  className="py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-lg uppercase tracking-wider"
                >
                  Пройти ещё раз
                </button>
                <Link
                  href="/smeta-trainer/drawings-practice/hub"
                  className="py-2.5 bg-slate-700 hover:bg-slate-800 text-white text-sm font-bold rounded-lg uppercase tracking-wider text-center"
                >
                  На хаб
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
