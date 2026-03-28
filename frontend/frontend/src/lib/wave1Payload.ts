/** QSign/Bureau payload: ключи в фиксированном порядке (как в bureau payloadForObject). */
export function qrightObjectToSignPayload(o: {
  id: string;
  title: string;
  contentHash: string;
  country?: string;
  city?: string;
}) {
  return JSON.stringify({
    objectId: o.id,
    title: o.title,
    contentHash: o.contentHash,
    country: o.country || null,
    city: o.city || null,
  });
}

export function qsignUrlForQRightObject(o: Parameters<typeof qrightObjectToSignPayload>[0]) {
  return `/qsign?payload=${encodeURIComponent(qrightObjectToSignPayload(o))}`;
}

export function bureauUrlFocusObject(
  o: { id: string; country?: string; city?: string },
  extra?: { country?: string; city?: string },
) {
  const qs = new URLSearchParams();
  const c = o.country || extra?.country;
  const ci = o.city || extra?.city;
  if (c) qs.set("country", c);
  if (ci) qs.set("city", ci);
  qs.set("focus", o.id);
  const q = qs.toString();
  return `/bureau${q ? `?${q}` : ""}`;
}
