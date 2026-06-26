import nodemailer from "nodemailer";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function getFromAddress() {
  return (
    process.env.EMAIL_FROM ??
    (process.env.SMTP_USER ? `RiftVault <${process.env.SMTP_USER}>` : "RiftVault <onboarding@resend.dev>")
  );
}

export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

function html(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;background:#0a0e1a;font-family:'DM Sans',Arial,sans-serif;color:#c8cfe8">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#111827;border-radius:16px;border:1px solid #1e293b;overflow:hidden">
<tr><td style="background:#0f172a;padding:24px 32px;border-bottom:1px solid #1e293b">
<span style="font-size:20px;font-weight:700;color:#00e5c3">RiftVault</span>
</td></tr>
<tr><td style="padding:32px">${body}</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #1e293b;font-size:12px;color:#64748b">
You received this because you have an account at <a href="${APP_URL}" style="color:#00e5c3">RiftVault</a>.
</td></tr></table></td></tr></table></body></html>`;
}

function btn(text: string, link: string): string {
  return `<p style="margin:24px 0 0"><a href="${link}" style="display:inline-block;background:#f5c842;color:#0a0e1a;font-weight:700;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:10px">${text}</a></p>`;
}

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendViaSmtp(to: string, subject: string, bodyHtml: string) {
  if (!smtpConfigured()) return false;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject,
    html: bodyHtml,
  });

  return true;
}

async function sendViaResend(to: string, subject: string, bodyHtml: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: getFromAddress(),
      to,
      subject,
      html: bodyHtml,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new EmailDeliveryError(`Resend rejected the email: ${detail}`);
  }

  return true;
}

async function send(to: string, subject: string, bodyHtml: string) {
  if (await sendViaSmtp(to, subject, bodyHtml)) return;
  if (await sendViaResend(to, subject, bodyHtml)) return;

  // Dev fallback — log to console instead of failing
  console.log(`[email:dev] To: ${to} | Subject: ${subject}`);
}

export function isEmailDeliveryConfigured() {
  return smtpConfigured() || Boolean(process.env.RESEND_API_KEY);
}

export async function sendVerificationEmail(email: string, token: string) {
  const link = `${APP_URL}/verify-email?token=${token}`;
  await send(
    email,
    "Verify your RiftVault email",
    html(
      "Verify email",
      `<h2 style="color:#fff;margin:0 0 8px">Confirm your email</h2>
       <p style="color:#94a3b8;margin:0 0 4px">Click the button below to verify your email address and unlock full access to RiftVault.</p>
       ${btn("Verify email", link)}
       <p style="font-size:12px;color:#64748b;margin:16px 0 0">Link expires in 24 hours.</p>
       <p style="font-size:11px;color:#64748b;margin:12px 0 0;word-break:break-all">Or paste this link: ${link}</p>`
    )
  );
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const link = `${APP_URL}/reset-password?token=${token}`;
  await send(
    email,
    "Reset your RiftVault password",
    html(
      "Password reset",
      `<h2 style="color:#fff;margin:0 0 8px">Reset your password</h2>
       <p style="color:#94a3b8;margin:0 0 4px">We received a request to reset your password. If you didn&apos;t ask for this, you can ignore this email.</p>
       ${btn("Reset password", link)}
       <p style="font-size:12px;color:#64748b;margin:16px 0 0">Link expires in 1 hour.</p>`
    )
  );
}

export async function sendWithdrawalStatusEmail(
  email: string,
  action: "approved" | "rejected",
  amount: number,
  currency: string
) {
  const approved = action === "approved";
  const subject = approved ? "Withdrawal approved ✓" : "Withdrawal update";
  const body = approved
    ? `<h2 style="color:#00e5c3;margin:0 0 8px">Withdrawal approved</h2>
       <p style="color:#94a3b8">Your withdrawal of <strong style="color:#fff">${amount} ${currency}</strong> has been approved and is being processed.</p>
       ${btn("View wallet", `${APP_URL}/dashboard/wallet`)}`
    : `<h2 style="color:#ef4444;margin:0 0 8px">Withdrawal not processed</h2>
       <p style="color:#94a3b8">Your withdrawal of <strong style="color:#fff">${amount} ${currency}</strong> could not be processed. Your balance has been restored. Contact support if you have questions.</p>
       ${btn("View wallet", `${APP_URL}/dashboard/wallet`)}`;
  await send(email, subject, html(subject, body));
}

export async function sendOfferReceivedEmail(
  email: string,
  nftName: string,
  amount: number,
  currency: string,
  nftId: string
) {
  const link = `${APP_URL}/explore/${nftId}`;
  await send(
    email,
    `New offer on ${nftName}`,
    html(
      "New offer",
      `<h2 style="color:#fff;margin:0 0 8px">You received an offer</h2>
       <p style="color:#94a3b8">Someone offered <strong style="color:#00e5c3">${amount} ${currency}</strong> for your NFT <strong style="color:#fff">${nftName}</strong>.</p>
       ${btn("View & respond", link)}`
    )
  );
}
