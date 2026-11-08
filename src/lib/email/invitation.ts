import { formatEventDate, formatEventTime } from "@/lib/dates";
import { eventLocation } from "@/lib/calendar";
import { detectLocale, invitationText } from "@/lib/invitations/message";
import type { EventRow } from "@/lib/types/database";

type EventLike = Pick<
  EventRow,
  "title" | "date_time" | "venue_name" | "address" | "primary_color" | "media_url" | "invitation_message"
>;

const STRINGS = {
  he: { subject: (t: string) => `הזמנה: ${t}`, when: "מתי", where: "איפה", cta: "לפרטים ולאישור הגעה", footer: "קיבלת את המייל הזה כי הוזמנת לאירוע. הקישור אישי, נא לא להעביר אותו." },
  en: { subject: (t: string) => `Invitation: ${t}`, when: "When", where: "Where", cta: "Details and RSVP", footer: "You received this email because you were invited. The link is personal, please don't forward it." },
};

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Email body = the event's invitation text (with the link turned into a
// button) + date/venue + image. Plain-text part is the same message.
export function buildInvitationEmail({ event, name, link }: { event: EventLike; name: string; link: string }) {
  const locale = detectLocale(event.title + (event.invitation_message ?? ""));
  const s = STRINGS[locale];
  const dir = locale === "he" ? "rtl" : "ltr";
  const align = locale === "he" ? "right" : "left";
  const accent = event.primary_color ?? "#b08d57";
  const when = `${formatEventDate(event.date_time, locale)}, ${formatEventTime(event.date_time)}`;
  const where = eventLocation(event);
  const subject = s.subject(event.title);

  const text = invitationText(event, { name, link });
  // The link stays where the text puts it, as a clickable link; the button
  // below repeats it for a bigger tap target.
  const linkHtml = `<a href="${escapeHtml(link)}" style="color:${accent};word-break:break-all;">${escapeHtml(link)}</a>`;
  const bodyHtml = escapeHtml(invitationText(event, { name, link: "\u0000" }))
    .replace(/\u0000/g, linkHtml)
    .split("\n")
    .join("<br>");

  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head>
<body dir="${dir}" style="margin:0;padding:0;background:#f6f6f4;font-family:Heebo,Arial,Helvetica,sans-serif;color:#1c1917;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" dir="${dir}" style="background:#f6f6f4;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" dir="${dir}" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
${event.media_url ? `<tr><td><img src="${escapeHtml(event.media_url)}" alt="" width="560" style="display:block;width:100%;height:auto;"></td></tr>` : ""}
<tr><td style="padding:28px 28px 8px;text-align:${align};" dir="${dir}">
  <div style="height:4px;width:48px;background:${accent};border-radius:2px;margin-bottom:16px;"></div>
  <h1 style="margin:0 0 16px;font-size:26px;line-height:1.3;">${escapeHtml(event.title)}</h1>
  <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">${bodyHtml}</p>
</td></tr>
<tr><td style="padding:0 28px;" dir="${dir}">
  <table role="presentation" cellspacing="0" cellpadding="0" dir="${dir}" style="font-size:15px;line-height:1.6;">
    <tr><td style="color:#78716c;padding:2px 0;${locale === "he" ? "padding-left:12px" : "padding-right:12px"};" align="${align}">${s.when}</td><td align="${align}">${escapeHtml(when)}</td></tr>
    ${where ? `<tr><td style="color:#78716c;padding:2px 0;${locale === "he" ? "padding-left:12px" : "padding-right:12px"};" align="${align}">${s.where}</td><td align="${align}">${escapeHtml(where)}</td></tr>` : ""}
  </table>
</td></tr>
<tr><td style="padding:24px;" align="center">
  <a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:600;font-size:16px;background:${accent};color:#ffffff;">${s.cta}</a>
</td></tr>
<tr><td style="padding:0 28px 28px;font-size:12px;color:#a8a29e;text-align:${align};" dir="${dir}">${s.footer}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, html, text };
}
