import { getTranslations } from "next-intl/server";

export type MessageLogItem = {
  id: string;
  channel: "email" | "whatsapp";
  kind: "invitation" | "reminder" | "nudge" | "test";
  to: string;
  name: string | null;
  status: "sent" | "failed";
  error: string | null;
  at: string;
};

export async function MessageLog({ items }: { items: MessageLogItem[] }) {
  const t = await getTranslations("send.log");
  return (
    <details className="rounded-xl border border-border bg-white p-4">
      <summary className="cursor-pointer font-semibold">
        {t("title")} ({items.length})
      </summary>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{t("empty")}</p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-border text-sm">
          {items.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <span className="text-muted" dir="ltr">{l.at}</span>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs">{t(`channels.${l.channel}`)}</span>
              <span className="text-xs text-muted">{t(`kinds.${l.kind}`)}</span>
              <span className="font-medium">{l.name ?? ""}</span>
              <span className="text-muted" dir="ltr">{l.to}</span>
              <span className={l.status === "sent" ? "text-emerald-700" : "text-red-700"}>
                {t(`status.${l.status}`)}
                {l.error ? `: ${l.error}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
