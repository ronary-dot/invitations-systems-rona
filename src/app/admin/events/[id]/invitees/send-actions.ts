"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getInviteUrl, getPublicEventUrl } from "@/lib/site";
import { buildInvitationEmail } from "@/lib/email/invitation";
import { hasEmailEnv } from "@/lib/email/transport";
import { logMessages, sendEmail } from "@/lib/email/send";
import { EMAIL_BATCH_SIZE } from "@/lib/invitations/message";


export type EmailBatchResult = {
  sent: number;
  failed: { name: string; error: string }[];
  skipped: number; // no email address
  fatal?: "notConfigured" | "eventNotFound";
};

const EVENT_COLUMNS = "id, slug, title, date_time, venue_name, address, primary_color, media_url, invitation_message";

async function markSent(supabase: Awaited<ReturnType<typeof createClient>>, ids: string[]) {
  if (ids.length === 0) return;
  const now = new Date().toISOString();
  await supabase.from("inv_invitees").update({ status: "sent" }).in("id", ids).eq("status", "pending");
  await supabase.from("inv_invitees").update({ first_sent_at: now }).in("id", ids).is("first_sent_at", null);
  await supabase.from("inv_invitees").update({ last_sent_at: now }).in("id", ids);
}

export async function sendInvitationEmails(eventId: string, inviteeIds: string[]): Promise<EmailBatchResult> {
  const staff = await requireStaff();
  const result: EmailBatchResult = { sent: 0, failed: [], skipped: 0 };
  if (!hasEmailEnv() && process.env.EMAIL_DRY_RUN !== "1") return { ...result, fatal: "notConfigured" };

  const supabase = await createClient();
  const { data: event } = await supabase.from("inv_events").select(EVENT_COLUMNS).eq("id", eventId).maybeSingle();
  if (!event) return { ...result, fatal: "eventNotFound" };

  const { data: invitees } = await supabase
    .from("inv_invitees")
    .select("id, full_name, email, token")
    .eq("event_id", eventId)
    .in("id", inviteeIds.slice(0, EMAIL_BATCH_SIZE));

  const sentIds: string[] = [];
  const log = [];
  for (const inv of invitees ?? []) {
    if (!inv.email) {
      result.skipped += 1;
      continue;
    }
    const { subject, html, text } = buildInvitationEmail({ event, name: inv.full_name, link: getInviteUrl(inv.token) });
    const r = await sendEmail(inv.email, subject, html, text);
    log.push({
      event_id: eventId,
      invitee_id: inv.id,
      channel: "email" as const,
      kind: "invitation" as const,
      to_address: inv.email,
      status: r.ok ? ("sent" as const) : ("failed" as const),
      error: r.ok ? null : r.error.slice(0, 500),
      created_by: staff.id,
    });
    if (r.ok) {
      result.sent += 1;
      sentIds.push(inv.id);
    } else {
      result.failed.push({ name: inv.full_name, error: r.error });
    }
  }

  await logMessages(supabase, log);
  await markSent(supabase, sentIds);
  revalidatePath(`/admin/events/${eventId}/invitees`);
  revalidatePath(`/admin/events/${eventId}`);
  return result;
}

// Sends the invitation to the logged-in staff member, with the general link
// (or a note when it is closed), so they can see exactly what guests get.
export async function sendTestInvitation(eventId: string): Promise<{ ok: boolean; to?: string; error?: string }> {
  const staff = await requireStaff();
  if (!hasEmailEnv() && process.env.EMAIL_DRY_RUN !== "1") return { ok: false, error: "notConfigured" };
  const supabase = await createClient();
  const { data: event } = await supabase.from("inv_events").select(EVENT_COLUMNS).eq("id", eventId).maybeSingle();
  if (!event || !staff.email) return { ok: false, error: "eventNotFound" };

  const name = staff.displayName ?? staff.email;
  const { subject, html, text } = buildInvitationEmail({ event, name, link: getPublicEventUrl(event.slug) });
  const r = await sendEmail(staff.email, `[TEST] ${subject}`, html, text);
  await logMessages(supabase, [
    {
      event_id: eventId,
      channel: "email",
      kind: "test",
      to_address: staff.email,
      status: r.ok ? "sent" : "failed",
      error: r.ok ? null : r.error.slice(0, 500),
      created_by: staff.id,
    },
  ]);
  revalidatePath(`/admin/events/${eventId}/invitees`);
  return r.ok ? { ok: true, to: staff.email } : { ok: false, error: r.error };
}

// WhatsApp goes through wa.me in the staff member's own WhatsApp, so the
// system cannot confirm delivery. Clicking the button records it as sent.
export async function markWhatsappSent(eventId: string, inviteeId: string) {
  const staff = await requireStaff();
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from("inv_invitees")
    .select("id, phone")
    .eq("id", inviteeId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!inv?.phone) return;
  await logMessages(supabase, [
    {
      event_id: eventId,
      invitee_id: inv.id,
      channel: "whatsapp",
      kind: "invitation",
      to_address: inv.phone,
      status: "sent",
      created_by: staff.id,
    },
  ]);
  await markSent(supabase, [inv.id]);
  revalidatePath(`/admin/events/${eventId}/invitees`);
  revalidatePath(`/admin/events/${eventId}`);
}
