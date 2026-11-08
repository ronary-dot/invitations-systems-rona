import { normalizePhone } from "@/lib/phone";

export const MAX_EXPECTED_GUESTS = 50;
export const INVITEE_FIELDS = ["full_name", "phone", "email", "group_name", "expected_guests"] as const;
export type InviteeField = (typeof INVITEE_FIELDS)[number];

export type InviteeInput = Partial<Record<InviteeField, string>>;
export type InviteeValues = {
  full_name: string;
  phone: string | null;
  email: string | null;
  group_name: string | null;
  expected_guests: number;
};
export type InviteeErrors = Partial<Record<InviteeField | "form", string>>;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Shared by the add/edit form and the spreadsheet import.
export function parseInvitee(input: InviteeInput): { values: InviteeValues; errors: null } | { values: null; errors: InviteeErrors } {
  const errors: InviteeErrors = {};
  const full_name = (input.full_name ?? "").trim().replace(/\s+/g, " ");
  if (!full_name) errors.full_name = "nameRequired";
  else if (full_name.length > 120) errors.full_name = "tooLong";

  const phoneRaw = (input.phone ?? "").trim();
  let phone: string | null = null;
  if (phoneRaw) {
    phone = normalizePhone(phoneRaw);
    if (!phone) errors.phone = "phoneInvalid";
  }

  const emailRaw = (input.email ?? "").trim().toLowerCase();
  const email = emailRaw || null;
  if (email && !EMAIL.test(email)) errors.email = "emailInvalid";

  if (!phoneRaw && !emailRaw) errors.phone = "phoneOrEmail";

  const group = (input.group_name ?? "").trim();
  if (group.length > 60) errors.group_name = "tooLong";

  const countRaw = (input.expected_guests ?? "").trim();
  const expected_guests = countRaw === "" ? 1 : Number(countRaw);
  if (!Number.isInteger(expected_guests) || expected_guests < 1 || expected_guests > MAX_EXPECTED_GUESTS) {
    errors.expected_guests = "guestCountInvalid";
  }

  if (Object.keys(errors).length > 0) return { values: null, errors };
  return { values: { full_name, phone, email, group_name: group || null, expected_guests }, errors: null };
}

// Guess which spreadsheet column holds which field, from the header text.
const HEADER_HINTS: Record<InviteeField, RegExp> = {
  full_name: /^(שם|שם מלא|שם המוזמן|מוזמן|name|full ?name|guest)$/i,
  phone: /(טלפון|נייד|פלאפון|סלולרי|phone|mobile|cell|tel)/i,
  email: /(מייל|אימייל|דוא"?ל|e-?mail)/i,
  group_name: /(קבוצה|צד|קטגוריה|group|side|category)/i,
  expected_guests: /(כמות|מספר|מוזמנים|אורחים|guests|count|qty|quantity|people)/i,
};

export function guessMapping(headers: string[]): Partial<Record<InviteeField, number>> {
  const mapping: Partial<Record<InviteeField, number>> = {};
  const used = new Set<number>();
  for (const field of INVITEE_FIELDS) {
    const idx = headers.findIndex((h, i) => !used.has(i) && HEADER_HINTS[field].test(h.trim()));
    if (idx >= 0) {
      mapping[field] = idx;
      used.add(idx);
    }
  }
  // Fallback: a loose "name" match (e.g. "שם פרטי ומשפחה").
  if (mapping.full_name == null) {
    const idx = headers.findIndex((h, i) => !used.has(i) && /(שם|name)/i.test(h));
    if (idx >= 0) mapping.full_name = idx;
  }
  return mapping;
}
