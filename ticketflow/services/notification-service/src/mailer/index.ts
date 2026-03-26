import nodemailer, { Transporter } from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST ?? 'localhost';
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? '1025', 10);
const FROM_ADDRESS = process.env.FROM_ADDRESS ?? 'noreply@ticketflow.com';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false,
      ignoreTLS: true,
    });
  }
  return transporter;
}

interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export const mailer = {
  async send(options: MailOptions): Promise<void> {
    const t = getTransporter();
    await t.sendMail({
      from: FROM_ADDRESS,
      to: options.to,
      subject: options.subject,
      text: options.text,
      ...(options.html ? { html: options.html } : {}),
    });
    console.log(`Email sent to ${options.to}: ${options.subject}`);
  },
};
