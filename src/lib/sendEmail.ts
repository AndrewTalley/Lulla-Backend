import nodemailer from "nodemailer";

// Validate required environment variables
if (!process.env.SMTP_HOST) throw new Error("SMTP_HOST environment variable is required");
if (!process.env.SMTP_PORT) throw new Error("SMTP_PORT environment variable is required");
if (!process.env.SMTP_USER) throw new Error("SMTP_USER environment variable is required");
if (!process.env.SMTP_PASS) throw new Error("SMTP_PASS environment variable is required");
if (!process.env.SMTP_FROM) throw new Error("SMTP_FROM environment variable is required");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_PORT === "465", // true for port 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send an email using Nodemailer
 */
export async function sendEmail({ to, subject, html }: EmailOptions): Promise<void> {
  try {
    const info = await transporter.sendMail({
      from: `"Lulla App" <${process.env.SMTP_FROM}>`,
      to,
      subject,
      html,
    });

    console.log("✅ Email sent successfully:", info.messageId);
  } catch (error) {
    console.error("❌ Failed to send email:", error);
    throw new Error("Failed to send email");
  }
}
