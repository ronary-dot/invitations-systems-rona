"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { parseRegistration, type RegistrationErrors } from "@/lib/registration/schema";
import { rateLimit } from "@/lib/rate-limit";

// Where the RSVP comes from: the general event link or a personal invite link.
export type RsvpTarget = { slug: string } | { token: string };

export type RsvpState = {
  status: "idle" | "success";
  created?: boolean;
  attending?: boolean;
  name?: string;
  guestCount?: number;
  errors?: RegistrationErrors;
  raw?: Record<string, string>;
};

const RATE_LIMIT = { attempts: 8, windowMs: 10 * 60 * 1000 };

function rawValues(formData: FormData) {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string" && !k.startsWith("$ACTION")) out[k] = v;
  }
  return out;
}

export async function submitRsvp(target: RsvpTarget, _prev: RsvpState, formData: FormData): Promise<RsvpState> {
  const raw = rawValues(formData);

  // Honeypot: real users never fill this hidden field.
  if (formData.get("website")) return { status: "success", created: true, attending: true, name: raw.full_name, guestCount: 1 };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  if (!rateLimit(`rsvp:${ip}`, RATE_LIMIT.attempts, RATE_LIMIT.windowMs)) {
    return { status: "idle", errors: { form: "rateLimited" }, raw };
  }

  const { values, errors } = parseRegistration(formData);
  if (!values) return { status: "idle", errors: errors ?? {}, raw };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("inv_register", {
    p_slug: "slug" in target ? target.slug : null,
    p_token: "token" in target ? target.token : null,
    p_full_name: values.full_name,
    p_phone: values.phone,
    p_email: values.email,
    p_attending: values.attending,
    p_guest_count: values.guest_count,
    p_guest_names: values.guest_names,
    p_notes: values.notes,
  });

  if (error) {
    const m = error.message;
    const code = m.includes("closed") || m.includes("not_found") ? "closed" : m.includes("full") ? "full" : "generic";
    return { status: "idle", errors: { form: code }, raw };
  }

  const result = data as { id: string; created: boolean };
  return {
    status: "success",
    created: result.created,
    attending: values.attending,
    name: values.full_name,
    guestCount: values.guest_count,
    // Keep what was sent so "update my RSVP" reopens the form filled in.
    raw,
  };
}
