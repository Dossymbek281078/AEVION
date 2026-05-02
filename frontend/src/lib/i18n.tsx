"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Lang = "en" | "ru";
export const LANGS: Lang[] = ["en", "ru"];
export const LANG_FULL: Record<Lang, string> = { en: "English", ru: "Русский" };
export const LANG_SHORT: Record<Lang, string> = { en: "EN", ru: "RU" };

type I18nContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export const LANG_COOKIE = "aevion_lang_v1";
const STORAGE_KEY = LANG_COOKIE;

export function interpolate(raw: string, vars?: Record<string, string | number>): string {
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

export const translations: Record<Lang, Record<string, string>> = {
  en: {
    /* Nav & global */
    "nav.demo": "Ecosystem demo",
    "nav.auth": "Auth",
    "nav.qright": "QRight",
    "nav.qsign": "QSign",
    "nav.bureau": "Bureau",
    "nav.planet": "Planet",
    "nav.awards": "Awards",
    "nav.bank": "Bank",
    "nav.chess": "Chess",
    "nav.help": "Help",

    /* Home hero */
    "home.badge": "Product MVP \u00b7 ready for demo",
    "home.title": "Trust infrastructure for digital assets and intellectual property",
    "home.subtitle": "A unified environment for investment and partnership evaluation: identity, object registry, cryptographic signature, patent bureau, and compliance layer \u2014 on an interactive ecosystem map with 27 product nodes and open APIs.",
    "home.cta.auth": "Start with identity (Auth)",
    "home.cta.qright": "QRight Registry",
    "home.cta.music": "Music Awards",
    "home.cta.film": "Film Awards",
    "home.cta.demo": "Full demo \u2192",

    /* Stats */
    "stats.nodes": "Nodes on map",
    "stats.qright": "QRight records",
    "stats.participants": "Planet participants",
    "stats.certified": "Certified",
    "stats.submissions": "Planet submissions",
    "stats.stack": "Stack",

    /* Auth */
    "auth.title": "AEVION Identity",
    "auth.subtitle": "Single account for all ecosystem modules. Register or sign in to get a JWT token.",
    "auth.register": "Register",
    "auth.login": "Sign in",
    "auth.name": "Name",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.password.hint": "Minimum 6 characters",
    "auth.submit.register": "Create account",
    "auth.submit.login": "Sign in",
    "auth.waiting": "Please wait...",
    "auth.session": "Session active",
    "auth.logout": "Sign out",
    "auth.cta.qright": "Create object in QRight \u2192",
    "auth.cta.planet": "Planet Lab",
    "auth.toast.registered": "Account created! Welcome to AEVION",
    "auth.toast.loggedin": "Signed in",
    "auth.toast.loggedout": "Signed out",
    "auth.jwt.label": "JWT token (for developers)",

    /* QRight */
    "qright.title": "QRight",
    "qright.subtitle": "Electronic patenting (MVP): register object \u2192 hash \u2192 add to registry. Then \u2014 sign and bureau in one click.",
    "qright.form.title": "Title *",
    "qright.form.desc": "Description *",
    "qright.form.owner": "Author name (optional)",
    "qright.form.email": "Author email (optional)",
    "qright.form.country": "Country (optional)",
    "qright.form.city": "City (optional)",
    "qright.form.submit": "Register object",
    "qright.form.saving": "Saving...",
    "qright.toast.created": "Object registered in QRight",
    "qright.registry": "QRight Registry",
    "qright.mine": "Only mine (requires Auth)",

    /* Pipeline */
    "pipeline.auth": "Auth",
    "pipeline.qright": "QRight",
    "pipeline.qsign": "QSign",
    "pipeline.bureau": "Bureau",
    "pipeline.planet": "Planet",

    /* Bank */
    "bank.title": "Ecosystem digital bank",
    "bank.subtitle": "Wallet, P2P transfers between creators, automatic royalties for content usage, Awards payouts. Every transaction linked to Trust Graph.",
    "bank.balance": "Balance",
    "bank.available": "Available",
    "bank.frozen": "Frozen",
    "bank.pending": "Pending royalties",
    "bank.transfer": "P2P Transfer",
    "bank.recipient": "Recipient",
    "bank.amount": "Amount AEC",
    "bank.send": "Send",
    "bank.sending": "Sending...",
    "bank.history": "Transaction history",

    /* Chess */
    "chess.title": "Next-gen chess",
    "chess.subtitle": "Play against AI in your browser. Anti-cheat, ratings, and tournaments \u2014 coming soon.",
    "chess.your.turn": "Your move (white)",
    "chess.ai.thinking": "AI is thinking...",
    "chess.new.game": "New game",
    "chess.captured.you": "Captured by you",
    "chess.captured.ai": "Captured by AI",
    "chess.moves": "Moves",

    /* Footer */
    "footer.brand": "Global trust infrastructure for digital content, intellectual property and creator economy.",
    "footer.products": "Products",
    "footer.company": "Company",
    "footer.contact": "Contact",
    "footer.rights": "All rights reserved.",

    /* Help */
    "help.title": "Help Center",
    "help.subtitle": "Everything you need to know about using AEVION. Can't find an answer? Email us at yahiin1978@gmail.com",
    "help.still": "Still need help?",

    /* Misc */
    "planet.dashboard": "Planet Ecosystem \u2014 live",
    "planet.lab": "Planet Lab \u2192",
    "awards.hub": "Awards hub \u2192",

    /* Quantum Shield */
    "shield.title": "Quantum Shield",
    "shield.subtitle": "Post-quantum cryptographic protection. Keys split into shards \u2014 any threshold can reconstruct, but no single shard reveals anything.",
    "shield.dashboard": "Dashboard",
    "shield.viewer": "Shard Viewer",
    "shield.create": "Create Shield",
    "shield.verify": "Verify / Recover",
    "shield.total": "Total Shields",
    "shield.active": "Active",
    "shield.threshold": "Avg Threshold",
    "shield.shards": "Total Shards",
  },

  ru: {
    /* Nav & global */
    "nav.demo": "\u0414\u0435\u043c\u043e \u044d\u043a\u043e\u0441\u0438\u0441\u0442\u0435\u043c\u044b",
    "nav.auth": "Auth",
    "nav.qright": "QRight",
    "nav.qsign": "QSign",
    "nav.bureau": "\u0411\u044e\u0440\u043e",
    "nav.planet": "Planet",
    "nav.awards": "\u041f\u0440\u0435\u043c\u0438\u0438",
    "nav.bank": "\u0411\u0430\u043d\u043a",
    "nav.chess": "\u0428\u0430\u0445\u043c\u0430\u0442\u044b",
    "nav.help": "\u041f\u043e\u043c\u043e\u0449\u044c",

    /* Home hero */
    "home.badge": "\u041f\u0440\u043e\u0434\u0443\u043a\u0442\u043e\u0432\u044b\u0439 MVP \u00b7 \u0433\u043e\u0442\u043e\u0432\u043e \u043a \u0434\u0435\u043c\u043e\u043d\u0441\u0442\u0440\u0430\u0446\u0438\u0438",
    "home.title": "\u0418\u043d\u0444\u0440\u0430\u0441\u0442\u0440\u0443\u043a\u0442\u0443\u0440\u0430 \u0434\u043e\u0432\u0435\u0440\u0438\u044f \u0434\u043b\u044f \u0446\u0438\u0444\u0440\u043e\u0432\u044b\u0445 \u0430\u043a\u0442\u0438\u0432\u043e\u0432 \u0438 \u0438\u043d\u0442\u0435\u043b\u043b\u0435\u043a\u0442\u0443\u0430\u043b\u044c\u043d\u043e\u0439 \u0441\u043e\u0431\u0441\u0442\u0432\u0435\u043d\u043d\u043e\u0441\u0442\u0438",
    "home.subtitle": "\u0415\u0434\u0438\u043d\u044b\u0439 \u043a\u043e\u043d\u0442\u0443\u0440 \u0434\u043b\u044f \u0438\u043d\u0432\u0435\u0441\u0442\u0438\u0446\u0438\u043e\u043d\u043d\u043e\u0439 \u0438 \u043f\u0430\u0440\u0442\u043d\u0451\u0440\u0441\u043a\u043e\u0439 \u043e\u0446\u0435\u043d\u043a\u0438: \u0438\u0434\u0435\u043d\u0442\u0438\u0447\u043d\u043e\u0441\u0442\u044c, \u0440\u0435\u0435\u0441\u0442\u0440 \u043e\u0431\u044a\u0435\u043a\u0442\u043e\u0432, \u043a\u0440\u0438\u043f\u0442\u043e\u043f\u043e\u0434\u043f\u0438\u0441\u044c, \u043f\u0430\u0442\u0435\u043d\u0442\u043d\u043e\u0435 \u0431\u044e\u0440\u043e \u0438 \u0441\u043b\u043e\u0439 compliance \u2014 \u043d\u0430 \u0438\u043d\u0442\u0435\u0440\u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0439 \u043a\u0430\u0440\u0442\u0435 \u044d\u043a\u043e\u0441\u0438\u0441\u0442\u0435\u043c\u044b \u0441 27 \u043f\u0440\u043e\u0434\u0443\u043a\u0442\u043e\u0432\u044b\u043c\u0438 \u0443\u0437\u043b\u0430\u043c\u0438 \u0438 \u043e\u0442\u043a\u0440\u044b\u0442\u044b\u043c\u0438 API.",
    "home.cta.auth": "\u041d\u0430\u0447\u0430\u0442\u044c \u0441 \u0438\u0434\u0435\u043d\u0442\u0438\u0447\u043d\u043e\u0441\u0442\u0438 (Auth)",
    "home.cta.qright": "\u0420\u0435\u0435\u0441\u0442\u0440 QRight",
    "home.cta.music": "\u041f\u0440\u0435\u043c\u0438\u044f \u2014 \u043c\u0443\u0437\u044b\u043a\u0430",
    "home.cta.film": "\u041f\u0440\u0435\u043c\u0438\u044f \u2014 \u043a\u0438\u043d\u043e",
    "home.cta.demo": "\u041f\u043e\u043b\u043d\u0430\u044f \u0434\u0435\u043c\u043e\u043d\u0441\u0442\u0440\u0430\u0446\u0438\u044f \u2192",

    /* Stats */
    "stats.nodes": "\u0423\u0437\u043b\u043e\u0432 \u043d\u0430 \u043a\u0430\u0440\u0442\u0435",
    "stats.qright": "\u0417\u0430\u043f\u0438\u0441\u0435\u0439 QRight",
    "stats.participants": "Planet \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u043e\u0432",
    "stats.certified": "\u0421\u0435\u0440\u0442\u0438\u0444\u0438\u0446\u0438\u0440\u043e\u0432\u0430\u043d\u043e",
    "stats.submissions": "\u0417\u0430\u044f\u0432\u043e\u043a Planet",
    "stats.stack": "\u0421\u0442\u0435\u043a",

    /* Auth */
    "auth.title": "\u0418\u0434\u0435\u043d\u0442\u0438\u0447\u043d\u043e\u0441\u0442\u044c AEVION",
    "auth.subtitle": "\u0415\u0434\u0438\u043d\u0430\u044f \u0443\u0447\u0451\u0442\u043d\u0430\u044f \u0437\u0430\u043f\u0438\u0441\u044c \u0434\u043b\u044f \u0432\u0441\u0435\u0445 \u043c\u043e\u0434\u0443\u043b\u0435\u0439 \u044d\u043a\u043e\u0441\u0438\u0441\u0442\u0435\u043c\u044b. \u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u0443\u0439\u0442\u0435\u0441\u044c \u0438\u043b\u0438 \u0432\u043e\u0439\u0434\u0438\u0442\u0435, \u0447\u0442\u043e\u0431\u044b \u043f\u043e\u043b\u0443\u0447\u0438\u0442\u044c JWT-\u0442\u043e\u043a\u0435\u043d.",
    "auth.register": "\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044f",
    "auth.login": "\u0412\u0445\u043e\u0434",
    "auth.name": "\u0418\u043c\u044f",
    "auth.email": "Email",
    "auth.password": "\u041f\u0430\u0440\u043e\u043b\u044c",
    "auth.password.hint": "\u041c\u0438\u043d\u0438\u043c\u0443\u043c 6 \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432",
    "auth.submit.register": "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0430\u043a\u043a\u0430\u0443\u043d\u0442",
    "auth.submit.login": "\u0412\u043e\u0439\u0442\u0438",
    "auth.waiting": "\u041f\u043e\u0434\u043e\u0436\u0434\u0438\u0442\u0435...",
    "auth.session": "\u0421\u0435\u0441\u0441\u0438\u044f \u0430\u043a\u0442\u0438\u0432\u043d\u0430",
    "auth.logout": "\u0412\u044b\u0439\u0442\u0438",
    "auth.cta.qright": "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043e\u0431\u044a\u0435\u043a\u0442 \u0432 QRight \u2192",
    "auth.cta.planet": "Planet Lab",
    "auth.toast.registered": "\u0410\u043a\u043a\u0430\u0443\u043d\u0442 \u0441\u043e\u0437\u0434\u0430\u043d! \u0414\u043e\u0431\u0440\u043e \u043f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u0442\u044c \u0432 AEVION",
    "auth.toast.loggedin": "\u0412\u0445\u043e\u0434 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d",
    "auth.toast.loggedout": "\u0412\u044b \u0432\u044b\u0448\u043b\u0438 \u0438\u0437 \u0441\u0438\u0441\u0442\u0435\u043c\u044b",
    "auth.jwt.label": "JWT-\u0442\u043e\u043a\u0435\u043d (\u0434\u043b\u044f \u0440\u0430\u0437\u0440\u0430\u0431\u043e\u0442\u0447\u0438\u043a\u043e\u0432)",

    /* QRight */
    "qright.title": "QRight",
    "qright.subtitle": "\u042d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u043e\u0435 \u043f\u0430\u0442\u0435\u043d\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 (MVP): \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044f \u043e\u0431\u044a\u0435\u043a\u0442\u0430 \u2192 \u0445\u044d\u0448 \u2192 \u0437\u0430\u043f\u0438\u0441\u044c \u0432 \u0440\u0435\u0435\u0441\u0442\u0440. \u0414\u0430\u043b\u044c\u0448\u0435 \u2014 \u043f\u043e\u0434\u043f\u0438\u0441\u044c \u0438 \u0431\u044e\u0440\u043e \u0432 \u043e\u0434\u0438\u043d \u043a\u043b\u0438\u043a.",
    "qright.form.title": "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 *",
    "qright.form.desc": "\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 *",
    "qright.form.owner": "\u0418\u043c\u044f \u0430\u0432\u0442\u043e\u0440\u0430 (\u043e\u043f\u0446\u0438\u043e\u043d\u0430\u043b\u044c\u043d\u043e)",
    "qright.form.email": "Email \u0430\u0432\u0442\u043e\u0440\u0430 (\u043e\u043f\u0446\u0438\u043e\u043d\u0430\u043b\u044c\u043d\u043e)",
    "qright.form.country": "\u0421\u0442\u0440\u0430\u043d\u0430 (\u043e\u043f\u0446\u0438\u043e\u043d\u0430\u043b\u044c\u043d\u043e)",
    "qright.form.city": "\u0413\u043e\u0440\u043e\u0434 (\u043e\u043f\u0446\u0438\u043e\u043d\u0430\u043b\u044c\u043d\u043e)",
    "qright.form.submit": "\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043e\u0431\u044a\u0435\u043a\u0442",
    "qright.form.saving": "\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435...",
    "qright.toast.created": "\u041e\u0431\u044a\u0435\u043a\u0442 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u043d \u0432 QRight",
    "qright.registry": "\u0420\u0435\u0435\u0441\u0442\u0440 QRight",
    "qright.mine": "\u0422\u043e\u043b\u044c\u043a\u043e \u043c\u043e\u0438 (\u043d\u0443\u0436\u0435\u043d \u0432\u0445\u043e\u0434 \u0432 Auth)",

    /* Pipeline */
    "pipeline.auth": "Auth",
    "pipeline.qright": "QRight",
    "pipeline.qsign": "QSign",
    "pipeline.bureau": "\u0411\u044e\u0440\u043e",
    "pipeline.planet": "Planet",

    /* Bank */
    "bank.title": "\u0426\u0438\u0444\u0440\u043e\u0432\u043e\u0439 \u0431\u0430\u043d\u043a \u044d\u043a\u043e\u0441\u0438\u0441\u0442\u0435\u043c\u044b",
    "bank.subtitle": "\u041a\u043e\u0448\u0435\u043b\u0451\u043a, \u043f\u0435\u0440\u0435\u0432\u043e\u0434\u044b \u043c\u0435\u0436\u0434\u0443 \u0430\u0432\u0442\u043e\u0440\u0430\u043c\u0438, \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u0440\u043e\u044f\u043b\u0442\u0438 \u043f\u0440\u0438 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u0438 \u043a\u043e\u043d\u0442\u0435\u043d\u0442\u0430, \u0432\u044b\u043f\u043b\u0430\u0442\u044b \u0437\u0430 \u043f\u043e\u0431\u0435\u0434\u044b \u0432 Awards. \u041a\u0430\u0436\u0434\u0430\u044f \u0442\u0440\u0430\u043d\u0437\u0430\u043a\u0446\u0438\u044f \u043f\u0440\u0438\u0432\u044f\u0437\u0430\u043d\u0430 \u043a Trust Graph.",
    "bank.balance": "\u0411\u0430\u043b\u0430\u043d\u0441",
    "bank.available": "\u0414\u043e\u0441\u0442\u0443\u043f\u043d\u043e",
    "bank.frozen": "\u0417\u0430\u043c\u043e\u0440\u043e\u0436\u0435\u043d\u043e",
    "bank.pending": "\u041e\u0436\u0438\u0434\u0430\u0435\u0442 \u0440\u043e\u044f\u043b\u0442\u0438",
    "bank.transfer": "\u041f\u0435\u0440\u0435\u0432\u043e\u0434 P2P",
    "bank.recipient": "\u041f\u043e\u043b\u0443\u0447\u0430\u0442\u0435\u043b\u044c",
    "bank.amount": "\u0421\u0443\u043c\u043c\u0430 AEC",
    "bank.send": "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c",
    "bank.sending": "\u041e\u0442\u043f\u0440\u0430\u0432\u043a\u0430...",
    "bank.history": "\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u0442\u0440\u0430\u043d\u0437\u0430\u043a\u0446\u0438\u0439",

    /* Chess */
    "chess.title": "\u0428\u0430\u0445\u043c\u0430\u0442\u044b \u043d\u043e\u0432\u043e\u0433\u043e \u043f\u043e\u043a\u043e\u043b\u0435\u043d\u0438\u044f",
    "chess.subtitle": "\u0418\u0433\u0440\u0430\u0439\u0442\u0435 \u043f\u0440\u043e\u0442\u0438\u0432 \u0418\u0418 \u043f\u0440\u044f\u043c\u043e \u0432 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435. \u0410\u043d\u0442\u0438\u0447\u0438\u0442, \u0440\u0435\u0439\u0442\u0438\u043d\u0433 \u0438 \u0442\u0443\u0440\u043d\u0438\u0440\u044b \u2014 \u0441\u043a\u043e\u0440\u043e.",
    "chess.your.turn": "\u0412\u0430\u0448 \u0445\u043e\u0434 (\u0431\u0435\u043b\u044b\u0435)",
    "chess.ai.thinking": "\u0418\u0418 \u0434\u0443\u043c\u0430\u0435\u0442...",
    "chess.new.game": "\u041d\u043e\u0432\u0430\u044f \u0438\u0433\u0440\u0430",
    "chess.captured.you": "\u0412\u0437\u044f\u0442\u044b \u0432\u0430\u043c\u0438",
    "chess.captured.ai": "\u0412\u0437\u044f\u0442\u044b \u0418\u0418",
    "chess.moves": "\u0425\u043e\u0434\u044b",

    /* Footer */
    "footer.brand": "\u0413\u043b\u043e\u0431\u0430\u043b\u044c\u043d\u0430\u044f \u0438\u043d\u0444\u0440\u0430\u0441\u0442\u0440\u0443\u043a\u0442\u0443\u0440\u0430 \u0434\u043e\u0432\u0435\u0440\u0438\u044f \u0434\u043b\u044f \u0446\u0438\u0444\u0440\u043e\u0432\u043e\u0433\u043e \u043a\u043e\u043d\u0442\u0435\u043d\u0442\u0430, \u0438\u043d\u0442\u0435\u043b\u043b\u0435\u043a\u0442\u0443\u0430\u043b\u044c\u043d\u043e\u0439 \u0441\u043e\u0431\u0441\u0442\u0432\u0435\u043d\u043d\u043e\u0441\u0442\u0438 \u0438 \u044d\u043a\u043e\u043d\u043e\u043c\u0438\u043a\u0438 \u0441\u043e\u0437\u0434\u0430\u0442\u0435\u043b\u0435\u0439.",
    "footer.products": "\u041f\u0440\u043e\u0434\u0443\u043a\u0442\u044b",
    "footer.company": "\u041a\u043e\u043c\u043f\u0430\u043d\u0438\u044f",
    "footer.contact": "\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b",
    "footer.rights": "\u0412\u0441\u0435 \u043f\u0440\u0430\u0432\u0430 \u0437\u0430\u0449\u0438\u0449\u0435\u043d\u044b.",

    /* Help */
    "help.title": "\u0426\u0435\u043d\u0442\u0440 \u043f\u043e\u043c\u043e\u0449\u0438",
    "help.subtitle": "\u0412\u0441\u0451 \u0447\u0442\u043e \u043d\u0443\u0436\u043d\u043e \u0437\u043d\u0430\u0442\u044c \u043e\u0431 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u0438 AEVION. \u041d\u0435 \u043d\u0430\u0448\u043b\u0438 \u043e\u0442\u0432\u0435\u0442? \u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u043d\u0430\u043c \u043d\u0430 yahiin1978@gmail.com",
    "help.still": "\u041e\u0441\u0442\u0430\u043b\u0438\u0441\u044c \u0432\u043e\u043f\u0440\u043e\u0441\u044b?",

    /* Misc */
    "planet.dashboard": "Planet Ecosystem \u2014 live",
    "planet.lab": "Planet Lab \u2192",
    "awards.hub": "\u041f\u0440\u0435\u043c\u0438\u0438 Awards \u2192",

    /* Quantum Shield */
    "shield.title": "Quantum Shield",
    "shield.subtitle": "\u041f\u043e\u0441\u0442\u043a\u0432\u0430\u043d\u0442\u043e\u0432\u0430\u044f \u043a\u0440\u0438\u043f\u0442\u043e\u0433\u0440\u0430\u0444\u0438\u0447\u0435\u0441\u043a\u0430\u044f \u0437\u0430\u0449\u0438\u0442\u0430. \u041a\u043b\u044e\u0447\u0438 \u0440\u0430\u0437\u0434\u0435\u043b\u044f\u044e\u0442\u0441\u044f \u043d\u0430 \u0448\u0430\u0440\u0434\u044b \u2014 \u043b\u044e\u0431\u043e\u0439 \u043f\u043e\u0440\u043e\u0433 \u0432\u043e\u0441\u0441\u0442\u0430\u043d\u0430\u0432\u043b\u0438\u0432\u0430\u0435\u0442, \u043d\u043e \u043d\u0438 \u043e\u0434\u0438\u043d \u0448\u0430\u0440\u0434 \u043d\u0435 \u0440\u0430\u0441\u043a\u0440\u044b\u0432\u0430\u0435\u0442 \u043d\u0438\u0447\u0435\u0433\u043e.",
    "shield.dashboard": "\u041f\u0430\u043d\u0435\u043b\u044c",
    "shield.viewer": "\u041f\u0440\u043e\u0441\u043c\u043e\u0442\u0440 \u0448\u0430\u0440\u0434\u043e\u0432",
    "shield.create": "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0449\u0438\u0442",
    "shield.verify": "\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 / \u0412\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435",
    "shield.total": "\u0412\u0441\u0435\u0433\u043e \u0449\u0438\u0442\u043e\u0432",
    "shield.active": "\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0445",
    "shield.threshold": "\u0421\u0440. \u043f\u043e\u0440\u043e\u0433",
    "shield.shards": "\u0412\u0441\u0435\u0433\u043e \u0448\u0430\u0440\u0434\u043e\u0432",
  },
};

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (saved === "en" || saved === "ru") setLangState(saved);
    } catch {}
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const raw = translations[lang]?.[key] ?? translations.en[key] ?? key;
      return interpolate(raw, vars);
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Compact language switcher component */
export function LangSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <div style={{ display: "inline-flex", borderRadius: 8, border: "1px solid rgba(15,23,42,0.12)", overflow: "hidden", fontSize: 12 }}>
      <button
        onClick={() => setLang("en")}
        style={{
          padding: "5px 10px",
          border: "none",
          background: lang === "en" ? "#0f172a" : "transparent",
          color: lang === "en" ? "#fff" : "#64748b",
          fontWeight: lang === "en" ? 800 : 500,
          cursor: "pointer",
        }}
      >
        EN
      </button>
      <button
        onClick={() => setLang("ru")}
        style={{
          padding: "5px 10px",
          border: "none",
          borderLeft: "1px solid rgba(15,23,42,0.12)",
          background: lang === "ru" ? "#0f172a" : "transparent",
          color: lang === "ru" ? "#fff" : "#64748b",
          fontWeight: lang === "ru" ? 800 : 500,
          cursor: "pointer",
        }}
      >
        RU
      </button>
    </div>
  );
}
