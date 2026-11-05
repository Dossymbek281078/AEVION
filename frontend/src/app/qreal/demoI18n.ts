/**
 * Словарь демо-данных QReal (ru/en/kk).
 *
 * Демо-проект, критерии реализма, якоря 1/3/5, описания движков и ИИ-маркировка
 * приходят из API по-русски: русские якоря нужны судье VLM на бэкенде
 * (services/qreal/judge.ts), поэтому переводим только на сайте, по стабильным id.
 *
 * Правило показа: ru, неизвестный id или не демо-проект — значение из API как
 * есть (проект пользователя словарём не подменяем).
 * Не переводим: реплики персонажей (dialogue), англ. промты движку.
 * ⚠️ kk — черновой перевод, нужна вычитка носителя.
 */

export const DEMO_PROJECT_ID = "demo-steppe-morning";

type L = "en" | "kk";
type Pair = Record<L, string>;

const DEMO_TITLES: Record<string, Pair> = {
  "demo-steppe-morning": { en: "Morning on the Steppe", kk: "Даладағы таң" },
  "demo-shot-1": { en: "Dawn over the steppe", kk: "Дала үстіндегі таң шапағы" },
  "demo-shot-2": { en: "The boy and the dog", kk: "Бала мен ит" },
  "demo-shot-3": { en: "Grandmother by the hearth", kk: "Ошақ басындағы әже" },
  "demo-shot-4": { en: "The golden eagle takes off", kk: "Бүркіт көкке көтерілді" },
};

const CRITERIA: Record<string, Pair> = {
  "micro-expressions": { en: "Involuntary micro-expressions (not a “mask”, asymmetric face)", kk: "Еріксіз микромимика («бетперде» емес, бет асимметриясы бар)" },
  "blink-rate": { en: "Blinking 10–20/min, irregular, with partial blinks", kk: "Көз қарығу минутына 10–20 рет, біркелкі емес, жартылай қарығумен" },
  "skin-sss": { en: "Subsurface scattering in skin (ears/fingers against light)", kk: "Теріде жарықтың шашырауы (құлақ пен саусақ жарыққа қарсы)" },
  "hands-topology": { en: "Hands: 5 fingers, joints, natural grips", kk: "Қол: 5 саусақ, буын, табиғи ұстау" },
  "eye-parallax": { en: "Eyes: moisture, saccades, reflection parallax", kk: "Көз: ылғалдылық, саккадалар, шағылыс параллаксы" },
  "hair-cloth-physics": { en: "Hair and cloth physics (inertia, wind, no “jelly”)", kk: "Шаш пен мата физикасы (инерция, жел, «желе» емес)" },
  "lipsync": { en: "Lip-sync ±40 ms, lip co-articulation, visible tongue on [l]/[t]", kk: "Ерін үйлесімі ±40 мс, ерін коартикуляциясы, [л]/[т] дыбысында тіл көрінеді" },
  "gait-motorics": { en: "Gait/motor skills: body weight; for children, a child’s, not a shrunken adult’s", kk: "Жүріс/қозғалыс: дене салмағы; балада балаларға тән, кішірейтілген ересек емес" },
  "animal-ethology": { en: "Animals/birds: species-specific behaviour (ears, tail, gaze, head carriage)", kk: "Жануарлар/құстар: түріне тән мінез (құлақ, құйрық, көзқарас, бас қою)" },
  "camera-body": { en: "Camera with a “body”: hand micro-shake, steadicam weight, not a perfect slider", kk: "«Денесі» бар камера: қолдың шағын дірілі, стедикам салмағы, мінсіз слайдер емес" },
  "room-tone": { en: "Room tone: silence has the sound of the room/street, no digital zero", kk: "Room tone: тыныштықтың да бөлме/көше дыбысы бар, цифрлық нөл жоқ" },
  "foley-sync": { en: "Foley: footsteps/clothing/objects in sync and true to material", kk: "Фоли: қадам/киім/заттар дыбысы суретпен сәйкес және материалға сай" },
  "light-continuity": { en: "Light: one source across the scene’s shots, consistent shadows", kk: "Жарық: сахнаның барлық кадрында бір көз, көлеңкелер үйлесімді" },
  "motion-blur": { en: "24fps, 180° shutter, natural motion blur (not “video game”)", kk: "24fps, 180° затвор, табиғи қозғалыс бұлдырлығы («видеоойын» емес)" },
};

type Trio = [string, string, string];
const ANCHORS: Record<string, { en: Trio; kk: Trio }> = {
  "micro-expressions": {
    en: ["A mask face: one expression for the whole shot, both halves of the face symmetrical.", "There is expression, but in broad strokes (“smiled”, “frowned”) without fine transitions.", "Involuntary micro-movements, slight asymmetry, the muscles around the eyes work together with the mouth."],
    kk: ["Бетперде жүз: бүкіл кадрда бір ғана көрініс, жүздің екі жартысы симметриялы.", "Мимика бар, бірақ ірі сызбамен («күлді», «қабағын шытты»), ұсақ өтулері жоқ.", "Еріксіз микроқозғалыстар, шамалы асимметрия, көз айналасындағы бұлшықеттер ауызбен бірге жұмыс істейді."],
  },
  "blink-rate": {
    en: ["Never blinks, or blinks like a metronome.", "Blinks, but evenly and only with full blinks.", "10–20/min, irregular, with partial and double blinks tied to shifts of gaze."],
    kk: ["Мүлде қарықпайды немесе метроном сияқты қарығады.", "Қарығады, бірақ біркелкі және тек толық қарығумен.", "Минутына 10–20, біркелкі емес, көзқарас ауысуына байланысты жартылай және қосарлы қарығулар бар."],
  },
  "skin-sss": {
    en: ["Skin like plastic, no pores, even tone.", "Texture is there, but translucency does not read; in backlight ears and fingers look opaque.", "Ears and fingers turn pink against the light, pores and fine hair are visible, the tone is uneven."],
    kk: ["Тері пластик сияқты, тесіктері жоқ, түсі біркелкі.", "Текстура бар, бірақ жарықтың өтуі байқалмайды; арт жарықта құлақ пен саусақ тұйық.", "Құлақ пен саусақ жарыққа қарсы қызғылт тартады, тері тесіктері мен түкшелер көрінеді, түсі біркелкі емес."],
  },
  "hands-topology": {
    en: ["Extra or fused fingers, the hand changes shape between frames.", "Five fingers, but joints bend unnaturally or the grip does not match the object.", "Anatomy and grip are correct, the object genuinely deforms under the fingers."],
    kk: ["Артық немесе жабысқан саусақтар, кадрлар арасында қол пішінін өзгертеді.", "Саусақ бес, бірақ буындар табиғи емес бүгіледі немесе ұстау затқа сай емес.", "Анатомия мен ұстау дұрыс, зат саусақ астында шынымен қысылады."],
  },
  "eye-parallax": {
    en: ["Eyes dry and flat, no reflection, the gaze looks “through”.", "There is a highlight, but static; no saccades, the gaze drifts smoothly.", "Moisture, saccadic jumps, the reflection shifts as the head turns."],
    kk: ["Көз құрғақ әрі жалпақ, шағылыс жоқ, көзқарас «арқылы өтіп» кетеді.", "Жарқыл бар, бірақ қозғалмайды; саккада жоқ, көзқарас біртегіс жылжиды.", "Ылғалдылық, саккадалық секірістер, бас бұрылғанда шағылыс жылжиды."],
  },
  "hair-cloth-physics": {
    en: ["Hair and cloth are a single lump of “jelly”, no inertia.", "There is movement, but delayed or weightless; folds do not match the wind force.", "Inertia and damping are correct, strands and folds move independently."],
    kk: ["Шаш пен мата — біртұтас «желе», инерция жоқ.", "Қозғалыс бар, бірақ кешігеді немесе салмақсыз; қатпарлар жел күшіне сәйкес емес.", "Инерция мен тежелу дұрыс, шаш тарамдары мен қатпарлар жеке қозғалады."],
  },
  "lipsync": {
    en: ["Lips do not match the speech, or the mouth opens “in general”.", "Matches by phrase but not by phoneme; the mismatch is audible on fast syllables.", "±40 ms, co-articulation is visible, tongue visible on [l]/[t], lip closure on [m]/[b]/[p] is exact."],
    kk: ["Ерін сөзге сәйкес емес немесе ауыз «жалпы» ашылады.", "Сөз тіркесімен сәйкес, бірақ фонемамен емес; жылдам буындарда алшақтық естіледі.", "±40 мс, коартикуляция көрінеді, [л]/[т] дыбысында тіл көрінеді, [м]/[б]/[п] дыбысында ерін дәл жабылады."],
  },
  "gait-motorics": {
    en: ["Glides, feet carry no weight, the child moves like a shrunken adult.", "The gait is right but light: body weight does not read in the support leg.", "Weight transfers through the foot, the torso compensates, a child’s motor skills differ from an adult’s."],
    kk: ["Сырғиды, табан салмақ көтермейді, бала кішірейтілген ересек сияқты қозғалады.", "Жүріс дұрыс, бірақ жеңіл: тірек аяқта дене салмағы байқалмайды.", "Салмақ табан арқылы ауысады, дене теңестіреді, баланың қозғалысы ересектікінен өзгеше."],
  },
  "animal-ethology": {
    en: ["The animal moves like a person in a fur suit, or like a toy.", "Looks like the species, but the behaviour is generic: “a dog in general”.", "Species-specific: head carriage, ear and tail work, characteristic ballistics."],
    kk: ["Жануар терісін жамылған адам немесе ойыншық сияқты қозғалады.", "Түріне ұқсайды, бірақ мінезі жалпылама — «жалпы ит».", "Түріне тән: бас қою, құлақ пен құйрық қозғалысы, сипатты баллистика."],
  },
  "camera-body": {
    en: ["The camera is perfectly smooth: a weightless rail, or a tripod where movement was asked for.", "There is movement, but sterile; no micro-shake.", "The camera has a body: sub-pixel shake, inertia at start and stop."],
    kk: ["Камера мінсіз тегіс: салмақсыз рельс немесе қозғалыс сұралған жерде штатив.", "Қозғалыс бар, бірақ стерильді; шағын діріл жоқ.", "Камераның денесі бар: субпиксельдік діріл, басталу мен тоқтауда инерция."],
  },
  "room-tone": {
    en: ["Digital silence in pauses, or music instead of ambience.", "There is a background, but a “library” one that does not fit the room.", "Silence has the sound of exactly this space; speech reverb matches the geometry of the frame."],
    kk: ["Үзілістерде цифрлық тыныштық немесе ортаның орнына музыка.", "Фон бар, бірақ «кітапханалық», бөлмеге сай емес.", "Тыныштықтың дәл осы кеңістікке тән дыбысы бар; сөз реверберациясы кадр геометриясына сай."],
  },
  "foley-sync": {
    en: ["Action sounds are missing or off from the picture by tenths of a second.", "In sync, but wrong for the material: a step in water sounds like on wood.", "Frame-accurate sync and true to material, including clothing, objects and breath."],
    kk: ["Әрекет дыбыстары жоқ немесе суреттен секундтың оннан бір бөлігіне алшақ.", "Сәйкес, бірақ материалға сай емес — судағы қадам ағаштағыдай естіледі.", "Кадрма-кадр сәйкес және материалға сай, киім, заттар, тыныс қоса."],
  },
  "light-continuity": {
    en: ["The light source changes within the shot for no reason, shadows contradict each other.", "One source, but soft shadows “from nowhere”, direction hard to read.", "One source, consistent shadows, changes of light within the shot follow the action."],
    kk: ["Жарық көзі кадр ішінде себепсіз өзгереді, көлеңкелер бір-біріне қайшы.", "Көз біреу, бірақ көлеңкелер «ешқайдан» жұмсақ түседі, бағыты нашар оқылады.", "Бір көз, көлеңкелер үйлесімді, кадр ішіндегі жарық өзгерісі оқиғаға сай."],
  },
  "motion-blur": {
    en: ["Every frame is sterile-sharp, like a video game, or, conversely, a smeared mess.", "Blur is there, but does not match the object’s speed.", "24fps and 180° shutter: blur is proportional to speed, fast motion reads naturally."],
    kk: ["Әр кадр стерильді анық, «видеоойын» сияқты, немесе керісінше, бұлдыр қоқыс.", "Бұлдырлық бар, бірақ заттың жылдамдығына сай емес.", "24fps және 180° затвор: бұлдырлық жылдамдыққа пропорционал, жылдам қозғалыс табиғи оқылады."],
  },
};

// {usd} подставляется из данных API (usdPerSecond), цифр здесь не дублируем;
// «2.4 раза» и «9 изображений» — те же числа, что в источнике.
const ENGINES: Record<string, { label: Pair; note: Pair }> = {
  seedance: {
    label: { en: "Seedance 2.0 (ByteDance, direct API)", kk: "Seedance 2.0 (ByteDance, тікелей API)" },
    note: {
      en: "QReal default: best adherence to direction (A/B 2026-07-21); reference-to-video up to 9 images — groundwork for consistency",
      kk: "QReal әдепкісі: режиссураға ең жақсы сәйкестік (A/B 2026-07-21); 9 суретке дейін reference-to-video — консистенттілікке негіз",
    },
  },
  kling: {
    label: { en: "Kling v3 standard (Kuaishou, direct API)", kk: "Kling v3 standard (Kuaishou, тікелей API)" },
    note: {
      en: "budget option: ${usd}/s with sound — about 2.4 times cheaper than Seedance",
      kk: "бюджеттік нұсқа: дыбыспен ${usd}/с — Seedance-тен шамамен 2,4 есе арзан",
    },
  },
  elevenlabs: {
    label: { en: "ElevenLabs (voice, dialogue, foley)", kk: "ElevenLabs (дауыс, диалог, фоли)" },
    note: {
      en: "speech as a separate layer when the engine’s native sound loses",
      kk: "қозғалтқыштың өз дыбысы жеңілгенде сөз жеке қабат ретінде",
    },
  },
  "local-ffmpeg": {
    label: { en: "FFmpeg assembly (concat, grade, loudness)", kk: "FFmpeg жинағы (жалғау, грейд, дыбыс деңгейі)" },
    note: {
      en: "final assembly of shots and tracks, ${usd}",
      kk: "кадрлар мен дорожкаларды соңғы жинау, ${usd}",
    },
  },
};

// Точный текст из бэкенда (routes/qreal.ts, provenanceManifest). Переводим только
// при полном совпадении: чужой/изменённый текст показываем как есть.
export const DISCLOSURE_RU =
  "Это видео полностью сгенерировано ИИ (AEVION QReal). Люди, дети, животные и " +
  "среда в кадре не существуют. Маркировка соответствует EU AI Act art. 50.";
const DISCLOSURE: Pair = {
  en: "This video is entirely AI-generated (AEVION QReal). The people, children, animals and environment in the frame do not exist. The labelling complies with EU AI Act art. 50.",
  kk: "Бұл бейне толығымен жасанды интеллектпен жасалған (AEVION QReal). Кадрдағы адамдар, балалар, жануарлар мен орта шын мәнінде жоқ. Белгілеу EU AI Act 50-бабына сәйкес.",
};

const isL = (lang: string): lang is L => lang === "en" || lang === "kk";
const isDemo = (projectId: string | null | undefined) => projectId === DEMO_PROJECT_ID;

export function demoProjectTitle(lang: string, project: { id: string; title: string }): string {
  if (!isL(lang) || !isDemo(project.id)) return project.title;
  return DEMO_TITLES[project.id]?.[lang] ?? project.title;
}

export function demoShotTitle(lang: string, projectId: string, shot: { id: string; title: string }): string {
  if (!isL(lang) || !isDemo(projectId)) return shot.title;
  return DEMO_TITLES[shot.id]?.[lang] ?? shot.title;
}

export function criterionLabel(lang: string, c: { id: string; label: string }): string {
  if (!isL(lang)) return c.label;
  return CRITERIA[c.id]?.[lang] ?? c.label;
}

export function anchorText(lang: string, id: string, lvl: "1" | "3" | "5", api: string): string {
  if (!isL(lang)) return api;
  const a = ANCHORS[id]?.[lang];
  if (!a) return api;
  return a[lvl === "1" ? 0 : lvl === "3" ? 1 : 2];
}

export function engineLabel(lang: string, e: { id: string; label: string }): string {
  if (!isL(lang)) return e.label;
  return ENGINES[e.id]?.label[lang] ?? e.label;
}

export function engineNote(lang: string, e: { id: string; note: string; usdPerSecond?: number | null }): string {
  if (!isL(lang)) return e.note;
  const tpl = ENGINES[e.id]?.note[lang];
  if (!tpl) return e.note;
  if (!tpl.includes("{usd}")) return tpl;
  // Цена — только из данных API; нет числа — показываем заметку из API как есть.
  if (typeof e.usdPerSecond !== "number") return e.note;
  // split/join, а не replace: в строке-замене «$» имеет спецзначения.
  return tpl.split("{usd}").join(String(e.usdPerSecond));
}

export function disclosureText(lang: string, api: string): string {
  if (!isL(lang) || api !== DISCLOSURE_RU) return api;
  return DISCLOSURE[lang];
}

export const DEMO_I18N_DATA = { DEMO_TITLES, CRITERIA, ANCHORS, ENGINES, DISCLOSURE };
