import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: parseInt(process.env.SMTP_PORT || "1025", 10),
  secure: false,
});

export async function sendInviteEmail(
  to: string,
  companyName: string,
  inviteToken: string,
) {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const inviteLink = `${appUrl}/invite/${inviteToken}`;

  await transporter.sendMail({
    from: '"Raterlog" <noreply@raterlog.dev>',
    to,
    subject: `You've been invited to join ${companyName} on Raterlog`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>You're invited to ${companyName}</h2>
        <p>You've been invited to join <strong>${companyName}</strong> on Raterlog.</p>
        <p>Click the link below to accept the invitation:</p>
        <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; margin: 16px 0;">
          Accept Invitation
        </a>
        <p style="color: #666; font-size: 13px;">This link expires in 7 days. If you didn't expect this, you can ignore this email.</p>
      </div>
    `,
  });
}
