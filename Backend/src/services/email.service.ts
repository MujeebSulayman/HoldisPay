import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private from: string;
  private enabled: boolean;

  constructor() {
    this.from = process.env.EMAIL_FROM || 'noreply@holdis.app';
    this.enabled = !!process.env.EMAIL_ENABLED && process.env.EMAIL_ENABLED === 'true';

    if (!this.enabled) {
      logger.info('Email notifications disabled');
      return;
    }

    this.initializeTransporter();
  }

  private getEmailTemplate(content: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Holdis</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #e5e7eb;">
                      <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #4F46E5;">holDis</h1>
                    </td>
                  </tr>
                  <!-- Content -->
                  <tr>
                    <td style="padding: 32px; color: #374151; font-size: 16px; line-height: 1.6;">
                      ${content}
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center; border-radius: 0 0 8px 8px;">
                      <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">Best regards,<br>The holDis Team</p>
                      <p style="margin: 0; font-size: 12px; color: #9ca3af;">This is an automated message, please do not reply.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  }

  private initializeTransporter() {
    const provider = process.env.EMAIL_PROVIDER || 'smtp';

    try {
      switch (provider) {
        case 'sendgrid':
          this.transporter = nodemailer.createTransport({
            host: 'smtp.sendgrid.net',
            port: 587,
            auth: {
              user: 'apikey',
              pass: process.env.SENDGRID_API_KEY,
            },
          });
          break;

        case 'mailgun':
          this.transporter = nodemailer.createTransport({
            host: process.env.MAILGUN_SMTP_HOST || 'smtp.mailgun.org',
            port: 587,
            auth: {
              user: process.env.MAILGUN_SMTP_USER,
              pass: process.env.MAILGUN_SMTP_PASSWORD,
            },
          });
          break;

        case 'smtp':
        default:
          this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD,
            },
          });
          break;
      }

      logger.info('Email service initialized', { provider });
    } catch (error) {
      logger.error('Failed to initialize email service', { error, provider });
      this.enabled = false;
    }
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    if (!this.enabled || !this.transporter) {
      logger.debug('Email skipped (disabled)', { to: options.to, subject: options.subject });
      return;
    }

    try {
      await this.transporter.sendMail({
        from: `holDis <${this.from}>`,
        to: options.to,
        subject: options.subject,
        html: this.getEmailTemplate(options.html),
        text: options.text,
        headers: {
          'X-Priority': '1',
          'Importance': 'high',
          'X-MSMail-Priority': 'High',
        },
      });

      logger.info('Email sent successfully', {
        to: options.to,
        subject: options.subject,
      });
    } catch (error) {
      logger.error('Failed to send email', {
        error,
        to: options.to,
        subject: options.subject,
      });
      // Don't throw - email failures shouldn't break the main flow
    }
  }

  // Invoice notification templates
  async notifyInvoiceCreated(
    recipientEmail: string,
    invoiceData: {
      invoiceId: string;
      amount: string;
      description: string;
      paymentLinkUrl?: string;
    }
  ): Promise<void> {
    await this.sendEmail({
      to: recipientEmail,
      subject: `New Invoice #${invoiceData.invoiceId} Created`,
      html: `
        <h2 style="margin: 0 0 24px; font-size: 24px; font-weight: 600; color: #111827;">Invoice Created Successfully</h2>
        <p style="margin: 0 0 20px; color: #4b5563;">Your new invoice has been created and is ready.</p>
        
        <div style="background-color: #f9fafb; border-radius: 6px; padding: 20px; margin: 24px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Invoice ID</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600; text-align: right;">#${invoiceData.invoiceId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Amount</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600; text-align: right;">${invoiceData.amount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Description</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600; text-align: right;">${invoiceData.description}</td>
            </tr>
          </table>
        </div>
        
        ${
          invoiceData.paymentLinkUrl
            ? `<div style="text-align: center; margin: 32px 0;">
                <a href="${invoiceData.paymentLinkUrl}" style="background: #4F46E5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Pay Invoice</a>
              </div>`
            : ''
        }
      `,
      text: `Invoice #${invoiceData.invoiceId} created for ${invoiceData.amount}. ${
        invoiceData.paymentLinkUrl ? `Pay here: ${invoiceData.paymentLinkUrl}` : ''
      }`,
    });
  }

  async notifyInvoiceFunded(
    recipientEmail: string,
    invoiceData: {
      invoiceId: string;
      amount: string;
      payer: string;
    }
  ): Promise<void> {
    await this.sendEmail({
      to: recipientEmail,
      subject: `Invoice #${invoiceData.invoiceId} Has Been Funded`,
      html: `
        <h2 style="margin: 0 0 24px; font-size: 24px; font-weight: 600; color: #111827;">Payment Received</h2>
        <p style="margin: 0 0 20px; color: #4b5563;">Great news! Your invoice has been funded and the amount is now securely held in escrow.</p>
        
        <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 6px; padding: 20px; margin: 24px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #065f46; font-size: 14px;">Invoice ID</td>
              <td style="padding: 8px 0; color: #065f46; font-weight: 600; text-align: right;">#${invoiceData.invoiceId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #065f46; font-size: 14px;">Amount</td>
              <td style="padding: 8px 0; color: #065f46; font-weight: 600; text-align: right;">${invoiceData.amount}</td>
            </tr>
          </table>
        </div>
        
        <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px;">The funds will be released once delivery is confirmed.</p>
      `,
      text: `Invoice #${invoiceData.invoiceId} has been funded with ${invoiceData.amount}.`,
    });
  }

  async notifyInvoiceCompleted(
    recipientEmail: string,
    invoiceData: {
      invoiceId: string;
      amount: string;
      receiver: string;
    }
  ): Promise<void> {
    await this.sendEmail({
      to: recipientEmail,
      subject: `Invoice #${invoiceData.invoiceId} Completed`,
      html: `
        <h2 style="margin: 0 0 24px; font-size: 24px; font-weight: 600; color: #111827;">Invoice Completed</h2>
        <p style="margin: 0 0 20px; color: #4b5563;">Your invoice has been successfully completed and the funds have been released.</p>
        
        <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 6px; padding: 20px; margin: 24px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #065f46; font-size: 14px;">Invoice ID</td>
              <td style="padding: 8px 0; color: #065f46; font-weight: 600; text-align: right;">#${invoiceData.invoiceId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #065f46; font-size: 14px;">Amount Released</td>
              <td style="padding: 8px 0; color: #065f46; font-weight: 600; text-align: right;">${invoiceData.amount}</td>
            </tr>
          </table>
        </div>
        
        <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px;">The transaction is now final. You can view the details in your dashboard.</p>
      `,
      text: `Invoice #${invoiceData.invoiceId} completed. ${invoiceData.amount} released to receiver.`,
    });
  }

  async notifyDeliverySubmitted(
    recipientEmail: string,
    invoiceData: {
      invoiceId: string;
      issuer: string;
    }
  ): Promise<void> {
    await this.sendEmail({
      to: recipientEmail,
      subject: `Delivery Proof Submitted - Invoice #${invoiceData.invoiceId}`,
      html: `
        <h2 style="margin: 0 0 24px; font-size: 24px; font-weight: 600; color: #111827;">Delivery Submitted</h2>
        <p style="margin: 0 0 20px; color: #4b5563;">The service provider has submitted proof of delivery for your invoice.</p>
        
        <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 20px; margin: 24px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #1e40af; font-size: 14px;">Invoice ID</td>
              <td style="padding: 8px 0; color: #1e40af; font-weight: 600; text-align: right;">#${invoiceData.invoiceId}</td>
            </tr>
          </table>
        </div>
        
        <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px;">Please review the delivery and confirm in your dashboard to release the funds.</p>
      `,
      text: `Delivery submitted for invoice #${invoiceData.invoiceId}. Please confirm.`,
    });
  }

  async notifyInvoiceCancelled(
    recipientEmail: string,
    invoiceData: {
      invoiceId: string;
      reason?: string;
    }
  ): Promise<void> {
    await this.sendEmail({
      to: recipientEmail,
      subject: `Invoice #${invoiceData.invoiceId} Has Been Cancelled`,
      html: `
        <h2 style="margin: 0 0 24px; font-size: 24px; font-weight: 600; color: #111827;">Invoice Cancelled</h2>
        <p style="margin: 0 0 20px; color: #4b5563;">Invoice #${invoiceData.invoiceId} has been cancelled.</p>
        
        ${invoiceData.reason ? `<div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 6px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0; color: #991b1b; font-size: 14px;"><strong>Reason:</strong> ${invoiceData.reason}</p>
        </div>` : ''}
        
        <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px;">Any held funds will be automatically refunded to the payer.</p>
      `,
      text: `Invoice #${invoiceData.invoiceId} cancelled. ${invoiceData.reason || ''}`,
    });
  }

  async notifyUserRegistration(
    recipientEmail: string,
    userData: {
      firstName: string;
    }
  ): Promise<void> {
    await this.sendEmail({
      to: recipientEmail,
      subject: 'Welcome to holDis!',
      html: `
        <h2 style="margin: 0 0 24px; font-size: 24px; font-weight: 600; color: #111827;">Welcome to holDis, ${userData.firstName}!</h2>
        <p style="margin: 0 0 20px; color: #4b5563;">Your account has been successfully created. You're all set to start managing your invoices and payments.</p>
        
        <div style="background-color: #f9fafb; border-radius: 6px; padding: 20px; margin: 24px 0;">
          <h3 style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #111827;">What you can do now:</h3>
          <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
            <li style="margin-bottom: 8px;">Create and send invoices</li>
            <li style="margin-bottom: 8px;">Receive secure payments</li>
            <li style="margin-bottom: 8px;">Track all your transactions</li>
            <li style="margin-bottom: 0;">Manage your account</li>
          </ul>
        </div>
        
        <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px;">Get started by logging into your dashboard.</p>
      `,
      text: `Welcome to holDis, ${userData.firstName}! Your account has been created successfully.`,
    });
  }

  async notifyDepositReceived(
    recipientEmail: string,
    depositData: {
      amount: string;
      amountUSD?: string;
      token: string;
    }
  ): Promise<void> {
    await this.sendEmail({
      to: recipientEmail,
      subject: 'Payment Received',
      html: `
        <h2 style="margin: 0 0 24px; font-size: 24px; font-weight: 600; color: #111827;">Payment Received</h2>
        <p style="margin: 0 0 20px; color: #4b5563;">You've received a new payment to your account.</p>
        
        <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 6px; padding: 20px; margin: 24px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #065f46; font-size: 14px;">Amount</td>
              <td style="padding: 8px 0; color: #065f46; font-weight: 600; text-align: right;">${depositData.amount}</td>
            </tr>
            ${depositData.amountUSD ? `<tr>
              <td style="padding: 8px 0; color: #065f46; font-size: 14px;">USD Value</td>
              <td style="padding: 8px 0; color: #065f46; font-weight: 600; text-align: right;">$${depositData.amountUSD}</td>
            </tr>` : ''}
          </table>
        </div>
        
        <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px;">View your updated balance and transaction details in your dashboard.</p>
      `,
      text: `Payment received: ${depositData.amount}. ${depositData.amountUSD ? `Value: $${depositData.amountUSD}` : ''}`,
    });
  }

  async notifyAdminNewUser(userData: {
    email: string;
    name: string;
    accountType: string;
  }): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;

    await this.sendEmail({
      to: adminEmail,
      subject: '🎉 New User Registration - holDis',
      html: `
        <h2 style="color: #14b8a6; margin-bottom: 24px;">New User Registered</h2>
        <p style="margin: 16px 0; color: #374151; line-height: 1.6;">A new user has registered on the platform:</p>
        
        <div style="background-color: #f0fdfa; border-left: 4px solid #14b8a6; padding: 16px; margin: 24px 0; border-radius: 4px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #065f46; font-size: 14px;">Name</td>
              <td style="padding: 8px 0; color: #065f46; font-weight: 600; text-align: right;">${userData.name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #065f46; font-size: 14px;">Email</td>
              <td style="padding: 8px 0; color: #065f46; font-weight: 600; text-align: right;">${userData.email}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #065f46; font-size: 14px;">Account Type</td>
              <td style="padding: 8px 0; color: #065f46; font-weight: 600; text-align: right;">${userData.accountType}</td>
            </tr>
          </table>
        </div>
      `,
      text: `New user registered: ${userData.name} (${userData.email}) - ${userData.accountType}`,
    });
  }

  async notifyAdminNewInvoice(invoiceData: {
    invoiceId: string;
    amount: string;
    issuer: string;
  }): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;

    await this.sendEmail({
      to: adminEmail,
      subject: '📄 New Invoice Created - holDis',
      html: `
        <h2 style="color: #14b8a6; margin-bottom: 24px;">New Invoice Created</h2>
        <p style="margin: 16px 0; color: #374151; line-height: 1.6;">A new invoice has been created on the platform:</p>
        
        <div style="background-color: #f0fdfa; border-left: 4px solid #14b8a6; padding: 16px; margin: 24px 0; border-radius: 4px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #065f46; font-size: 14px;">Invoice ID</td>
              <td style="padding: 8px 0; color: #065f46; font-weight: 600; text-align: right;">#${invoiceData.invoiceId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #065f46; font-size: 14px;">Amount</td>
              <td style="padding: 8px 0; color: #065f46; font-weight: 600; text-align: right;">${invoiceData.amount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #065f46; font-size: 14px;">Issuer</td>
              <td style="padding: 8px 0; color: #065f46; font-weight: 600; text-align: right;">${invoiceData.issuer}</td>
            </tr>
          </table>
        </div>
      `,
      text: `New invoice created: #${invoiceData.invoiceId} - ${invoiceData.amount} by ${invoiceData.issuer}`,
    });
  }

  async notifyAdminKYCSubmission(userData: {
    email: string;
    name: string;
  }): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;

    await this.sendEmail({
      to: adminEmail,
      subject: '🔍 New KYC Submission - holDis',
      html: `
        <h2 style="color: #14b8a6; margin-bottom: 24px;">New KYC Submission</h2>
        <p style="margin: 16px 0; color: #374151; line-height: 1.6;">A user has submitted KYC documents for review:</p>
        
        <div style="background-color: #f0fdfa; border-left: 4px solid #14b8a6; padding: 16px; margin: 24px 0; border-radius: 4px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #065f46; font-size: 14px;">Name</td>
              <td style="padding: 8px 0; color: #065f46; font-weight: 600; text-align: right;">${userData.name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #065f46; font-size: 14px;">Email</td>
              <td style="padding: 8px 0; color: #065f46; font-weight: 600; text-align: right;">${userData.email}</td>
            </tr>
          </table>
        </div>
        
        <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px;">Please review the submission in the admin dashboard.</p>
      `,
      text: `New KYC submission from ${userData.name} (${userData.email})`,
    });
  }
}

export const emailService = new EmailService();
