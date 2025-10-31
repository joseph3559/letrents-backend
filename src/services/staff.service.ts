import { PrismaClient } from '@prisma/client';
import { JWTClaims } from '../types/index.js';
import { buildWhereClause, formatDataForRole } from '../utils/roleBasedFiltering.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * Staff roles that can be managed by this service
 */
type StaffRole = 'caretaker' | 'agent' | 'cleaner' | 'security' | 'maintenance' | 'receptionist' | 'accountant' | 'manager';

/**
 * Generate a unique staff number based on role
 * Format: ROLE-YYYY-XXXX
 * Examples: CTK-2025-0001 (Caretaker), AGT-2025-0001 (Agent), CLN-2025-0001 (Cleaner)
 */
async function generateStaffNumber(role: StaffRole, companyId?: string): Promise<string> {
  const year = new Date().getFullYear();
  
  // Role-specific prefixes
  const rolePrefixes: Record<StaffRole, string> = {
    'caretaker': 'CTK',
    'agent': 'AGT',
    'cleaner': 'CLN',
    'security': 'SEC',
    'maintenance': 'MTN',
    'receptionist': 'RCP',
    'accountant': 'ACC',
    'manager': 'MGR',
  };
  
  const prefix = `${rolePrefixes[role]}-${year}-`;
  
  // Get the count of existing staff of this role in this company for this year
  const whereClause: any = {
    role: role,
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

/**
 * Generic Staff Service
 * Handles all staff members (caretakers, agents, etc.) with role-based logic
 */
export const staffService = {
  /**
   * Get all staff members of a specific role
   */
  async getStaffMembers(user: JWTClaims, role: StaffRole, filters: any = {}) {
    // Build role-based where clause
    const whereClause = buildWhereClause(user, {
      role: role as any,
      ...filters,
    }, 'user');

    // Debug logging
    console.log('🔍 getStaffMembers called with:');
    console.log('  User:', { user_id: user.user_id, role: user.role, company_id: user.company_id, agency_id: user.agency_id });
    console.log('  Requested role:', role);
    console.log('  Where clause:', JSON.stringify(whereClause, null, 2));

    const staffMembers = await prisma.user.findMany({
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
        // Include extended staff fields
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
        // Include property assignments
        property_assignments: {
          where: { status: 'active' },
          select: {
            id: true,
            property_id: true,
            is_primary: true,
            assigned_at: true,
            property: {
              select: {
                id: true,
                name: true,
                type: true,
                street: true,
                city: true,
              }
            }
          }
        },
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

    // Debug logging for results
    console.log('  Results:', staffMembers.length, 'staff members found');

    // Format data based on user role
    return formatDataForRole(user, staffMembers);
  },

  /**
   * Create a new staff member
   */
  async createStaffMember(user: JWTClaims, role: StaffRole, staffData: any) {
    // Validate permissions
    if (!['landlord', 'agency_admin', 'super_admin'].includes(user.role)) {
      throw new Error(`Insufficient permissions to create ${role}`);
    }

    // CRITICAL: Validate that creator has a company_id
    if (!user.company_id) {
      console.error('❌ CRITICAL: User attempting to create staff without company_id:', user);
      throw new Error('Cannot create staff member: Your account is not associated with a company. Please contact support.');
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: staffData.email }
    });

    if (existingUser) {
      throw new Error('A user with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(staffData.password || 'TempPassword123!', 10);

    // Determine company_id for staff number generation
    let companyIdForStaffNumber = user.company_id;
    if (user.role === 'agency_admin' && user.agency_id) {
      companyIdForStaffNumber = user.company_id;
    } else if (user.role === 'landlord' && user.company_id) {
      companyIdForStaffNumber = user.company_id;
    }

    // Generate unique staff number based on role
    const staffNumber = await generateStaffNumber(role, companyIdForStaffNumber);

    // Prepare staff data with proper scoping
    const createData: any = {
      first_name: staffData.first_name,
      last_name: staffData.last_name,
      email: staffData.email,
      phone_number: staffData.phone_number,
      password_hash: hashedPassword,
      role: role as any,
      status: 'active' as any,
      email_verified: false,
      created_by: user.user_id,
      // Add auto-generated staff number
      staff_number: staffNumber,
      // Add extended staff fields
      id_number: staffData.id_number,
      address: staffData.residential_address || staffData.address,
      nationality: staffData.nationality,
      monthly_salary: staffData.monthly_salary,
      position: staffData.position,
      employment_date: staffData.employment_date ? new Date(staffData.employment_date) : null,
      emergency_contact_name: staffData.emergency_contact_name,
      emergency_contact_phone: staffData.emergency_contact_phone,
      emergency_relationship: staffData.emergency_relationship,
      working_hours: staffData.working_hours,
      off_days: Array.isArray(staffData.off_days) ? staffData.off_days.join(',') : staffData.off_days,
      skills: staffData.skills,
      languages: staffData.languages,
    };

    // CRITICAL: Always set company_id - this is mandatory for all staff members
    // Apply company/agency scoping based on creator's role
    if (user.role === 'agency_admin') {
      // Always set company_id for agency admin
      if (user.company_id) {
        createData.company_id = user.company_id;
      } else {
        // This should never happen due to check above, but add as safeguard
        throw new Error('Cannot create staff: Agency admin has no company_id');
      }
      // Set agency_id if the admin has one
      if (user.agency_id) {
        createData.agency_id = user.agency_id;
      }
    } else if (user.role === 'landlord') {
      if (user.company_id) {
        createData.company_id = user.company_id;
      } else {
        // This should never happen due to check above, but add as safeguard
        throw new Error('Cannot create staff: Landlord has no company_id');
      }
    } else if (user.role === 'super_admin') {
      // Super admin must explicitly provide company_id in staffData
      if (staffData.company_id) {
        createData.company_id = staffData.company_id;
      } else {
        throw new Error('Cannot create staff: Super admin must specify company_id');
      }
    }

    // FINAL VALIDATION: Ensure company_id is set
    if (!createData.company_id) {
      console.error('❌ CRITICAL: About to create staff without company_id:', {
        creator: user,
        staffData: createData
      });
      throw new Error('Cannot create staff member: company_id is required');
    }

    // Log the creation for audit trail
    console.log('✅ Creating staff member:', {
      role: role,
      email: staffData.email,
      company_id: createData.company_id,
      agency_id: createData.agency_id,
      created_by: user.email,
      creator_role: user.role
    });

    const staffMember = await prisma.user.create({
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

    // Handle property assignments if provided
    if (staffData.assigned_properties && Array.isArray(staffData.assigned_properties) && staffData.assigned_properties.length > 0) {
      const propertyAssignments = staffData.assigned_properties.map((propertyId: string, index: number) => ({
        staff_id: staffMember.id,
        property_id: propertyId,
        assigned_by: user.user_id,
        is_primary: index === 0, // First property is primary
        status: 'active',
      }));

      await prisma.staffPropertyAssignment.createMany({
        data: propertyAssignments,
        skipDuplicates: true,
      });

      console.log(`✅ Assigned ${propertyAssignments.length} properties to ${role}: ${staffMember.staff_number}`);
    }

    console.log(`✅ ${role} created successfully: ${staffMember.staff_number} - ${staffMember.first_name} ${staffMember.last_name}`);
    return staffMember;
  },

  /**
   * Get a single staff member by ID
   */
  async getStaffMember(user: JWTClaims, staffId: string, role?: StaffRole) {
    const whereClause = buildWhereClause(user, {
      id: staffId,
      ...(role ? { role: role as any } : {}),
    }, 'user');

    const staffMember = await prisma.user.findFirst({
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
        // Include extended staff fields
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
        // Include property assignments
        property_assignments: {
          where: { status: 'active' },
          select: {
            id: true,
            property_id: true,
            is_primary: true,
            assigned_at: true,
            property: {
              select: {
                id: true,
                name: true,
                type: true,
                street: true,
                city: true,
                number_of_units: true,
              }
            }
          },
          orderBy: {
            is_primary: 'desc' // Primary property first
          }
        },
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

    if (!staffMember) {
      return null;
    }

    return formatDataForRole(user, staffMember);
  },

  /**
   * Update a staff member
   */
  async updateStaffMember(user: JWTClaims, staffId: string, updateData: any, role?: StaffRole) {
    console.log('🔄 UPDATE STAFF MEMBER:', {
      staffId,
      role,
      user: user.email,
      updateDataKeys: Object.keys(updateData)
    });

    // Check if staff member exists and user has access
    // Don't pass role to allow updating any staff member regardless of their role
    const existingStaff = await this.getStaffMember(user, staffId);
    if (!existingStaff) {
      console.error('❌ Staff member not found:', staffId);
      throw new Error('Staff member not found or access denied');
    }

    console.log('✅ Existing staff found:', existingStaff.email);

    // Prepare update data
    const updateFields: any = {};
    
    // Basic fields
    if (updateData.first_name) {
      updateFields.first_name = updateData.first_name;
    }
    if (updateData.last_name) {
      updateFields.last_name = updateData.last_name;
    }
    if (updateData.email) {
      updateFields.email = updateData.email;
    }
    if (updateData.phone_number) {
      updateFields.phone_number = updateData.phone_number;
    }
    if (updateData.status) {
      updateFields.status = updateData.status;
    }

    // Extended staff fields
    if (updateData.id_number !== undefined) {
      updateFields.id_number = updateData.id_number;
    }
    if (updateData.address !== undefined || updateData.residential_address !== undefined) {
      updateFields.address = updateData.address || updateData.residential_address;
    }
    if (updateData.nationality !== undefined) {
      updateFields.nationality = updateData.nationality;
    }
    if (updateData.monthly_salary !== undefined || updateData.salary !== undefined) {
      const salaryValue = updateData.monthly_salary || updateData.salary;
      updateFields.monthly_salary = salaryValue ? parseFloat(salaryValue) : null;
    }
    if (updateData.position !== undefined) {
      updateFields.position = updateData.position;
    }
    if (updateData.employment_date !== undefined) {
      updateFields.employment_date = updateData.employment_date ? new Date(updateData.employment_date) : null;
    }
    if (updateData.emergency_contact_name !== undefined) {
      updateFields.emergency_contact_name = updateData.emergency_contact_name;
    }
    if (updateData.emergency_contact_phone !== undefined) {
      updateFields.emergency_contact_phone = updateData.emergency_contact_phone;
    }
    if (updateData.emergency_relationship !== undefined) {
      updateFields.emergency_relationship = updateData.emergency_relationship;
    }
    if (updateData.working_hours !== undefined) {
      updateFields.working_hours = updateData.working_hours;
    }
    if (updateData.off_days !== undefined) {
      updateFields.off_days = Array.isArray(updateData.off_days) 
        ? updateData.off_days.join(',') 
        : updateData.off_days;
    }
    if (updateData.skills !== undefined) {
      updateFields.skills = Array.isArray(updateData.skills) 
        ? updateData.skills.join(',') 
        : updateData.skills;
    }
    if (updateData.languages !== undefined) {
      updateFields.languages = Array.isArray(updateData.languages) 
        ? updateData.languages.join(',') 
        : updateData.languages;
    }

    // Hash new password if provided
    if (updateData.password) {
      updateFields.password_hash = await bcrypt.hash(updateData.password, 10);
    }

    console.log('📝 Update fields prepared:', Object.keys(updateFields));

    try {
      const updatedStaff = await prisma.user.update({
        where: { id: staffId },
        data: {
          ...updateFields,
          updated_at: new Date(),
        },
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
          // Extended fields
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

      console.log('✅ Staff updated successfully');

      // Handle property assignments update
      if (updateData.assigned_properties) {
        console.log('🏠 Updating property assignments:', updateData.assigned_properties);
        
        // Delete existing assignments
        await prisma.staffPropertyAssignment.deleteMany({
          where: { staff_id: staffId }
        });

        // Create new assignments
        if (Array.isArray(updateData.assigned_properties) && updateData.assigned_properties.length > 0) {
          await prisma.staffPropertyAssignment.createMany({
            data: updateData.assigned_properties.map((propertyId: string) => ({
              staff_id: staffId,
              property_id: propertyId,
              status: 'active',
              assigned_at: new Date()
            }))
          });
          console.log('✅ Property assignments updated');
        }
      }

      return updatedStaff;
    } catch (error: any) {
      console.error('❌ Error updating staff:', error.message);
      throw error;
    }
  },

  /**
   * Delete a staff member (permanent)
   */
  async deleteStaffMember(user: JWTClaims, staffId: string, role?: StaffRole) {
    // Check if staff member exists and user has access
    const existingStaff = await this.getStaffMember(user, staffId, role);
    if (!existingStaff) {
      throw new Error('Staff member not found or access denied');
    }

    // Permanent delete - remove from database
    await prisma.user.delete({
      where: { id: staffId }
    });

    console.log(`🗑️ ${role || 'Staff'} deleted: ${staffId}`);
    return { success: true };
  },

  /**
   * Invite a staff member (send credentials email)
   */
  async inviteStaffMember(user: JWTClaims, staffId: string, role?: StaffRole) {
    // Check if staff member exists and user has access
    let staffMember = null;
    
    try {
      staffMember = await this.getStaffMember(user, staffId, role);
    } catch (error) {
      // If getStaffMember throws an error, staffMember will remain null
      console.log('getStaffMember failed, trying direct lookup:', error);
    }
    
    // If not found with access control, try direct lookup for same company
    if (!staffMember) {
      const whereClause: any = {
        id: staffId,
        ...(role ? { role: role as any } : {}),
      };
      
      // Apply company scoping based on user's role
      if (user.role === 'landlord' && user.company_id) {
        whereClause.company_id = user.company_id;
      } else if (user.role === 'agency_admin' && user.company_id) {
        whereClause.company_id = user.company_id;
      }
      
      staffMember = await prisma.user.findFirst({
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
    
    if (!staffMember) {
      throw new Error('Staff member not found or access denied');
    }

    if (!staffMember.email) {
      throw new Error('Staff member email not found');
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-10) + 'A1!';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Update staff member with temporary password and verify email
    await prisma.user.update({
      where: { id: staffId },
      data: {
        password_hash: hashedPassword,
        status: 'pending_setup',
        email_verified: true, // Auto-verify email for invited users
        updated_at: new Date(),
      }
    });

    // Get role display name
    const roleDisplayName = staffMember.role.charAt(0).toUpperCase() + staffMember.role.slice(1);

    // Send invitation email with credentials
    try {
      const { emailService } = await import('./email.service.js');
      
      const invitationHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>LetRents - ${roleDisplayName} Invitation</title>
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
              <p>${roleDisplayName} Account Invitation</p>
            </div>
            <div class="content">
              <h2>You've been invited as a ${roleDisplayName}</h2>
              <p>Hello ${staffMember.first_name} ${staffMember.last_name},</p>
              <p>You have been invited to join LetRents as a ${roleDisplayName.toLowerCase()}. Your account has been created and you can now access the platform using the credentials below:</p>
              
              <div class="credentials">
                <h3 style="margin-top: 0; color: #2563eb;">Your Login Credentials</h3>
                <p><strong>Email:</strong> ${staffMember.email}</p>
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
                <li>Start working!</li>
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
        to: staffMember.email,
        subject: `Welcome to LetRents - ${roleDisplayName} Account Created`,
        html: invitationHtml,
        text: `Welcome to LetRents!

You've been invited as a ${roleDisplayName.toLowerCase()}. Here are your login credentials:

Email: ${staffMember.email}
Temporary Password: ${tempPassword}
Login URL: ${process.env.APP_URL || 'http://localhost:3000'}/login

Please log in and change your password immediately.

Best regards,
The LetRents Team`,
      });

      if (!emailResult.success) {
        console.error(`Failed to send ${roleDisplayName} invitation email:`, emailResult.error);
        // Log credentials to console as fallback
        console.log(`\n📧 ${roleDisplayName.toUpperCase()} INVITATION (email service failed):`);
        console.log(`👤 Name: ${staffMember.first_name} ${staffMember.last_name}`);
        console.log(`📧 Email: ${staffMember.email}`);
        console.log(`🔑 Temporary Password: ${tempPassword}`);
        console.log(`🔗 Login URL: ${process.env.APP_URL || 'http://localhost:3000'}/login\n`);
        
        throw new Error('Failed to send invitation email');
      } else {
        console.log(`✅ ${roleDisplayName} invitation sent successfully to ${staffMember.email}`);
        console.log(`🔑 Temporary password generated: ${tempPassword}`);
      }

      return {
        staffId,
        role: staffMember.role,
        invitationSent: true,
        email: staffMember.email,
        temporaryPassword: tempPassword, // Include in response for testing
        message: 'Invitation sent successfully with login credentials'
      };

    } catch (error) {
      console.error(`Error sending ${roleDisplayName} invitation:`, error);
      throw new Error(`Failed to send ${roleDisplayName} invitation email`);
    }
  },

  /**
   * Reset staff member password
   */
  async resetPassword(user: JWTClaims, staffId: string, role?: StaffRole) {
    // Check if staff member exists and user has access
    const staffMember = await this.getStaffMember(user, staffId, role);
    if (!staffMember) {
      throw new Error('Staff member not found or access denied');
    }

    if (!staffMember.email) {
      throw new Error('Staff member email not found');
    }

    // Generate reset token
    const raw = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token
    await prisma.passwordResetToken.create({
      data: {
        user_id: staffMember.id,
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
        staffMember.email,
        resetUrl,
        `${staffMember.first_name} ${staffMember.last_name}`
      );
      
      if (!emailResult.success) {
        console.error('Failed to send staff password reset email:', emailResult.error);
        throw new Error('Failed to send password reset email');
      } else {
        console.log(`✅ Staff password reset email sent successfully to ${staffMember.email}`);
      }
    } catch (error) {
      console.error('Error sending staff password reset email:', error);
      throw new Error('Failed to send password reset email');
    }

    return {
      staffId,
      email: staffMember.email,
      message: 'Password reset email sent successfully.'
    };
  },
};

// Export backward-compatible caretaker service
export const careteakersService = {
  getCaretakers: async (user: JWTClaims, filters?: any) => {
    // Define role hierarchy - roles that can be viewed based on user's role
    let allowedStaffRoles: StaffRole[];
    
    if (user.role === 'agent') {
      // Agents can only see staff below their level (NOT other agents or agency_admins)
      allowedStaffRoles = ['caretaker', 'cleaner', 'security', 'maintenance', 'receptionist', 'accountant', 'manager'];
    } else if (user.role === 'agency_admin') {
      // Agency admins can see agents and all staff below
      allowedStaffRoles = ['agent', 'caretaker', 'cleaner', 'security', 'maintenance', 'receptionist', 'accountant', 'manager'];
    } else {
      // Landlords and super_admins can see all staff
      allowedStaffRoles = ['agent', 'caretaker', 'cleaner', 'security', 'maintenance', 'receptionist', 'accountant', 'manager'];
    }
    
    // Build where clause with company/agency scoping and role filtering
    const whereClause = buildWhereClause(user, {
      role: { in: allowedStaffRoles },
      ...filters,
    }, 'user');
    
    console.log(`🔍 getCaretakers for ${user.role}:`, {
      allowedRoles: allowedStaffRoles,
      user_id: user.user_id,
    });
    
    const staffMembers = await prisma.user.findMany({
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
        property_assignments: {
          where: { status: 'active' },
          select: {
            id: true,
            property_id: true,
            is_primary: true,
            assigned_at: true,
            property: {
              select: {
                id: true,
                name: true,
                type: true,
                street: true,
                city: true,
              }
            }
          }
        },
      },
      orderBy: {
        created_at: 'desc'
      }
    });
    
    return staffMembers;
  },
  
  createCaretaker: (user: JWTClaims, data: any) => 
    staffService.createStaffMember(user, data.role || 'caretaker', data), // Use role from data, fallback to 'caretaker'
  
  getCaretaker: (user: JWTClaims, id: string) => 
    staffService.getStaffMember(user, id), // No role filter - fetch any staff member
  
  updateCaretaker: (user: JWTClaims, id: string, data: any) => 
    staffService.updateStaffMember(user, id, data, 'caretaker'),
  
  deleteCaretaker: (user: JWTClaims, id: string) => 
    staffService.deleteStaffMember(user, id, 'caretaker'),
  
  inviteCaretaker: (user: JWTClaims, id: string) => 
    staffService.inviteStaffMember(user, id), // Don't pass role - let it auto-detect
  
  resetPassword: (user: JWTClaims, id: string) => 
    staffService.resetPassword(user, id, 'caretaker'),
};

