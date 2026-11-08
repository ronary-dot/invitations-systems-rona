// Absolute base URL for links that leave the app (emails, wa.me messages).
export function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

export function getPublicEventUrl(slug: string) {
  return `${getSiteUrl()}/e/${slug}`;
}

export function getInviteUrl(token: string) {
  return `${getSiteUrl()}/i/${token}`;
}
