import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPersonalInvite } from "@/lib/public-event";
import { getInviteUrl } from "@/lib/site";
import { eventMetadata, renderInvitation } from "@/lib/invitation-page";
import { formatPhoneForDisplay } from "@/lib/phone";
import { MarkOpened } from "./MarkOpened";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const invite = await getPersonalInvite(token);
  if (!invite) return {};
  return eventMetadata(invite.event, getInviteUrl(token));
}

export default async function PersonalInvitePage({ params }: Props) {
  const { token } = await params;
  const invite = await getPersonalInvite(token);
  if (!invite) notFound();
  const t = await getTranslations("invite");

  const { invitee, registration: reg } = invite;
  const initial = reg
    ? {
        full_name: reg.full_name,
        phone: formatPhoneForDisplay(reg.phone),
        email: reg.email ?? "",
        attending: reg.attending,
        guest_count: reg.guest_count,
        guest_names: reg.guest_names,
        notes: reg.notes ?? "",
      }
    : {
        full_name: invitee.full_name,
        phone: invitee.phone ? formatPhoneForDisplay(invitee.phone) : "",
        email: invitee.email ?? "",
        guest_count: invitee.expected_guests,
      };

  const greeting = (
    <div className="text-center">
      <MarkOpened token={token} />
      <p className="text-xl font-semibold">{t("personalGreeting", { name: invitee.full_name })}</p>
      {reg && (
        <p className="mt-1 text-sm opacity-70">
          {reg.attending ? t("alreadyConfirmed", { count: reg.guest_count }) : t("alreadyDeclined")}
        </p>
      )}
    </div>
  );

  return renderInvitation(invite.event, { token }, initial, greeting);
}
