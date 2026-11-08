"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { commitImport, previewImport, type ImportResult } from "@/app/admin/events/[id]/invitees/actions";
import { INVITEE_FIELDS, parseInvitee, type InviteeField, type InviteeInput } from "@/lib/invitees/schema";

type Loaded = { headers: string[]; rows: string[][] };

const SAMPLE_CSV = "﻿שם,טלפון,אימייל,קבוצה,כמות\nישראל ישראלי,050-123-4567,israel@example.com,משפחה,2\nדנה כהן,052-765-4321,,חברים,1\n";

export function ImportPanel({ eventId, onDone }: { eventId: string; onDone: () => void }) {
  const t = useTranslations("invitees.import");
  const tErr = useTranslations("invitees.errors");
  const tFields = useTranslations("invitees.fields");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<InviteeField, number>>>({});
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  const mapped: InviteeInput[] = useMemo(() => {
    if (!loaded) return [];
    return loaded.rows.map((r) => {
      const o: InviteeInput = {};
      for (const f of INVITEE_FIELDS) {
        const idx = mapping[f];
        if (idx != null) o[f] = r[idx] ?? "";
      }
      return o;
    });
  }, [loaded, mapping]);
  // Same validation as the server, plus duplicates within the file.
  const checked = useMemo(() => {
    const seen = new Set<string>();
    return mapped.map((m) => {
      const c = parseInvitee(m);
      if (!c.values) return c;
      const key = c.values.phone ? `p:${c.values.phone}` : `e:${c.values.email}`;
      if (seen.has(key)) return { values: null, errors: { form: "duplicateInFile" } };
      seen.add(key);
      return c;
    });
  }, [mapped]);
  const validCount = checked.filter((c) => c.values).length;

  function onFile(file: File) {
    setError(null);
    setResult(null);
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res = await previewImport(fd);
      if (!res.ok) {
        setError(t(`errors.${res.error}`));
        setLoaded(null);
        return;
      }
      setLoaded({ headers: res.headers, rows: res.rows });
      setMapping(res.mapping);
    });
  }

  function onImport() {
    const rows = mapped;
    startTransition(async () => {
      setResult(await commitImport(eventId, rows));
    });
  }

  function downloadSample() {
    const url = URL.createObjectURL(new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "invitees-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (result) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-accent/40 bg-white p-4" role="status">
        <h2 className="font-semibold">{t("doneTitle")}</h2>
        <p>{t("doneSummary", { added: result.added, updated: result.updated, failed: result.failed.length })}</p>
        {result.failed.length > 0 && (
          <ul className="max-h-48 overflow-auto rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {result.failed.map((f, i) => (
              <li key={i}>
                {f.row > 0 && `${t("row", { n: f.row })}: `}
                {f.name || "—"}: {tErr(f.error as never)}
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end">
          <Button onClick={onDone}>{t("close")}</Button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-accent/40 bg-white p-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted">{t("help")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-border bg-white px-4 text-sm font-medium hover:bg-stone-50">
          {pending && !loaded ? t("reading") : t("chooseFile")}
          <input
            type="file"
            accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
        </label>
        <button type="button" className="text-sm text-accent underline" onClick={downloadSample}>
          {t("sample")}
        </button>
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      {loaded && (
        <>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{t("mappingTitle")}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {INVITEE_FIELDS.map((f) => (
                <label key={f} className="flex flex-col gap-1 text-sm">
                  <span>
                    {tFields(f)}
                    {f === "full_name" && <span className="ms-1 text-red-600">*</span>}
                  </span>
                  <Select
                    value={mapping[f] ?? ""}
                    onChange={(e) => setMapping({ ...mapping, [f]: e.target.value === "" ? undefined : Number(e.target.value) })}
                  >
                    <option value="">{t("noColumn")}</option>
                    {loaded.headers.map((h, i) => (
                      <option key={i} value={i}>{h}</option>
                    ))}
                  </Select>
                </label>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-start text-muted">
                <tr>
                  {INVITEE_FIELDS.map((f) => (
                    <th key={f} className="px-3 py-2 text-start font-medium">{tFields(f)}</th>
                  ))}
                  <th className="px-3 py-2 text-start font-medium">{t("check")}</th>
                </tr>
              </thead>
              <tbody>
                {mapped.slice(0, 8).map((m, i) => {
                  const c = checked[i];
                  return (
                    <tr key={i} className="border-t border-border">
                      {INVITEE_FIELDS.map((f) => (
                        <td key={f} className="px-3 py-2" dir={f === "phone" || f === "email" ? "ltr" : undefined}>
                          {m[f] ?? ""}
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        {c.values ? (
                          <span className="text-emerald-700">✓</span>
                        ) : (
                          <span className="text-red-700">{tErr(Object.values(c.errors)[0] as never)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-sm">
            {t("summary", { rows: mapped.length, valid: validCount, invalid: mapped.length - validCount })}
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onDone}>{t("cancel")}</Button>
            <Button disabled={pending || validCount === 0 || mapping.full_name == null} onClick={onImport}>
              {pending ? t("importing") : t("submit", { count: validCount })}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
