import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';
import { env } from '../config/env';

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FRONTEND_URL = 'https://holdispay.xyz';

const EMAIL_STYLES = {
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
  fontSize: '16px',
  lineHeight: '1.5',
  primaryColor: '#14b8a6',
  textColor: '#fafafa',
  textMuted: '#a3a3a3',
  textMutedLight: '#737373',
  cardBg: '#1a1a1a',
  outerBg: '#0a0a0a',
} as const;

function escapeHtml(s: string | undefined | null): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const CARD_HEADER = `
  <div style="text-align:center; margin-bottom:28px;">
    <span style="color:${EMAIL_STYLES.textColor}; font-size:20px; font-weight:700; font-family:${EMAIL_STYLES.fontFamily}; letter-spacing:-0.02em;">HoldisPay</span>
  </div>`;

const SECURITY_NOTICE = `
  <p style="margin:24px 0 0; color:${EMAIL_STYLES.textMuted}; font-size:13px; line-height:1.5;">
    For security reasons, keep this information safe and don't share it with anyone.
  </p>
  <p style="margin:8px 0 0; color:${EMAIL_STYLES.textMutedLight}; font-size:12px; line-height:1.5;">
    Please don't reply to this email. It's sent from a no-reply address and responses won't be received.
  </p>`;

const OUTER_FOOTER = `
  <p style="margin:24px 0 0; color:${EMAIL_STYLES.textMutedLight}; font-size:12px;">HoldisPay. Invoice and payment platform.</p>`;

function emailLayout(innerHtml: string, options?: { includeSecurityNotice?: boolean; includeFooter?: boolean }): string {
  const security = options?.includeSecurityNotice !== false ? SECURITY_NOTICE : '';
  const footer = options?.includeFooter !== false ? OUTER_FOOTER : '';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>HoldisPay</title>
</head>
<body style="margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; background-color:${EMAIL_STYLES.outerBg}; font-family:${EMAIL_STYLES.fontFamily}; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight}; color:${EMAIL_STYLES.textColor};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0; padding:0; border-collapse:collapse; width:100%; background-color:${EMAIL_STYLES.outerBg};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px; width:100%; margin:0 auto; border-collapse:collapse; background-color:${EMAIL_STYLES.cardBg}; border-radius:12px; border:1px solid #262626;">
          <tr>
            <td style="padding:32px 28px; font-family:${EMAIL_STYLES.fontFamily}; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight}; color:${EMAIL_STYLES.textColor};">
              ${CARD_HEADER}
              ${innerHtml}
              ${security}
            </td>
          </tr>
        </table>
        ${footer ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px; width:100%; margin:0 auto; border-collapse:collapse;"><tr><td align="center" style="padding:16px 12px;">${footer}</td></tr></table>` : ''}
      </td>
    </tr>
  </table>
</body>
</html>`;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private resendApiKey: string | null = null;
  private enabled: boolean;

  private get baseUrl(): string {
    return env.FRONTEND_URL || process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL;
  }

  constructor() {
    const resendKey = process.env.RESEND_API_KEY?.trim();
    if (resendKey) {
      this.enabled = true;
      this.resendApiKey = resendKey;
      this.transporter = null;
      logger.info('Email service initialized with Resend HTTP API (works from Render/prod)');
    } else if (env.NODE_ENV === 'production' && process.env.SMTP_HOST) {
      this.enabled = true;
      this.resendApiKey = null;
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
      this.resendApiKey = null;
      this.transporter = null;
      logger.info('Email service disabled (no RESEND_API_KEY or SMTP config)');
    }
  }

  private async sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
    const fromAddress = (env.EMAIL_FROM ?? process.env.EMAIL_FROM)?.trim();
    if (!fromAddress) {
      logger.error('EMAIL_FROM is not set; cannot send email');
      throw new Error('EMAIL_FROM is required for sending email');
    }
    const fromName = (env.EMAIL_FROM_NAME ?? process.env.EMAIL_FROM_NAME)?.trim();
    const from = fromName ? `"${fromName.replace(/"/g, '')}" <${fromAddress}>` : fromAddress;

    if (this.enabled && this.resendApiKey) {
      try {
        const res = await fetch(RESEND_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from,
            to: [to],
            subject,
            html,
            text,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const errMsg = (data as { message?: string })?.message || `HTTP ${res.status}`;
          logger.error('Failed to send email', { to, subject, error: errMsg });
          throw new Error(errMsg);
        }
        logger.info('Email sent successfully', { to, subject, from: fromAddress });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.error('Failed to send email', { to, subject, error: errMsg });
        throw error;
      }
    } else if (this.enabled && this.transporter) {
      try {
        await this.transporter.sendMail({
          from,
          to,
          subject,
          html,
          text,
        });
        logger.info('Email sent successfully', { to, subject, from: fromAddress });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.error('Failed to send email', { to, subject, error: errMsg });
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
      <h2 style="color:${EMAIL_STYLES.textColor}; margin:0 0 20px; font-size:22px; font-weight:700; font-family:${EMAIL_STYLES.fontFamily};">Verification</h2>
      <p style="margin:0 0 8px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight}; color:${EMAIL_STYLES.textColor};">Dear ${firstName},</p>
      <p style="margin:0 0 24px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight}; color:${EMAIL_STYLES.textColor};">Use the link below to verify your email and activate your HoldisPay account:</p>
      <div style="text-align:center; margin:28px 0;">
        <a href="${verifyUrl}" style="display:inline-block; padding:16px 32px; background-color:${EMAIL_STYLES.primaryColor}; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:18px; font-family:${EMAIL_STYLES.fontFamily};">Verify email address</a>
      </div>
      <p style="color:${EMAIL_STYLES.textMuted}; margin:0 0 4px; font-size:14px;">This link expires in ${data.expiresInHours} hours.</p>
      <p style="color:${EMAIL_STYLES.textMutedLight}; margin:0; font-size:13px; word-break:break-all;">If the button doesn't work, copy and paste this link into your browser:<br>${verifyUrl}</p>
    `);
    const text = `Verify your email address: ${verifyUrl} (expires in ${data.expiresInHours} hours)`;
    await this.sendEmail(email, 'HoldisPay: Verify your email address', html, text);
  }

  async notifyUserRegistration(email: string, data: { firstName: string }): Promise<void> {
    const firstName = escapeHtml(data.firstName);
    const html = emailLayout(`
      <h2 style="color:${EMAIL_STYLES.textColor}; margin:0 0 20px; font-size:22px; font-weight:700; font-family:${EMAIL_STYLES.fontFamily};">Welcome to HoldisPay</h2>
      <p style="margin:0 0 8px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight}; color:${EMAIL_STYLES.textColor};">Dear ${firstName},</p>
      <p style="margin:0 0 24px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight}; color:${EMAIL_STYLES.textColor};">Your email has been verified and your account is now active. You can sign in and start creating invoices and managing payments.</p>
      <div style="text-align:center; margin:28px 0;">
        <a href="${this.baseUrl}/dashboard" style="display:inline-block; padding:16px 32px; background-color:${EMAIL_STYLES.primaryColor}; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:${EMAIL_STYLES.fontSize}; font-family:${EMAIL_STYLES.fontFamily};">Go to dashboard</a>
      </div>
    `, { includeSecurityNotice: false });
    await this.sendEmail(email, 'HoldisPay: Welcome', html, `Hello ${data.firstName}, welcome to HoldisPay. Your account is active.`);
  }

  async sendPasswordResetEmail(email: string, data: {
    firstName: string;
    resetUrl: string;
    expiresInMinutes: number;
  }): Promise<void> {
    const firstName = escapeHtml(data.firstName);
    const resetUrl = data.resetUrl || '#';
    const html = emailLayout(`
      <h2 style="color:${EMAIL_STYLES.textColor}; margin:0 0 20px; font-size:22px; font-weight:700; font-family:${EMAIL_STYLES.fontFamily};">Reset your password</h2>
      <p style="margin:0 0 8px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight}; color:${EMAIL_STYLES.textColor};">Dear ${firstName},</p>
      <p style="margin:0 0 24px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight}; color:${EMAIL_STYLES.textColor};">We received a request to reset the password for your HoldisPay account. Use the link below to set a new password:</p>
      <div style="text-align:center; margin:28px 0;">
        <a href="${resetUrl}" style="display:inline-block; padding:16px 32px; background-color:${EMAIL_STYLES.primaryColor}; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:18px; font-family:${EMAIL_STYLES.fontFamily};">Set new password</a>
      </div>
      <p style="color:${EMAIL_STYLES.textMuted}; margin:0 0 4px; font-size:14px;">This link expires in ${data.expiresInMinutes} minutes.</p>
      <p style="color:${EMAIL_STYLES.textMutedLight}; margin:0; font-size:13px; word-break:break-all;">If you did not request this, you can safely ignore this email. If the button doesn't work, copy and paste this link into your browser:<br>${resetUrl}</p>
    `);
    const text = `Reset your password: ${resetUrl} (expires in ${data.expiresInMinutes} minutes)`;
    await this.sendEmail(email, 'HoldisPay: Reset your password', html, text);
  }

  async sendPasswordChangedEmail(email: string, data: {
    firstName: string;
  }): Promise<void> {
    const firstName = escapeHtml(data.firstName);
    const html = emailLayout(`
      <h2 style="color:${EMAIL_STYLES.textColor}; margin:0 0 20px; font-size:22px; font-weight:700; font-family:${EMAIL_STYLES.fontFamily};">Password updated</h2>
      <p style="margin:0 0 8px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight}; color:${EMAIL_STYLES.textColor};">Dear ${firstName},</p>
      <p style="margin:0 0 16px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight}; color:${EMAIL_STYLES.textColor};">The password for your HoldisPay account was changed successfully. For your security, all other sessions have been signed out.</p>
      <div style="background-color:#f0fdf4; border-left:4px solid #10b981; padding:14px 16px; margin:20px 0; border-radius:0 8px 8px 0;">
        <p style="margin:0; color:#065f46; font-size:${EMAIL_STYLES.fontSize};">All other devices have been signed out. Use your new password to sign in again.</p>
      </div>
      <p style="margin:16px 0 0; font-size:14px; color:${EMAIL_STYLES.textMuted};">If you did not make this change, please contact support immediately.</p>
    `, { includeSecurityNotice: false });
    await this.sendEmail(email, 'HoldisPay: Password updated', html, 'Your HoldisPay password was changed successfully. All other sessions have been signed out.');
  }

  async notifyAdminNewUser(data: any): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;

    const name = escapeHtml(data.name ?? ((`${data.firstName ?? ''} ${data.lastName ?? ''}`.trim()) || 'Not provided'));
    const emailAddr = escapeHtml(data.email);
    const accountType = escapeHtml(data.accountType ?? 'Not provided');
    const html = emailLayout(`
      <h2 style="color:${EMAIL_STYLES.textColor}; margin:0 0 20px; font-size:22px; font-weight:700; font-family:${EMAIL_STYLES.fontFamily};">New user registration</h2>
        <p style="margin:0 0 16px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">A new account has been registered on HoldisPay.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:${EMAIL_STYLES.fontSize}; line-height:1.6;">
          <tr><td style="padding:4px 12px 4px 0; color:${EMAIL_STYLES.textMuted}; font-weight:500;">Name</td><td style="padding:4px 0;">${name}</td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:${EMAIL_STYLES.textMuted}; font-weight:500;">Email</td><td style="padding:4px 0;">${emailAddr}</td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:${EMAIL_STYLES.textMuted}; font-weight:500;">Account type</td><td style="padding:4px 0;">${accountType}</td></tr>
        </table>
    `, { includeFooter: false, includeSecurityNotice: false });
    await this.sendEmail(adminEmail, 'HoldisPay: New user registration', html, `New user registered: ${data.email}`);
  }

  async notifyAdminNewInvoice(data: any): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;

    const invoiceId = escapeHtml(String(data.invoiceId));
    const amount = escapeHtml(String(data.amount));
    const issuer = escapeHtml(data.issuer);
    const html = emailLayout(`
      <h2 style="color:${EMAIL_STYLES.textColor}; margin:0 0 20px; font-size:22px; font-weight:700; font-family:${EMAIL_STYLES.fontFamily};">New invoice created</h2>
        <p style="margin:0 0 16px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">A new invoice has been created on the platform.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:${EMAIL_STYLES.fontSize}; line-height:1.6;">
          <tr><td style="padding:4px 12px 4px 0; color:${EMAIL_STYLES.textMuted}; font-weight:500;">Invoice</td><td style="padding:4px 0;">#${invoiceId}</td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:${EMAIL_STYLES.textMuted}; font-weight:500;">Amount</td><td style="padding:4px 0;">$${amount}</td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:${EMAIL_STYLES.textMuted}; font-weight:500;">Issuer</td><td style="padding:4px 0;">${issuer}</td></tr>
        </table>
    `, { includeFooter: false, includeSecurityNotice: false });
    await this.sendEmail(adminEmail, 'HoldisPay: New invoice created', html, `New invoice #${data.invoiceId} created`);
  }

  async notifyInvoiceCreated(email: string, data: any): Promise<void> {
    const invoiceId = escapeHtml(String(data.invoiceId));
    const amount = escapeHtml(String(data.amount));
    const paymentLink = (data.paymentLink && String(data.paymentLink).startsWith('http')) ? data.paymentLink : '';
    const linkBlock = paymentLink
      ? `<a href="${paymentLink}" style="display:inline-block; padding:14px 28px; background-color:${EMAIL_STYLES.primaryColor}; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:${EMAIL_STYLES.fontSize}; font-family:${EMAIL_STYLES.fontFamily};">View invoice</a>`
      : `<p style="margin:0; font-size:${EMAIL_STYLES.fontSize};">You can view and manage this invoice in your <a href="${this.baseUrl}/dashboard/invoices" style="color:${EMAIL_STYLES.primaryColor}; text-decoration:none;">dashboard</a>.</p>`;
    const html = emailLayout(`
      <h2 style="color:${EMAIL_STYLES.textColor}; margin:0 0 20px; font-size:22px; font-weight:700; font-family:${EMAIL_STYLES.fontFamily};">Invoice created</h2>
      <p style="margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight}; color:${EMAIL_STYLES.textColor};">Your invoice has been created successfully.</p>
      <p style="margin:0 0 8px; font-size:${EMAIL_STYLES.fontSize};"><strong>Invoice #</strong>${invoiceId}</p>
      <p style="margin:0 0 24px; font-size:${EMAIL_STYLES.fontSize};"><strong>Amount:</strong> $${amount}</p>
      ${linkBlock}
    `, { includeSecurityNotice: false });
    await this.sendEmail(email, 'HoldisPay: Invoice created', html, `Invoice #${data.invoiceId} created. Amount: $${data.amount}`);
  }

  async notifyInvoiceFunded(email: string, data: any): Promise<void> {
    const invoiceId = escapeHtml(String(data.invoiceId));
    const amount = escapeHtml(String(data.amount));
    const html = emailLayout(`
      <h2 style="color:${EMAIL_STYLES.textColor}; margin:0 0 20px; font-size:22px; font-weight:700; font-family:${EMAIL_STYLES.fontFamily};">Payment received</h2>
      <p style="margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight}; color:${EMAIL_STYLES.textColor};">Payment has been received for your invoice.</p>
      <p style="margin:0 0 8px; font-size:${EMAIL_STYLES.fontSize};"><strong>Invoice #</strong>${invoiceId}</p>
      <p style="margin:0 0 20px; font-size:${EMAIL_STYLES.fontSize};"><strong>Amount:</strong> ${amount}</p>
      <p style="margin:24px 0 0;"><a href="${this.baseUrl}/dashboard/invoices" style="display:inline-block; padding:16px 32px; background-color:${EMAIL_STYLES.primaryColor}; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:${EMAIL_STYLES.fontSize}; font-family:${EMAIL_STYLES.fontFamily};">View invoices</a></p>
    `, { includeSecurityNotice: false });
    await this.sendEmail(email, 'HoldisPay: Payment received', html, `Payment received for invoice #${data.invoiceId}: ${data.amount}`);
  }

  async notifyDeliverySubmitted(email: string, data: any): Promise<void> {
    const invoiceId = escapeHtml(String(data.invoiceId));
    const html = emailLayout(`
      <h2 style="color:${EMAIL_STYLES.textColor}; margin:0 0 20px; font-size:22px; font-weight:700; font-family:${EMAIL_STYLES.fontFamily};">Delivery submitted</h2>
      <p style="margin:0 0 20px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight}; color:${EMAIL_STYLES.textColor};">Delivery has been submitted for invoice #${invoiceId}. You can review and confirm it in your dashboard.</p>
      <p style="margin:24px 0 0;"><a href="${this.baseUrl}/dashboard/invoices" style="display:inline-block; padding:16px 32px; background-color:${EMAIL_STYLES.primaryColor}; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:${EMAIL_STYLES.fontSize}; font-family:${EMAIL_STYLES.fontFamily};">View invoices</a></p>
    `, { includeSecurityNotice: false });
    await this.sendEmail(email, 'HoldisPay: Delivery submitted', html, `Delivery submitted for invoice #${data.invoiceId}`);
  }

  async notifyInvoiceCompleted(email: string, data: any): Promise<void> {
    const invoiceId = escapeHtml(String(data.invoiceId));
    const amount = escapeHtml(String(data.amount));
    const html = emailLayout(`
      <h2 style="color:${EMAIL_STYLES.textColor}; margin:0 0 20px; font-size:22px; font-weight:700; font-family:${EMAIL_STYLES.fontFamily};">Invoice completed</h2>
      <p style="margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight}; color:${EMAIL_STYLES.textColor};">Invoice #${invoiceId} has been completed successfully.</p>
      <p style="margin:0 0 20px; font-size:${EMAIL_STYLES.fontSize};"><strong>Amount:</strong> ${amount}</p>
      <p style="margin:24px 0 0;"><a href="${this.baseUrl}/dashboard/invoices" style="display:inline-block; padding:16px 32px; background-color:${EMAIL_STYLES.primaryColor}; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:${EMAIL_STYLES.fontSize}; font-family:${EMAIL_STYLES.fontFamily};">View invoices</a></p>
    `, { includeSecurityNotice: false });
    await this.sendEmail(email, 'HoldisPay: Invoice completed', html, `Invoice #${data.invoiceId} completed. Amount: ${data.amount}`);
  }

  async notifyInvoiceCancelled(email: string, data: any): Promise<void> {
    const invoiceId = escapeHtml(String(data.invoiceId));
    const html = emailLayout(`
      <h2 style="color:#dc2626; margin:0 0 20px; font-size:22px; font-weight:700; font-family:${EMAIL_STYLES.fontFamily};">Invoice cancelled</h2>
      <p style="margin:0; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight}; color:${EMAIL_STYLES.textColor};">Invoice #${invoiceId} has been cancelled. No further action is required.</p>
    `, { includeSecurityNotice: false });
    await this.sendEmail(email, 'HoldisPay: Invoice cancelled', html, `Invoice #${data.invoiceId} has been cancelled`);
  }

  async notifyDepositReceived(email: string, data: any): Promise<void> {
    const amount = escapeHtml(String(data.amount));
    const token = escapeHtml(String(data.token));
    const txHash = escapeHtml(String(data.txHash));
    const html = emailLayout(`
      <h2 style="color:${EMAIL_STYLES.textColor}; margin:0 0 20px; font-size:22px; font-weight:700; font-family:${EMAIL_STYLES.fontFamily};">Deposit received</h2>
      <p style="margin:0 0 16px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight}; color:${EMAIL_STYLES.textColor};">A deposit has been credited to your wallet.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:${EMAIL_STYLES.fontSize}; line-height:1.6;">
        <tr><td style="padding:4px 12px 4px 0; color:${EMAIL_STYLES.textMuted}; font-weight:500;">Amount</td><td style="padding:4px 0;">${amount}</td></tr>
        <tr><td style="padding:4px 12px 4px 0; color:${EMAIL_STYLES.textMuted}; font-weight:500;">Token</td><td style="padding:4px 0;">${token}</td></tr>
        <tr><td style="padding:4px 12px 4px 0; color:${EMAIL_STYLES.textMuted}; font-weight:500;">Transaction</td><td style="padding:4px 0; font-size:13px; word-break:break-all;">${txHash}</td></tr>
      </table>
      <p style="margin:24px 0 0;"><a href="${this.baseUrl}/dashboard/wallet" style="display:inline-block; padding:16px 32px; background-color:${EMAIL_STYLES.primaryColor}; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:${EMAIL_STYLES.fontSize}; font-family:${EMAIL_STYLES.fontFamily};">View wallet</a></p>
    `, { includeSecurityNotice: false });
    await this.sendEmail(email, 'HoldisPay: Deposit received', html, `Deposit received: ${data.amount} ${data.token}`);
  }

  async notifyInvoicePaid(email: string, data: { invoiceId: string; amount: string; customerName?: string }): Promise<void> {
    const invoiceId = escapeHtml(data.invoiceId);
    const amount = escapeHtml(data.amount);
    const customerName = data.customerName ? escapeHtml(data.customerName) : '';
    const html = emailLayout(`
      <h2 style="color:${EMAIL_STYLES.textColor}; margin:0 0 20px; font-size:22px; font-weight:700; font-family:${EMAIL_STYLES.fontFamily};">Invoice paid</h2>
      <p style="margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight}; color:${EMAIL_STYLES.textColor};">Invoice #${invoiceId} has been paid.</p>
      <p style="margin:0 0 8px; font-size:${EMAIL_STYLES.fontSize};"><strong>Amount:</strong> ${amount}</p>
      ${customerName ? `<p style="margin:0 0 20px; font-size:${EMAIL_STYLES.fontSize};"><strong>Paid by:</strong> ${customerName}</p>` : '<p style="margin:0 0 20px;"> </p>'}
      <p style="margin:24px 0 0;"><a href="${this.baseUrl}/dashboard/invoices" style="display:inline-block; padding:16px 32px; background-color:${EMAIL_STYLES.primaryColor}; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:${EMAIL_STYLES.fontSize}; font-family:${EMAIL_STYLES.fontFamily};">View invoices</a></p>
    `, { includeSecurityNotice: false });
    await this.sendEmail(email, 'HoldisPay: Invoice paid', html, `Invoice #${data.invoiceId} paid: ${data.amount}`);
  }

  async notifyInvoiceExpired(email: string, data: { invoiceId: string; dueDate: string }): Promise<void> {
    const invoiceId = escapeHtml(data.invoiceId);
    const dueDate = escapeHtml(data.dueDate);
    const html = emailLayout(`
      <h2 style="color:#b45309; margin:0 0 20px; font-size:22px; font-weight:700; font-family:${EMAIL_STYLES.fontFamily};">Invoice expired</h2>
      <p style="margin:0 0 12px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight}; color:${EMAIL_STYLES.textColor};">Invoice #${invoiceId} has expired. The due date was ${dueDate}.</p>
      <p style="margin:0 0 24px; font-size:${EMAIL_STYLES.fontSize}; line-height:${EMAIL_STYLES.lineHeight};">You can create a new invoice from your dashboard if payment is still needed.</p>
      <p style="margin:24px 0 0;"><a href="${this.baseUrl}/dashboard/invoices/create" style="display:inline-block; padding:16px 32px; background-color:${EMAIL_STYLES.primaryColor}; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:${EMAIL_STYLES.fontSize}; font-family:${EMAIL_STYLES.fontFamily};">Create new invoice</a></p>
    `, { includeSecurityNotice: false });
    await this.sendEmail(email, 'HoldisPay: Invoice expired', html, `Invoice #${data.invoiceId} expired. Due date was ${data.dueDate}`);
  }
}

export const emailService = new EmailService();
