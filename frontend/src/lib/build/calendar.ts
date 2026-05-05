// Generate calendar links / .ics text for an interview slot. Pure client-side —
// no third-party deps. Used by ChatUI's "Schedule interview" composer.

export type InterviewDraft = {
  title: string;
  startsAt: Date;
  durationMinutes: number;
  description?: string;
  location?: string; // e.g. "Zoom: <url>" or "AEVION Tower 7, Astana"
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function fmtUtc(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

export function googleCalendarLink(d: InterviewDraft): string {
  const end = new Date(d.startsAt.getTime() + d.durationMinutes * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: d.title,
    dates: `${fmtUtc(d.startsAt)}/${fmtUtc(end)}`,
  });
  if (d.description) params.set("details", d.description);
  if (d.location) params.set("location", d.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarLink(d: InterviewDraft): string {
  const end = new Date(d.startsAt.getTime() + d.durationMinutes * 60_000);
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: d.title,
    startdt: d.startsAt.toISOString(),
    enddt: end.toISOString(),
  });
  if (d.description) params.set("body", d.description);
  if (d.location) params.set("location", d.location);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function icsBlob(d: InterviewDraft): Blob {
  const end = new Date(d.startsAt.getTime() + d.durationMinutes * 60_000);
  const uid = `${Date.now()}@aevion.tech`;
  const escape = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AEVION//QBuild//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${fmtUtc(new Date())}`,
    `DTSTART:${fmtUtc(d.startsAt)}`,
    `DTEND:${fmtUtc(end)}`,
    `SUMMARY:${escape(d.title)}`,
  ];
  if (d.description) lines.push(`DESCRIPTION:${escape(d.description)}`);
  if (d.location) lines.push(`LOCATION:${escape(d.location)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
}

// Pretty plain-text snippet to drop into a chat message.
export function interviewBlurb(d: InterviewDraft, links: { google: string; outlook: string }): string {
  const local = d.startsAt.toLocaleString();
  const lines = [
    `📅 ${d.title}`,
    `When: ${local} (${d.durationMinutes} min)`,
  ];
  if (d.location) lines.push(`Where: ${d.location}`);
  lines.push("", `Add to calendar:`, `Google: ${links.google}`, `Outlook: ${links.outlook}`);
  return lines.join("\n");
}
