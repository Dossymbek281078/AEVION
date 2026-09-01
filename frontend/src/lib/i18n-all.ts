// Every dictionary in one object — for code that genuinely needs all of them.
//
// That means the server (i18n-server.ts renders any language on request) and
// tests. Client code must NOT import this: it is the whole 1.3 MB that the
// per-language split exists to keep off the page. The client gets `en` at
// build time for the first render and loads the visitor's language on demand;
// see i18n.tsx.

import { LANGS, type Lang } from "./i18n-data";

import ar from "./i18n-lang/ar";
import de from "./i18n-lang/de";
import en from "./i18n-lang/en";
import es from "./i18n-lang/es";
import fr from "./i18n-lang/fr";
import ja from "./i18n-lang/ja";
import kk from "./i18n-lang/kk";
import pt from "./i18n-lang/pt";
import ru from "./i18n-lang/ru";
import tr from "./i18n-lang/tr";
import zh from "./i18n-lang/zh";

export const translations: Record<Lang, Record<string, string>> = {
  ru, en, kk, de, fr, es, zh, ja, ar, pt, tr,
};

export { LANGS, type Lang };
