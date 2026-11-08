// The invitation text an event sends by email and WhatsApp. {name} and {link}
// are replaced per invitee; if the text has no {link}, the link is appended.

export type MessageLocale = "he" | "en";

export function detectLocale(text: string): MessageLocale {
  return /[֐-׿]/.test(text) ? "he" : "en";
}

export function defaultInvitationMessage(locale: MessageLocale, eventTitle: string) {
  return locale === "he"
    ? `שלום {name},\nנשמח לראותך ב${eventTitle}!\nלפרטים ולאישור הגעה: {link}`
    : `Hi {name},\nWe'd love to see you at ${eventTitle}!\nDetails and RSVP: {link}`;
}

export function fillMessage(template: string, vars: { name: string; link: string }) {
  const hasLink = template.includes("{link}");
  const filled = template.replaceAll("{name}", vars.name).replaceAll("{link}", vars.link);
  return hasLink ? filled : `${filled.trimEnd()}\n${vars.link}`;
}

export function invitationText(
  event: { title: string; invitation_message: string | null },
  vars: { name: string; link: string },
) {
  const template = event.invitation_message?.trim() || defaultInvitationMessage(detectLocale(event.title), event.title);
  return fillMessage(template, vars);
}

export function whatsappUrl(phoneE164: string, text: string) {
  return `https://wa.me/${phoneE164.replace(/^\+/, "")}?text=${encodeURIComponent(text)}`;
}

// Gmail allows ~500 messages a day; one server call sends a small batch so the
// request stays short and the screen can show progress.
export const EMAIL_BATCH_SIZE = 10;
