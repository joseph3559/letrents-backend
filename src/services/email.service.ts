import { env } from '../config/env.js';

// Email service interface
export interface EmailProvider {
  sendEmail(options: EmailOptions): Promise<EmailResult>;
  sendTemplateEmail(options: TemplateEmailOptions): Promise<EmailResult>;
}

export interface EmailOptions {
  to: string | string[];
  from?: {
    email: string;
    name: string;
  };
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
  type?: string; // Email type for tracking/categorization
}

export interface TemplateEmailOptions {
  to: string | string[];
  from?: {
    email: string;
    name: string;
  };
  templateId: string;
  templateData?: Record<string, any>;
  subject?: string;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  type?: string;
  disposition?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Email service factory
export class EmailService {
  private provider: EmailProvider;

  constructor() {
    // Determine which provider to use based on environment configuration
    const emailProvider = env.email.provider || 'brevo'; // Default to Brevo
    
    switch (emailProvider.toLowerCase()) {
      case 'sendgrid':
        this.provider = new SendGridProvider();
        break;
      case 'brevo':
      case 'sendinblue':
        this.provider = new BrevoProvider();
        break;
      default:
        throw new Error(`Unsupported email provider: ${emailProvider}`);
    }
  }

  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    try {
      // Set default from address if not provided
      if (!options.from) {
        options.from = {
          email: env.email.fromAddress,
          name: env.email.fromName,
        };
      }

      return await this.provider.sendEmail(options);
    } catch (error) {
      console.error('Error sending email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async sendTemplateEmail(options: TemplateEmailOptions): Promise<EmailResult> {
    try {
      // Set default from address if not provided
      if (!options.from) {
        options.from = {
          email: env.email.fromAddress,
          name: env.email.fromName,
        };
      }

      return await this.provider.sendTemplateEmail(options);
    } catch (error) {
      console.error('Error sending template email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Convenience methods for common email types
  async sendVerificationEmail(email: string, verificationUrl: string, userName?: string): Promise<EmailResult> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - LetRents</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to LetRents</h1>
          </div>
          <div class="content">
            <h2>Verify Your Email Address</h2>
            <p>Hello ${userName || 'there'},</p>
            <p>Thank you for creating your LetRents account! To complete your registration and start using our platform, please verify your email address by clicking the button below:</p>
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Account</a>
            </div>
            <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #2563eb;">${verificationUrl}</p>
            <p>This verification link will expire in 24 hours for security reasons.</p>
            <p>If you didn't create this account, please ignore this email.</p>
            <p>Best regards,<br>The LetRents Team</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} LetRents. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Verify Your Email - LetRents',
      html,
      text: `Welcome to LetRents! Please verify your email address by visiting: ${verificationUrl}`,
    });
  }

  async sendPasswordResetEmail(email: string, resetUrl: string, userName?: string): Promise<EmailResult> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password - LetRents</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .button { display: inline-block; background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Reset Your Password</h2>
            <p>Hello ${userName || 'there'},</p>
            <p>We received a request to reset your password for your LetRents account. If you made this request, click the button below to set a new password:</p>
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #dc3545;">${resetUrl}</p>
            <div class="warning">
              <strong>Security Notice:</strong> This password reset link will expire in 1 hour for security reasons. If you didn't request this password reset, please ignore this email and your password will remain unchanged.
            </div>
            <p>If you're having trouble accessing your account, please contact our support team.</p>
            <p>Best regards,<br>The LetRents Team</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} LetRents. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Reset Your Password - LetRents',
      html,
      text: `Reset your LetRents password by visiting: ${resetUrl}`,
    });
  }

  async sendPaymentReceipt(options: {
    to: string;
    tenant_name: string;
    payment_amount: number;
    payment_date: string;
    payment_method: string;
    receipt_number: string;
    reference_number?: string;
    transaction_id?: string;
    property_name: string;
    unit_number: string;
    invoice_numbers?: string[];
    payment_period?: string;
  }): Promise<EmailResult> {
    const { 
      to, 
      tenant_name, 
      payment_amount, 
      payment_date, 
      payment_method, 
      receipt_number, 
      reference_number,
      transaction_id,
      property_name, 
      unit_number,
      invoice_numbers,
      payment_period
    } = options;
    
    const formattedDate = new Date(payment_date).toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Receipt - LetRents</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background-color: #f3f4f6;
          }
          .email-wrapper { background-color: #f3f4f6; padding: 40px 20px; }
          .container { 
            max-width: 750px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 16px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            overflow: hidden;
          }
          .header { 
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white; 
            padding: 50px 30px; 
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          .header::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -10%;
            width: 300px;
            height: 300px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 50%;
            z-index: 0;
          }
          .header::after {
            content: '';
            position: absolute;
            bottom: -30%;
            left: -5%;
            width: 200px;
            height: 200px;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 50%;
            z-index: 0;
          }
          .header-content {
            position: relative;
            z-index: 1;
          }
          .header-icon { 
            width: 100px; 
            height: 100px; 
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.2) 100%);
            border: 4px solid rgba(255, 255, 255, 0.4);
            border-radius: 50%; 
            display: inline-flex; 
            align-items: center; 
            justify-content: center; 
            margin-bottom: 20px;
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15);
            animation: float 3s ease-in-out infinite;
            position: relative;
          }
          .header-icon::before {
            content: '✓';
            font-size: 55px;
            font-weight: bold;
            color: white;
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }
          .header h1 { 
            font-size: 32px; 
            font-weight: 800; 
            margin-bottom: 10px;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            letter-spacing: -0.5px;
          }
          .header p { 
            font-size: 16px; 
            opacity: 0.95;
            font-weight: 400;
            letter-spacing: 0.3px;
          }
          .header-badge {
            display: inline-block;
            background: rgba(255, 255, 255, 0.2);
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-top: 12px;
            border: 1px solid rgba(255, 255, 255, 0.3);
          }
          .success-badge {
            background: #10b981;
            color: white;
            display: inline-block;
            padding: 8px 20px;
            border-radius: 24px;
            font-size: 14px;
            font-weight: 600;
            margin: 20px 0;
          }
          .content { padding: 40px 30px; }
          .greeting { 
            font-size: 18px; 
            font-weight: 600; 
            color: #1f2937;
            margin-bottom: 16px;
          }
          .intro-text { 
            font-size: 15px; 
            color: #6b7280;
            margin-bottom: 30px;
            line-height: 1.7;
          }
          .amount-card {
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
            border: 2px solid #10b981;
            border-radius: 12px;
            padding: 30px;
            text-align: center;
            margin: 30px 0;
          }
          .amount-label {
            font-size: 14px;
            color: #047857;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
          }
          .amount-value {
            font-size: 42px;
            font-weight: 800;
            color: #059669;
            letter-spacing: -1px;
          }
          .amount-currency {
            font-size: 24px;
            font-weight: 600;
            color: #059669;
            margin-right: 4px;
          }
          .details-section {
            background: #f9fafb;
            border-radius: 12px;
            padding: 28px 32px;
            margin: 24px 0;
          }
          .details-title {
            font-size: 16px;
            font-weight: 700;
            color: #1f2937;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 2px solid #e5e7eb;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 8px;
            border-bottom: 1px solid #e5e7eb;
            min-height: 65px;
            gap: 40px;
          }
          .detail-row:last-child { border-bottom: none; }
          .detail-label {
            font-size: 14px;
            color: #6b7280;
            font-weight: 600;
            flex: 0 0 auto;
            max-width: 40%;
            min-width: 180px;
          }
          .detail-value {
            font-size: 14px;
            color: #1f2937;
            font-weight: 700;
            text-align: right;
            flex: 1 1 auto;
            word-break: break-word;
          }
          .reference-highlight {
            background: #dbeafe;
            color: #1e40af;
            padding: 4px 10px;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            font-weight: 700;
            letter-spacing: 1px;
            font-size: 13px;
            display: inline-block;
          }
          .invoice-list {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 16px;
            border-radius: 8px;
            margin: 16px 0;
          }
          .invoice-list-title {
            font-size: 14px;
            font-weight: 600;
            color: #92400e;
            margin-bottom: 8px;
          }
          .invoice-item {
            font-size: 13px;
            color: #78350f;
            margin: 4px 0;
            font-family: 'Courier New', monospace;
          }
          .cta-section {
            text-align: center;
            margin: 32px 0;
          }
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 14px 32px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 15px;
            box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.3);
          }
          .info-box {
            background: #eff6ff;
            border-left: 4px solid #3b82f6;
            padding: 16px;
            border-radius: 8px;
            margin: 24px 0;
          }
          .info-box-text {
            font-size: 14px;
            color: #1e40af;
            line-height: 1.6;
          }
          .footer {
            background: #1f2937;
            color: #9ca3af;
            padding: 30px;
            text-align: center;
          }
          .footer-logo {
            font-size: 24px;
            font-weight: 700;
            color: #10b981;
            margin-bottom: 12px;
          }
          .footer-text {
            font-size: 13px;
            line-height: 1.7;
            margin: 8px 0;
          }
          .footer-links {
            margin: 16px 0;
          }
          .footer-link {
            color: #10b981;
            text-decoration: none;
            margin: 0 12px;
            font-size: 13px;
          }
          .social-icons {
            margin: 20px 0;
          }
          .divider {
            border-top: 1px solid #e5e7eb;
            margin: 24px 0;
          }
          @media only screen and (max-width: 600px) {
            .email-wrapper { padding: 20px 10px; }
            .content { padding: 24px 20px; }
            .amount-value { font-size: 36px; }
            .details-section { padding: 20px 16px; }
            .detail-row { 
              flex-direction: column; 
              align-items: flex-start; 
              padding: 18px 4px;
              min-height: auto;
              gap: 10px;
            }
            .detail-label {
              max-width: 100%;
              min-width: auto;
              font-size: 13px;
            }
            .detail-value { 
              margin-top: 4px; 
              text-align: left;
              font-size: 14px;
              width: 100%;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <!-- Header -->
        <div class="header">
          <div class="header-content">
            <div class="header-icon"></div>
            <h1>Payment Successful!</h1>
            <p>Your payment has been processed and confirmed</p>
            <div class="header-badge">✓ VERIFIED PAYMENT</div>
          </div>
        </div>

            <!-- Content -->
            <div class="content">
              <div class="greeting">Hello ${tenant_name},</div>
              
              <p class="intro-text">
                Great news! We've successfully received your rent payment. This email serves as your official receipt and confirmation of the transaction.
              </p>

              <div style="text-align: center;">
                <span class="success-badge">✓ PAYMENT CONFIRMED</span>
              </div>

              <!-- Amount Card -->
              <div class="amount-card">
                <div class="amount-label">Total Amount Paid</div>
                <div class="amount-value">
                  <span class="amount-currency">KSh</span>${payment_amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              ${invoice_numbers && invoice_numbers.length > 0 ? `
              <!-- Invoice List -->
              <div class="invoice-list">
                <div class="invoice-list-title">📋 Invoices Paid</div>
                ${invoice_numbers.map(inv => `<div class="invoice-item">• ${inv}</div>`).join('')}
              </div>
              ` : ''}

              <!-- Payment Details -->
              <div class="details-section">
                <div class="details-title">📄 Payment Details</div>
                
                <div class="detail-row">
                  <span class="detail-label">Receipt Number</span>
                  <span class="detail-value">${receipt_number}</span>
                </div>

                ${reference_number ? `
                <div class="detail-row">
                  <span class="detail-label">Payment Reference</span>
                  <span class="detail-value reference-highlight">${reference_number}</span>
                </div>
                ` : ''}

                ${transaction_id ? `
                <div class="detail-row">
                  <span class="detail-label">Transaction ID</span>
                  <span class="detail-value">${transaction_id}</span>
                </div>
                ` : ''}
                
                <div class="detail-row">
                  <span class="detail-label">Payment Date & Time</span>
                  <span class="detail-value">${formattedDate}</span>
                </div>

                ${payment_period ? `
                <div class="detail-row">
                  <span class="detail-label">Payment Period</span>
                  <span class="detail-value">${payment_period}</span>
                </div>
                ` : ''}
                
                <div class="detail-row">
                  <span class="detail-label">Payment Method</span>
                  <span class="detail-value">${payment_method.toUpperCase()}</span>
                </div>
              </div>

              <!-- Property Details -->
              <div class="details-section">
                <div class="details-title">🏢 Property Details</div>
                
                <div class="detail-row">
                  <span class="detail-label">Property</span>
                  <span class="detail-value">${property_name}</span>
                </div>
                
                <div class="detail-row">
                  <span class="detail-label">Unit Number</span>
                  <span class="detail-value">${unit_number}</span>
                </div>
              </div>

              <!-- Info Box -->
              <div class="info-box">
                <div class="info-box-text">
                  <strong>💡 Keep This Receipt:</strong> This email serves as your official payment receipt. Please save it for your records. You can also view and download this receipt anytime from your tenant dashboard.
                </div>
              </div>

              <!-- CTA -->
              <div class="cta-section">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/tenant/payments" class="cta-button">
                  View Payment History →
                </a>
              </div>

              <div class="divider"></div>

              <p class="intro-text" style="text-align: center;">
                Thank you for being a valued tenant! If you have any questions about this payment, please don't hesitate to reach out to us.
              </p>
            </div>

            <!-- Footer -->
            <div class="footer">
              <div class="footer-logo">LetRents</div>
              <p class="footer-text">Modern Property Management Made Simple</p>
              
              <div class="footer-links">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" class="footer-link">Dashboard</a>
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/tenant/support" class="footer-link">Support</a>
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/tenant/profile" class="footer-link">Profile</a>
              </div>

              <div class="divider" style="border-color: #374151;"></div>

              <p class="footer-text" style="font-size: 12px;">
                © ${new Date().getFullYear()} LetRents. All rights reserved.<br>
                This is an automated receipt. Please do not reply to this email.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject: `✓ Payment Receipt ${receipt_number} - LetRents`,
      html,
      text: `Payment Receipt\n\nReceipt Number: ${receipt_number}\n${reference_number ? `Reference: ${reference_number}\n` : ''}Amount: KSh ${payment_amount.toLocaleString()}\nDate: ${formattedDate}\nProperty: ${property_name}\nUnit: ${unit_number}\n\nThank you for your payment!`,
    });
  }

  /**
   * Send welcome email from CEO Joseph to new company registrations (landlords and agencies)
   */
  async sendWelcomeEmail(
    email: string,
    userName: string,
    companyName: string,
    userRole: 'landlord' | 'agency_admin'
  ): Promise<EmailResult> {
    const loginUrl = `${env.appUrl || process.env.APP_URL || 'http://localhost:3000'}/login`;
    const dashboardUrl = `${env.appUrl || process.env.APP_URL || 'http://localhost:3000'}/${userRole === 'landlord' ? 'landlord' : 'agency-admin'}`;
    const roleDisplayName = userRole === 'agency_admin' ? 'Property Agency' : 'Independent Landlord';

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to LetRents</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 16px 16px 0 0; }
          .content { padding: 40px 30px; background: white; }
          .signature { padding: 30px; background: #f8f9fa; border-left: 4px solid #2563eb; margin: 25px 0; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; margin: 25px 0; font-weight: 600; }
          .footer { background: #f8f9fa; padding: 30px; text-align: center; font-size: 14px; color: #666; border-radius: 0 0 16px 16px; }
          h1 { margin: 0; font-size: 28px; font-weight: 700; }
          h2 { margin: 0 0 15px; color: #1e293b; font-size: 20px; font-weight: 600; }
          p { margin: 0 0 15px; color: #475569; font-size: 16px; }
          ul { margin: 15px 0; padding-left: 20px; }
          li { margin: 8px 0; color: #475569; }
          .highlight { background: #eff6ff; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2563eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to LetRents! 🎉</h1>
            <p style="margin: 10px 0 0; opacity: 0.9;">Your Property Management Journey Starts Here</p>
          </div>
          <div class="content">
            <h2>Hello ${userName},</h2>
            <p>
              On behalf of the entire LetRents team, I'm thrilled to welcome you and <strong>${companyName}</strong> to our platform! As the CEO of LetRents, I'm personally excited about the opportunity to help transform your property management operations.
            </p>
            
            <p>
              You've taken an important step toward modernizing your property management. Whether you're managing a single property or a growing portfolio, LetRents is designed to make your life easier and your business more profitable.
            </p>

            <div class="highlight">
              <h3 style="margin-top: 0; color: #1e293b; font-size: 18px;">🚀 Get Started in 3 Simple Steps:</h3>
              <ol style="margin: 15px 0; padding-left: 20px;">
                <li><strong>Add Your Properties</strong> - Start by adding your first property. Our intuitive wizard guides you through every step.</li>
                <li><strong>Create Units</strong> - Add units to your properties and set up rent amounts, lease terms, and more.</li>
                <li><strong>Invite Your Team</strong> - Add staff members or caretakers to help manage your properties efficiently.</li>
              </ol>
            </div>

            <h3 style="color: #1e293b; font-size: 18px;">What You Can Do Right Now:</h3>
            <ul>
              <li>📊 <strong>Track Everything</strong> - Monitor rent collections, expenses, and property performance in real-time</li>
              <li>💰 <strong>Collect Rent Easily</strong> - Accept payments via M-Pesa, bank transfers, and other convenient methods</li>
              <li>👥 <strong>Manage Tenants</strong> - Keep detailed tenant records, track lease agreements, and handle maintenance requests</li>
              <li>📈 <strong>Generate Reports</strong> - Get insights into your property portfolio with comprehensive financial reports</li>
              <li>📱 <strong>Access Anywhere</strong> - Use our mobile-responsive platform from any device, anywhere</li>
            </ul>

            <p>
              Our team is here to support you every step of the way. If you have any questions or need assistance getting started, don't hesitate to reach out. We're committed to your success.
            </p>

            <div style="text-align: center; margin: 35px 0;">
              <a href="${dashboardUrl}" class="button" style="background: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                Go to Your Dashboard →
              </a>
            </div>

            <div class="signature">
              <p style="margin: 0 0 5px; font-weight: 600; color: #1e293b;">Warm regards,</p>
              <p style="margin: 0; color: #475569;"><strong>Joseph</strong></p>
              <p style="margin: 5px 0 0; color: #64748b; font-size: 14px;">CEO, LetRents</p>
              <p style="margin: 10px 0 0; color: #64748b; font-size: 14px;">joseph@letrents.com</p>
            </div>

            <p style="margin-top: 30px; font-size: 14px; color: #64748b;">
              <strong>Need Help?</strong> Check out our <a href="${env.appUrl}/help" style="color: #2563eb;">help center</a> or reply to this email. We typically respond within 24 hours.
            </p>
          </div>
          <div class="footer">
            <p style="margin: 0 0 10px;">
              <strong>LetRents</strong> - Modern Property Management for Africa
            </p>
            <p style="margin: 0; font-size: 12px; color: #94a3b8;">
              © ${new Date().getFullYear()} LetRents. All rights reserved.<br>
              This email was sent to ${email}
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `Welcome to LetRents! Let's Get Started 🚀`,
      html,
      text: `Welcome to LetRents!\n\nHello ${userName},\n\nOn behalf of the entire LetRents team, I'm thrilled to welcome you and ${companyName} to our platform!\n\nGet started by:\n1. Adding your properties\n2. Creating units\n3. Inviting your team\n\nVisit your dashboard: ${dashboardUrl}\n\nWarm regards,\nJoseph\nCEO, LetRents`,
    });
  }
}

// SendGrid Provider Implementation
export class SendGridProvider implements EmailProvider {
  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    // TODO: Implement SendGrid email sending
    // This will be implemented when switching back to SendGrid
    console.log('SendGrid email sending not implemented yet');
    return {
      success: false,
      error: 'SendGrid provider not implemented',
    };
  }

  async sendTemplateEmail(options: TemplateEmailOptions): Promise<EmailResult> {
    // TODO: Implement SendGrid template email sending
    console.log('SendGrid template email sending not implemented yet');
    return {
      success: false,
      error: 'SendGrid template provider not implemented',
    };
  }
}

// Brevo Provider Implementation
export class BrevoProvider implements EmailProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = env.email.brevoKey;
    // Allow missing API key in test environment
    if (!this.apiKey && process.env.NODE_ENV !== 'test') {
      throw new Error('BREVO_API_KEY is required for Brevo email provider');
    }
    // Use a dummy key in test environment to prevent errors
    if (!this.apiKey) {
      this.apiKey = 'test-api-key';
    }
  }

  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    try {
      // In test environment, return success without actually sending
      if (process.env.NODE_ENV === 'test' || this.apiKey === 'test-api-key') {
        console.log('📧 [TEST] Email would be sent:', options);
        return {
          success: true,
          messageId: 'test-message-id',
        };
      }

      // Use the newer @getbrevo/brevo SDK
      const brevo = await import('@getbrevo/brevo');
      
      // Configure API instance
      const apiInstance = new brevo.TransactionalEmailsApi();
      apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, this.apiKey);

      // Prepare email data
      const sendSmtpEmail = new brevo.SendSmtpEmail();
      
      // Handle recipients
      if (Array.isArray(options.to)) {
        sendSmtpEmail.to = options.to.map(email => ({ email }));
      } else {
        sendSmtpEmail.to = [{ email: options.to }];
      }

      // Set sender
      if (options.from) {
        sendSmtpEmail.sender = {
          name: options.from.name,
          email: options.from.email,
        };
      }

      // Set content
      sendSmtpEmail.subject = options.subject;
      if (options.html) {
        sendSmtpEmail.htmlContent = options.html;
      }
      if (options.text) {
        sendSmtpEmail.textContent = options.text;
      }

      // Handle attachments if any
      if (options.attachments && options.attachments.length > 0) {
        sendSmtpEmail.attachment = options.attachments.map(att => ({
          name: att.filename,
          content: Buffer.isBuffer(att.content) ? att.content.toString('base64') : att.content,
        }));
      }

      // Send email
      const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
      
      return {
        success: true,
        messageId: (result as any).messageId || 'sent',
      };
    } catch (error) {
      console.error('Brevo email sending error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async sendTemplateEmail(options: TemplateEmailOptions): Promise<EmailResult> {
    try {
      // In test environment, return success without actually sending
      if (process.env.NODE_ENV === 'test' || this.apiKey === 'test-api-key') {
        console.log('📧 [TEST] Template email would be sent:', options);
        return {
          success: true,
          messageId: 'test-message-id',
        };
      }

      // Use the newer @getbrevo/brevo SDK
      const brevo = await import('@getbrevo/brevo');
      
      // Configure API instance
      const apiInstance = new brevo.TransactionalEmailsApi();
      apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, this.apiKey);

      // Prepare email data
      const sendSmtpEmail = new brevo.SendSmtpEmail();
      
      // Handle recipients
      if (Array.isArray(options.to)) {
        sendSmtpEmail.to = options.to.map(email => ({ email }));
      } else {
        sendSmtpEmail.to = [{ email: options.to }];
      }

      // Set sender
      if (options.from) {
        sendSmtpEmail.sender = {
          name: options.from.name,
          email: options.from.email,
        };
      }

      // Set template
      sendSmtpEmail.templateId = parseInt(options.templateId);
      
      // Set template parameters
      if (options.templateData) {
        sendSmtpEmail.params = options.templateData;
      }

      // Override subject if provided
      if (options.subject) {
        sendSmtpEmail.subject = options.subject;
      }

      // Send email
      const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
      
      return {
        success: true,
        messageId: (result as any).messageId || 'sent',
      };
    } catch (error) {
      console.error('Brevo template email sending error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
