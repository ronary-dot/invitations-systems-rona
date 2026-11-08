"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { markWhatsappSent, sendInvitationEmails, sendTestInvitation } from "@/app/admin/events/[id]/invitees/send-actions";
import { EMAIL_BATCH_SIZE } from "@/lib/invitations/message";
import type { InviteeItem } from "./InviteesManager";

type Channel = "email" | "whatsapp";
type Audience = "selected" | "notSent" | "all" | `group:${string}`;

export function SendPanel({
  eventId,
  items,
  selectedIds,
  groups,
  emailConfigured,
  onClose,
}: {
  eventId: string;
  items: InviteeItem[];
  selectedIds: string[];
  groups: string[];
  emailConfigured: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("send");
  const router = useRouter();
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [audience, setAudience] = useState<Audience>(selectedIds.length > 0 ? "selected" : "notSent");

  const audienceItems = useMemo(() => {
    if (audience === "selected") return items.filter((i) => selectedIds.includes(i.id));
    if (audience === "notSent") return items.filter((i) => i.status === "pending");
    if (audience === "all") return items;
    const g = audience.slice("group:".length);
    return items.filter((i) => i.group_name === g);
  }, [audience, items, selectedIds]);

  const reachable = audienceItems.filter((i) => (channel === "email" ? i.email : i.phone));
  const missing = audienceItems.length - reachable.length;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-accent/40 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold">{t("title")}</h2>
        <button type="button" className="text-sm text-muted hover:text-foreground" onClick={onClose}>
          {t("close")}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t("channel")}</span>
          <div className="grid grid-cols-2 gap-2">
            {(["whatsapp", "email"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setChannel(c)}
                className={`min-h-11 rounded-lg border-2 px-3 font-medium ${channel === c ? "border-accent bg-accent/10" : "border-border"}`}
              >
                {t(`channels.${c}`)}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t("audience")}</span>
          <Select value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
            {selectedIds.length > 0 && <option value="selected">{t("audiences.selected", { count: selectedIds.length })}</option>}
            <option value="notSent">{t("audiences.notSent")}</option>
            <option value="all">{t("audiences.all")}</option>
            {groups.map((g) => (
              <option key={g} value={`group:${g}`}>{t("audiences.group", { group: g })}</option>
            ))}
          </Select>
        </label>
      </div>

      <p className="text-sm">
        {t("recipients", { count: reachable.length })}
        {missing > 0 && <span className="text-muted"> · {t(channel === "email" ? "missingEmail" : "missingPhone", { count: missing })}</span>}
      </p>

      {reachable[0] && (
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted">{t("preview", { name: reachable[0].full_name })}</span>
          <pre className="whitespace-pre-wrap rounded-lg bg-stone-50 p-3 font-sans text-sm" dir="auto">{reachable[0].messageText}</pre>
        </div>
      )}

      {channel === "email" ? (
        <EmailSender
          eventId={eventId}
          recipients={reachable}
          configured={emailConfigured}
          onFinished={() => router.refresh()}
        />
      ) : (
        <WhatsappSender eventId={eventId} recipients={reachable} onSent={() => router.refresh()} />
      )}
    </section>
  );
}

function EmailSender({
  eventId,
  recipients,
  configured,
  onFinished,
}: {
  eventId: string;
  recipients: InviteeItem[];
  configured: boolean;
  onFinished: () => void;
}) {
  const t = useTranslations("send.email");
  const [test, setTest] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; sent: number; failed: { name: string; error: string }[] } | null>(null);
  const [running, setRunning] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);

  if (!configured) return <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{t("notConfigured")}</p>;

  async function runTest() {
    setTesting(true);
    const r = await sendTestInvitation(eventId);
    setTest(r.ok ? t("testSent", { to: r.to ?? "" }) : t("testFailed", { error: r.error ?? "" }));
    setTesting(false);
  }

  async function run() {
    if (!window.confirm(t("confirm", { count: recipients.length }))) return;
    setRunning(true);
    setFatal(null);
    const ids = recipients.map((r) => r.id);
    let state = { done: 0, sent: 0, failed: [] as { name: string; error: string }[] };
    setProgress(state);
    for (let i = 0; i < ids.length; i += EMAIL_BATCH_SIZE) {
      const batch = ids.slice(i, i + EMAIL_BATCH_SIZE);
      const r = await sendInvitationEmails(eventId, batch);
      if (r.fatal) {
        setFatal(t(`fatal.${r.fatal}`));
        break;
      }
      state = { done: state.done + batch.length, sent: state.sent + r.sent, failed: [...state.failed, ...r.failed] };
      setProgress(state);
    }
    setRunning(false);
    onFinished();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={testing || running} onClick={runTest}>
          {testing ? t("sending") : t("test")}
        </Button>
        <Button disabled={running || recipients.length === 0} onClick={run}>
          {running ? t("sending") : t("send", { count: recipients.length })}
        </Button>
      </div>
      {test && <p className="text-sm" role="status">{test}</p>}
      {fatal && <p className="text-sm text-red-700" role="alert">{fatal}</p>}
      {progress && (
        <div className="flex flex-col gap-2" role="status">
          <div className="h-2 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full bg-accent transition-all" style={{ width: `${(progress.done / Math.max(recipients.length, 1)) * 100}%` }} />
          </div>
          <p className="text-sm">{t("progress", { sent: progress.sent, failed: progress.failed.length, total: recipients.length })}</p>
          {progress.failed.length > 0 && (
            <ul className="max-h-40 overflow-auto rounded-lg bg-red-50 p-3 text-sm text-red-800">
              {progress.failed.map((f, i) => (
                <li key={i}>{f.name}: {f.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// "Continuous send": one invitee at a time. Each click opens WhatsApp with the
// message ready, records the invitee as sent and moves to the next one.
function WhatsappSender({ eventId, recipients, onSent }: { eventId: string; recipients: InviteeItem[]; onSent: () => void }) {
  const t = useTranslations("send.whatsapp");
  // Freeze the queue when sending starts, so refreshes don't reshuffle it.
  const [queue, setQueue] = useState<InviteeItem[] | null>(null);
  const [index, setIndex] = useState(0);

  if (!queue) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted">{t("help")}</p>
        <div>
          <Button disabled={recipients.length === 0} onClick={() => { setQueue(recipients); setIndex(0); }}>
            {t("start", { count: recipients.length })}
          </Button>
        </div>
      </div>
    );
  }

  const current = queue[index];
  if (!current) {
    return (
      <div className="flex flex-col items-start gap-2" role="status">
        <p className="font-medium">{t("done", { count: queue.length })}</p>
        <Button variant="secondary" onClick={() => setQueue(null)}>{t("restart")}</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>{t("position", { n: index + 1, total: queue.length })}</span>
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-stone-100">
          <div className="h-full bg-accent" style={{ width: `${(index / queue.length) * 100}%` }} />
        </div>
      </div>
      <div>
        <p className="text-lg font-semibold">{current.full_name}</p>
        <p className="text-sm text-muted" dir="ltr">{current.phoneDisplay}</p>
        {current.status !== "pending" && <p className="text-sm text-amber-700">{t("alreadySent")}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={current.whatsappUrl ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#25D366] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          onClick={() => {
            void markWhatsappSent(eventId, current.id).then(onSent);
            setIndex(index + 1);
          }}
        >
          {t("open")}
        </a>
        <Button variant="secondary" onClick={() => setIndex(index + 1)}>{t("skip")}</Button>
        {index > 0 && <Button variant="ghost" onClick={() => setIndex(index - 1)}>{t("back")}</Button>}
      </div>
    </div>
  );
}
