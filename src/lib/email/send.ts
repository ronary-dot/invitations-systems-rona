import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { createTransport, fromAddress } from "./transport";

export type SendResult = { ok: true } | { ok: false; error: string };

export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<SendResult> {
  try {
    await createTransport().sendMail({ from: fromAddress(), to, subject, html, text });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

type LogEntry = Database["public"]["Tables"]["inv_message_log"]["Insert"];

export async function logMessages(client: SupabaseClient<Database>, entries: LogEntry[]) {
  if (entries.length > 0) await client.from("inv_message_log").insert(entries);
}
