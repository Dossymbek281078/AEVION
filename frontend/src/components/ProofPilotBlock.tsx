"use client";

import { track } from "@/lib/track";
import {
  PILOT_USD,
  PILOT_RECORDS,
  PILOT_DAYS,
  PILOT_MANIFEST_MB,
  PILOT_CONTACT,
  PILOT_FEATURE,
  pismoZakaza,
} from "@/lib/proofPilot";

/**
 * Платный пилот на `/proof`: единственный платный шаг этой страницы.
 *
 * ПОЧЕМУ КОМПОНЕНТ КЛИЕНТСКИЙ, хотя страница серверная намеренно. Нажатие надо
 * посчитать, иначе результат пилота неизмерим — а это главный смысл затеи.
 * Общий `PageTracking` здесь не поможет: он ловит уходы только на gumroad и
 * lemonsqueezy (проверено по его условию), а наша кнопка — `mailto`, и под его
 * правило не попадает вовсе. То есть без своего обработчика нажатие ушло бы в
 * тишину, и страница выглядела бы работающей.
 *
 * ПОЧЕМУ ДВА СОБЫТИЯ НА ОДНО НАЖАТИЕ, а не одно своё. Оба имени уже живут и на
 * фронте, и в принимающем списке бэкенда, поэтому молча отброшены быть не могут:
 *   `cta_click`   — попадает в разрез по письмам (`byPost`), тот самый, где по
 *                   каналу писем сейчас стоит ноль нажатий;
 *   `feature_use` — с названием шага `pilot_490` попадает в разрез `byFeature`,
 *                   который отделяет наши пробы от живых людей.
 * Своё, новое имя пришлось бы заводить в двух списках сразу, и ровно на этом мы
 * уже теряли шаг воронки целиком: фронт отправлял, сервер отвечал 200 и
 * выбрасывал.
 */
export function ProofPilotBlock() {
  function zakazat() {
    // Оба события уходят ДО перехода к почтовому клиенту. `track` использует
    // sendBeacon, поэтому они переживают уход со страницы.
    track({
      type: "cta_click",
      source: "proof",
      value: PILOT_USD,
      meta: { feature: PILOT_FEATURE, product: PILOT_FEATURE },
    });
    track({
      type: "feature_use",
      source: "proof",
      meta: { feature: PILOT_FEATURE },
    });
  }

  return (
    <section
      id="pilot"
      style={{
        border: "1px solid #0d9488",
        borderRadius: 10,
        padding: "18px 20px",
        marginTop: 32,
        marginBottom: 26,
        background: "#f0fdfa",
      }}
    >
      <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 0, marginBottom: 10, color: "#0f172a" }}>
        Paid pilot — ${PILOT_USD}
      </h2>
      <p style={{ color: "#334155", fontSize: 15, lineHeight: 1.7, marginBottom: 12 }}>
        We sign your delivery and hand back a manifest your client verifies on their own
        machine. Up to {PILOT_RECORDS.toLocaleString("en-US")} of your records, within{" "}
        {PILOT_DAYS} days.
      </p>
      <p style={{ color: "#334155", fontSize: 15, lineHeight: 1.7, marginBottom: 12 }}>
        <b>What you get.</b> Every record signed with Ed25519 over RFC 8785 canonical JSON;
        the signed records are embedded in the manifest, so your client&apos;s check calls
        nothing of ours. The manifest is yours to keep and to forward, whether or not you
        continue with us.
      </p>
      <p style={{ color: "#334155", fontSize: 15, lineHeight: 1.7, marginBottom: 12 }}>
        <b>How it reaches you.</b> A manifest for {PILOT_RECORDS.toLocaleString("en-US")}{" "}
        records is about {PILOT_MANIFEST_MB}&nbsp;MB — we measured it — so we hand it over as
        a download link, not as an email attachment. The verifier itself stays small and you
        can keep running it against the manifest offline.
      </p>
      <p style={{ color: "#334155", fontSize: 15, lineHeight: 1.7, marginBottom: 12 }}>
        <b>What it is not.</b> We do not certify the author&apos;s identity — document checks
        are a stub today. There is no notary co-signature, no SOC&nbsp;2, no ISO&nbsp;27001,
        and consent-to-train is specified but not built. We hold no data catalogue: we sign
        your records, we do not sell ours.
      </p>
      <p style={{ color: "#334155", fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
        <b>How to order.</b> Tell us the delivery you have in mind and its record count. We
        reply with the format we need and a fixed date. Nothing is charged on this page: the
        invoice comes after we agree the scope.
      </p>
      <a
        href={pismoZakaza()}
        onClick={zakazat}
        style={{
          display: "inline-block",
          padding: "12px 20px",
          fontSize: 16,
          fontWeight: 800,
          borderRadius: 10,
          background: "#0d9488",
          color: "#fff",
          textDecoration: "none",
        }}
      >
        Order the pilot — ${PILOT_USD}
      </a>
      {/*
        Слабое место `mailto` названо прямо: у части людей почтовый клиент не
        настроен, и нажатие не даёт ничего. Поэтому адрес стоит рядом ТЕКСТОМ —
        его можно скопировать. Это не замена форме, а честный минимум без кассы.
      */}
      <p style={{ color: "#475569", fontSize: 14, lineHeight: 1.7, marginTop: 12, marginBottom: 0 }}>
        If the button does nothing, your browser has no mail client set up — write to{" "}
        <a href={`mailto:${PILOT_CONTACT}`} style={{ color: "#0f766e", fontWeight: 700 }}>
          {PILOT_CONTACT}
        </a>{" "}
        directly.
      </p>
    </section>
  );
}
