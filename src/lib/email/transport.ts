import "server-only";
import nodemailer from "nodemailer";

// Gmail SMTP with an App Password (GMAIL_USER, GMAIL_APP_PASSWORD).
// SMTP_URL overrides it for another provider or a local test server.
// EMAIL_DRY_RUN=1 prints messages instead of sending (development only).
export function hasEmailEnv() {
  return Boolean(process.env.SMTP_URL || (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD));
}

export function createTransport() {
  if (process.env.SMTP_URL) return nodemailer.createTransport(process.env.SMTP_URL);
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  if (user && pass) {
    return nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
  }
  if (process.env.EMAIL_DRY_RUN === "1" && process.env.NODE_ENV !== "production") {
    return nodemailer.createTransport({ jsonTransport: true });
  }
  throw new Error("email_not_configured");
}

export function fromAddress() {
  const name = process.env.EMAIL_FROM_NAME?.trim();
  const user = process.env.EMAIL_FROM ?? process.env.GMAIL_USER ?? "noreply@example.com";
  return name ? `"${name.replace(/"/g, "")}" <${user}>` : user;
}
