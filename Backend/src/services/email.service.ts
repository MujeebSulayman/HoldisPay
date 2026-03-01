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

const EMAIL_HEADER = `
  <div style="border-bottom:1px solid #e5e7eb; padding-bottom:20px; margin-bottom:24px;">
    <span style="color:${EMAIL_STYLES.primaryColor}; font-size:22px; font-weight:700; font-family:${EMAIL_STYLES.fontFamily}; letter-spacing:-0.02em;">holDis</span>
  </div>`;

const EMAIL_FOOTER = `
  <div style="margin-top:32px; padding-top:20px; border-top:1px solid #e5e7eb;">
    <p style="margin:0; color:${EMAIL_STYLES.textMutedLight}; font-size:13px;">holDis — Invoice &amp; payment platform</p>
  </div>`;

function emailLayout(innerHtml: string, options?: { includeFooter?: boolean }): string {
  const footer = options?.includeFooter !== false ? EMAIL_FOOTER : '';
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
<body style="margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; background-color:#ffffff; font-family:${EMAIL_STYLES.fontFamily}; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight}; color:${EMAIL_STYLES.textColor};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0; padding:0; border-collapse:collapse; width:100%;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px; width:100%; margin:0 auto; border-collapse:collapse;">
          <tr>
            <td style="padding:0 12px; font-family:${EMAIL_STYLES.fontFamily}; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight}; color:${EMAIL_STYLES.textColor};">
              ${EMAIL_HEADER}
              ${innerHtml}
              ${footer}
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
      if (subject.toLowerCase().includes('reset') && subject.toLowerCase().includes('password')) {
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
      <div style="padding:0 0 28px;">
        <h2 style="color:${EMAIL_STYLES.textColor}; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">Verify your email address</h2>
        <p style="margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Hello ${firstName},</p>
        <p style="margin:0 0 24px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Thank you for registering with holDis. Please verify your email address by clicking the button below to activate your account.</p>
        <div style="text-align:left; margin:24px 0;">
          <a href="${verifyUrl}" style="display:inline-block; padding:14px 28px; background-color:${EMAIL_STYLES.primaryColor}; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:${EMAIL_STYLES.fontSize}; font-family:${EMAIL_STYLES.fontFamily};">Verify email address</a>
        </div>
        <p style="color:${EMAIL_STYLES.textMuted}; margin:0 0 8px; font-size:14px;">This link expires in ${data.expiresInHours} hours.</p>
        <p style="color:${EMAIL_STYLES.textMutedLight}; margin:0; font-size:13px; word-break:break-all;">If the button does not work, copy and paste this link into your browser:<br>${verifyUrl}</p>
      </div>
    `);
    const text = `Verify your email address: ${verifyUrl} (expires in ${data.expiresInHours} hours)`;
    await this.sendEmail(email, 'holDis — Verify your email address', html, text);
  }

  async notifyUserRegistration(email: string, data: { firstName: string }): Promise<void> {
    const firstName = escapeHtml(data.firstName);
    const html = emailLayout(`
      <div style="padding:0 0 28px;">
        <h2 style="color:${EMAIL_STYLES.textColor}; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">Welcome to holDis</h2>
        <p style="margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Hello ${firstName},</p>
        <p style="margin:0 0 24px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Your email has been verified and your account is now active. You can sign in and start creating invoices and managing payments.</p>
        <a href="${this.baseUrl}/dashboard" style="display:inline-block; padding:14px 28px; background-color:${EMAIL_STYLES.primaryColor}; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:${EMAIL_STYLES.fontSize}; font-family:${EMAIL_STYLES.fontFamily};">Go to dashboard</a>
      </div>
    `);
    await this.sendEmail(email, 'holDis — Welcome', html, `Hello ${data.firstName}, welcome to holDis. Your account is active.`);
  }

  async sendPasswordResetEmail(email: string, data: {
    firstName: string;
    resetUrl: string;
    expiresInMinutes: number;
  }): Promise<void> {
    const firstName = escapeHtml(data.firstName);
    const resetUrl = data.resetUrl || '#';
    const html = emailLayout(`
      <div style="padding:0 0 28px;">
        <h2 style="color:${EMAIL_STYLES.textColor}; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">Reset your password</h2>
        <p style="margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Hello ${firstName},</p>
        <p style="margin:0 0 24px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">We received a request to reset the password for your holDis account. Click the button below to set a new password.</p>
        <div style="text-align:left; margin:24px 0;">
          <a href="${resetUrl}" style="display:inline-block; padding:14px 28px; background-color:${EMAIL_STYLES.primaryColor}; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:${EMAIL_STYLES.fontSize}; font-family:${EMAIL_STYLES.fontFamily};">Set new password</a>
        </div>
        <p style="color:${EMAIL_STYLES.textMuted}; margin:0 0 8px; font-size:14px;">This link expires in ${data.expiresInMinutes} minutes.</p>
        <p style="color:${EMAIL_STYLES.textMutedLight}; margin:0; font-size:13px; word-break:break-all;">If you did not request this, you can safely ignore this email. If the button does not work, copy and paste this link into your browser:<br>${resetUrl}</p>
      </div>
    `);
    const text = `Reset your password: ${resetUrl} (expires in ${data.expiresInMinutes} minutes)`;
    await this.sendEmail(email, 'holDis — Reset your password', html, text);
  }

  async sendPasswordChangedEmail(email: string, data: {
    firstName: string;
  }): Promise<void> {
    const firstName = escapeHtml(data.firstName);
    const html = emailLayout(`
      <div style="padding:0 0 28px;">
        <h2 style="color:${EMAIL_STYLES.textColor}; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">Password updated</h2>
        <p style="margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Hello ${firstName},</p>
        <p style="margin:0 0 16px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">The password for your holDis account was changed successfully. For your security, all other sessions have been signed out.</p>
        <div style="background-color:#f0fdf4; border-left:4px solid #10b981; padding:14px 16px; margin:20px 0;">
          <p style="margin:0; color:#065f46; font-size:${EMAIL_STYLES.fontSize};">All other devices have been signed out. Use your new password to sign in again.</p>
        </div>
        <p style="margin:0; font-size:14px; color:${EMAIL_STYLES.textMuted};">If you did not make this change, please contact support immediately.</p>
        <p style="color:${EMAIL_STYLES.textMutedLight}; margin:16px 0 0; font-size:13px;">${new Date().toLocaleString()}</p>
      </div>
    `);
    await this.sendEmail(email, 'holDis — Password updated', html, 'Your holDis password was changed successfully. All other sessions have been signed out.');
  }

  async notifyAdminNewUser(data: any): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;

    const name = escapeHtml(data.name ?? ((`${data.firstName ?? ''} ${data.lastName ?? ''}`.trim()) || '—'));
    const emailAddr = escapeHtml(data.email);
    const accountType = escapeHtml(data.accountType ?? '—');
    const html = emailLayout(`
      <div style="padding:0 0 28px;">
        <p style="margin:0 0 8px; font-size:12px; text-transform:uppercase; letter-spacing:0.05em; color:${EMAIL_STYLES.textMutedLight};">Admin notification</p>
        <h2 style="color:${EMAIL_STYLES.textColor}; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">New user registration</h2>
        <p style="margin:0 0 16px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">A new account has been registered on holDis.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:${EMAIL_STYLES.fontSize}; line-height:1.6;">
          <tr><td style="padding:4px 12px 4px 0; color:${EMAIL_STYLES.textMuted}; font-weight:500;">Name</td><td style="padding:4px 0;">${name}</td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:${EMAIL_STYLES.textMuted}; font-weight:500;">Email</td><td style="padding:4px 0;">${emailAddr}</td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:${EMAIL_STYLES.textMuted}; font-weight:500;">Account type</td><td style="padding:4px 0;">${accountType}</td></tr>
        </table>
      </div>
    `, { includeFooter: false });
    await this.sendEmail(adminEmail, 'holDis — New user registration', html, `New user registered: ${data.email}`);
  }

  async notifyAdminNewInvoice(data: any): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;

    const invoiceId = escapeHtml(String(data.invoiceId));
    const amount = escapeHtml(String(data.amount));
    const issuer = escapeHtml(data.issuer);
    const html = emailLayout(`
      <div style="padding:0 0 28px;">
        <p style="margin:0 0 8px; font-size:12px; text-transform:uppercase; letter-spacing:0.05em; color:${EMAIL_STYLES.textMutedLight};">Admin notification</p>
        <h2 style="color:${EMAIL_STYLES.textColor}; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">New invoice created</h2>
        <p style="margin:0 0 16px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">A new invoice has been created on the platform.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:${EMAIL_STYLES.fontSize}; line-height:1.6;">
          <tr><td style="padding:4px 12px 4px 0; color:${EMAIL_STYLES.textMuted}; font-weight:500;">Invoice</td><td style="padding:4px 0;">#${invoiceId}</td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:${EMAIL_STYLES.textMuted}; font-weight:500;">Amount</td><td style="padding:4px 0;">$${amount}</td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:${EMAIL_STYLES.textMuted}; font-weight:500;">Issuer</td><td style="padding:4px 0;">${issuer}</td></tr>
        </table>
      </div>
    `, { includeFooter: false });
    await this.sendEmail(adminEmail, 'holDis — New invoice created', html, `New invoice #${data.invoiceId} created`);
  }

  async notifyInvoiceCreated(email: string, data: any): Promise<void> {
    const invoiceId = escapeHtml(String(data.invoiceId));
    const amount = escapeHtml(String(data.amount));
    const paymentLink = (data.paymentLink && String(data.paymentLink).startsWith('http')) ? data.paymentLink : '';
    const linkBlock = paymentLink
      ? `<a href="${paymentLink}" style="display:inline-block; padding:14px 28px; background-color:${EMAIL_STYLES.primaryColor}; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:${EMAIL_STYLES.fontSize}; font-family:${EMAIL_STYLES.fontFamily};">View invoice</a>`
      : `<p style="margin:0; font-size:${EMAIL_STYLES.fontSize};">You can view and manage this invoice in your <a href="${this.baseUrl}/dashboard/invoices" style="color:${EMAIL_STYLES.primaryColor}; text-decoration:none;">dashboard</a>.</p>`;
    const html = emailLayout(`
      <div style="padding:0 0 28px;">
        <h2 style="color:${EMAIL_STYLES.textColor}; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">Invoice created</h2>
        <p style="margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Your invoice has been created successfully.</p>
        <p style="margin:0 0 8px; font-size:${EMAIL_STYLES.fontSize};"><strong>Invoice #</strong>${invoiceId}</p>
        <p style="margin:0 0 24px; font-size:${EMAIL_STYLES.fontSize};"><strong>Amount:</strong> $${amount}</p>
        ${linkBlock}
      </div>
    `);
    await this.sendEmail(email, 'holDis — Invoice created', html, `Invoice #${data.invoiceId} created. Amount: $${data.amount}`);
  }

  async notifyInvoiceFunded(email: string, data: any): Promise<void> {
    const invoiceId = escapeHtml(String(data.invoiceId));
    const amount = escapeHtml(String(data.amount));
    const html = emailLayout(`
      <div style="padding:0 0 28px;">
        <h2 style="color:${EMAIL_STYLES.textColor}; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">Payment received</h2>
        <p style="margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Payment has been received for your invoice.</p>
        <p style="margin:0 0 8px; font-size:${EMAIL_STYLES.fontSize};"><strong>Invoice #</strong>${invoiceId}</p>
        <p style="margin:0 0 20px; font-size:${EMAIL_STYLES.fontSize};"><strong>Amount:</strong> ${amount}</p>
        <a href="${this.baseUrl}/dashboard/invoices" style="display:inline-block; padding:14px 28px; background-color:${EMAIL_STYLES.primaryColor}; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:${EMAIL_STYLES.fontSize}; font-family:${EMAIL_STYLES.fontFamily};">View invoices</a>
      </div>
    `);
    await this.sendEmail(email, 'holDis — Payment received', html, `Payment received for invoice #${data.invoiceId}: ${data.amount}`);
  }

  async notifyDeliverySubmitted(email: string, data: any): Promise<void> {
    const invoiceId = escapeHtml(String(data.invoiceId));
    const html = emailLayout(`
      <div style="padding:0 0 28px;">
        <h2 style="color:${EMAIL_STYLES.textColor}; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">Delivery submitted</h2>
        <p style="margin:0 0 20px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Delivery has been submitted for invoice #${invoiceId}. You can review and confirm it in your dashboard.</p>
        <a href="${this.baseUrl}/dashboard/invoices" style="display:inline-block; padding:14px 28px; background-color:${EMAIL_STYLES.primaryColor}; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:${EMAIL_STYLES.fontSize}; font-family:${EMAIL_STYLES.fontFamily};">View invoices</a>
      </div>
    `);
    await this.sendEmail(email, 'holDis — Delivery submitted', html, `Delivery submitted for invoice #${data.invoiceId}`);
  }

  async notifyInvoiceCompleted(email: string, data: any): Promise<void> {
    const invoiceId = escapeHtml(String(data.invoiceId));
    const amount = escapeHtml(String(data.amount));
    const html = emailLayout(`
      <div style="padding:0 0 28px;">
        <h2 style="color:${EMAIL_STYLES.textColor}; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">Invoice completed</h2>
        <p style="margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Invoice #${invoiceId} has been completed successfully.</p>
        <p style="margin:0 0 20px; font-size:${EMAIL_STYLES.fontSize};"><strong>Amount:</strong> ${amount}</p>
        <a href="${this.baseUrl}/dashboard/invoices" style="display:inline-block; padding:14px 28px; background-color:${EMAIL_STYLES.primaryColor}; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:${EMAIL_STYLES.fontSize}; font-family:${EMAIL_STYLES.fontFamily};">View invoices</a>
      </div>
    `);
    await this.sendEmail(email, 'holDis — Invoice completed', html, `Invoice #${data.invoiceId} completed. Amount: ${data.amount}`);
  }

  async notifyInvoiceCancelled(email: string, data: any): Promise<void> {
    const invoiceId = escapeHtml(String(data.invoiceId));
    const html = emailLayout(`
      <div style="padding:0 0 28px;">
        <h2 style="color:#dc2626; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">Invoice cancelled</h2>
        <p style="margin:0; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Invoice #${invoiceId} has been cancelled. No further action is required.</p>
      </div>
    `);
    await this.sendEmail(email, 'holDis — Invoice cancelled', html, `Invoice #${data.invoiceId} has been cancelled`);
  }

  async notifyDepositReceived(email: string, data: any): Promise<void> {
    const amount = escapeHtml(String(data.amount));
    const token = escapeHtml(String(data.token));
    const txHash = escapeHtml(String(data.txHash));
    const html = emailLayout(`
      <div style="padding:0 0 28px;">
        <h2 style="color:${EMAIL_STYLES.textColor}; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">Deposit received</h2>
        <p style="margin:0 0 16px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">A deposit has been credited to your wallet.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:${EMAIL_STYLES.fontSize}; line-height:1.6;">
          <tr><td style="padding:4px 12px 4px 0; color:${EMAIL_STYLES.textMuted}; font-weight:500;">Amount</td><td style="padding:4px 0;">${amount}</td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:${EMAIL_STYLES.textMuted}; font-weight:500;">Token</td><td style="padding:4px 0;">${token}</td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:${EMAIL_STYLES.textMuted}; font-weight:500;">Transaction</td><td style="padding:4px 0; font-size:13px; word-break:break-all;">${txHash}</td></tr>
        </table>
        <p style="margin:24px 0 0;"><a href="${this.baseUrl}/dashboard/wallet" style="display:inline-block; padding:14px 28px; background-color:${EMAIL_STYLES.primaryColor}; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:${EMAIL_STYLES.fontSize}; font-family:${EMAIL_STYLES.fontFamily};">View wallet</a></p>
      </div>
    `);
    await this.sendEmail(email, 'holDis — Deposit received', html, `Deposit received: ${data.amount} ${data.token}`);
  }

  async notifyInvoicePaid(email: string, data: { invoiceId: string; amount: string; customerName?: string }): Promise<void> {
    const invoiceId = escapeHtml(data.invoiceId);
    const amount = escapeHtml(data.amount);
    const customerName = data.customerName ? escapeHtml(data.customerName) : '';
    const html = emailLayout(`
      <div style="padding:0 0 28px;">
        <h2 style="color:${EMAIL_STYLES.textColor}; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">Invoice paid</h2>
        <p style="margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Invoice #${invoiceId} has been paid.</p>
        <p style="margin:0 0 8px; font-size:${EMAIL_STYLES.fontSize};"><strong>Amount:</strong> ${amount}</p>
        ${customerName ? `<p style="margin:0 0 20px; font-size:${EMAIL_STYLES.fontSize};"><strong>Paid by:</strong> ${customerName}</p>` : '<p style="margin:0 0 20px;"> </p>'}
        <a href="${this.baseUrl}/dashboard/invoices" style="display:inline-block; padding:14px 28px; background-color:${EMAIL_STYLES.primaryColor}; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:${EMAIL_STYLES.fontSize}; font-family:${EMAIL_STYLES.fontFamily};">View invoices</a>
      </div>
    `);
    await this.sendEmail(email, 'holDis — Invoice paid', html, `Invoice #${data.invoiceId} paid: ${data.amount}`);
  }

  async notifyInvoiceExpired(email: string, data: { invoiceId: string; dueDate: string }): Promise<void> {
    const invoiceId = escapeHtml(data.invoiceId);
    const dueDate = escapeHtml(data.dueDate);
    const html = emailLayout(`
      <div style="padding:0 0 28px;">
        <h2 style="color:#b45309; margin:0 0 16px; font-size:20px; font-weight:600; font-family:${EMAIL_STYLES.fontFamily};">Invoice expired</h2>
        <p style="margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">Invoice #${invoiceId} has expired. The due date was ${dueDate}.</p>
        <p style="margin:0 0 24px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">You can create a new invoice from your dashboard if payment is still needed.</p>
        <a href="${this.baseUrl}/dashboard/invoices/create" style="display:inline-block; padding:14px 28px; background-color:${EMAIL_STYLES.primaryColor}; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:${EMAIL_STYLES.fontSize}; font-family:${EMAIL_STYLES.fontFamily};">Create new invoice</a>
      </div>
    `);
    await this.sendEmail(email, 'holDis — Invoice expired', html, `Invoice #${data.invoiceId} expired. Due date was ${data.dueDate}`);
  }
}

export const emailService = new EmailService();
