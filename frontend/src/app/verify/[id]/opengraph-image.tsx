import { renderCertCard, CARD_SIZE } from "@/app/bureau/og/certCard";

/**
 * `/verify/<id>` — адрес из QR-кода КАЖДОГО сертификата и то, что автор
 * пересылает, доказывая авторство. До 29.08.2026 карточка этой ссылки была без
 * картинки вовсе; теперь она та же, что у страницы сертификата, — общий модуль,
 * а не копия.
 */
export const runtime = "edge";
export const alt = "AEVION certificate";
export const size = CARD_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderCertCard(id);
}
