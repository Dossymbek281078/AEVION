import { renderCertCard, CARD_SIZE } from "@/app/bureau/og/certCard";

/**
 * Картинка предпросмотра для страницы сертификата. Сама отрисовка — в общем
 * модуле: тот же файл обслуживает /verify/<id>, и вторая копия разошлась бы
 * с первой при первой правке.
 */
export const runtime = "edge";
export const alt = "AEVION Bureau certificate";
export const size = CARD_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ certId: string }> }) {
  const { certId } = await params;
  return renderCertCard(certId);
}
