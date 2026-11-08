import { createClient } from "@/lib/supabase/server";
import { createTransport, hasEmailEnv } from "@/lib/email/transport";
import { getSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

// Configuration status for whoever deploys the app. Never returns secret values.
export async function GET() {
  const result: Record<string, string | boolean> = {
    siteUrl: getSiteUrl(),
    supabaseSecretKey: Boolean(process.env.SUPABASE_SECRET_KEY),
    cronSecret: Boolean(process.env.CRON_SECRET),
  };

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("inv_public_event", { p_slug: "__health__" });
    result.supabase = error ? "error" : "ok";
  } catch {
    result.supabase = "error";
  }

  if (hasEmailEnv()) {
    try {
      await createTransport().verify();
      result.email = "ok";
    } catch (e) {
      result.email = "error";
      result.emailError = e instanceof Error ? e.message.slice(0, 200) : "unknown";
    }
  } else {
    result.email = "missing";
  }

  const healthy = result.supabase === "ok" && result.email === "ok";
  return Response.json(result, { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
