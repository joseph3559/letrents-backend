import { PrismaClient } from '@prisma/client';
import { buildWhereClause, formatDataForRole } from '../utils/roleBasedFiltering.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
const prisma = new PrismaClient();
export const careteakersService = {
    async getCaretakers(user, filters = {}) {
        // Build role-based where clause
        const whereClause = buildWhereClause(user, {
            role: 'caretaker',
            ...filters,
        }, 'user');
        const caretakers = await prisma.user.findMany({
            where: whereClause,
            select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
                phone_number: true,
                role: true,
                status: true,
                created_at: true,
                updated_at: true,
                company_id: true,
                agency_id: true,
                // Include related data based on role
                ...(user.role === 'super_admin' || user.role === 'agency_admin' ? {
                    company: {
                        select: {
                            id: true,
                            name: true,
                        }
                    },
                    agency: {
                        select: {
                            id: true,
                            name: true,
                        }
                    }
                } : {})
            },
            orderBy: {
                created_at: 'desc'
            }
        });
        // Format data based on user role
        return formatDataForRole(user, caretakers);
    },
    async createCaretaker(user, caretakerData) {
        // Validate permissions - only landlords, agency admins, and super admins can create caretakers
        if (!['landlord', 'agency_admin', 'super_admin'].includes(user.role)) {
            throw new Error('Insufficient permissions to create caretaker');
        }
        // Hash password
        const hashedPassword = await bcrypt.hash(caretakerData.password || 'TempPassword123!', 10);
        // Prepare caretaker data with proper scoping
        const createData = {
            first_name: caretakerData.first_name,
            last_name: caretakerData.last_name,
            email: caretakerData.email,
            phone_number: caretakerData.phone_number,
            password_hash: hashedPassword,
            role: 'caretaker',
            status: 'active',
            email_verified: false,
            created_by: user.user_id,
        };
        // Apply company/agency scoping based on creator's role
        if (user.role === 'agency_admin' && user.agency_id) {
            createData.agency_id = user.agency_id;
            createData.company_id = user.company_id;
        }
        else if (user.role === 'landlord' && user.company_id) {
            createData.company_id = user.company_id;
        }
        const caretaker = await prisma.user.create({
            data: createData,
            select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
                phone_number: true,
                role: true,
                status: true,
                created_at: true,
                company_id: true,
                agency_id: true,
            }
        });
        return caretaker;
    },
    async getCaretaker(user, caretakerId) {
        const whereClause = buildWhereClause(user, {
            id: caretakerId,
            role: 'caretaker',
        }, 'user');
        const caretaker = await prisma.user.findFirst({
            where: whereClause,
            select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
                phone_number: true,
                role: true,
                status: true,
                created_at: true,
                updated_at: true,
                company_id: true,
                agency_id: true,
                email_verified: true,
                last_login_at: true,
                // Include related data for authorized roles
                ...(user.role === 'super_admin' || user.role === 'agency_admin' ? {
                    company: {
                        select: {
                            id: true,
                            name: true,
                        }
                    },
                    agency: {
                        select: {
                            id: true,
                            name: true,
                        }
                    }
                } : {})
            }
        });
        if (!caretaker) {
            return null;
        }
        return formatDataForRole(user, caretaker);
    },
    async updateCaretaker(user, caretakerId, updateData) {
        // Check if caretaker exists and user has access
        const existingCaretaker = await this.getCaretaker(user, caretakerId);
        if (!existingCaretaker) {
            throw new Error('Caretaker not found or access denied');
        }
        // Prepare update data
        const updateFields = {};
        if (updateData.first_name || updateData.first_name) {
            updateFields.first_name = updateData.first_name || updateData.first_name;
        }
        if (updateData.last_name || updateData.last_name) {
            updateFields.last_name = updateData.last_name || updateData.last_name;
        }
        if (updateData.email) {
            updateFields.email = updateData.email;
        }
        if (updateData.phone_number || updateData.phone_number) {
            updateFields.phone_number = updateData.phone_number || updateData.phone_number;
        }
        if (updateData.status) {
            updateFields.status = updateData.status;
        }
        // Hash new password if provided
        if (updateData.password) {
            updateFields.password = await bcrypt.hash(updateData.password, 10);
        }
        const updatedCaretaker = await prisma.user.update({
            where: { id: caretakerId },
            data: updateFields,
            select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
                phone_number: true,
                role: true,
                status: true,
                updated_at: true,
                company_id: true,
                agency_id: true,
            }
        });
        return updatedCaretaker;
    },
    async deleteCaretaker(user, caretakerId) {
        // Check if caretaker exists and user has access
        const existingCaretaker = await this.getCaretaker(user, caretakerId);
        if (!existingCaretaker) {
            throw new Error('Caretaker not found or access denied');
        }
        // Soft delete by updating status
        await prisma.user.update({
            where: { id: caretakerId },
            data: {
                status: 'inactive',
                updated_at: new Date(),
            }
        });
        return { success: true };
    },
    async inviteCaretaker(user, caretakerId) {
        // Check if caretaker exists and user has access
        // First try to get caretaker with access control
        let caretaker = await this.getCaretaker(user, caretakerId);
        // If not found with access control, try direct lookup for same company
        if (!caretaker) {
            const whereClause = {
                id: caretakerId,
                role: 'caretaker',
            };
            // Apply company scoping based on user's role
            if (user.role === 'landlord' && user.company_id) {
                whereClause.company_id = user.company_id;
            }
            else if (user.role === 'agency_admin' && user.company_id) {
                whereClause.company_id = user.company_id;
            }
            caretaker = await prisma.user.findFirst({
                where: whereClause,
                select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                    email: true,
                    phone_number: true,
                    role: true,
                    status: true,
                    company_id: true,
                    agency_id: true,
                }
            });
        }
        if (!caretaker) {
            throw new Error('Caretaker not found or access denied');
        }
        if (!caretaker.email) {
            throw new Error('Caretaker email not found');
        }
        // Generate temporary password for new caretaker
        const tempPassword = Math.random().toString(36).slice(-10) + 'A1!';
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        // Update caretaker with temporary password
        await prisma.user.update({
            where: { id: caretakerId },
            data: {
                password_hash: hashedPassword,
                status: 'pending_setup',
                updated_at: new Date(),
            }
        });
        // Send invitation email with credentials
        try {
            const { emailService } = await import('./email.service.js');
            const invitationHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>LetRents - Caretaker Invitation</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; }
            .credentials { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to LetRents</h1>
              <p>Caretaker Account Invitation</p>
            </div>
            <div class="content">
              <h2>You've been invited as a Caretaker</h2>
              <p>Hello ${caretaker.first_name} ${caretaker.last_name},</p>
              <p>You have been invited to join LetRents as a caretaker. Your account has been created and you can now access the platform using the credentials below:</p>
              
              <div class="credentials">
                <h3 style="margin-top: 0; color: #2563eb;">Your Login Credentials</h3>
                <p><strong>Email:</strong> ${caretaker.email}</p>
                <p><strong>Temporary Password:</strong> <code style="background: #e9ecef; padding: 4px 8px; border-radius: 4px;">${tempPassword}</code></p>
                <p><strong>Login URL:</strong> <a href="${process.env.APP_URL || 'http://localhost:3000'}/login">${process.env.APP_URL || 'http://localhost:3000'}/login</a></p>
              </div>

              <div class="warning">
                <strong>Important Security Notice:</strong>
                <ul>
                  <li>This is a temporary password for your first login</li>
                  <li>You will be required to change your password after logging in</li>
                  <li>Please keep these credentials secure and do not share them</li>
                  <li>If you didn't expect this invitation, please contact support</li>
                </ul>
              </div>

              <div style="text-align: center;">
                <a href="${process.env.APP_URL || 'http://localhost:3000'}/login" class="button">Login to LetRents</a>
              </div>

              <h3>What's Next?</h3>
              <ol>
                <li>Click the login button above or visit the login URL</li>
                <li>Enter your email and temporary password</li>
                <li>Set up your new secure password</li>
                <li>Complete your profile setup</li>
                <li>Start managing properties!</li>
              </ol>

              <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
              
              <p>Welcome to the LetRents family!</p>
              <p>Best regards,<br>The LetRents Team</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} LetRents. All rights reserved.</p>
              <p>This is an automated invitation email. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;
            const emailResult = await emailService.sendEmail({
                to: caretaker.email,
                subject: `Welcome to LetRents - Caretaker Account Created`,
                html: invitationHtml,
                text: `Welcome to LetRents!

You've been invited as a caretaker. Here are your login credentials:

Email: ${caretaker.email}
Temporary Password: ${tempPassword}
Login URL: ${process.env.APP_URL || 'http://localhost:3000'}/login

Please log in and change your password immediately.

Best regards,
The LetRents Team`,
            });
            if (!emailResult.success) {
                console.error('Failed to send caretaker invitation email:', emailResult.error);
                // Log credentials to console as fallback
                console.log('\n📧 CARETAKER INVITATION (email service failed):');
                console.log(`👤 Name: ${caretaker.first_name} ${caretaker.last_name}`);
                console.log(`📧 Email: ${caretaker.email}`);
                console.log(`🔑 Temporary Password: ${tempPassword}`);
                console.log(`🔗 Login URL: ${process.env.APP_URL || 'http://localhost:3000'}/login\n`);
                throw new Error('Failed to send invitation email');
            }
            else {
                console.log(`✅ Caretaker invitation sent successfully to ${caretaker.email}`);
                console.log(`🔑 Temporary password generated: ${tempPassword}`);
            }
            return {
                caretakerId,
                invitationSent: true,
                email: caretaker.email,
                temporaryPassword: tempPassword, // Include in response for testing
                message: 'Invitation sent successfully with login credentials'
            };
        }
        catch (error) {
            console.error('Error sending caretaker invitation:', error);
            throw new Error('Failed to send caretaker invitation email');
        }
    },
    async resetPassword(user, caretakerId) {
        // Check if caretaker exists and user has access
        const caretaker = await this.getCaretaker(user, caretakerId);
        if (!caretaker) {
            throw new Error('Caretaker not found or access denied');
        }
        if (!caretaker.email) {
            throw new Error('caretaker email not found');
        }
        // Generate reset token
        const raw = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        // Store reset token
        await prisma.passwordResetToken.create({
            data: {
                user_id: caretaker.id,
                token_hash: tokenHash,
                expires_at: expiresAt,
                is_used: false,
            },
        });
        // Send password reset email
        const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${raw}`;
        try {
            const { emailService } = await import('./email.service.js');
            const emailResult = await emailService.sendPasswordResetEmail(caretaker.email, resetUrl, `${caretaker.first_name} ${caretaker.last_name}`);
            if (!emailResult.success) {
                console.error('Failed to send caretaker password reset email:', emailResult.error);
                throw new Error('Failed to send password reset email');
            }
            else {
                console.log(`✅ Caretaker password reset email sent successfully to ${caretaker.email}`);
            }
        }
        catch (error) {
            console.error('Error sending caretaker password reset email:', error);
            throw new Error('Failed to send password reset email');
        }
        return {
            caretakerId,
            email: caretaker.email,
            message: 'Password reset email sent successfully.'
        };
    },
};
