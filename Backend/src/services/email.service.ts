import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';
import { env } from '../config/env';

const RESEND_SMTP = {
  host: 'smtp.resend.com',
  port: 465,
  secure: true,
  user: 'resend',
};

const DEFAULT_FRONTEND_URL = 'https://holdis.vercel.app';

const EMAIL_STYLES = {
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
  fontSize: '16px',
  lineHeight: '1.5',
  primaryColor: '#14b8a6',
  textColor: '#171717',
  textMuted: '#525252',
  textMutedLight: '#737373',
} as const;

function escapeHtml(s: string | undefined | null): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function emailLayout(innerHtml: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>holDis</title>
</head>
<body style="margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; background-color:#f5f5f5; font-family:${EMAIL_STYLES.fontFamily}; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight}; color:${EMAIL_STYLES.textColor};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0; padding:0; border-collapse:collapse; width:100%;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px; width:100%; margin:0 auto; border-collapse:collapse;">
          <tr>
            <td style="padding:0 20px; font-family:${EMAIL_STYLES.fontFamily}; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight}; color:${EMAIL_STYLES.textColor};">
              ${innerHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private enabled: boolean;

  private get baseUrl(): string {
    return env.FRONTEND_URL || process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL;
  }

  constructor() {
    const resendKey = process.env.RESEND_API_KEY?.trim();
    const useResend = !!resendKey;

    if (useResend) {
      this.enabled = true;
      this.transporter = nodemailer.createTransport({
        host: RESEND_SMTP.host,
        port: RESEND_SMTP.port,
        secure: RESEND_SMTP.secure,
        auth: {
          user: RESEND_SMTP.user,
          pass: resendKey,
        },
      });
      logger.info('Email service initialized with Resend (dev + prod)');
    } else if (env.NODE_ENV === 'production' && process.env.SMTP_HOST) {
      this.enabled = true;
      const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass,
        },
      });
      logger.info('Email service initialized with SMTP (production)');
    } else {
      this.enabled = false;
      this.transporter = null;
      logger.info('Email service disabled (no RESEND_API_KEY or SMTP config)');
    }
  }

  private async sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
    if (this.enabled && this.transporter) {
      try {
        const fromAddress = process.env.EMAIL_FROM || 'onboarding@resend.dev';
        const fromName = process.env.EMAIL_FROM_NAME?.trim();
        const from = fromName ? `"${fromName.replace(/"/g, '')}" <${fromAddress}>` : fromAddress;
        await this.transporter.sendMail({
          from,
          to,
          subject,
          html,
          text,
        });
        logger.info('Email sent successfully', { to, subject });
      } catch (error) {
        logger.error('Failed to send email', { error, to, subject });
        throw error;
      }
    } else {
      logger.info('Email (DEV MODE)', { to, subject, text });
      if (subject.includes('Password Reset')) {
        const urlMatch = html.match(/https?:\/\/[^\s"<]+/);
        if (urlMatch) {
          logger.warn('🔑 PASSWORD RESET URL (DEV ONLY):', { url: urlMatch[0] });
        }
      }
    }
  }

  async sendEmailVerificationEmail(email: string, data: {
    firstName: string;
    verifyUrl: string;
    expiresInHours: number;
  }): Promise<void> {
    const firstName = escapeHtml(data.firstName);
    const verifyUrl = data.verifyUrl || '#';
    const html = emailLayout(`
      <div style="background-color:#ffffff; border-radius:12px; padding:32px 24px; box-sizing:border-box;">
        <div style="text-align:center; margin-bottom:28px;">
          <h1 style="color:${EMAIL_STYLES.primaryColor}; margin:0; font-size:24px; font-weight:700; font-family:${EMAIL_STYLES.fontFamily};">holDis</h1>
        </div>
        <h2 style="color:${EMAIL_STYLES.textColor}; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">Confirm your email</h2>
        <p style="margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Hi ${firstName},</p>
        <p style="margin:0 0 20px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Thanks for signing up. Please confirm your email address by clicking the button below:</p>
        <div style="text-align:center; margin:28px 0;">
          <a href="${verifyUrl}" style="display:inline-block; padding:14px 28px; background-color:${EMAIL_STYLES.primaryColor}; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:${EMAIL_STYLES.fontSize}; font-family:${EMAIL_STYLES.fontFamily};">Confirm email</a>
        </div>
        <p style="color:#b45309; font-weight:600; margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize};">⏰ This link expires in ${data.expiresInHours} hours.</p>
        <hr style="border:none; border-top:1px solid #e5e7eb; margin:28px 0;">
        <p style="color:${EMAIL_STYLES.textMutedLight}; margin:0; font-size:14px; word-break:break-all;">Link: ${verifyUrl}</p>
      </div>
    `);
    const text = `Confirm your email: ${verifyUrl} (expires in ${data.expiresInHours} hours)`;
    await this.sendEmail(email, 'Confirm your email - holDis', html, text);
  }

  async notifyUserRegistration(email: string, data: { firstName: string }): Promise<void> {
    const firstName = escapeHtml(data.firstName);
    const html = emailLayout(`
      <div style="background-color:#ffffff; border-radius:12px; padding:32px 24px; box-sizing:border-box;">
        <div style="text-align:center; margin-bottom:28px;">
          <h1 style="color:${EMAIL_STYLES.primaryColor}; margin:0; font-size:24px; font-weight:700; font-family:${EMAIL_STYLES.fontFamily};">holDis</h1>
        </div>
        <h2 style="color:${EMAIL_STYLES.primaryColor}; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">Welcome to holDis!</h2>
        <p style="margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Hi ${firstName},</p>
        <p style="margin:0 0 20px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Your account has been created successfully. You can now start creating invoices and managing payments.</p>
        <a href="${this.baseUrl}/dashboard" style="display:inline-block; padding:14px 28px; background-color:${EMAIL_STYLES.primaryColor}; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:${EMAIL_STYLES.fontSize}; font-family:${EMAIL_STYLES.fontFamily};">Go to Dashboard</a>
      </div>
    `);
    await this.sendEmail(email, 'Welcome to holDis', html, `Hi ${data.firstName}, welcome to holDis!`);
  }

  async sendPasswordResetEmail(email: string, data: {
    firstName: string;
    resetUrl: string;
    expiresInMinutes: number;
  }): Promise<void> {
    const firstName = escapeHtml(data.firstName);
    const resetUrl = data.resetUrl || '#';
    const html = emailLayout(`
      <div style="background-color:#ffffff; border-radius:12px; padding:32px 24px; box-sizing:border-box;">
        <div style="text-align:center; margin-bottom:28px;">
          <h1 style="color:${EMAIL_STYLES.primaryColor}; margin:0; font-size:24px; font-weight:700; font-family:${EMAIL_STYLES.fontFamily};">holDis</h1>
        </div>
        <h2 style="color:${EMAIL_STYLES.textColor}; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">Reset Your Password</h2>
        <p style="margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Hi ${firstName},</p>
        <p style="margin:0 0 20px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">We received a request to reset your password. Click the button below to create a new password:</p>
        <div style="text-align:center; margin:28px 0;">
          <a href="${resetUrl}" style="display:inline-block; padding:14px 28px; background-color:${EMAIL_STYLES.primaryColor}; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:${EMAIL_STYLES.fontSize}; font-family:${EMAIL_STYLES.fontFamily};">Reset Password</a>
        </div>
        <p style="color:#b45309; font-weight:600; margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize};">⏰ This link expires in ${data.expiresInMinutes} minutes.</p>
        <p style="color:${EMAIL_STYLES.textMuted}; margin:0; font-size:${EMAIL_STYLES.fontSize};">If you didn't request this, please ignore this email.</p>
        <hr style="border:none; border-top:1px solid #e5e7eb; margin:28px 0;">
        <p style="color:${EMAIL_STYLES.textMutedLight}; margin:0; font-size:14px; word-break:break-all;">Link: ${resetUrl}</p>
      </div>
    `);
    const text = `Reset your password: ${resetUrl} (expires in ${data.expiresInMinutes} minutes)`;
    await this.sendEmail(email, 'Reset Your Password - holDis', html, text);
  }

  async sendPasswordChangedEmail(email: string, data: {
    firstName: string;
  }): Promise<void> {
    const firstName = escapeHtml(data.firstName);
    const html = emailLayout(`
      <div style="background-color:#ffffff; border-radius:12px; padding:32px 24px; box-sizing:border-box;">
        <div style="text-align:center; margin-bottom:28px;">
          <h1 style="color:${EMAIL_STYLES.primaryColor}; margin:0; font-size:24px; font-weight:700; font-family:${EMAIL_STYLES.fontFamily};">holDis</h1>
        </div>
        <h2 style="color:${EMAIL_STYLES.textColor}; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">Password Changed Successfully</h2>
        <p style="margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Hi ${firstName},</p>
        <p style="margin:0 0 20px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Your password has been successfully changed. All your active sessions have been logged out for security.</p>
        <div style="background-color:#d1fae5; border-left:4px solid #10b981; padding:16px; margin:20px 0;">
          <p style="margin:0; color:#065f46; font-size:${EMAIL_STYLES.fontSize};">✅ All active sessions have been logged out.</p>
        </div>
        <p style="margin:0 0 20px; font-size:${EMAIL_STYLES.fontSize};">If you didn't make this change, please contact our support team immediately.</p>
        <p style="color:${EMAIL_STYLES.textMutedLight}; margin:0; font-size:14px;">Time: ${new Date().toLocaleString()}</p>
      </div>
    `);
    await this.sendEmail(email, 'Password Changed - holDis', html, `Your password has been changed successfully.`);
  }

  async notifyAdminNewUser(data: any): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;

    const name = escapeHtml(data.name ?? ((`${data.firstName ?? ''} ${data.lastName ?? ''}`.trim()) || '—'));
    const emailAddr = escapeHtml(data.email);
    const accountType = escapeHtml(data.accountType ?? '—');
    const html = emailLayout(`
      <div style="background-color:#ffffff; border-radius:12px; padding:32px 24px; box-sizing:border-box;">
        <h2 style="color:${EMAIL_STYLES.primaryColor}; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">New User Registration</h2>
        <p style="margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">A new user has registered:</p>
        <ul style="margin:0 0 20px; padding-left:20px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">
          <li>Name: ${name}</li>
          <li>Email: ${emailAddr}</li>
          <li>Account Type: ${accountType}</li>
        </ul>
      </div>
    `);
    await this.sendEmail(adminEmail, 'New User Registration - holDis', html, `New user: ${data.email}`);
  }

  async notifyAdminNewInvoice(data: any): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;

    const invoiceId = escapeHtml(String(data.invoiceId));
    const amount = escapeHtml(String(data.amount));
    const issuer = escapeHtml(data.issuer);
    const html = emailLayout(`
      <div style="background-color:#ffffff; border-radius:12px; padding:32px 24px; box-sizing:border-box;">
        <h2 style="color:${EMAIL_STYLES.primaryColor}; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">New Invoice Created</h2>
        <p style="margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Invoice #${invoiceId} has been created.</p>
        <ul style="margin:0 0 20px; padding-left:20px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">
          <li>Amount: $${amount}</li>
          <li>Issuer: ${issuer}</li>
        </ul>
      </div>
    `);
    await this.sendEmail(adminEmail, 'New Invoice - holDis', html, `New invoice #${data.invoiceId}`);
  }

  async notifyInvoiceCreated(email: string, data: any): Promise<void> {
    const invoiceId = escapeHtml(String(data.invoiceId));
    const amount = escapeHtml(String(data.amount));
    const paymentLink = (data.paymentLink && String(data.paymentLink).startsWith('http')) ? data.paymentLink : '';
    const linkBlock = paymentLink
      ? `<a href="${paymentLink}" style="display:inline-block; padding:14px 28px; background-color:${EMAIL_STYLES.primaryColor}; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:${EMAIL_STYLES.fontSize}; font-family:${EMAIL_STYLES.fontFamily};">View Invoice</a>`
      : `<p style="margin:0; font-size:${EMAIL_STYLES.fontSize};">View your invoice in the dashboard.</p>`;
    const html = emailLayout(`
      <div style="background-color:#ffffff; border-radius:12px; padding:32px 24px; box-sizing:border-box;">
        <h2 style="color:${EMAIL_STYLES.primaryColor}; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">Invoice Created</h2>
        <p style="margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Your invoice #${invoiceId} has been created successfully.</p>
        <p style="margin:0 0 20px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Amount: $${amount}</p>
        ${linkBlock}
      </div>
    `);
    await this.sendEmail(email, 'Invoice Created - holDis', html, `Invoice #${data.invoiceId} created`);
  }

  async notifyInvoiceFunded(email: string, data: any): Promise<void> {
    const invoiceId = escapeHtml(String(data.invoiceId));
    const amount = escapeHtml(String(data.amount));
    const html = emailLayout(`
      <div style="background-color:#ffffff; border-radius:12px; padding:32px 24px; box-sizing:border-box;">
        <h2 style="color:${EMAIL_STYLES.primaryColor}; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">Payment Received</h2>
        <p style="margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Invoice #${invoiceId} has been funded.</p>
        <p style="margin:0; font-size:${EMAIL_STYLES.fontSize};">Amount: ${amount}</p>
      </div>
    `);
    await this.sendEmail(email, 'Payment Received - holDis', html, `Invoice #${data.invoiceId} funded`);
  }

  async notifyDeliverySubmitted(email: string, data: any): Promise<void> {
    const invoiceId = escapeHtml(String(data.invoiceId));
    const html = emailLayout(`
      <div style="background-color:#ffffff; border-radius:12px; padding:32px 24px; box-sizing:border-box;">
        <h2 style="color:${EMAIL_STYLES.primaryColor}; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">Delivery Submitted</h2>
        <p style="margin:0; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Delivery has been submitted for invoice #${invoiceId}.</p>
      </div>
    `);
    await this.sendEmail(email, 'Delivery Submitted - holDis', html, `Delivery submitted for invoice #${data.invoiceId}`);
  }

  async notifyInvoiceCompleted(email: string, data: any): Promise<void> {
    const invoiceId = escapeHtml(String(data.invoiceId));
    const amount = escapeHtml(String(data.amount));
    const html = emailLayout(`
      <div style="background-color:#ffffff; border-radius:12px; padding:32px 24px; box-sizing:border-box;">
        <h2 style="color:${EMAIL_STYLES.primaryColor}; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">Invoice Completed</h2>
        <p style="margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Invoice #${invoiceId} has been completed successfully.</p>
        <p style="margin:0; font-size:${EMAIL_STYLES.fontSize};">Amount: ${amount}</p>
      </div>
    `);
    await this.sendEmail(email, 'Invoice Completed - holDis', html, `Invoice #${data.invoiceId} completed`);
  }

  async notifyInvoiceCancelled(email: string, data: any): Promise<void> {
    const invoiceId = escapeHtml(String(data.invoiceId));
    const html = emailLayout(`
      <div style="background-color:#ffffff; border-radius:12px; padding:32px 24px; box-sizing:border-box;">
        <h2 style="color:#ef4444; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">Invoice Cancelled</h2>
        <p style="margin:0; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Invoice #${invoiceId} has been cancelled.</p>
      </div>
    `);
    await this.sendEmail(email, 'Invoice Cancelled - holDis', html, `Invoice #${data.invoiceId} cancelled`);
  }

  async notifyDepositReceived(email: string, data: any): Promise<void> {
    const amount = escapeHtml(String(data.amount));
    const token = escapeHtml(String(data.token));
    const txHash = escapeHtml(String(data.txHash));
    const html = emailLayout(`
      <div style="background-color:#ffffff; border-radius:12px; padding:32px 24px; box-sizing:border-box;">
        <h2 style="color:${EMAIL_STYLES.primaryColor}; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">Deposit Received</h2>
        <p style="margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">You've received a deposit:</p>
        <ul style="margin:0; padding-left:20px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">
          <li>Amount: ${amount}</li>
          <li>Token: ${token}</li>
          <li>Transaction: ${txHash}</li>
        </ul>
      </div>
    `);
    await this.sendEmail(email, 'Deposit Received - holDis', html, `Deposit received: ${data.amount}`);
  }

  async notifyInvoicePaid(email: string, data: { invoiceId: string; amount: string; customerName?: string }): Promise<void> {
    const invoiceId = escapeHtml(data.invoiceId);
    const amount = escapeHtml(data.amount);
    const customerName = data.customerName ? escapeHtml(data.customerName) : '';
    const html = emailLayout(`
      <div style="background-color:#ffffff; border-radius:12px; padding:32px 24px; box-sizing:border-box;">
        <h2 style="color:${EMAIL_STYLES.primaryColor}; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">Invoice paid</h2>
        <p style="margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Invoice #${invoiceId} has been paid.</p>
        <p style="margin:0 0 8px; font-size:${EMAIL_STYLES.fontSize};"><strong>Amount:</strong> ${amount}</p>
        ${customerName ? `<p style="margin:0 0 20px; font-size:${EMAIL_STYLES.fontSize};"><strong>Paid by:</strong> ${customerName}</p>` : '<p style="margin:0 0 20px;"> </p>'}
        <a href="${this.baseUrl}/dashboard/invoices" style="display:inline-block; padding:14px 28px; background-color:${EMAIL_STYLES.primaryColor}; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:${EMAIL_STYLES.fontSize}; font-family:${EMAIL_STYLES.fontFamily};">View invoices</a>
      </div>
    `);
    await this.sendEmail(email, 'Invoice paid - holDis', html, `Invoice #${data.invoiceId} paid: ${data.amount}`);
  }

  async notifyInvoiceExpired(email: string, data: { invoiceId: string; dueDate: string }): Promise<void> {
    const invoiceId = escapeHtml(data.invoiceId);
    const dueDate = escapeHtml(data.dueDate);
    const html = emailLayout(`
      <div style="background-color:#ffffff; border-radius:12px; padding:32px 24px; box-sizing:border-box;">
        <h2 style="color:#b45309; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">Invoice expired</h2>
        <p style="margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Invoice #${invoiceId} has expired (valid until date was ${dueDate}).</p>
        <p style="margin:0 0 20px; font-size:${EMAIL_STYLES.fontSize};">You can create a new invoice if your customer still needs to pay.</p>
        <a href="${this.baseUrl}/dashboard/invoices/create" style="display:inline-block; padding:14px 28px; background-color:${EMAIL_STYLES.primaryColor}; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:${EMAIL_STYLES.fontSize}; font-family:${EMAIL_STYLES.fontFamily};">Create new invoice</a>
      </div>
    `);
    await this.sendEmail(email, 'Invoice expired - holDis', html, `Invoice #${data.invoiceId} expired`);
  }
}

export const emailService = new EmailService();
