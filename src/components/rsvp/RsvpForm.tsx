"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { submitRsvp, type RsvpState, type RsvpTarget } from "./actions";
import { MAX_GUESTS_PER_REGISTRATION } from "@/lib/registration/schema";

const control =
  "w-full rounded-lg border border-current/20 bg-white/90 px-3 py-3 text-base text-[#1c1917] placeholder:text-[#1c1917]/40 focus:outline-none focus:ring-2 focus:ring-[var(--tpl-accent,#0f766e)]/40 aria-[invalid=true]:border-red-500";

export type RsvpInitial = {
  full_name?: string;
  phone?: string;
  email?: string;
  attending?: boolean;
  guest_count?: number;
  guest_names?: string[];
  notes?: string;
};

export function RsvpForm({ target, accent, initial = {} }: { target: RsvpTarget; accent: string; initial?: RsvpInitial }) {
  const t = useTranslations("invite.rsvp");
  const action = submitRsvp.bind(null, target);
  const [state, formAction, pending] = useActionState<RsvpState, FormData>(action, { status: "idle" });
  const raw = state.raw;
  const d = {
    full_name: raw?.full_name ?? initial.full_name ?? "",
    phone: raw?.phone ?? initial.phone ?? "",
    email: raw?.email ?? initial.email ?? "",
    notes: raw?.notes ?? initial.notes ?? "",
    guestName: (i: number) => raw?.[`guest_name_${i}`] ?? initial.guest_names?.[i] ?? "",
  };
  const [attending, setAttending] = useState<"yes" | "no" | "">(
    (raw?.attending as "yes" | "no" | undefined) ?? (initial.attending == null ? "" : initial.attending ? "yes" : "no"),
  );
  const [guestCount, setGuestCount] = useState(Number(raw?.guest_count ?? Math.max(initial.guest_count ?? 1, 1)));
  const [editing, setEditing] = useState(false);
  const errors = state.errors ?? {};
  const err = (k: keyof typeof errors) => (errors[k] ? t(`errors.${errors[k]}` as never) : undefined);

  if (state.status === "success" && !editing) {
    return (
      <div className="flex flex-col items-center gap-3 text-center" role="status">
        <CheckIcon color={accent} />
        <h2 className="text-2xl font-semibold">
          {state.attending ? (state.created ? t("thanksTitle") : t("updatedTitle")) : t("declinedTitle")}
        </h2>
        <p className="opacity-80">
          {state.attending
            ? t(state.created ? "thanksBody" : "updatedBody", { name: state.name ?? "", count: state.guestCount ?? 1 })
            : t("declinedBody", { name: state.name ?? "" })}
        </p>
        <button type="button" className="text-sm underline opacity-70 hover:opacity-100" onClick={() => setEditing(true)}>
          {t("again")}
        </button>
      </div>
    );
  }

  return (
    <form
      action={(fd) => {
        setEditing(false);
        formAction(fd);
      }}
      className="flex flex-col gap-5"
      style={{ ["--tpl-accent" as string]: accent }}
    >
      <div className="text-center">
        <h2 className="text-2xl font-semibold">{t("title")}</h2>
        <p className="opacity-75">{t("subtitle")}</p>
      </div>

      {errors.form && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {t(`errors.${errors.form}` as never)}
        </p>
      )}

      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">
          {t("attendingQuestion")}
          <span className="ms-1 text-red-500" aria-hidden>*</span>
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {(["yes", "no"] as const).map((v) => (
            <label
              key={v}
              className="flex min-h-12 cursor-pointer items-center justify-center rounded-lg border-2 px-3 text-center font-medium transition-colors"
              style={attending === v ? { borderColor: accent, background: `${accent}1a` } : { borderColor: "rgb(0 0 0 / 0.12)" }}
            >
              <input
                type="radio"
                name="attending"
                value={v}
                checked={attending === v}
                onChange={() => setAttending(v)}
                className="sr-only"
                required
              />
              {v === "yes" ? t("attendingYes") : t("attendingNo")}
            </label>
          ))}
        </div>
        {errors.attending && <p className="text-sm text-red-600" role="alert">{err("attending")}</p>}
      </fieldset>

      <Field label={t("fullName")} htmlFor="full_name" required error={err("full_name")}>
        <input id="full_name" name="full_name" className={control} required maxLength={120} autoComplete="name" defaultValue={d.full_name} aria-invalid={Boolean(errors.full_name)} />
      </Field>

      <Field label={t("phone")} htmlFor="phone" required error={err("phone")}>
        <input id="phone" name="phone" type="tel" inputMode="tel" dir="ltr" className={`${control} text-start`} required autoComplete="tel" placeholder={t("phonePlaceholder")} defaultValue={d.phone} aria-invalid={Boolean(errors.phone)} />
      </Field>

      {attending !== "no" && (
        <>
          <Field label={t("email")} htmlFor="email" help={t("emailHelp")} error={err("email")}>
            <input id="email" name="email" type="email" inputMode="email" dir="ltr" className={`${control} text-start`} autoComplete="email" defaultValue={d.email} aria-invalid={Boolean(errors.email)} />
          </Field>

          <Field label={t("guestCount")} htmlFor="guest_count" required error={err("guest_count")}>
            <select id="guest_count" name="guest_count" className={control} value={guestCount} onChange={(e) => setGuestCount(Number(e.target.value))}>
              {Array.from({ length: MAX_GUESTS_PER_REGISTRATION }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </Field>

          {guestCount > 1 && (
            <fieldset className="flex flex-col gap-3">
              {Array.from({ length: guestCount - 1 }, (_, i) => i + 1).map((i) => (
                <Field key={i} label={t("guestName", { n: i + 1 })} htmlFor={`guest_name_${i}`} required>
                  <input id={`guest_name_${i}`} name={`guest_name_${i}`} className={control} required maxLength={120} defaultValue={d.guestName(i)} />
                </Field>
              ))}
              {errors.guest_names && <p className="text-sm text-red-600" role="alert">{err("guest_names")}</p>}
            </fieldset>
          )}
        </>
      )}

      <Field label={t("notes")} htmlFor="notes" error={err("notes")}>
        <textarea id="notes" name="notes" className={`${control} min-h-20`} maxLength={1000} placeholder={t("notesPlaceholder")} defaultValue={d.notes} />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 min-h-12 rounded-full px-6 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ background: accent }}
      >
        {pending ? t("submitting") : attending === "no" ? t("submitDecline") : t("submit")}
      </button>
    </form>
  );
}

function Field({ label, htmlFor, help, error, required, children }: { label: string; htmlFor: string; help?: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && <span className="ms-1 text-red-500" aria-hidden>*</span>}
      </label>
      {children}
      {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : help ? <p className="text-sm opacity-60">{help}</p> : null}
    </div>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg aria-hidden width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  );
}
