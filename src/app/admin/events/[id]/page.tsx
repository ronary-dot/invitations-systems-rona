import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { buttonLinkClass } from "@/components/ui/Button";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { DeleteEventButton } from "@/components/DeleteEventButton";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatEventDate, formatEventTime } from "@/lib/dates";
import { getPublicEventUrl } from "@/lib/site";
import { getTemplate } from "@/templates/registry";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const t = await getTranslations();
  const locale = await getLocale();
  const supabase = await createClient();

  const [{ data: event }, { data: invitees }, { data: regs }] = await Promise.all([
    supabase.from("inv_events").select("*").eq("id", id).maybeSingle(),
    supabase.from("inv_invitees").select("status").eq("event_id", id),
    supabase.from("inv_registrations").select("attending, guest_count").eq("event_id", id),
  ]);
  if (!event) notFound();

  const inviteeRows = invitees ?? [];
  const regRows = regs ?? [];
  const sent = inviteeRows.filter((i) => i.status !== "pending").length;
  const attending = regRows.filter((r) => r.attending);
  const declined = regRows.length - attending.length;
  const guests = attending.reduce((s, r) => s + r.guest_count, 0);
  const publicUrl = getPublicEventUrl(event.slug);
  const template = getTemplate(event.template_id);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            {event.title}
            {!event.is_active && (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-normal text-muted">
                {t("admin.inactive")}
              </span>
            )}
          </h1>
          <p className="text-muted">
            {formatEventDate(event.date_time, locale)}, <span dir="ltr">{formatEventTime(event.date_time)}</span>
            {event.venue_name ? ` · ${event.venue_name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/events/${id}/edit`} className={buttonLinkClass("secondary")}>
            {t("admin.editEvent")}
          </Link>
          <DeleteEventButton id={id} title={event.title} />
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label={t("admin.stats.invitees")} value={inviteeRows.length} />
        <Stat label={t("admin.stats.sent")} value={sent} />
        <Stat label={t("admin.stats.attending")} value={`${attending.length} (${guests})`} />
        <Stat label={t("admin.stats.declined")} value={declined} />
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">{t("invitees.title")}</h2>
          <p className="text-sm text-muted">{t("admin.inviteesHelp")}</p>
        </div>
        <Link href={`/admin/events/${id}/invitees`} className={buttonLinkClass("primary")}>
          {t("admin.manageInvitees")}
        </Link>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-white p-5">
        <h2 className="font-semibold">{t("admin.publicLink")}</h2>
        {event.allow_public_link ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <code dir="ltr" className="flex-1 overflow-x-auto rounded-lg bg-stone-50 px-3 py-2 text-sm">
              {publicUrl}
            </code>
            <div className="flex gap-2">
              <CopyLinkButton url={publicUrl} />
              <a href={publicUrl} target="_blank" rel="noreferrer" className={buttonLinkClass("secondary")}>
                {t("admin.openPublicPage")}
              </a>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">{t("admin.publicLinkClosed")}</p>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-white p-5">
        <h2 className="font-semibold">{t("admin.details")}</h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          <Row label={t("eventForm.eventType")} value={t(event.event_type === "private" ? "eventForm.typePrivate" : "eventForm.typeBusiness")} />
          <Row label={t("eventForm.template")} value={t(`templates.names.${template.nameKey}` as never)} />
          {event.address && <Row label={t("eventForm.address")} value={event.address} />}
          {event.description && <Row label={t("eventForm.description")} value={event.description} />}
          {event.invitation_message && <Row label={t("eventForm.invitationMessage")} value={event.invitation_message} />}
          {event.gift_link_url && (
            <Row label={t("eventForm.giftLink")} value={<a dir="ltr" className="text-accent underline" href={event.gift_link_url}>{event.gift_link_url}</a>} />
          )}
          <Row label={t("eventForm.reminderOffset")} value={t("eventForm.reminderHours", { count: event.reminder_offset_hours })} />
          {event.rsvp_deadline && (
            <Row label={t("eventForm.rsvpDeadline")} value={<>{formatEventDate(event.rsvp_deadline, locale)}, <span dir="ltr">{formatEventTime(event.rsvp_deadline)}</span></>} />
          )}
          {event.max_guests && <Row label={t("eventForm.maxGuests")} value={event.max_guests} />}
        </dl>
        {event.media_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.media_url} alt="" className="mt-2 max-h-56 w-auto self-start rounded-lg border border-border" />
        )}
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="whitespace-pre-line">{value}</dd>
    </>
  );
}
