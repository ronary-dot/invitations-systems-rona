"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { deleteInvitees } from "@/app/admin/events/[id]/invitees/actions";
import type { InviteeStatus } from "@/lib/types/database";
import { InviteeForm } from "./InviteeForm";
import { ImportPanel } from "./ImportPanel";
import { SendPanel } from "./SendPanel";
import { markWhatsappSent, sendInvitationEmails } from "@/app/admin/events/[id]/invitees/send-actions";

export type InviteeItem = {
  id: string;
  full_name: string;
  phone: string | null;
  phoneDisplay: string;
  email: string | null;
  group_name: string | null;
  expected_guests: number;
  status: InviteeStatus;
  attendingGuests: number | null;
  inviteUrl: string;
  messageText: string;
  whatsappUrl: string | null;
};

const STATUSES: InviteeStatus[] = ["pending", "sent", "opened", "confirmed", "declined"];

const statusStyle: Record<InviteeStatus, string> = {
  pending: "bg-stone-100 text-stone-600",
  sent: "bg-sky-50 text-sky-700",
  opened: "bg-amber-50 text-amber-700",
  confirmed: "bg-emerald-50 text-emerald-700",
  declined: "bg-red-50 text-red-700",
};

export function InviteesManager({
  eventId,
  items,
  emailConfigured,
}: {
  eventId: string;
  items: InviteeItem[];
  emailConfigured: boolean;
}) {
  const t = useTranslations("invitees");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [status, setStatus] = useState<InviteeStatus | "">("");
  const [mode, setMode] = useState<"none" | "add" | "import" | "send">("none");
  const [rowMsg, setRowMsg] = useState<{ id: string; text: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const groups = useMemo(
    () => [...new Set(items.map((i) => i.group_name).filter((g): g is string => Boolean(g)))].sort(),
    [items],
  );
  const counts = useMemo(() => {
    const c: Record<InviteeStatus, number> = { pending: 0, sent: 0, opened: 0, confirmed: 0, declined: 0 };
    for (const i of items) c[i.status] += 1;
    return c;
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    return items.filter((i) => {
      if (group && i.group_name !== group) return false;
      if (status && i.status !== status) return false;
      if (!q) return true;
      return (
        i.full_name.toLowerCase().includes(q) ||
        (i.email ?? "").includes(q) ||
        (qDigits.length >= 3 && (i.phone ?? "").replace(/\D/g, "").includes(qDigits.replace(/^0/, "")))
      );
    });
  }, [items, query, group, status]);

  const done = () => {
    setMode("none");
    setEditing(null);
    router.refresh();
  };

  function remove(ids: string[], label: string) {
    if (!window.confirm(t("deleteConfirm", { count: ids.length, name: label }))) return;
    startTransition(async () => {
      await deleteInvitees(eventId, ids);
      setSelected(new Set());
      router.refresh();
    });
  }

  async function copy(item: InviteeItem) {
    try {
      await navigator.clipboard.writeText(item.inviteUrl);
      setCopied(item.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt(t("copyLink"), item.inviteUrl);
    }
  }

  const allVisibleSelected = visible.length > 0 && visible.every((i) => selected.has(i.id));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-white px-3 py-1 ring-1 ring-border">{t("total", { count: items.length })}</span>
        {STATUSES.map((s) => (
          <span key={s} className={`rounded-full px-3 py-1 ${statusStyle[s]}`}>
            {t(`status.${s}`)}: {counts[s]}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {items.length > 0 && (
          <Button onClick={() => setMode(mode === "send" ? "none" : "send")}>{t("sendInvitations")}</Button>
        )}
        <Button variant="secondary" onClick={() => setMode(mode === "add" ? "none" : "add")}>{t("addInvitee")}</Button>
        <Button variant="secondary" onClick={() => setMode(mode === "import" ? "none" : "import")}>
          {t("import.button")}
        </Button>
      </div>

      {mode === "add" && (
        <InviteeForm eventId={eventId} inviteeId={null} initial={{ expected_guests: "1" }} groups={groups} onDone={done} />
      )}
      {mode === "import" && <ImportPanel eventId={eventId} onDone={done} />}
      {mode === "send" && (
        <SendPanel
          eventId={eventId}
          items={items}
          selectedIds={[...selected]}
          groups={groups}
          emailConfigured={emailConfigured}
          onClose={() => setMode("none")}
        />
      )}

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted">{t("empty")}</p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <Input type="search" placeholder={t("search")} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t("search")} />
            <Select value={group} onChange={(e) => setGroup(e.target.value)} aria-label={t("fields.group_name")}>
              <option value="">{t("allGroups")}</option>
              {groups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value as InviteeStatus | "")} aria-label={t("statusLabel")}>
              <option value="">{t("allStatuses")}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{t(`status.${s}`)}</option>
              ))}
            </Select>
          </div>

          <div className="flex min-h-9 items-center justify-between gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-accent"
                checked={allVisibleSelected}
                onChange={() => {
                  const next = new Set(selected);
                  for (const i of visible) {
                    if (allVisibleSelected) next.delete(i.id);
                    else next.add(i.id);
                  }
                  setSelected(next);
                }}
              />
              {t("showing", { shown: visible.length, total: items.length })}
            </label>
            {selected.size > 0 && (
              <Button variant="danger" className="min-h-9" disabled={pending} onClick={() => remove([...selected], "")}>
                {t("deleteSelected", { count: selected.size })}
              </Button>
            )}
          </div>

          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
            {visible.map((i) =>
              editing === i.id ? (
                <li key={i.id} className="p-2">
                  <InviteeForm
                    eventId={eventId}
                    inviteeId={i.id}
                    groups={groups}
                    onDone={done}
                    initial={{
                      full_name: i.full_name,
                      phone: i.phoneDisplay,
                      email: i.email ?? "",
                      group_name: i.group_name ?? "",
                      expected_guests: String(i.expected_guests),
                    }}
                  />
                </li>
              ) : (
                <li key={i.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 shrink-0 accent-accent"
                      aria-label={i.full_name}
                      checked={selected.has(i.id)}
                      onChange={() => {
                        const next = new Set(selected);
                        if (next.has(i.id)) next.delete(i.id);
                        else next.add(i.id);
                        setSelected(next);
                      }}
                    />
                    <div className="flex min-w-0 flex-col">
                      <span className="flex flex-wrap items-center gap-2 font-medium">
                        {i.full_name}
                        {i.group_name && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-normal text-muted">{i.group_name}</span>}
                      </span>
                      <span className="flex flex-wrap gap-x-3 text-sm text-muted">
                        {i.phoneDisplay && <span dir="ltr">{i.phoneDisplay}</span>}
                        {i.email && <span dir="ltr" className="truncate">{i.email}</span>}
                        <span>{t("expected", { count: i.expected_guests })}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 ps-7 sm:ps-0">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle[i.status]}`}>
                      {t(`status.${i.status}`)}
                      {i.attendingGuests != null && ` (${i.attendingGuests})`}
                    </span>
                    {i.whatsappUrl && (
                      <a
                        href={i.whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg px-2 py-1.5 text-sm font-medium text-[#128C7E] hover:bg-emerald-50"
                        onClick={() => {
                          void markWhatsappSent(eventId, i.id).then(() => router.refresh());
                        }}
                      >
                        {t("whatsapp")}
                      </a>
                    )}
                    {i.email && emailConfigured && (
                      <Button
                        variant="ghost"
                        className="min-h-9 px-2"
                        disabled={pending}
                        onClick={() => {
                          if (!window.confirm(t("emailConfirm", { name: i.full_name, email: i.email ?? "" }))) return;
                          startTransition(async () => {
                            const r = await sendInvitationEmails(eventId, [i.id]);
                            setRowMsg({ id: i.id, text: r.sent ? t("emailSent") : t("emailFailed", { error: r.failed[0]?.error ?? r.fatal ?? "" }) });
                            router.refresh();
                          });
                        }}
                      >
                        {t("email")}
                      </Button>
                    )}
                    {rowMsg?.id === i.id && <span className="text-xs text-muted" role="status">{rowMsg.text}</span>}
                    <Button variant="ghost" className="min-h-9 px-2" onClick={() => copy(i)}>
                      {copied === i.id ? t("copied") : t("copyLink")}
                    </Button>
                    <a href={i.inviteUrl} target="_blank" rel="noreferrer" className="rounded-lg px-2 py-1.5 text-sm hover:bg-stone-100">
                      {t("open")}
                    </a>
                    <Button variant="ghost" className="min-h-9 px-2" onClick={() => setEditing(i.id)}>
                      {t("edit")}
                    </Button>
                    <Button variant="ghost" className="min-h-9 px-2 text-red-700" disabled={pending} onClick={() => remove([i.id], i.full_name)}>
                      {t("delete")}
                    </Button>
                  </div>
                </li>
              ),
            )}
          </ul>
        </>
      )}
    </div>
  );
}
