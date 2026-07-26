// QReal — директивы реализма, вшиваемые в каждый render-промт.
//
// Вынесено из routes/qreal.ts отдельным модулем без зависимостей: тот же
// текст нужен раннеру бенчмарка, а импортировать роутер из скрипта значит
// затащить express и пул Postgres. Дублировать строку нельзя — разъедется,
// и бенчмарк начнёт мерить не тот промт, который уходит в прод.

export const REALISM_DIRECTIVES =
  "Shot on ARRI Alexa 35, 24fps, 180-degree shutter, natural motion blur. " +
  "Skin with subsurface scattering, visible pores, slight asymmetry. Involuntary " +
  "micro-expressions; irregular blinking every 3-6s including partial blinks. " +
  "Hands anatomically correct. Handheld micro-jitter (sub-pixel), camera has body weight. " +
  "Species-accurate animal behavior. Natural ambient sound bed (room tone), " +
  "material-true foley, dialogue with real room acoustics. No slow-motion look, " +
  "no beauty filter, no digital sharpness.";
