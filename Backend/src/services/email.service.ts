import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';
import { env } from '../config/env';

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private enabled: boolean;

  constructor() {
    this.enabled = env.NODE_ENV === 'production' && !!process.env.SMTP_HOST;

    if (this.enabled) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      logger.info('Email service initialized with SMTP');
    } else {
      logger.info('Email service in development mode (logging only)');
    }
  }

  private async sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
    if (this.enabled && this.transporter) {
      try {
        await this.transporter.sendMail({
          from: process.env.EMAIL_FROM || 'noreply@holdis.app',
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

  async notifyUserRegistration(email: string, data: { firstName: string }): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #14b8a6;">Welcome to holDis!</h2>
        <p>Hi ${data.firstName},</p>
        <p>Your account has been created successfully. You can now start creating invoices and managing payments.</p>
        <a href="${env.FRONTEND_URL}/dashboard" style="display: inline-block; padding: 12px 24px; background-color: #14b8a6; color: white; text-decoration: none; border-radius: 8px; margin: 16px 0;">
          Go to Dashboard
        </a>
      </div>
    `;
    await this.sendEmail(email, 'Welcome to holDis', html, `Hi ${data.firstName}, welcome to holDis!`);
  }

  async notifyAdminKYCSubmission(data: { email: string; name: string }): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #14b8a6;">New KYC Submission</h2>
        <p>User ${data.name} (${data.email}) has submitted KYC documents for review.</p>
        <a href="${env.FRONTEND_URL}/admin/users" style="display: inline-block; padding: 12px 24px; background-color: #14b8a6; color: white; text-decoration: none; border-radius: 8px; margin: 16px 0;">
          Review Submission
        </a>
      </div>
    `;
    await this.sendEmail(adminEmail, 'New KYC Submission - holDis', html, `New KYC submission from ${data.name}`);
  }

  async sendPasswordResetEmail(email: string, data: {
    firstName: string;
    resetUrl: string;
    expiresInMinutes: number;
  }): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6; margin: 0;">holDis</h1>
        </div>
        <h2 style="color: #333;">Reset Your Password</h2>
        <p>Hi ${data.firstName},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.resetUrl}" style="display: inline-block; padding: 14px 32px; background-color: #14b8a6; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
            Reset Password
          </a>
        </div>
        <p style="color: #f59e0b; font-weight: 600;">⏰ This link expires in ${data.expiresInMinutes} minutes.</p>
        <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">Link: ${data.resetUrl}</p>
      </div>
    `;
    const text = `Reset your password: ${data.resetUrl} (expires in ${data.expiresInMinutes} minutes)`;
    
    await this.sendEmail(email, 'Reset Your Password - holDis', html, text);
  }

  async sendPasswordChangedEmail(email: string, data: {
    firstName: string;
  }): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6; margin: 0;">holDis</h1>
        </div>
        <h2 style="color: #333;">Password Changed Successfully</h2>
        <p>Hi ${data.firstName},</p>
        <p>Your password has been successfully changed. All your active sessions have been logged out for security.</p>
        <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0;">
          <p style="margin: 0; color: #065f46;">✅ All active sessions have been logged out.</p>
        </div>
        <p>If you didn't make this change, please contact our support team immediately.</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">Time: ${new Date().toLocaleString()}</p>
      </div>
    `;
    await this.sendEmail(email, 'Password Changed - holDis', html, `Your password has been changed successfully.`);
  }

  async notifyAdminNewUser(data: any): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #14b8a6;">New User Registration</h2>
        <p>A new user has registered:</p>
        <ul>
          <li>Name: ${data.firstName} ${data.lastName}</li>
          <li>Email: ${data.email}</li>
          <li>Account Type: ${data.accountType}</li>
        </ul>
      </div>
    `;
    await this.sendEmail(adminEmail, 'New User Registration - holDis', html, `New user: ${data.email}`);
  }

  async notifyAdminNewInvoice(data: any): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #14b8a6;">New Invoice Created</h2>
        <p>Invoice #${data.invoiceId} has been created.</p>
        <ul>
          <li>Amount: $${data.amount}</li>
          <li>Issuer: ${data.issuer}</li>
        </ul>
      </div>
    `;
    await this.sendEmail(adminEmail, 'New Invoice - holDis', html, `New invoice #${data.invoiceId}`);
  }

  async notifyInvoiceCreated(email: string, data: any): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #14b8a6;">Invoice Created</h2>
        <p>Your invoice #${data.invoiceId} has been created successfully.</p>
        <p>Amount: $${data.amount}</p>
        <a href="${data.paymentLink}" style="display: inline-block; padding: 12px 24px; background-color: #14b8a6; color: white; text-decoration: none; border-radius: 8px; margin: 16px 0;">
          View Invoice
        </a>
      </div>
    `;
    await this.sendEmail(email, 'Invoice Created - holDis', html, `Invoice #${data.invoiceId} created`);
  }

  async notifyInvoiceFunded(email: string, data: any): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #14b8a6;">Payment Received</h2>
        <p>Invoice #${data.invoiceId} has been funded.</p>
        <p>Amount: ${data.amount}</p>
      </div>
    `;
    await this.sendEmail(email, 'Payment Received - holDis', html, `Invoice #${data.invoiceId} funded`);
  }

  async notifyDeliverySubmitted(email: string, data: any): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #14b8a6;">Delivery Submitted</h2>
        <p>Delivery has been submitted for invoice #${data.invoiceId}.</p>
      </div>
    `;
    await this.sendEmail(email, 'Delivery Submitted - holDis', html, `Delivery submitted for invoice #${data.invoiceId}`);
  }

  async notifyInvoiceCompleted(email: string, data: any): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #14b8a6;">Invoice Completed</h2>
        <p>Invoice #${data.invoiceId} has been completed successfully.</p>
        <p>Amount: ${data.amount}</p>
      </div>
    `;
    await this.sendEmail(email, 'Invoice Completed - holDis', html, `Invoice #${data.invoiceId} completed`);
  }

  async notifyInvoiceCancelled(email: string, data: any): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ef4444;">Invoice Cancelled</h2>
        <p>Invoice #${data.invoiceId} has been cancelled.</p>
      </div>
    `;
    await this.sendEmail(email, 'Invoice Cancelled - holDis', html, `Invoice #${data.invoiceId} cancelled`);
  }

  async notifyDepositReceived(email: string, data: any): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #14b8a6;">Deposit Received</h2>
        <p>You've received a deposit:</p>
        <ul>
          <li>Amount: ${data.amount}</li>
          <li>Token: ${data.token}</li>
          <li>Transaction: ${data.txHash}</li>
        </ul>
      </div>
    `;
    await this.sendEmail(email, 'Deposit Received - holDis', html, `Deposit received: ${data.amount}`);
  }

  async notifyInvoicePaid(email: string, data: { invoiceId: string; amount: string; customerName?: string }): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #14b8a6;">Invoice paid</h2>
        <p>Invoice #${data.invoiceId} has been paid.</p>
        <p><strong>Amount:</strong> ${data.amount}</p>
        ${data.customerName ? `<p><strong>Paid by:</strong> ${data.customerName}</p>` : ''}
        <a href="${env.FRONTEND_URL}/dashboard/invoices" style="display: inline-block; padding: 12px 24px; background-color: #14b8a6; color: white; text-decoration: none; border-radius: 8px; margin: 16px 0;">View invoices</a>
      </div>
    `;
    await this.sendEmail(email, 'Invoice paid - holDis', html, `Invoice #${data.invoiceId} paid: ${data.amount}`);
  }

  async notifyInvoiceExpired(email: string, data: { invoiceId: string; dueDate: string }): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">Invoice expired</h2>
        <p>Invoice #${data.invoiceId} has expired (valid until date was ${data.dueDate}).</p>
        <p>You can create a new invoice if your customer still needs to pay.</p>
        <a href="${env.FRONTEND_URL}/dashboard/invoices/create" style="display: inline-block; padding: 12px 24px; background-color: #14b8a6; color: white; text-decoration: none; border-radius: 8px; margin: 16px 0;">Create new invoice</a>
      </div>
    `;
    await this.sendEmail(email, 'Invoice expired - holDis', html, `Invoice #${data.invoiceId} expired`);
  }
}

export const emailService = new EmailService();
