"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { saveInvitee, type InviteeFormState } from "@/app/admin/events/[id]/invitees/actions";
import type { InviteeInput } from "@/lib/invitees/schema";

export function InviteeForm({
  eventId,
  inviteeId,
  initial,
  groups,
  onDone,
}: {
  eventId: string;
  inviteeId: string | null;
  initial: InviteeInput;
  groups: string[];
  onDone: () => void;
}) {
  const t = useTranslations("invitees");
  const action = saveInvitee.bind(null, eventId, inviteeId);
  const [state, formAction, pending] = useActionState<InviteeFormState, FormData>(action, {});
  const errors = state.errors ?? {};
  const d = state.raw ?? initial;
  const err = (k: keyof typeof errors) => (errors[k] ? t(`errors.${errors[k]}` as never) : undefined);

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  const listId = `groups-${inviteeId ?? "new"}`;
  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-accent/40 bg-white p-4">
      {errors.form && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{err("form")}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label={t("fields.full_name")} htmlFor={`${listId}-name`} required error={err("full_name")}>
          <Input id={`${listId}-name`} name="full_name" defaultValue={d.full_name ?? ""} required maxLength={120} autoFocus />
        </Field>
        <Field label={t("fields.phone")} htmlFor={`${listId}-phone`} error={err("phone")}>
          <Input id={`${listId}-phone`} name="phone" type="tel" dir="ltr" className="text-start" defaultValue={d.phone ?? ""} placeholder="050-000-0000" />
        </Field>
        <Field label={t("fields.email")} htmlFor={`${listId}-email`} error={err("email")}>
          <Input id={`${listId}-email`} name="email" type="email" dir="ltr" className="text-start" defaultValue={d.email ?? ""} />
        </Field>
        <Field label={t("fields.group_name")} htmlFor={`${listId}-group`} error={err("group_name")}>
          <Input id={`${listId}-group`} name="group_name" list={listId} defaultValue={d.group_name ?? ""} maxLength={60} placeholder={t("groupPlaceholder")} />
          <datalist id={listId}>
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </Field>
        <Field label={t("fields.expected_guests")} htmlFor={`${listId}-count`} error={err("expected_guests")}>
          <Input id={`${listId}-count`} name="expected_guests" type="number" min={1} max={50} inputMode="numeric" dir="ltr" className="text-start" defaultValue={d.expected_guests ?? "1"} />
        </Field>
      </div>
      <p className="text-sm text-muted">{t("phoneOrEmailHelp")}</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>{t("cancel")}</Button>
        <Button type="submit" disabled={pending}>{pending ? t("saving") : inviteeId ? t("save") : t("add")}</Button>
      </div>
    </form>
  );
}
