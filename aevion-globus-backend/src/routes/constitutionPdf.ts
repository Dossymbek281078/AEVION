/**
 * Constitution — branded PDF export.
 *
 * POST /api/constitution/pdf
 *   body: { title?, sliders, regime?: {id,name,era}, signature?, signedAt? }
 *   returns: application/pdf (single page A4)
 *
 * Content:
 *   - AEVION CONSTITUTION header
 *   - Title + regime name/era
 *   - Radar chart (8-axis octagon, cyan filled polygon)
 *   - 6 metrics bars (innovation/stability/legitimacy + eliteFear/conflict/resentment)
 *   - 8 sliders table with values
 *   - QR code (if signature provided) pointing to /api/qsign/verify
 *   - Footer: aevion.io/constitution + signedAt
 *
 * Uses pdfkit + qrcode (both already in deps for Planet certs).
 */

import { Router, type Request, type Response } from "express";
import { rateLimit } from "../lib/rateLimit";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { resolvePlan } from "../lib/constitutionGate";

const SLIDER_KEYS = [
  "floor", "ruleOfLaw", "rotation", "transparency",
  "multiStatus", "skinInGame", "polycentricity", "positiveSum",
] as const;
type SliderKey = (typeof SLIDER_KEYS)[number];
type Sliders = Record<SliderKey, number>;

const SLIDER_LABELS_EN: Record<SliderKey, string> = {
  floor: "Floor below",
  ruleOfLaw: "Rule of law over the top",
  rotation: "Rotation / sortition",
  transparency: "Elite transparency",
  multiStatus: "Multiple status axes",
  skinInGame: "Skin in the game",
  polycentricity: "Polycentricity",
  positiveSum: "Positive sum",
};

const SHORT_LABELS: Record<SliderKey, string> = {
  floor: "Floor",
  ruleOfLaw: "Law",
  rotation: "Rotation",
  transparency: "Transp.",
  multiStatus: "Multi-status",
  skinInGame: "Skin",
  polycentricity: "Polycentr.",
  positiveSum: "Pos-sum",
};

function clamp(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function computeMetrics(s: Sliders) {
  const inv = (x: number) => 100 - x;
  return {
    eliteFear: Math.round(inv(s.floor)*0.3 + inv(s.ruleOfLaw)*0.3 + inv(s.transparency)*0.2 + inv(s.positiveSum)*0.2),
    intraConflict: Math.round(inv(s.rotation)*0.4 + inv(s.multiStatus)*0.4 + inv(s.ruleOfLaw)*0.2),
    resentment: Math.round(inv(s.floor)*0.4 + inv(s.transparency)*0.3 + inv(s.skinInGame)*0.3),
    innovation: Math.round(s.positiveSum*0.5 + s.polycentricity*0.25 + s.multiStatus*0.25),
    stability: Math.round(s.ruleOfLaw*0.4 + s.floor*0.3 + s.transparency*0.2 + s.rotation*0.1),
    legitimacy: Math.round(s.transparency*0.3 + s.ruleOfLaw*0.3 + s.floor*0.2 + s.rotation*0.2),
  };
}

export const constitutionPdfRouter = Router();

const limiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  keyPrefix: "constitution-pdf",
});

constitutionPdfRouter.post(
  "/pdf",
  limiter as unknown as (req: Request, res: Response, next: () => void) => void,
  async (req: Request, res: Response) => {
    try {
      const body = (req.body && typeof req.body === "object")
        ? (req.body as Record<string, unknown>)
        : {};
      const rawSliders = body.sliders as Record<string, unknown> | undefined;
      if (!rawSliders || typeof rawSliders !== "object") {
        return res.status(400).json({ error: "missing_sliders" });
      }
      const sliders = {} as Sliders;
      for (const k of SLIDER_KEYS) sliders[k] = clamp(rawSliders[k]);

      const title = typeof body.title === "string" && body.title
        ? body.title.slice(0, 120)
        : "Untitled Constitution";
      const regime = (body.regime ?? {}) as Record<string, unknown>;
      const regimeName = typeof regime.name === "string" ? regime.name : "Mixed";
      const regimeEra = typeof regime.era === "string" ? regime.era : "";
      const signature = typeof body.signature === "string" ? body.signature : null;
      const signedAt = typeof body.signedAt === "string" ? body.signedAt : null;
      const artifactId = typeof body.artifactId === "string" ? body.artifactId : null;
      const metrics = computeMetrics(sliders);

      const qrPayload = signature
        ? (artifactId
            ? `https://aevion.app/constitution?artifact=${artifactId}`
            : `qsign:${signature.slice(0, 16)}`)
        : "https://aevion.app/constitution";
      const qrDataUrl = await QRCode.toDataURL(qrPayload, {
        errorCorrectionLevel: "M",
        width: 160,
        margin: 1,
      });
      const qrBuf = Buffer.from(qrDataUrl.replace(/^data:image\/png;base64,/, ""), "base64");

      const safeTitle = title.replace(/[^a-z0-9а-яё-]+/giu, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "constitution";
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="constitution-${safeTitle}-${Date.now()}.pdf"`,
      );

      const doc = new PDFDocument({ size: "A4", margin: 0 });
      doc.pipe(res);

      const W = 595;
      const H = 842;

      // Gold header bar
      doc.rect(0, 0, W, 70).fill("#d4af37");
      doc.fillColor("#0b1736").fontSize(22).font("Helvetica-Bold")
        .text("AEVION", 40, 20, { lineBreak: false });
      doc.fontSize(11).font("Helvetica")
        .text("CONSTITUTION · World-System Design Lab", 40, 48, { lineBreak: false });
      doc.fontSize(9).font("Helvetica")
        .text(new Date().toLocaleDateString("en-GB"), W - 100, 28, { width: 60, align: "right" });

      // Title
      doc.fillColor("#0b1736").fontSize(20).font("Helvetica-Bold")
        .text(title, 40, 90, { width: W - 80, lineBreak: false });
      doc.fillColor("#475569").fontSize(13).font("Helvetica-Bold")
        .text(regimeName, 40, 118, { width: W - 80, lineBreak: false });
      if (regimeEra) {
        doc.fillColor("#64748b").fontSize(10).font("Helvetica-Oblique")
          .text(regimeEra, 40, 138, { width: W - 80, lineBreak: false });
      }

      // Radar chart on left
      const radarCx = 175;
      const radarCy = 320;
      const radarR = 120;
      const n = SLIDER_KEYS.length;
      const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const pointAt = (i: number, val: number) => {
        const a = angleFor(i);
        const r = (val / 100) * radarR;
        return { x: radarCx + r * Math.cos(a), y: radarCy + r * Math.sin(a) };
      };

      // Rings
      doc.strokeColor("#cbd5e1").lineWidth(0.5);
      for (const pct of [25, 50, 75, 100]) {
        const rr = (pct / 100) * radarR;
        doc.circle(radarCx, radarCy, rr).stroke();
      }
      // Axes + outer labels
      doc.fillColor("#64748b").fontSize(8).font("Helvetica");
      for (let i = 0; i < n; i++) {
        const outer = pointAt(i, 100);
        const labelP = pointAt(i, 118);
        doc.strokeColor("#cbd5e1").lineWidth(0.5).moveTo(radarCx, radarCy).lineTo(outer.x, outer.y).stroke();
        const lbl = SHORT_LABELS[SLIDER_KEYS[i]];
        // Approximate text alignment by axis direction
        const a = angleFor(i);
        const tx = labelP.x + (Math.cos(a) >= 0 ? -10 : -50);
        const ty = labelP.y - 4;
        doc.text(lbl, tx, ty, { width: 60, align: Math.cos(a) >= 0 ? "left" : "right" });
      }

      // Filled polygon
      const pts = SLIDER_KEYS.map((k, i) => pointAt(i, sliders[k]));
      doc.save();
      doc.fillColor("#22d3ee").fillOpacity(0.32);
      doc.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) doc.lineTo(pts[i].x, pts[i].y);
      doc.closePath().fill();
      doc.restore();
      doc.strokeColor("#0891b2").lineWidth(1.5);
      doc.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) doc.lineTo(pts[i].x, pts[i].y);
      doc.closePath().stroke();
      // Vertices
      for (const p of pts) {
        doc.fillColor("#0891b2").fillOpacity(1).circle(p.x, p.y, 2.5).fill();
      }

      // Metrics on right
      const mX = 350;
      let mY = 195;
      doc.fillColor("#0b1736").fontSize(13).font("Helvetica-Bold")
        .text("Six indices", mX, mY, { width: 200, lineBreak: false });
      mY += 22;
      const metricList: Array<[string, number, boolean]> = [
        ["Elite fear of the bottom", metrics.eliteFear, true],
        ["Intra-elite conflict",     metrics.intraConflict, true],
        ["Resentment from below",    metrics.resentment, true],
        ["Innovation / drive",       metrics.innovation, false],
        ["Stability",                metrics.stability, false],
        ["Legitimacy",               metrics.legitimacy, false],
      ];
      doc.fontSize(9).font("Helvetica");
      for (const [label, value, invert] of metricList) {
        doc.fillColor("#475569").text(label, mX, mY, { width: 130, lineBreak: false });
        doc.fillColor("#0b1736").font("Helvetica-Bold").text(String(value), mX + 175, mY, { width: 30, lineBreak: false });
        doc.font("Helvetica");
        // Bar
        const barX = mX;
        const barY = mY + 12;
        const barW = 200;
        doc.rect(barX, barY, barW, 4).fillColor("#e2e8f0").fill();
        const good = invert ? value < 40 : value > 60;
        const mid = invert ? value < 65 : value > 35;
        const color = good ? "#10b981" : mid ? "#f59e0b" : "#ef4444";
        doc.rect(barX, barY, (value / 100) * barW, 4).fillColor(color).fill();
        mY += 24;
      }

      // Sliders table at bottom
      const tX = 40;
      let tY = 480;
      doc.fillColor("#0b1736").fontSize(13).font("Helvetica-Bold")
        .text("Eight parameters", tX, tY, { lineBreak: false });
      tY += 22;
      doc.fontSize(9).font("Helvetica");
      const colW = (W - 80) / 4;
      let col = 0;
      for (const k of SLIDER_KEYS) {
        const cx = tX + col * colW;
        const cy = tY + Math.floor(col / 4) * 38;
        const v = sliders[k];
        doc.fillColor("#475569").font("Helvetica").text(SLIDER_LABELS_EN[k], cx, cy, { width: colW - 6, lineBreak: false });
        doc.fillColor("#0b1736").font("Helvetica-Bold").fontSize(14).text(String(v), cx, cy + 11, { width: colW - 6, lineBreak: false });
        doc.fontSize(9);
        col = (col + 1) % 4;
        if (col === 0) tY += 38;
      }
      // Second row if needed (we have 8 = 2 rows)
      tY += 38;

      // QR code bottom-right
      const qrX = W - 130;
      const qrY = H - 200;
      doc.image(qrBuf, qrX, qrY, { width: 90, height: 90 });
      doc.fillColor("#64748b").fontSize(7).font("Helvetica")
        .text("Verify", qrX, qrY + 92, { width: 90, align: "center" });

      // Signature info
      if (signature) {
        doc.fillColor("#475569").fontSize(8).font("Helvetica")
          .text("QSign HMAC-SHA256:", 40, H - 180, { lineBreak: false });
        doc.fillColor("#0b1736").font("Courier").fontSize(7)
          .text(signature.slice(0, 64) + "…", 40, H - 168, { width: 380, lineBreak: false });
        if (signedAt) {
          doc.fillColor("#64748b").font("Helvetica").fontSize(8)
            .text("Signed: " + signedAt, 40, H - 155, { lineBreak: false });
        }
      } else {
        doc.fillColor("#64748b").fontSize(8).font("Helvetica-Oblique")
          .text("Unsigned draft — sign via /api/qsign/sign for verifiable artifact.", 40, H - 168, { width: 380, lineBreak: false });
      }

      // Footer
      doc.fillColor("#94a3b8").fontSize(8).font("Helvetica")
        .text(
          "aevion.app/constitution · 8 sliders → regime classifier · North · Acemoglu · Ostrom · Taleb",
          40, H - 30,
          { width: W - 80, align: "center", lineBreak: false },
        );

      // Watermark for free tier (unsigned PDF without Pro plan)
      const { plan } = resolvePlan(req);
      const isSigned = Boolean(signature);
      if (plan === "free" && !isSigned) {
        // Diagonal watermark — Constitution Pro removes it
        doc.save();
        doc.rotate(-45, { origin: [W / 2, H / 2] });
        doc.fillColor("#d4af37").fillOpacity(0.08).fontSize(64).font("Helvetica-Bold")
          .text("FREE TIER", 60, H / 2 - 40, { width: W - 120, align: "center", lineBreak: false });
        doc.restore();
        doc.fillColor("#94a3b8").fontSize(9).font("Helvetica-Oblique").fillOpacity(0.9)
          .text(
            "Watermark-free PDF available on Constitution Pro · aevion.app/constitution/pricing",
            40, H - 50,
            { width: W - 80, align: "center", lineBreak: false },
          );
      }

      doc.end();
    } catch (err) {
      // If headers already sent, can't change to JSON
      if (!res.headersSent) {
        res.status(500).json({
          error: "pdf_failed",
          detail: err instanceof Error ? err.message : "unknown",
        });
      } else {
        res.end();
      }
    }
  },
);
