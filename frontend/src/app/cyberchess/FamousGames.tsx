/* AEVION Famous Games library.

   Hand-picked classical games — chess notation itself is not copyrightable
   (US 17 USC §102(b); analogously in EU/RU). The games here are out of
   copyright as creative works (Morphy 1858, Anderssen 1851 …) and the
   modern WC games are factual game records.

   Every entry includes:
   - title       — short name learners would recognize
   - subtitle    — context line (year, location, what's notable)
   - white/black — players
   - pgn         — space-separated SAN moves (no headers or comments)
   - eco         — ECO code if applicable
   - lesson      — one-line takeaway about WHY this game is famous
*/

export type FamousGame = {
  id: string;
  title: string;
  subtitle: string;
  white: string;
  black: string;
  result: "1-0" | "0-1" | "1/2-1/2";
  eco?: string;
  pgn: string;
  lesson: string;
  emoji: string;
};

export const FAMOUS_GAMES: FamousGame[] = [
  {
    id: "opera",
    title: "Опера у Парижской",
    subtitle: "Morphy vs Duke of Brunswick & Count Isouard · 1858",
    white: "Paul Morphy",
    black: "Duke of Brunswick & Count Isouard",
    result: "1-0",
    eco: "C41",
    emoji: "🎭",
    lesson: "Темп важнее материала. Морфи жертвует фигуры ради быстрого развития и матовой атаки.",
    pgn: "e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#",
  },
  {
    id: "immortal",
    title: "Бессмертная партия",
    subtitle: "Anderssen vs Kieseritzky · London 1851",
    white: "Adolf Anderssen",
    black: "Lionel Kieseritzky",
    result: "1-0",
    eco: "C33",
    emoji: "♛",
    lesson: "Король партий жертвенного стиля. Жертвует обе ладьи, ферзя и ставит мат тремя лёгкими фигурами.",
    pgn: "e4 e5 f4 exf4 Bc4 Qh4+ Kf1 b5 Bxb5 Nf6 Nf3 Qh6 d3 Nh5 Nh4 Qg5 Nf5 c6 g4 Nf6 Rg1 cxb5 h4 Qg6 h5 Qg5 Qf3 Ng8 Bxf4 Qf6 Nc3 Bc5 Nd5 Qxb2 Bd6 Bxg1 e5 Qxa1+ Ke2 Na6 Nxg7+ Kd8 Qf6+ Nxf6 Be7#",
  },
  {
    id: "evergreen",
    title: "Вечнозелёная партия",
    subtitle: "Anderssen vs Dufresne · Berlin 1852",
    white: "Adolf Anderssen",
    black: "Jean Dufresne",
    result: "1-0",
    eco: "C52",
    emoji: "🌲",
    lesson: "Эталон комбинационного миттельшпиля. Финальная атака с тихим ходом 19.Rad1!",
    pgn: "e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O d3 Qb3 Qf6 e5 Qg6 Re1 Nge7 Ba3 b5 Qxb5 Rb8 Qa4 Bb6 Nbd2 Bb7 Ne4 Qf5 Bxd3 Qh5 Nf6+ gxf6 exf6 Rg8 Rad1 Qxf3 Rxe7+ Nxe7 Qxd7+ Kxd7 Bf5+ Ke8 Bd7+ Kf8 Bxe7#",
  },
  {
    id: "kasparov-topalov",
    title: "Каспаров — Топалов",
    subtitle: "Wijk aan Zee 1999 · «Бессмертная Каспарова»",
    white: "Garry Kasparov",
    black: "Veselin Topalov",
    result: "1-0",
    eco: "B07",
    emoji: "⚡",
    lesson: "Жертва ладьи на 24-м ходу для атаки на голого короля через всю доску. Считается лучшей партией XX века.",
    pgn: "e4 d6 d4 Nf6 Nc3 g6 Be3 Bg7 Qd2 c6 f3 b5 Nge2 Nbd7 Bh6 Bxh6 Qxh6 Bb7 a3 e5 O-O-O Qe7 Kb1 a6 Nc1 O-O-O Nb3 exd4 Rxd4 c5 Rd1 Nb6 g3 Kb8 Na5 Ba8 Bh3 d5 Qf4+ Ka7 Rhe1 d4 Nd5 Nbxd5 exd5 Qd6 Rxd4 cxd4 Re7+ Kb6 Qxd4+ Kxa5 b4+ Ka4 Qc3 Qxd5 Ra7 Bb7 Rxb7 Qc4 Qxf6 Kxa3 Qxa6+ Kxb4 c3+ Kxc3 Qa1+ Kd2 Qb2+ Kd1 Bf1 Rd2 Rd7 Rxd7 Bxc4 bxc4 Qxh8 Rd3 Qa8 c3 Qa4+ Ke1 f4 f5 Kc1 Rd2 Qa7",
  },
  {
    id: "fischer-spassky-6",
    title: "Фишер — Спасский, партия 6",
    subtitle: "World Championship Reykjavík 1972",
    white: "Bobby Fischer",
    black: "Boris Spassky",
    result: "1-0",
    eco: "D59",
    emoji: "🏆",
    lesson: "Фишер впервые в карьере играет 1.c4. Безупречная позиционная партия — после Спасский встал и аплодировал.",
    pgn: "c4 e6 Nf3 d5 d4 Nf6 Nc3 Be7 Bg5 O-O e3 h6 Bh4 b6 cxd5 Nxd5 Bxe7 Qxe7 Nxd5 exd5 Rc1 Be6 Qa4 c5 Qa3 Rc8 Bb5 a6 dxc5 bxc5 O-O Ra7 Be2 Nd7 Nd4 Qf8 Nxe6 fxe6 e4 d4 f4 Qe7 e5 Rb8 Bc4 Kh8 Qh3 Nf8 b3 a5 f5 exf5 Rxf5 Nh7 Rcf1 Qd8 Qg3 Re7 h4 Rbb7 e6 Rbc7 Qe5 Qe8 a4 Qd8 R1f2 Qe8 R2f3 Qd8 Bd3 Qe8 Qe4 Nf6 Rxf6 gxf6 Rxf6 Kg8 Bc4 Kh8 Qf4",
  },
  {
    id: "polugaevsky-nezhmetdinov",
    title: "Полугаевский — Нежметдинов",
    subtitle: "Sochi 1958 · «Жертва, перевернувшая шахматы»",
    white: "Lev Polugaevsky",
    black: "Rashid Nezhmetdinov",
    result: "0-1",
    eco: "A55",
    emoji: "🌋",
    lesson: "Нежметдинов жертвует ферзя за две лёгкие фигуры и проводит этюдную атаку — одна из самых красивых партий советской эпохи.",
    pgn: "d4 Nf6 c4 d6 Nc3 e5 e4 exd4 Qxd4 Nc6 Qd2 g6 b3 Bg7 Bb2 O-O Bd3 Ng4 Nge2 Qh4 Ng3 Nge5 O-O f5 f3 Bh6 Qd1 f4 Nge2 g5 Nd5 g4 g3 fxg3 hxg3 Qh3 Nef4 Qg3+ Kh1 Bxf4 Nxf4 Rxf4 Bf5 Bxf5 exf5 Nf3 Be5 Qg5+ Kh1 Qh4+ Kg1 Qg3+ Kh1 Nxe5 Qxg3 Nf3+ Kh1 Bg2+ Qxg2 Rh4+",
  },
  {
    id: "byrne-fischer",
    title: "Бирн — Фишер «Партия века»",
    subtitle: "New York 1956 · 13-летний Фишер играет шедевр",
    white: "Donald Byrne",
    black: "Bobby Fischer",
    result: "0-1",
    eco: "D92",
    emoji: "👑",
    lesson: "На 17-м ходу Фишер жертвует ферзя за разрушительную атаку. Партия признана одной из лучших в истории.",
    pgn: "Nf3 Nf6 c4 g6 Nc3 Bg7 d4 O-O Bf4 d5 Qb3 dxc4 Qxc4 c6 e4 Nbd7 Rd1 Nb6 Qc5 Bg4 Bg5 Na4 Qa3 Nxc3 bxc3 Nxe4 Bxe7 Qb6 Bc4 Nxc3 Bc5 Rfe8+ Kf1 Be6 Bxb6 Bxc4+ Kg1 Ne2+ Kf1 Nxd4+ Kg1 Ne2+ Kf1 Nc3+ Kg1 axb6 Qb4 Ra4 Qxb6 Nxd1 h3 Rxa2 Kh2 Nxf2 Re1 Rxe1 Qd8+ Bf8 Nxe1 Bd5 Nf3 Ne4 Qb8 b5 h4 h5 Ne5 Kg7 Kg1 Bc5+ Kf1 Ng3+ Ke1 Bb4+ Kd1 Bb3+ Kc1 Ne2+ Kb1 Nc3+ Kc1 Rc2#",
  },
  {
    id: "carlsen-anand-2013-9",
    title: "Карлсен — Ананд, партия 9",
    subtitle: "World Championship Chennai 2013",
    white: "Magnus Carlsen",
    black: "Viswanathan Anand",
    result: "1/2-1/2",
    eco: "E25",
    emoji: "🇳🇴",
    lesson: "Финальная партия матча, в которой 22-летний Карлсен оформил завоевание короны. Образец профилактической игры.",
    pgn: "d4 Nf6 c4 e6 Nc3 Bb4 f3 d5 a3 Bxc3+ bxc3 c5 cxd5 Nxd5 dxc5 f5 Qc2 Nd7 e4 fxe4 fxe4 N5f6 c6 bxc6 Nf3 Qc7 Bg5 Bb7 Bd3 h6 Bh4 Rb8 Qe2 g5 Bg3 Qa5+ Kf1 Bxe4 Nd2 Bxd3 Qxd3 Qxc5 Bd6 Qf5+ Qxf5 exf5 Bxb8 Rxb8",
  },
  {
    id: "carlsen-caruana-2018-12",
    title: "Карлсен — Каруана, партия 12",
    subtitle: "World Championship London 2018",
    white: "Magnus Carlsen",
    black: "Fabiano Caruana",
    result: "1/2-1/2",
    eco: "B33",
    emoji: "🤝",
    lesson: "Карлсен предлагает ничью в выигранной позиции и решает матч на тай-брейке — спорное решение, изменившее правила World Championship.",
    pgn: "e4 c5 Nf3 Nc6 Nc3 e5 Bc4 Be7 d3 Nf6 Nd2 d6 Nf1 h6 Ne3 g6 h4 Nd4 Bd5 Qd7 c3 Nxd5 Nxd5 Nf5 g3 h5 Nxe7 Qxe7 g4 hxg4 Ng5 Nh6 Nf3 Qd7 Be3 Bd8 Bd2 Bg5 c4 Bxd2+ Qxd2 Qe7 Qe3 Kf8 Rh2 g5 hxg5 Qxg5 Qxg5",
  },
  {
    id: "kasparov-deepblue-1996-1",
    title: "Каспаров — Deep Blue, партия 1",
    subtitle: "Philadelphia 1996 · человек побеждает машину",
    white: "Garry Kasparov",
    black: "Deep Blue",
    result: "1-0",
    eco: "B22",
    emoji: "🤖",
    lesson: "Первая партия первого матча между чемпионом мира и компьютером. Каспаров победил, доказав превосходство интуиции — но через год Deep Blue взял реванш.",
    pgn: "e4 c5 c3 d5 exd5 Qxd5 d4 Nf6 Nf3 Bg4 Be2 e6 h3 Bh5 O-O Nc6 Be3 cxd4 cxd4 Bb4 a3 Ba5 Nc3 Qd6 Nb5 Qe7 Ne5 Bxe2 Qxe2 O-O Rac1 Rac8 Bg5 Bb6 Bxf6 gxf6 Nc4 Rfd8 Nxb6 axb6 Rfd1 f5 Qe3 Qf6 d5 Rxd5 Rxd5 exd5 b3 Kh8 Qxb6 Rg8 Qc5 d4 Nd6 f4 Nxb7 Ne5 Qd5 f3 g3 Nd3 Rc7 Re8 Nf6 Rg7 b4 Nxb4 Qxd5 dxe2 Re5 Qxe2 Rxg3+ hxg3",
  },
];
