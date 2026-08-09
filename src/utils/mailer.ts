// utils/mailer.ts
import nodemailer from "nodemailer";

// ─── Lazy transporter — created on first use so dotenv is always loaded first ─
let _transporter: nodemailer.Transporter | null = null;

const getTransporter = (): nodemailer.Transporter => {
  if (_transporter) return _transporter;

  // Validate env vars at the moment of first use, not at module load time.
  // This prevents silent failures when dotenv hasn't run yet.
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    const missing = [
      !host && "SMTP_HOST",
      !user && "SMTP_USER",
      !pass && "SMTP_PASS",
    ].filter(Boolean).join(", ");

    throw new Error(
      `[Mailer] Missing env vars: ${missing}. ` +
      `Make sure dotenv.config() runs before any imports in server.ts.`
    );
  }

  console.log(`[Mailer] Creating transporter → ${host}:${process.env.SMTP_PORT || 587}`);

  _transporter = nodemailer.createTransport({
    host,
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: false, // STARTTLS on port 587
    auth:   { user, pass },
  });

  return _transporter;
};

// ─── Verify connection on startup ─────────────────────────────────────────────
export const verifyMailer = async (): Promise<void> => {
  try {
    await getTransporter().verify();
    console.log("✅ [Mailer] Brevo SMTP connection verified");
  } catch (err) {
    console.error("❌ [Mailer] SMTP connection failed:", err);
  }
};

// ─── Generic send helper ──────────────────────────────────────────────────────
interface MailOptions {
  to:      string;
  subject: string;
  html:    string;
}

export const sendMail = async ({ to, subject, html }: MailOptions): Promise<void> => {
  await getTransporter().sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject,
    html,
  });
};