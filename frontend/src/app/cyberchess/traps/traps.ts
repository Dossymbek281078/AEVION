// 10 дебютных ловушек для страницы /cyberchess/traps (и /en, /kk).
// Зачем: люди из поиска «chess opening traps» / «шахматные ловушки» → CyberChess.
// Каждая партия проходит chess.js в тесте traps.test.ts: 0 нелегальных ходов,
// заявленный мат — настоящий мат. Тексты — по языку целиком, без смеси.

export type Yazyk = "ru" | "en" | "kk";
type Tri = Record<Yazyk, string>;

export type Lovushka = {
  id: string;
  /** Ходы в SAN, от начальной позиции. */
  moves: string[];
  /** Номер полухода (с 0), на котором попадаются в ловушку. */
  oshibka: number;
  /** Заканчивается ли партия матом — проверяет тест. */
  mat: boolean;
  name: Tri;
  about: Tri;
};

export const LOVUSHKI: Lovushka[] = [
  {
    id: "legal",
    moves: ["e4", "e5", "Nf3", "d6", "Bc4", "Bg4", "Nc3", "g6", "Nxe5", "Bxd1", "Bxf7+", "Ke7", "Nd5#"],
    oshibka: 9,
    mat: true,
    name: { ru: "Мат Легаля", en: "Légal's Mate", kk: "Легаль маты" },
    about: {
      ru: "Белые отдают ферзя: 5.Nxe5! Чёрные жадно берут 5...Bxd1?? — и получают мат лёгкими фигурами в два хода. Правильно было 5...dxe5, оставшись без пешки.",
      en: "White offers the queen with 5.Nxe5! Black greedily takes 5...Bxd1?? and gets mated by the minor pieces in two moves. 5...dxe5 was correct, only a pawn down.",
      kk: "Ақтар уәзірді береді: 5.Nxe5! Қаралар 5...Bxd1?? деп алады да, жеңіл фигуралардан екі жүрісте мат алады. Дұрысы 5...dxe5 еді — тек бір пешка кем.",
    },
  },
  {
    id: "scholars",
    moves: ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"],
    oshibka: 5,
    mat: true,
    name: { ru: "Детский мат", en: "Scholar's Mate", kk: "Балалар маты" },
    about: {
      ru: "Ферзь и слон бьют в одну точку — f7, которую защищает только король. 3...Nf6?? пропускает угрозу. Защита: 3...g6 или 3...Qe7.",
      en: "Queen and bishop both aim at f7, guarded only by the king. 3...Nf6?? misses the threat. Defend with 3...g6 or 3...Qe7.",
      kk: "Уәзір мен піл бір нүктеге — тек патша қорғайтын f7-ге соғады. 3...Nf6?? қауіпті байқамайды. Қорғаныс: 3...g6 немесе 3...Qe7.",
    },
  },
  {
    id: "fools",
    moves: ["f3", "e5", "g4", "Qh4#"],
    oshibka: 2,
    mat: true,
    name: { ru: "Дурацкий мат", en: "Fool's Mate", kk: "Ақымақ маты" },
    about: {
      ru: "Самый быстрый мат в шахматах. Белые открывают диагональ e1–h4 двумя пешечными ходами, и ферзь чёрных ставит мат на втором ходу. Урок: не ослабляйте пешки перед королём.",
      en: "The fastest mate in chess. Two pawn moves open the e1–h4 diagonal and Black's queen mates on move two. Lesson: don't weaken the pawns in front of your king.",
      kk: "Шахматтағы ең жылдам мат. Ақтар екі пешка жүрісімен e1–h4 диагоналін ашады, қаралардың уәзірі екінші жүрісте мат қояды. Сабақ: патшаның алдындағы пешкаларды әлсіретпеңіз.",
    },
  },
  {
    id: "blackburne-shilling",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nd4", "Nxe5", "Qg5", "Nxf7", "Qxg2", "Rf1", "Qxe4+", "Be2", "Nf3#"],
    oshibka: 6,
    mat: true,
    name: { ru: "Ловушка Блэкберна–Шиллинга", en: "Blackburne Shilling Gambit", kk: "Блэкберн–Шиллинг тұзағы" },
    about: {
      ru: "3...Nd4 выглядит как зевок пешки e5. Но после 4.Nxe5?? Qg5! ферзь бьёт g2, и при жадной игре белых всё кончается конём на f3. Спокойное 4.O-O или 4.Nxd4 даёт белым перевес.",
      en: "3...Nd4 looks like it drops the e5 pawn. After 4.Nxe5?? Qg5! the queen hits g2, and if White keeps grabbing, a knight mates on f3. The calm 4.O-O or 4.Nxd4 leaves White better.",
      kk: "3...Nd4 e5 пешкасын беріп қойған сияқты. Бірақ 4.Nxe5?? Qg5! кейін уәзір g2-ні соғады, ақтар ашкөздік етсе, f3-тегі атпен мат. Сабырлы 4.O-O немесе 4.Nxd4 ақтарға артықшылық береді.",
    },
  },
  {
    id: "elephant",
    moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Nbd7", "cxd5", "exd5", "Nxd5", "Nxd5", "Bxd8", "Bb4+", "Qd2", "Bxd2+", "Kxd2", "Kxd8"],
    oshibka: 10,
    mat: false,
    name: { ru: "Слоновая ловушка", en: "Elephant Trap", kk: "Піл тұзағы" },
    about: {
      ru: "Кажется, пешка d5 висит: конь f6 связан слоном g5. Белые берут 6.Nxd5??, но 6...Nxd5! — связка ложная: после 7.Bxd8 Bb4+! белые отдают ферзя назад и остаются без фигуры. Ферзевый гамбит, частая ошибка новичков.",
      en: "The d5 pawn looks loose because the f6 knight is pinned by the g5 bishop. White grabs 6.Nxd5??, but 6...Nxd5! breaks the pin: after 7.Bxd8 Bb4+! White has to give the queen back and ends up a piece down. A classic beginner mistake in the Queen's Gambit.",
      kk: "d5 пешкасы қорғаусыз сияқты: f6-тегі атты g5-тегі піл байлап тұр. Ақтар 6.Nxd5?? алады, бірақ 6...Nxd5! — байлау жалған: 7.Bxd8 Bb4+! кейін ақтар уәзірді қайтарып, бір фигура кем қалады. Ферзь гамбитіндегі жаңадан бастаушылардың жиі қатесі.",
    },
  },
  {
    id: "lasker",
    moves: ["d4", "d5", "c4", "e5", "dxe5", "d4", "e3", "Bb4+", "Bd2", "dxe3", "Bxb4", "exf2+", "Ke2", "fxg1=N+"],
    oshibka: 10,
    mat: false,
    name: { ru: "Ловушка Ласкера", en: "Lasker Trap", kk: "Ласкер тұзағы" },
    about: {
      ru: "Контргамбит Альбина. После 5...dxe3 белые жадно берут слона 6.Bxb4?? — и пешка чёрных бежит до первой горизонтали: 6...exf2+ 7.Ke2 fxg1=N+! — превращение в коня с шахом. Редкий случай, когда конь лучше ферзя. Раньше было неточно 4.e3 — лучше 4.Nf3.",
      en: "Albin Countergambit. After 5...dxe3 White greedily takes the bishop with 6.Bxb4??, and Black's pawn runs all the way: 6...exf2+ 7.Ke2 fxg1=N+! promotes to a knight with check. A rare case where a knight beats a queen. Earlier, 4.e3 was already inaccurate; 4.Nf3 is better.",
      kk: "Альбин қарсы гамбиті. 5...dxe3 кейін ақтар ашкөздікпен 6.Bxb4?? деп пілді алады, ал қаралардың пешкасы бірінші қатарға дейін жетеді: 6...exf2+ 7.Ke2 fxg1=N+! — шахпен атқа айналу. Ат уәзірден жақсы болатын сирек жағдай. Бұған дейін 4.e3 дәл емес еді — 4.Nf3 жақсырақ.",
    },
  },
  {
    id: "englund",
    moves: ["d4", "e5", "dxe5", "Nc6", "Nf3", "Qe7", "Bf4", "Qb4+", "Bd2", "Qxb2", "Bc3", "Bb4", "Qd2", "Bxc3", "Qxc3", "Qc1#"],
    oshibka: 10,
    mat: true,
    name: { ru: "Гамбит Энглунда", en: "Englund Gambit Trap", kk: "Энглунд гамбиті" },
    about: {
      ru: "Чёрные жертвуют пешку и ферзём бьют b2. Белые атакуют ферзя 6.Bc3?? — и после 6...Bb4! 7.Qd2 Bxc3 8.Qxc3 Qc1# мат на первой горизонтали. Нужно было 6.Nc3.",
      en: "Black gives a pawn and the queen grabs b2. White chases it with 6.Bc3??, and after 6...Bb4! 7.Qd2 Bxc3 8.Qxc3 Qc1# it's mate on the back rank. 6.Nc3 was the move.",
      kk: "Қаралар пешка құрбан етіп, уәзірмен b2-ні алады. Ақтар 6.Bc3?? деп уәзірді қуады, 6...Bb4! 7.Qd2 Bxc3 8.Qxc3 Qc1# — бірінші қатарда мат. 6.Nc3 керек еді.",
    },
  },
  {
    id: "fishing-pole",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6", "O-O", "Ng4", "h3", "h5", "hxg4", "hxg4", "Ne1", "Qh4", "f3", "g3"],
    oshibka: 10,
    mat: false,
    name: { ru: "Ловушка «Удочка»", en: "Fishing Pole Trap", kk: "«Қармақ» тұзағы" },
    about: {
      ru: "Испанская партия. Конь на g4 — наживка. Белые берут 6.hxg4?? и открывают вертикаль h для ладьи чёрных. После 7...Qh4 и 8...g3 мат на h2 не остановить.",
      en: "Ruy Lopez. The knight on g4 is the bait. White takes 6.hxg4?? and opens the h-file for Black's rook. After 7...Qh4 and 8...g3 mate on h2 can't be stopped.",
      kk: "Испан партиясы. g4-тегі ат — жем. Ақтар 6.hxg4?? алып, қаралардың турасына h тігінін ашады. 7...Qh4 және 8...g3 кейін h2-дегі матты тоқтату мүмкін емес.",
    },
  },
  {
    id: "siberian",
    moves: ["e4", "c5", "d4", "cxd4", "c3", "dxc3", "Nxc3", "Nc6", "Nf3", "e6", "Bc4", "Qc7", "O-O", "Nf6", "Qe2", "Ng4", "h3", "Nd4", "Nxd4", "Qh2#"],
    oshibka: 16,
    mat: true,
    name: { ru: "Сибирская ловушка", en: "Siberian Trap", kk: "Сібір тұзағы" },
    about: {
      ru: "Гамбит Смит-Морра. Белые прогоняют коня 9.h3??, а чёрные отвечают 9...Nd4!, нападая на ферзя. После 10.Nxd4 ферзь c7 ставит мат на h2. Лучшее после 9...Nd4 — 10.hxg4, но и тогда чёрные лучше; ошибка — сам ход 9.h3, правильно 9.Rd1.",
      en: "Smith-Morra Gambit. White kicks the knight with 9.h3??, Black replies 9...Nd4! hitting the queen. After 10.Nxd4 the c7 queen mates on h2. The best try after 9...Nd4 is 10.hxg4, but Black is still better; the real mistake is 9.h3 itself, and 9.Rd1 was correct.",
      kk: "Смит-Морра гамбиті. Ақтар 9.h3?? деп атты қуады, қаралар 9...Nd4! деп уәзірге шабуыл жасайды. 10.Nxd4 кейін c7-дегі уәзір h2-де мат қояды. 9...Nd4 кейінгі ең жақсы жауап — 10.hxg4, бірақ сонда да қаралар жақсы; қате — 9.h3 жүрісінің өзі, дұрысы 9.Rd1.",
    },
  },
  {
    id: "noahs-ark",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "d6", "d4", "b5", "Bb3", "Nxd4", "Nxd4", "exd4", "Qxd4", "c5", "Qd5", "Be6", "Qc6+", "Bd7", "Qd5", "c4"],
    oshibka: 14,
    mat: false,
    name: { ru: "Ловушка «Ноев ковчег»", en: "Noah's Ark Trap", kk: "«Нұх кемесі» тұзағы" },
    about: {
      ru: "Испанская партия. Белые забирают пешку 8.Qxd4??, а пешки чёрных a6–b5–c5–c4 запирают слона b3. Слон пойман, белые теряют фигуру.",
      en: "Ruy Lopez. White grabs a pawn with 8.Qxd4??, and Black's pawns a6–b5–c5–c4 wall in the b3 bishop. The bishop is trapped and White loses a piece.",
      kk: "Испан партиясы. Ақтар 8.Qxd4?? деп пешка алады, ал қаралардың a6–b5–c5–c4 пешкалары b3-тегі пілді қамап тастайды. Піл ұсталды, ақтар фигура жоғалтады.",
    },
  },
];
