import "dotenv/config";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
export async function generateCertificatePDF(data) {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: "A4", margin: 50 });
            const chunks = [];
            doc.on("data", (chunk) => chunks.push(chunk));
            doc.on("end", () => resolve(Buffer.concat(chunks)));
            doc.on("error", reject);
            const verifyUrl = `https://aevion.kz/verify/${data.id}`;
            const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 120, margin: 1 });
            const qrBuffer = Buffer.from(qrDataUrl.split(",")[1], "base64");
            // Header border
            doc.rect(40, 40, 515, 752).lineWidth(2).strokeColor("#4f46e5").stroke();
            doc.rect(44, 44, 507, 744).lineWidth(0.5).strokeColor("#a78bfa").stroke();
            // Title
            doc.fontSize(28).fillColor("#4f46e5").font("Helvetica-Bold");
            doc.text("AEVION", 50, 65, { align: "center" });
            doc.fontSize(12).fillColor("#7c3aed").font("Helvetica");
            doc.text("INTELLECTUAL PROPERTY BUREAU", 50, 98, { align: "center" });
            doc.moveTo(80, 120).lineTo(515, 120).lineWidth(1).strokeColor("#e2e8f0").stroke();
            doc.fontSize(20).fillColor("#1e293b").font("Helvetica-Bold");
            doc.text("CERTIFICATE OF AUTHORSHIP", 50, 140, { align: "center" });
            doc.fontSize(10).fillColor("#64748b").font("Helvetica");
            doc.text("Protected by Quantum Shield Technology", 50, 168, { align: "center" });
            doc.moveTo(80, 188).lineTo(515, 188).lineWidth(0.5).strokeColor("#e2e8f0").stroke();
            let y = 205;
            doc.fontSize(10).fillColor("#64748b").font("Helvetica");
            doc.text("OBJECT TITLE", 60, y);
            y += 14;
            doc.fontSize(16).fillColor("#1e293b").font("Helvetica-Bold");
            doc.text(data.title, 60, y, { width: 400 });
            y += doc.heightOfString(data.title, { width: 400 }) + 16;
            doc.fontSize(10).fillColor("#64748b").font("Helvetica");
            doc.text("TYPE", 60, y);
            y += 14;
            doc.fontSize(12).fillColor("#1e293b").font("Helvetica-Bold");
            doc.text(data.kind.toUpperCase(), 60, y);
            y += 24;
            doc.fontSize(10).fillColor("#64748b").font("Helvetica");
            doc.text("DESCRIPTION", 60, y);
            y += 14;
            doc.fontSize(10).fillColor("#475569").font("Helvetica");
            const descText = data.description.length > 300 ? data.description.slice(0, 297) + "..." : data.description;
            doc.text(descText, 60, y, { width: 430 });
            y += doc.heightOfString(descText, { width: 430 }) + 16;
            if (data.ownerName) {
                doc.fontSize(10).fillColor("#64748b").font("Helvetica");
                doc.text("AUTHOR", 60, y);
                y += 14;
                doc.fontSize(12).fillColor("#1e293b").font("Helvetica-Bold");
                doc.text(data.ownerName, 60, y);
                y += 24;
            }
            doc.fontSize(10).fillColor("#64748b").font("Helvetica");
            doc.text("REGISTRATION DATE", 60, y);
            y += 14;
            doc.fontSize(12).fillColor("#1e293b").font("Helvetica");
            doc.text(new Date(data.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), 60, y);
            y += 28;
            doc.moveTo(60, y).lineTo(535, y).lineWidth(0.5).strokeColor("#e2e8f0").stroke();
            y += 16;
            doc.fontSize(11).fillColor("#4f46e5").font("Helvetica-Bold");
            doc.text("CRYPTOGRAPHIC PROTECTION", 60, y);
            y += 18;
            doc.fontSize(9).fillColor("#64748b").font("Helvetica");
            doc.text("Content Hash (SHA-256):", 60, y);
            y += 12;
            doc.fontSize(8).fillColor("#1e293b").font("Courier");
            doc.text(data.contentHash, 60, y, { width: 430 });
            y += 16;
            if (data.signature) {
                doc.fontSize(9).fillColor("#64748b").font("Helvetica");
                doc.text("Signature:", 60, y);
                y += 12;
                doc.fontSize(8).fillColor("#1e293b").font("Courier");
                const sigDisplay = data.signature.length > 64 ? data.signature.slice(0, 64) + "..." : data.signature;
                doc.text(sigDisplay, 60, y, { width: 430 });
                y += 16;
            }
            if (data.quantumShield) {
                doc.fontSize(9).fillColor("#7c3aed").font("Helvetica-Bold");
                doc.text("Algorithm: " + data.quantumShield.algorithm, 60, y);
                y += 14;
                doc.fontSize(9).fillColor("#64748b").font("Helvetica");
                doc.text("Quantum Shield Record: " + data.quantumShield.recordId, 60, y);
                y += 14;
                doc.text("Signed: " + new Date(data.quantumShield.timestamp).toLocaleString("en-US"), 60, y);
                y += 20;
            }
            doc.image(qrBuffer, 430, y - 80, { width: 90 });
            doc.fontSize(7).fillColor("#94a3b8").font("Helvetica");
            doc.text("Scan to verify", 430, y + 14, { width: 90, align: "center" });
            const footerY = 740;
            doc.moveTo(60, footerY).lineTo(535, footerY).lineWidth(0.5).strokeColor("#e2e8f0").stroke();
            doc.fontSize(8).fillColor("#94a3b8").font("Helvetica");
            doc.text("AEVION IP Bureau  |  Astana, Kazakhstan  |  aevion.kz", 60, footerY + 8, { align: "center", width: 475 });
            doc.text("Certificate ID: " + data.id, 60, footerY + 20, { align: "center", width: 475 });
            doc.text("This certificate is cryptographically signed and tamper-proof. Verify at aevion.kz/verify", 60, footerY + 32, { align: "center", width: 475 });
            doc.end();
        }
        catch (e) {
            reject(e);
        }
    });
}
//# sourceMappingURL=certificate-generator.js.map