"use client";

import Link from "next/link";
import { useState } from "react";

export default function ZooAquariumPage() {
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex2, setEx2] = useState<string | null>(null);
  const [ex3, setEx3] = useState<string>("");
  const [ex3Checked, setEx3Checked] = useState(false);
  const [ex4, setEx4] = useState<string | null>(null);

  const ex3Value = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Value) && Math.abs(ex3Value - 195_000_000) <= 15_000_000;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300 hover:text-blue-200 transition">← К разделам</Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Зоопарки и аквариумы</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🐅 Зоопарки и аквариумы</h1>
          <p className="mt-3 text-slate-400 max-w-3xl leading-relaxed">
            Сметы на зоопарки, океанариумы и террариумы — одна из самых сложных
            категорий гражданского строительства. Здесь смешиваются нормы
            благополучия животных (EAZA/WAZA), требования биологической
            безопасности, инженерия жизнеобеспечения (вода, климат, фильтрация),
            ветеринарные стандарты и требования к посетительским потокам. В этом
            модуле — стандарты площадей вольеров, конструкции ограждений,
            климатические зоны, аквариумные системы и бенчмарки РК.
          </p>
        </section>

        {/* Section 1: Площадь вольеров */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">1. Площадь вольеров по нормам EAZA/WAZA</h2>
          <p className="mt-2 text-slate-400 text-sm leading-relaxed">
            Международные ассоциации зоопарков (EAZA — европейская, WAZA — мировая)
            задают минимальные площади вольеров для каждого вида. Это нормы
            благополучия животных, а не просто рекомендация — без сертификации
            EAZA зоопарк не допускается к обмену редкими видами.
          </p>
          <ul className="mt-4 text-sm text-slate-300 space-y-2 list-disc list-inside">
            <li><span className="text-emerald-300">Слон африканский / азиатский</span> — 2000–5000 м² на особь, открытый выгул + ночник 50–80 м²</li>
            <li><span className="text-emerald-300">Тигр амурский / суматранский</span> — 500–1500 м² (одиночное содержание), бассейн 20–40 м²</li>
            <li><span className="text-emerald-300">Лев</span> — 400–1000 м² на прайд из 3–5 особей</li>
            <li><span className="text-emerald-300">Бурый медведь</span> — 300–800 м² с бассейном и берлогой</li>
            <li><span className="text-emerald-300">Приматы (шимпанзе, орангутан)</span> — 100–300 м² + вертикальные структуры (высота 6–8 м)</li>
            <li><span className="text-emerald-300">Жираф</span> — 800–1500 м² (групповое), высота павильона ≥ 6 м</li>
            <li><span className="text-emerald-300">Волк / гиена</span> — 200–500 м² на стаю</li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            В Казахстане формально нет жёсткого норматива — но Министерство экологии
            при проектировании ссылается на EAZA Standards for Accommodation
            (последняя редакция 2024 г.).
          </p>
        </section>

        {/* Section 2: Ограждения */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">2. Ограждения и барьеры</h2>
          <p className="mt-2 text-slate-400 text-sm leading-relaxed">
            Тип ограждения подбирается под поведенческие риски вида. Главный
            принцип: барьер должен быть надёжен при двойном превышении нагрузки
            (атака взрослой особи + удар разогнавшегося животного).
          </p>
          <div className="mt-4 grid md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-amber-300 font-semibold">Стальные сетки (хищники)</div>
              <div className="text-slate-400 text-xs mt-1">Высота 4–6 м, ячейка 50×50 мм, проволока Ø 4–6 мм, оцинкованная или с PVC-покрытием. Сверху козырёк под углом 45° внутрь.</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-amber-300 font-semibold">Стеклопанели (приматы, медведи)</div>
              <div className="text-slate-400 text-xs mt-1">Низкоиронистое триплекс-стекло 60–100 мм, прозрачность ≥ 91%. Швы — структурный силикон Dow Corning 995. Производители: AGC, Saint-Gobain.</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-amber-300 font-semibold">Водные рвы</div>
              <div className="text-slate-400 text-xs mt-1">Ширина 5–8 м, глубина 2–3 м для крупных хищников. Внутренняя сторона — гладкий бетон 90° (исключить выкарабкивание).</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-amber-300 font-semibold">Сухие рвы</div>
              <div className="text-slate-400 text-xs mt-1">Глубина 4–6 м, ширина 6–10 м, использовался у копытных и медведей. Сегодня EAZA не рекомендует — травмоопасно.</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-amber-300 font-semibold">Электропастух</div>
              <div className="text-slate-400 text-xs mt-1">Для копытных и приматов как дополнительный барьер. Напряжение 5–10 кВ импульсами, ток &lt; 5 мА — несмертельно.</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-amber-300 font-semibold">Сетчатые купола</div>
              <div className="text-slate-400 text-xs mt-1">Для авиариев и обезьян. Из нержавеющего троса Ø 2–4 мм, ячейка 30–60 мм. Покрытие площадей до 1500 м² без опор.</div>
            </div>
          </div>
        </section>

        {/* Section 3: Бионадзор */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">3. Бионадзор и безопасность персонала</h2>
          <p className="mt-2 text-slate-400 text-sm leading-relaxed">
            Без двойных шлюзов и нокдаун-комнат вольер крупного хищника не
            принимается надзором.
          </p>
          <ul className="mt-4 text-sm text-slate-300 space-y-2 list-disc list-inside">
            <li><span className="text-rose-300">Двойные шлюзы (sally port)</span> — две двери, одна не открывается пока вторая закрыта. Электромеханический интерлок.</li>
            <li><span className="text-rose-300">Нокдаун-комната</span> — изолированный отсек для седации животного (ветеринарный дартинг). Площадь 6–12 м².</li>
            <li><span className="text-rose-300">Эвакуационные коридоры персонала</span> — отдельная сеть проходов между ночниками, без пересечения с вольерами.</li>
            <li><span className="text-rose-300">Карантинный блок</span> — обязательная зона на 10–15% от поголовья, изолированная вентиляция HEPA.</li>
            <li><span className="text-rose-300">Тревожные кнопки</span> — на каждом посту по нормам EAZA-EMP, с прямой связью в полицию.</li>
            <li><span className="text-rose-300">Сигнальная сеть</span> — звуковое оповещение «код Альфа» (побег хищника) с автоматической блокировкой посетительских зон.</li>
          </ul>
        </section>

        {/* Section 4: Климатические зоны */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">4. Климатические зоны (микроклимат вольеров)</h2>
          <p className="mt-2 text-slate-400 text-sm leading-relaxed">
            Главная инженерная сложность зоопарка — поддержание разных климатов
            в смежных павильонах. Используется VRF-система с раздельными контурами
            + ультразвуковые увлажнители + охлаждение чиллерами.
          </p>
          <div className="mt-4 grid md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-cyan-300 font-semibold">Тропики (рептилии, амфибии)</div>
              <div className="text-slate-400 text-xs mt-1">+28 °C ±2 °C, влажность 80–90%. УФ-лампы Reptisun 10.0. Распыление через 3–4 часа.</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-cyan-300 font-semibold">Арктика (пингвины, моржи)</div>
              <div className="text-slate-400 text-xs mt-1">-5 …-10 °C, мощные чиллеры Carrier 30HXC. Снежные пушки SnowMagic. Бассейн +2…+4 °C.</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-cyan-300 font-semibold">Пустыня (вараны, фенеки)</div>
              <div className="text-slate-400 text-xs mt-1">+30…+35 °C днём, +18…+22 °C ночью. Влажность 15–25%. Точечный обогрев керамическими лампами.</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-cyan-300 font-semibold">Умеренный пояс (бурые медведи, волки)</div>
              <div className="text-slate-400 text-xs mt-1">Естественный, но ночник зимой +5…+10 °C. Подогрев пола для пожилых особей.</div>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Энергопотребление океанариума/тропикария — 200–400 Вт/м² установленной
            мощности. В смете климат-системы дают 18–30% от стоимости м².
          </p>
        </section>

        {/* Section 5: Кухня корма */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">5. Кухня корма и ветеринарный блок</h2>
          <p className="mt-2 text-slate-400 text-sm leading-relaxed">
            Кухня зоопарка — это пищевое производство, оно проектируется по СН РК
            4.02-22 «Предприятия общественного питания» и проходит СЭС-сертификацию.
          </p>
          <ul className="mt-4 text-sm text-slate-300 space-y-2 list-disc list-inside">
            <li>Холодильные камеры -18 °C для мяса (объём 30–80 м³ для среднего зоопарка)</li>
            <li>Разделочные с нержавеющими столами AISI 304</li>
            <li>Отдельные секции для рыбы, мяса, овощей (избежать кросс-контаминации)</li>
            <li>Травный склад с принудительной вентиляцией (сено для копытных)</li>
            <li>Ветеринарный блок с операционной — 40–80 м², рентген, УЗИ, наркозный аппарат</li>
            <li>Карантинная клиника — изолированный воздушный контур с HEPA-фильтрацией</li>
            <li>Утилизация органических отходов — холодильник для павших + договор с ветеринарной службой</li>
          </ul>
        </section>

        {/* Section 6: Аквариумы */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">6. Аквариумы и океанариумы — конструкции</h2>
          <p className="mt-2 text-slate-400 text-sm leading-relaxed">
            Главные материалы — акрил (для больших объёмов) и стекло (для малых
            и средних). Акрил гнётся под кривые тоннелей, стекло — нет.
          </p>
          <div className="mt-4 grid md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-sky-300 font-semibold">Акрил (большие морские)</div>
              <div className="text-slate-400 text-xs mt-1">Толщина 100–300 мм для панелей высотой 4–10 м. Производители: Reynolds Polymer (США), Nippura (Япония). Стоимость 8000–15000 USD/м² панели.</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-sky-300 font-semibold">Стекло (пресные малые)</div>
              <div className="text-slate-400 text-xs mt-1">Толщина 30–80 мм для аквариумов до 2–3 м высотой. Низкоиронистое (Optiwhite, Diamant) для прозрачности.</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-sky-300 font-semibold">Тоннельные акриловые арки</div>
              <div className="text-slate-400 text-xs mt-1">Радиус 3–6 м, длина до 80 м. Толщина 180–250 мм. Стыки полированы лазером и склеены полимеризацией.</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-sky-300 font-semibold">Бетонные основания</div>
              <div className="text-slate-400 text-xs mt-1">Толщина стенок 600–1200 мм у крупных бассейнов. Гидроизоляция эпоксидная Sika или Köster + защитное покрытие пищевой пластик.</div>
            </div>
          </div>
        </section>

        {/* Section 7: Системы жизнеобеспечения */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">7. Системы жизнеобеспечения (LSS — Life Support Systems)</h2>
          <p className="mt-2 text-slate-400 text-sm leading-relaxed">
            Для морского аквариума LSS — это 30–45% всей сметы. Без рециркуляции
            воды никакой океанариум не работает.
          </p>
          <ul className="mt-4 text-sm text-slate-300 space-y-2 list-disc list-inside">
            <li><span className="text-emerald-300">Механическая фильтрация</span> — песчаные/барабанные фильтры (Aqua Medic, OASE) задерживают частицы &gt; 20 мкм.</li>
            <li><span className="text-emerald-300">Биологическая фильтрация</span> — биореакторы с пластиковыми «биошарами», бактерии Nitrosomonas/Nitrobacter перерабатывают аммиак.</li>
            <li><span className="text-emerald-300">УФ-стерилизация</span> — лампы 40–254 нм, мощность 100–600 Вт на 100 м³.</li>
            <li><span className="text-emerald-300">Протеиновый скиммер</span> (только для морской воды) — пенный сепаратор удаляет органику.</li>
            <li><span className="text-emerald-300">Озонирование</span> — генераторы 1–10 г/час, доочистка после биофильтра.</li>
            <li><span className="text-emerald-300">Охлаждение</span> — чиллеры (для холодноводных видов температура воды +12…+15 °C).</li>
            <li><span className="text-emerald-300">Рециркуляция</span> — 5–15% обмена воды в сутки, остальное прогон через LSS.</li>
            <li><span className="text-emerald-300">Резервное питание</span> — дизель-генератор 100% мощности LSS + источники бесперебойного питания на критичные насосы.</li>
          </ul>
        </section>

        {/* Section 8: Безопасность посетителей */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">8. Безопасность посетителей</h2>
          <p className="mt-2 text-slate-400 text-sm leading-relaxed">
            Все панели, через которые посетитель смотрит на хищника или внутрь
            аквариума — это многослойные конструкции с расчётным запасом
            прочности минимум 4×.
          </p>
          <ul className="mt-4 text-sm text-slate-300 space-y-2 list-disc list-inside">
            <li>Двойное стекло аквариумов: внешнее 19 мм триплекс + воздушный зазор 12–20 мм + внутреннее 30 мм</li>
            <li>Бронированное стекло перед хищниками класса BR4–BR6 (выдерживает удар ножом и крупное столкновение)</li>
            <li>Ограждения посетительских зон высотой 1100 мм + дополнительный экран 600 мм</li>
            <li>Антискользящие покрытия (R11–R13) на полах рядом с водными объектами</li>
            <li>Эвакуационные выходы по СН РК 2.02-15: ширина ≥ 1.2 м на 100 чел.</li>
            <li>Системы пожаротушения газовые в технических LSS-помещениях (вода = короткое замыкание)</li>
            <li>Видеонаблюдение CCTV всех вольеров + AI-аналитика поведения животных</li>
          </ul>
        </section>

        {/* Section 9: Бенчмарки РК */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">9. Бенчмарки РК</h2>
          <p className="mt-2 text-slate-400 text-sm leading-relaxed">
            В Казахстане крупные зоо-объекты: Алматинский зоопарк (реконструкция
            2018–2020), Бурабай океанариум (концепт 2024), зоопарк в Астане
            (проект «Семейный парк»).
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 uppercase border-b border-slate-800">
                <tr>
                  <th className="text-left py-2 pr-4">Тип объекта</th>
                  <th className="text-left py-2 pr-4">Стоимость м²</th>
                  <th className="text-left py-2">Комментарий</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr className="border-b border-slate-800/60">
                  <td className="py-2 pr-4">Вольер тигра/льва (с ночником)</td>
                  <td className="py-2 pr-4 text-amber-300">380–650 тыс. тг/м²</td>
                  <td className="py-2 text-xs text-slate-400">Сетки 4 м + бассейн + нокдаун</td>
                </tr>
                <tr className="border-b border-slate-800/60">
                  <td className="py-2 pr-4">Слоновник (тёплый павильон)</td>
                  <td className="py-2 pr-4 text-amber-300">450–700 тыс. тг/м²</td>
                  <td className="py-2 text-xs text-slate-400">Высота 7–9 м, тёплый пол</td>
                </tr>
                <tr className="border-b border-slate-800/60">
                  <td className="py-2 pr-4">Океанариум (полнокомплект)</td>
                  <td className="py-2 pr-4 text-amber-300">1200–2500 тыс. тг/м²</td>
                  <td className="py-2 text-xs text-slate-400">С LSS и тоннелями</td>
                </tr>
                <tr className="border-b border-slate-800/60">
                  <td className="py-2 pr-4">Террариум (тропики)</td>
                  <td className="py-2 pr-4 text-amber-300">280–480 тыс. тг/м²</td>
                  <td className="py-2 text-xs text-slate-400">Климат + УФ + декорация</td>
                </tr>
                <tr className="border-b border-slate-800/60">
                  <td className="py-2 pr-4">Авиарий (купольный)</td>
                  <td className="py-2 pr-4 text-amber-300">220–380 тыс. тг/м²</td>
                  <td className="py-2 text-xs text-slate-400">Сетчатый купол ≥ 1000 м²</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Контактный зоопарк</td>
                  <td className="py-2 pr-4 text-amber-300">120–220 тыс. тг/м²</td>
                  <td className="py-2 text-xs text-slate-400">Простые загоны + укрытия</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Цены на 2026 г. без учёта затрат на животных, инженерные сети до
            участка и благоустройство территории.
          </p>
        </section>

        {/* Exercises */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-50">Упражнения</h2>

          {/* Ex 1 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="text-sm text-slate-500">Упражнение 1 · нормы вольеров</div>
            <div className="mt-2 text-slate-100">Какая минимальная площадь вольера для тигра по нормам WAZA?</div>
            <div className="mt-4 grid gap-2">
              {[
                { id: "a", label: "100 м²" },
                { id: "b", label: "500–1500 м²" },
                { id: "c", label: "50 м²" },
                { id: "d", label: "5000 м²" },
              ].map((opt) => {
                const chosen = ex1 === opt.id;
                const correct = opt.id === "b";
                const showState = ex1 !== null;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setEx1(opt.id)}
                    className={`text-left rounded-lg border px-4 py-2 text-sm transition ${
                      showState && chosen && correct
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
                        : showState && chosen && !correct
                        ? "border-rose-500 bg-rose-500/10 text-rose-200"
                        : showState && correct
                        ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-300"
                        : "border-slate-700 bg-slate-950/40 text-slate-200 hover:border-slate-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {ex1 !== null && (
              <p className="mt-3 text-xs text-slate-400">
                {ex1 === "b"
                  ? "Верно. WAZA Standards: для амурского/суматранского тигра — 500–1500 м² одиночного вольера + бассейн."
                  : "Неверно. WAZA задаёт 500–1500 м² на одну особь тигра."}
              </p>
            )}
          </div>

          {/* Ex 2 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="text-sm text-slate-500">Упражнение 2 · конструкция аквариума</div>
            <div className="mt-2 text-slate-100">Какая толщина акрила для большого морского аквариума (панели 4–10 м высотой)?</div>
            <div className="mt-4 grid gap-2">
              {[
                { id: "a", label: "30–50 мм" },
                { id: "b", label: "60–80 мм" },
                { id: "c", label: "100–300 мм" },
                { id: "d", label: "10–20 мм" },
              ].map((opt) => {
                const chosen = ex2 === opt.id;
                const correct = opt.id === "c";
                const showState = ex2 !== null;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setEx2(opt.id)}
                    className={`text-left rounded-lg border px-4 py-2 text-sm transition ${
                      showState && chosen && correct
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
                        : showState && chosen && !correct
                        ? "border-rose-500 bg-rose-500/10 text-rose-200"
                        : showState && correct
                        ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-300"
                        : "border-slate-700 bg-slate-950/40 text-slate-200 hover:border-slate-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {ex2 !== null && (
              <p className="mt-3 text-xs text-slate-400">
                {ex2 === "c"
                  ? "Верно. Большие морские панели — 100–300 мм акрила Reynolds Polymer / Nippura. Гидростатическое давление + запас прочности 4×."
                  : "Неверно. Для больших морских панелей нужен акрил 100–300 мм."}
              </p>
            )}
          </div>

          {/* Ex 3 — numeric */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="text-sm text-slate-500">Упражнение 3 · сметный расчёт</div>
            <div className="mt-2 text-slate-100">
              Океанариум площадью 150 м² при бенчмарке 1300 тыс. тг/м². Какова
              ориентировочная сметная стоимость в тенге?
            </div>
            <div className="mt-4 flex flex-wrap gap-3 items-center">
              <input
                type="text"
                inputMode="numeric"
                value={ex3}
                onChange={(e) => {
                  setEx3(e.target.value);
                  setEx3Checked(false);
                }}
                placeholder="введите сумму в тг"
                className="bg-slate-950/60 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => setEx3Checked(true)}
                className="rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-4 py-2 text-sm transition"
              >
                Проверить
              </button>
            </div>
            {ex3Checked && ex3.trim() !== "" && (
              <p className={`mt-3 text-xs ${ex3Correct ? "text-emerald-300" : "text-rose-300"}`}>
                {ex3Correct
                  ? "Верно. 150 × 1 300 000 = 195 000 000 тг. Допуск ±15 млн на колебания бенчмарка."
                  : "Неверно. Расчёт: 150 × 1 300 000 = 195 000 000 тг."}
              </p>
            )}
          </div>

          {/* Ex 4 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="text-sm text-slate-500">Упражнение 4 · системы жизнеобеспечения</div>
            <div className="mt-2 text-slate-100">Что входит в полную систему жизнеобеспечения морского аквариума (LSS)?</div>
            <div className="mt-4 grid gap-2">
              {[
                { id: "a", label: "Только фильтр" },
                { id: "b", label: "Только насосы" },
                { id: "c", label: "Только подсветка" },
                { id: "d", label: "Механическая + биологическая + УФ-фильтрация, протеиновый скиммер, охлаждение, рециркуляция 5–15% обмена в сутки" },
              ].map((opt) => {
                const chosen = ex4 === opt.id;
                const correct = opt.id === "d";
                const showState = ex4 !== null;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setEx4(opt.id)}
                    className={`text-left rounded-lg border px-4 py-2 text-sm transition ${
                      showState && chosen && correct
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
                        : showState && chosen && !correct
                        ? "border-rose-500 bg-rose-500/10 text-rose-200"
                        : showState && correct
                        ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-300"
                        : "border-slate-700 bg-slate-950/40 text-slate-200 hover:border-slate-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {ex4 !== null && (
              <p className="mt-3 text-xs text-slate-400">
                {ex4 === "d"
                  ? "Верно. Полный LSS — это многоступенчатая фильтрация + скиммер для морской + охлаждение + рециркуляция. Без любого из звеньев аквариум выходит из строя за дни."
                  : "Неверно. LSS — комплексная система: механическая + биологическая + УФ + скиммер + охлаждение + рециркуляция."}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6">
          <h3 className="text-lg font-semibold text-slate-100">Резюме модуля</h3>
          <ul className="mt-3 text-sm text-slate-400 list-disc list-inside space-y-1">
            <li>Площади вольеров задаются стандартами EAZA/WAZA, а не СН РК</li>
            <li>Ограждения подбираются под поведенческие риски, барьер выдерживает 2× нагрузку</li>
            <li>Климат — главный двигатель сметы зоопарка (18–30% м²)</li>
            <li>Аквариум — это акрил/стекло + LSS на 30–45% сметы</li>
            <li>Бенчмарки РК: вольер тигра 380–650, океанариум 1200–2500 тыс. тг/м²</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
