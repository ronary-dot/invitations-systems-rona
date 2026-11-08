import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { hasSupabaseEnv } from "@/lib/env";

// Placeholder until stage 1 adds /login and /admin; then this redirects to /admin.
export default async function HomePage() {
  const t = await getTranslations("app");
  const tHome = await getTranslations("home");

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-3xl font-bold">{t("name")}</h1>
      <p className="text-muted">{t("tagline")}</p>
      <p className="text-sm">
        {hasSupabaseEnv() ? tHome("supabaseConnected") : tHome("supabaseMissing")}
      </p>
      <div>
        <LocaleSwitcher />
      </div>
    </main>
  );
}
