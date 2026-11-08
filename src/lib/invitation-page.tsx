import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { getRsvpStatus, type PublicEvent } from "@/lib/public-event";
import { googleCalendarUrl, googleMapsUrl, wazeUrl } from "@/lib/calendar";
import { getPublicEventUrl } from "@/lib/site";
import { formatEventDate, formatEventTime } from "@/lib/dates";
import { getTemplate } from "@/templates/registry";
import { renderTemplate } from "@/templates/components";
import { RsvpForm, type RsvpInitial } from "@/components/rsvp/RsvpForm";
import type { RsvpTarget } from "@/components/rsvp/actions";

export async function eventMetadata(event: PublicEvent, url: string): Promise<Metadata> {
  const t = await getTranslations("invite");
  const locale = await getLocale();
  const when = `${formatEventDate(event.date_time, locale)}, ${formatEventTime(event.date_time)}`;
  const where = [event.venue_name, event.address].filter(Boolean).join(", ");
  const description = event.description?.trim() || [when, where].filter(Boolean).join(" · ");
  // A generated share image arrives in stage 7; the uploaded media works for now.
  const images = event.media_url ? [{ url: event.media_url, alt: event.title }] : undefined;
  return {
    title: { absolute: event.title },
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title: event.title,
      description,
      url,
      type: "website",
      locale: locale === "he" ? "he_IL" : "en_US",
      siteName: t("shareSiteName"),
      images,
    },
  };
}

// Shared by the general link and (stage 3) the personal invite link.
export async function renderInvitation(
  event: PublicEvent,
  target: RsvpTarget,
  initial?: RsvpInitial,
  before?: React.ReactNode,
) {
  const locale = await getLocale();
  const t = await getTranslations("invite.rsvp");
  const template = getTemplate(event.template_id);
  const accent = event.primary_color ?? template.palette.accent;

  const status = getRsvpStatus(event);
  const form =
    status === "open" ? (
      <RsvpForm target={target} accent={accent} initial={initial} />
    ) : (
      <p className="text-center text-lg" role="status">
        {t(status === "full" ? "closedFull" : status === "event_passed" ? "closedPassed" : "closedDeadline")}
      </p>
    );
  const rsvp = before ? (
    <div className="flex flex-col gap-5">
      {before}
      {form}
    </div>
  ) : (
    form
  );

  return renderTemplate(event.template_id, {
    event,
    locale,
    links: {
      waze: wazeUrl(event),
      googleMaps: googleMapsUrl(event),
      googleCalendar: googleCalendarUrl(event, getPublicEventUrl(event.slug)),
      ics: `/e/${event.slug}/calendar.ics`,
    },
    rsvp,
  });
}
