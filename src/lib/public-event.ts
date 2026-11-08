import { createClient } from "@/lib/supabase/server";
import type { EventType } from "@/lib/types/database";

export type PublicEvent = {
  id: string;
  slug: string;
  title: string;
  event_type: EventType;
  description: string | null;
  date_time: string;
  venue_name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  template_id: string;
  media_url: string | null;
  primary_color: string | null;
  gift_link_url: string | null;
  rsvp_deadline: string | null;
  max_guests: number | null;
  allow_public_link: boolean;
  updated_at: string | null;
  attending_guests: number;
};

export async function getPublicEvent(slug: string): Promise<PublicEvent | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("inv_public_event", { p_slug: slug });
  if (error || !data) return null;
  return data as unknown as PublicEvent;
}

export type RsvpStatus = "open" | "deadline_passed" | "event_passed" | "full";

export function getRsvpStatus(event: PublicEvent, now = Date.now()): RsvpStatus {
  if (new Date(event.date_time).getTime() < now) return "event_passed";
  if (event.rsvp_deadline && new Date(event.rsvp_deadline).getTime() < now) return "deadline_passed";
  if (event.max_guests != null && event.attending_guests >= event.max_guests) return "full";
  return "open";
}

export type PersonalInvite = {
  event: PublicEvent;
  invitee: { full_name: string; phone: string | null; email: string | null; expected_guests: number };
  registration: {
    full_name: string;
    phone: string;
    email: string | null;
    attending: boolean;
    guest_count: number;
    guest_names: string[];
    notes: string | null;
  } | null;
};

export async function getPersonalInvite(token: string): Promise<PersonalInvite | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("inv_invite", { p_token: token });
  if (error || !data) return null;
  return data as unknown as PersonalInvite;
}
