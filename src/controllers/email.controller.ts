import { Request, Response } from 'express';
import { emailService } from '../services/email.service.js';
import { JWTClaims } from '../types/index.js';

export const emailController = {
  // Test email endpoint
  async testEmail(req: Request, res: Response) {
    try {
      const { to, subject, message, type = 'test' } = req.body;
      const user = req.user as JWTClaims;

      if (!to || !subject || !message) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: to, subject, message'
        });
      }

      let result;

      switch (type) {
        case 'verification':
          const verificationUrl = `${req.protocol}://${req.get('host')}/verify-email?token=test-token`;
          result = await emailService.sendVerificationEmail(to, verificationUrl, 'Test User');
          break;
          
        case 'password-reset':
          const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=test-token`;
          result = await emailService.sendPasswordResetEmail(to, resetUrl, 'Test User');
          break;
          
        default:
          result = await emailService.sendEmail({
            to,
            subject,
            html: `<h2>${subject}</h2><p>${message}</p><p>Sent from LetRents Email Service</p>`,
            text: `${subject}\n\n${message}\n\nSent from LetRents Email Service`,
          });
      }

      if (result.success) {
        res.json({
          success: true,
          message: 'Email sent successfully',
          messageId: result.messageId,
          emailType: type,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Failed to send email',
        });
      }
    } catch (error) {
      console.error('Email test error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  },

  // Send custom email endpoint
  async sendCustomEmail(req: Request, res: Response) {
    try {
      const { to, subject, html, text, attachments } = req.body;
      const user = req.user as JWTClaims;

      // Validate permissions - only certain roles can send custom emails
      if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions to send emails',
        });
      }

      if (!to || !subject || (!html && !text)) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: to, subject, and either html or text content',
        });
      }

      const result = await emailService.sendEmail({
        to,
        subject,
        html,
        text,
        attachments,
      });

      if (result.success) {
        res.json({
          success: true,
          message: 'Email sent successfully',
          messageId: result.messageId,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Failed to send email',
        });
      }
    } catch (error) {
      console.error('Custom email sending error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  },

  // Get email provider status
  async getEmailStatus(req: Request, res: Response) {
    try {
      const user = req.user as JWTClaims;

      // Only allow super_admin to view email configuration
      if (user.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions to view email status',
        });
      }

      // Get current email configuration without exposing API keys
      const config = {
        provider: process.env.EMAIL_PROVIDER || 'brevo',
        fromAddress: process.env.EMAIL_FROM_ADDRESS || 'noreply@letrents.com',
        fromName: process.env.EMAIL_FROM_NAME || 'LetRents',
        hasBrevoKey: !!(process.env.BREVO_API_KEY),
        hasSendGridKey: !!(process.env.SENDGRID_API_KEY),
        emailVerificationEnabled: process.env.REQUIRE_EMAIL_VERIFICATION !== 'false',
      };

      res.json({
        success: true,
        emailConfiguration: config,
      });
    } catch (error) {
      console.error('Email status error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  },
};
