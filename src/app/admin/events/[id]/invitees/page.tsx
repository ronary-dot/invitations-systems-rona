import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getInviteUrl } from "@/lib/site";
import { formatPhoneForDisplay } from "@/lib/phone";
import { InviteesManager, type InviteeItem } from "@/components/invitees/InviteesManager";

export async function generateMetadata() {
  const t = await getTranslations("invitees");
  return { title: t("title") };
}

export default async function InviteesPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const t = await getTranslations("invitees");
  const supabase = await createClient();

  const [{ data: event }, { data: rows }] = await Promise.all([
    supabase.from("inv_events").select("id, title").eq("id", id).maybeSingle(),
    supabase
      .from("inv_invitees")
      .select("*, inv_registrations(attending, guest_count)")
      .eq("event_id", id)
      .order("created_at", { ascending: true }),
  ]);
  if (!event) notFound();

  const items: InviteeItem[] = (rows ?? []).map((r) => {
    const reg = r.inv_registrations[0];
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
      inviteUrl: getInviteUrl(r.token),
    };
  });

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href={`/admin/events/${id}`} className="text-sm text-muted hover:text-foreground">
          ← {event.title}
        </Link>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
      </div>
      <InviteesManager eventId={id} items={items} />
    </>
  );
}
