import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getInviteUrl } from "@/lib/site";
import { formatPhoneForDisplay } from "@/lib/phone";
import { InviteesManager, type InviteeItem } from "@/components/invitees/InviteesManager";
import { MessageLog, type MessageLogItem } from "@/components/invitees/MessageLog";
import { invitationText, whatsappUrl } from "@/lib/invitations/message";
import { hasEmailEnv } from "@/lib/email/transport";
import { EVENT_TIME_ZONE } from "@/lib/dates";

export async function generateMetadata() {
  const t = await getTranslations("invitees");
  return { title: t("title") };
}

export default async function InviteesPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const t = await getTranslations("invitees");
  const supabase = await createClient();

  const locale = await getLocale();
  const [{ data: event }, { data: rows }, { data: logRows }] = await Promise.all([
    supabase.from("inv_events").select("id, title, invitation_message").eq("id", id).maybeSingle(),
    supabase
      .from("inv_invitees")
      .select("*, inv_registrations(attending, guest_count)")
      .eq("event_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("inv_message_log")
      .select("id, channel, kind, to_address, status, error, created_at, invitee_id")
      .eq("event_id", id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  if (!event) notFound();

  const items: InviteeItem[] = (rows ?? []).map((r) => {
    const reg = r.inv_registrations[0];
    const inviteUrl = getInviteUrl(r.token);
    const messageText = invitationText(event, { name: r.full_name, link: inviteUrl });
    return {
      id: r.id,
      full_name: r.full_name,
      phone: r.phone,
      phoneDisplay: r.phone ? formatPhoneForDisplay(r.phone) : "",
      email: r.email,
      group_name: r.group_name,
      expected_guests: r.expected_guests,
      status: r.status,
      attendingGuests: reg?.attending ? reg.guest_count : null,
      inviteUrl,
      messageText,
      whatsappUrl: r.phone ? whatsappUrl(r.phone, messageText) : null,
    };
  });

  const fmt = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", {
    timeZone: EVENT_TIME_ZONE,
    dateStyle: "short",
    timeStyle: "short",
  });
  const nameById = new Map(items.map((i) => [i.id, i.full_name]));
  const log: MessageLogItem[] = (logRows ?? []).map((l) => ({
    id: l.id,
    channel: l.channel,
    kind: l.kind,
    to: l.to_address,
    name: l.invitee_id ? (nameById.get(l.invitee_id) ?? null) : null,
    status: l.status,
    error: l.error,
    at: fmt.format(new Date(l.created_at)),
  }));

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href={`/admin/events/${id}`} className="text-sm text-muted hover:text-foreground">
          ← {event.title}
        </Link>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
      </div>
      <InviteesManager eventId={id} items={items} emailConfigured={hasEmailEnv() || process.env.EMAIL_DRY_RUN === "1"} />
      <MessageLog items={log} />
    </>
  );
}
