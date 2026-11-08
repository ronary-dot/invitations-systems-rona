"use server";

import { createClient } from "@/lib/supabase/server";

export async function markInviteOpened(token: string) {
  if (!/^[a-z0-9]{16,64}$/i.test(token)) return;
  const supabase = await createClient();
  await supabase.rpc("inv_mark_invite_opened", { p_token: token });
}
