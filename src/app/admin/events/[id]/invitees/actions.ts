"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { INVITEE_FIELDS, guessMapping, parseInvitee, type InviteeErrors, type InviteeField, type InviteeInput } from "@/lib/invitees/schema";
import { MAX_IMPORT_BYTES, readSpreadsheet } from "@/lib/invitees/spreadsheet";

export type InviteeFormState = { ok?: boolean; errors?: InviteeErrors; raw?: InviteeInput };

function formInput(formData: FormData): InviteeInput {
  const out: InviteeInput = {};
  for (const f of INVITEE_FIELDS) out[f] = String(formData.get(f) ?? "");
  return out;
}

function revalidate(eventId: string) {
  revalidatePath(`/admin/events/${eventId}/invitees`);
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin");
}

const isUnique = (e: { code?: string } | null) => e?.code === "23505";

export async function saveInvitee(
  eventId: string,
  inviteeId: string | null,
  _prev: InviteeFormState,
  formData: FormData,
): Promise<InviteeFormState> {
  await requireStaff();
  const raw = formInput(formData);
  const parsed = parseInvitee(raw);
  if (!parsed.values) return { errors: parsed.errors, raw };

  const supabase = await createClient();
  const { error } = inviteeId
    ? await supabase.from("inv_invitees").update(parsed.values).eq("id", inviteeId).eq("event_id", eventId)
    : await supabase.from("inv_invitees").insert({ ...parsed.values, event_id: eventId });
  if (error) return { errors: { form: isUnique(error) ? "phoneTaken" : "saveFailed" }, raw };

  revalidate(eventId);
  return { ok: true };
}

export async function deleteInvitees(eventId: string, ids: string[]) {
  await requireStaff();
  if (ids.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase.from("inv_invitees").delete().eq("event_id", eventId).in("id", ids);
  if (error) throw new Error("deleteFailed");
  revalidate(eventId);
}

// ---------- import ----------

export type ImportPreview =
  | { ok: true; headers: string[]; rows: string[][]; mapping: Partial<Record<InviteeField, number>> }
  | { ok: false; error: "noFile" | "tooBig" | "unreadable" | "empty" };

export async function previewImport(formData: FormData): Promise<ImportPreview> {
  await requireStaff();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "noFile" };
  if (file.size > MAX_IMPORT_BYTES) return { ok: false, error: "tooBig" };
  try {
    const sheet = await readSpreadsheet(file);
    if (sheet.rows.length === 0) return { ok: false, error: "empty" };
    return { ok: true, ...sheet, mapping: guessMapping(sheet.headers) };
  } catch {
    return { ok: false, error: "unreadable" };
  }
}

export type ImportResult = {
  added: number;
  updated: number;
  failed: { row: number; name: string; error: string }[];
};

// Rows come back from the client already mapped to fields. Existing invitees
// (same phone, or same email when there is no phone) are updated, not duplicated.
export async function commitImport(eventId: string, rows: InviteeInput[]): Promise<ImportResult> {
  await requireStaff();
  const supabase = await createClient();
  const result: ImportResult = { added: 0, updated: 0, failed: [] };

  const { data: existing } = await supabase.from("inv_invitees").select("id, phone, email").eq("event_id", eventId);
  const byPhone = new Map<string, string>();
  const byEmail = new Map<string, string>();
  for (const e of existing ?? []) {
    if (e.phone) byPhone.set(e.phone, e.id);
    else if (e.email) byEmail.set(e.email, e.id);
  }

  const toInsert: Array<ReturnType<typeof parseInvitee>["values"] & object> = [];
  const toUpdate: Array<{ id: string; values: NonNullable<ReturnType<typeof parseInvitee>["values"]> }> = [];
  const seen = new Set<string>();

  rows.slice(0, 2000).forEach((input, i) => {
    const parsed = parseInvitee(input);
    if (!parsed.values) {
      result.failed.push({ row: i + 2, name: input.full_name ?? "", error: Object.values(parsed.errors)[0] ?? "invalid" });
      return;
    }
    const v = parsed.values;
    const key = v.phone ? `p:${v.phone}` : `e:${v.email}`;
    if (seen.has(key)) {
      result.failed.push({ row: i + 2, name: v.full_name, error: "duplicateInFile" });
      return;
    }
    seen.add(key);
    const id = v.phone ? byPhone.get(v.phone) : v.email ? byEmail.get(v.email) : undefined;
    if (id) toUpdate.push({ id, values: v });
    else toInsert.push(v);
  });

  for (let i = 0; i < toInsert.length; i += 500) {
    const chunk = toInsert.slice(i, i + 500).map((v) => ({ ...v, event_id: eventId }));
    const { error } = await supabase.from("inv_invitees").insert(chunk);
    if (error) {
      for (const v of chunk) result.failed.push({ row: 0, name: v.full_name, error: "saveFailed" });
    } else result.added += chunk.length;
  }
  for (const u of toUpdate) {
    const { error } = await supabase.from("inv_invitees").update(u.values).eq("id", u.id);
    if (error) result.failed.push({ row: 0, name: u.values.full_name, error: "saveFailed" });
    else result.updated += 1;
  }

  revalidate(eventId);
  return result;
}
