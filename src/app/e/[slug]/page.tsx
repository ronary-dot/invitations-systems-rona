import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicEvent } from "@/lib/public-event";
import { getPublicEventUrl } from "@/lib/site";
import { eventMetadata, renderInvitation } from "@/lib/invitation-page";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) return {};
  return eventMetadata(event, getPublicEventUrl(event.slug));
}

export default async function PublicEventPage({ params }: Props) {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) notFound();
  return renderInvitation(event, { slug: event.slug });
}
