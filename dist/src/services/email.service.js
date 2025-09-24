import { env } from '../config/env.js';
// Email service factory
export class EmailService {
    provider;
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
    async sendEmail(options) {
        try {
            // Set default from address if not provided
            if (!options.from) {
                options.from = {
                    email: env.email.fromAddress,
                    name: env.email.fromName,
                };
            }
            return await this.provider.sendEmail(options);
        }
        catch (error) {
            console.error('Error sending email:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            };
        }
    }
    async sendTemplateEmail(options) {
        try {
            // Set default from address if not provided
            if (!options.from) {
                options.from = {
                    email: env.email.fromAddress,
                    name: env.email.fromName,
                };
            }
            return await this.provider.sendTemplateEmail(options);
        }
        catch (error) {
            console.error('Error sending template email:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            };
        }
    }
    // Convenience methods for common email types
    async sendVerificationEmail(email, verificationUrl, userName) {
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
    async sendPasswordResetEmail(email, resetUrl, userName) {
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
}
// SendGrid Provider Implementation
export class SendGridProvider {
    async sendEmail(options) {
        // TODO: Implement SendGrid email sending
        // This will be implemented when switching back to SendGrid
        console.log('SendGrid email sending not implemented yet');
        return {
            success: false,
            error: 'SendGrid provider not implemented',
        };
    }
    async sendTemplateEmail(options) {
        // TODO: Implement SendGrid template email sending
        console.log('SendGrid template email sending not implemented yet');
        return {
            success: false,
            error: 'SendGrid template provider not implemented',
        };
    }
}
// Brevo Provider Implementation
export class BrevoProvider {
    apiKey;
    constructor() {
        this.apiKey = env.email.brevoKey;
        if (!this.apiKey) {
            throw new Error('BREVO_API_KEY is required for Brevo email provider');
        }
    }
    async sendEmail(options) {
        try {
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
            }
            else {
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
                messageId: result.messageId || 'sent',
            };
        }
        catch (error) {
            console.error('Brevo email sending error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            };
        }
    }
    async sendTemplateEmail(options) {
        try {
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
            }
            else {
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
                messageId: result.messageId || 'sent',
            };
        }
        catch (error) {
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
