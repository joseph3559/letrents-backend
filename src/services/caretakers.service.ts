import { PrismaClient } from '@prisma/client';
import { JWTClaims } from '../types/index.js';
import { buildWhereClause, formatDataForRole } from '../utils/roleBasedFiltering.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * Generate a unique staff number in format: STF-YYYY-XXXX
 * Example: STF-2025-0001
 */
async function generateStaffNumber(companyId?: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `STF-${year}-`;
  
  // Get the count of existing staff in this company for this year
  const whereClause: any = {
    role: 'caretaker',
    created_at: {
      gte: new Date(`${year}-01-01`),
      lt: new Date(`${year + 1}-01-01`),
    }
  };
  
  if (companyId) {
    whereClause.company_id = companyId;
  }
  
  const count = await prisma.user.count({ where: whereClause });
  
  // Increment and format as 4-digit number
  const nextNumber = (count + 1).toString().padStart(4, '0');
  const staffNumber = `${prefix}${nextNumber}`;
  
  // Check if this number already exists (rare edge case)
  const existing = await prisma.user.findFirst({
    where: { staff_number: staffNumber }
  });
  
  if (existing) {
    // If collision, try next number
    const nextNum = (count + 2).toString().padStart(4, '0');
    return `${prefix}${nextNum}`;
  }
  
  return staffNumber;
}

export const careteakersService = {
  async getCaretakers(user: JWTClaims, filters: any = {}) {
    // Build role-based where clause
    const whereClause = buildWhereClause(user, {
      role: 'caretaker' as any,
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
        // Include extended caretaker fields
        staff_number: true,
        id_number: true,
        address: true,
        nationality: true,
        monthly_salary: true,
        position: true,
        employment_date: true,
        emergency_contact_name: true,
        emergency_contact_phone: true,
        emergency_relationship: true,
        working_hours: true,
        off_days: true,
        skills: true,
        languages: true,
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

  async createCaretaker(user: JWTClaims, caretakerData: any) {
    // Validate permissions - only landlords, agency admins, and super admins can create caretakers
    if (!['landlord', 'agency_admin', 'super_admin'].includes(user.role)) {
      throw new Error('Insufficient permissions to create caretaker');
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: caretakerData.email }
    });

    if (existingUser) {
      throw new Error('A user with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(caretakerData.password || 'TempPassword123!', 10);

    // Determine company_id for staff number generation
    let companyIdForStaffNumber = user.company_id;
    if (user.role === 'agency_admin' && user.agency_id) {
      companyIdForStaffNumber = user.company_id;
    } else if (user.role === 'landlord' && user.company_id) {
      companyIdForStaffNumber = user.company_id;
    }

    // Generate unique staff number
    const staffNumber = await generateStaffNumber(companyIdForStaffNumber);

    // Prepare caretaker data with proper scoping
    const createData: any = {
      first_name: caretakerData.first_name,
      last_name: caretakerData.last_name,
      email: caretakerData.email,
      phone_number: caretakerData.phone_number,
      password_hash: hashedPassword,
      role: 'caretaker' as any,
      status: 'active' as any,
      email_verified: false,
      created_by: user.user_id,
      // Add auto-generated staff number
      staff_number: staffNumber,
      // Add extended caretaker fields
      id_number: caretakerData.id_number,
      address: caretakerData.residential_address || caretakerData.address,
      nationality: caretakerData.nationality,
      monthly_salary: caretakerData.monthly_salary,
      position: caretakerData.position,
      employment_date: caretakerData.employment_date ? new Date(caretakerData.employment_date) : null,
      emergency_contact_name: caretakerData.emergency_contact_name,
      emergency_contact_phone: caretakerData.emergency_contact_phone,
      emergency_relationship: caretakerData.emergency_relationship,
      working_hours: caretakerData.working_hours,
      off_days: Array.isArray(caretakerData.off_days) ? caretakerData.off_days.join(',') : caretakerData.off_days,
      skills: caretakerData.skills,
      languages: caretakerData.languages,
    };

    // Apply company/agency scoping based on creator's role
    if (user.role === 'agency_admin' && user.agency_id) {
      createData.agency_id = user.agency_id;
      createData.company_id = user.company_id;
    } else if (user.role === 'landlord' && user.company_id) {
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
        // Include extended fields in response
        staff_number: true,
        id_number: true,
        address: true,
        nationality: true,
        monthly_salary: true,
        position: true,
        employment_date: true,
        emergency_contact_name: true,
        emergency_contact_phone: true,
        emergency_relationship: true,
        working_hours: true,
        off_days: true,
        skills: true,
        languages: true,
      }
    });

    return caretaker;
  },

  async getCaretaker(user: JWTClaims, caretakerId: string) {
    const whereClause = buildWhereClause(user, {
      id: caretakerId,
      role: 'caretaker' as any,
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
        // Include extended caretaker fields
        staff_number: true,
        id_number: true,
        address: true,
        nationality: true,
        monthly_salary: true,
        position: true,
        employment_date: true,
        emergency_contact_name: true,
        emergency_contact_phone: true,
        emergency_relationship: true,
        working_hours: true,
        off_days: true,
        skills: true,
        languages: true,
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

  async updateCaretaker(user: JWTClaims, caretakerId: string, updateData: any) {
    // Check if caretaker exists and user has access
    const existingCaretaker = await this.getCaretaker(user, caretakerId);
    if (!existingCaretaker) {
      throw new Error('Caretaker not found or access denied');
    }

    // Prepare update data
    const updateFields: any = {};
    
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

  async deleteCaretaker(user: JWTClaims, caretakerId: string) {
    // Delegate to staffService.deleteStaffMember for consistent behavior
    // This maintains backward compatibility while using the unified implementation
    const { staffService } = await import('./staff.service.js');
    return staffService.deleteStaffMember(user, caretakerId);
  },

  async inviteCaretaker(user: JWTClaims, caretakerId: string) {
    // Check if caretaker exists and user has access
    // First try to get caretaker with access control
    let caretaker = await this.getCaretaker(user, caretakerId);
    
    // If not found with access control, try direct lookup for same company
    if (!caretaker) {
      const whereClause: any = {
        id: caretakerId,
        role: 'caretaker' as any,
      };
      
      // Apply company scoping based on user's role
      if (user.role === 'landlord' && user.company_id) {
        whereClause.company_id = user.company_id;
      } else if (user.role === 'agency_admin' && user.company_id) {
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

    // Generate invitation link (no password - user will set it via link)
    const invitationLink = `${process.env.APP_URL || 'http://localhost:3000'}/account/setup?token=invitation-${caretakerId}&email=${encodeURIComponent(caretaker.email)}&first_name=${encodeURIComponent(caretaker.first_name || '')}&last_name=${encodeURIComponent(caretaker.last_name || '')}`;

    // Update caretaker status - no password set, they'll set it via invitation link
    // Email is auto-verified for invited users since the invitation was sent to their email
    await prisma.user.update({
      where: { id: caretakerId },
      data: {
        status: 'pending', // User needs to set up their account via link
        email_verified: true, // Auto-verify email for invited users
        updated_at: new Date(),
      }
    });

    // Send invitation email with setup link
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
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
            .info { background: #e7f3ff; border: 1px solid #b3d9ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
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
              <p>You have been invited to join LetRents as a caretaker. Your account has been created and you can now set up your account to access the platform.</p>
              
              <div class="info">
                <strong>Account Setup Required:</strong>
                <p>Click the button below to complete your account setup and create your secure password.</p>
              </div>

              <div style="text-align: center;">
                <a href="${invitationLink}" class="button">Complete Account Setup</a>
              </div>

              <h3>What's Next?</h3>
              <ol>
                <li>Click the "Complete Account Setup" button above</li>
                <li>Create your secure password</li>
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
        subject: `Welcome to LetRents - Complete Your Caretaker Account Setup`,
        html: invitationHtml,
        text: `Welcome to LetRents!

You've been invited as a caretaker. Please complete your account setup:

Setup Link: ${invitationLink}

Click the link above to create your password and activate your account.

Best regards,
The LetRents Team`,
      });

      if (!emailResult.success) {
        console.error('Failed to send caretaker invitation email:', emailResult.error);
        // Log invitation link to console as fallback
        console.log('\n📧 CARETAKER INVITATION (email service failed):');
        console.log(`👤 Name: ${caretaker.first_name} ${caretaker.last_name}`);
        console.log(`📧 Email: ${caretaker.email}`);
        console.log(`🔗 Setup Link: ${invitationLink}\n`);
        
        throw new Error('Failed to send invitation email');
      } else {
        console.log(`✅ Caretaker invitation sent successfully to ${caretaker.email}`);
        console.log(`🔗 Setup link generated (no password - user will set it via link)`);
      }

      return {
        caretakerId,
        invitationSent: true,
        email: caretaker.email,
        setupLink: invitationLink, // Include setup link in response
        message: 'Invitation sent successfully with account setup link'
      };

    } catch (error) {
      console.error('Error sending caretaker invitation:', error);
      throw new Error('Failed to send caretaker invitation email');
    }
  },

  async resetPassword(user: JWTClaims, caretakerId: string) {
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
      const emailResult = await emailService.sendPasswordResetEmail(
        caretaker.email,
        resetUrl,
        `${caretaker.first_name} ${caretaker.last_name}`
      );
      
      if (!emailResult.success) {
        console.error('Failed to send caretaker password reset email:', emailResult.error);
        throw new Error('Failed to send password reset email');
      } else {
        console.log(`✅ Caretaker password reset email sent successfully to ${caretaker.email}`);
      }
    } catch (error) {
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
