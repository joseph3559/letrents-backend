import { getPrisma } from '../config/prisma.js';
import { JWTClaims } from '../types/index.js';
import { buildWhereClause, formatDataForRole } from '../utils/roleBasedFiltering.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = getPrisma();

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
        emergency_contact_email: true,
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
    // Validate permissions - allow agents, landlords, agency admins, and super admins to create staff
    if (!['agent', 'landlord', 'agency_admin', 'super_admin'].includes(user.role)) {
      throw new Error(`Insufficient permissions to create ${role}`);
    }

    // CRITICAL: Restrict 'manager' role to super_admin only (SaaS team only)
    if (role === 'manager' && user.role !== 'super_admin') {
      throw new Error('The manager role is only available for the SaaS team (super admin). Landlords and agencies cannot create manager roles.');
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

    // Don't create password - user will set it via invitation link (like tenants)
    // Only hash password if explicitly provided (for backward compatibility)
    let passwordHash = null;
    if (staffData.password) {
      passwordHash = await bcrypt.hash(staffData.password, 10);
    }

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
      ...(passwordHash ? { password_hash: passwordHash } : {}), // Only set password if provided
      role: role as any,
      status: passwordHash ? ('active' as any) : ('pending' as any), // Set to pending if no password
      email_verified: false, // Will be verified when they click invitation link
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
      emergency_contact_email: staffData.emergency_contact_email,
      emergency_relationship: staffData.emergency_relationship,
      working_hours: staffData.working_hours,
      off_days: Array.isArray(staffData.off_days) ? staffData.off_days.join(',') : staffData.off_days,
      skills: Array.isArray(staffData.skills) ? staffData.skills.join(',') : staffData.skills,
      languages: Array.isArray(staffData.languages) ? staffData.languages.join(',') : staffData.languages,
    };

    // CRITICAL: Always set company_id - this is mandatory for all staff members
    // Apply company/agency scoping based on creator's role
    if (user.role === 'agent') {
      // Agents should use their company_id
      if (user.company_id) {
        createData.company_id = user.company_id;
      } else {
        // This should never happen due to check above, but add as safeguard
        throw new Error('Cannot create staff: Agent has no company_id');
      }
      // Set agency_id if the agent has one
      if (user.agency_id) {
        createData.agency_id = user.agency_id;
      }
    } else if (user.role === 'agency_admin') {
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
        emergency_contact_email: true,
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
        emergency_contact_email: true,
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
    const allowedRoleUpdates = new Set([
      'agent',
      'caretaker',
      'cleaner',
      'security',
      'maintenance',
      'receptionist',
      'accountant',
      'manager',
      'admin',
      'team_lead',
      'staff',
      'finance',
      'sales',
      'marketing',
      'support',
      'hr',
      'auditor',
    ]);
    
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
    if (updateData.role) {
      const nextRole = updateData.role.toString();
      if (!allowedRoleUpdates.has(nextRole)) {
        throw new Error('Invalid role assignment for staff member');
      }
      updateFields.role = nextRole;
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
    if (updateData.emergency_contact_email !== undefined) {
      updateFields.emergency_contact_email = updateData.emergency_contact_email;
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
          emergency_contact_email: true,
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
   * Delete a staff member (permanent deletion)
   * 
   * This function handles cascading deletion of all related records to maintain data integrity.
   * It does not filter by role - it finds the staff member by ID regardless of their role.
   * 
   * @param user - The authenticated user making the deletion request
   * @param staffId - The ID of the staff member to delete
   * @param role - Optional role parameter (deprecated, kept for backward compatibility)
   * @returns Success object if deletion succeeds
   * @throws Error if staff member not found or user lacks permission
   */
  async deleteStaffMember(user: JWTClaims, staffId: string, role?: StaffRole) {
    // Find staff member by ID only (no role filtering for deletion)
    const existingStaff = await prisma.user.findFirst({
      where: {
        id: staffId,
      },
      select: {
        id: true,
        role: true,
        company_id: true,
        agency_id: true,
      }
    });

    if (!existingStaff) {
      throw new Error(`Staff member with ID ${staffId} not found`);
    }

    // Verify user has permission to delete this staff member
    // Super admin can delete anyone
    if (user.role === 'super_admin') {
      // Allow deletion
    }
    // Agency admin can delete staff in their company/agency
    else if (user.role === 'agency_admin') {
      if (user.company_id && existingStaff.company_id && existingStaff.company_id !== user.company_id) {
        throw new Error('Access denied: Cannot delete staff member from different company');
      }
      if (user.agency_id && existingStaff.agency_id && existingStaff.agency_id !== user.agency_id) {
        throw new Error('Access denied: Cannot delete staff member from different agency');
      }
    }
    // Landlord can delete staff in their company
    else if (user.role === 'landlord') {
      if (user.company_id && existingStaff.company_id && existingStaff.company_id !== user.company_id) {
        throw new Error('Access denied: Cannot delete staff member from different company');
      }
    }
    // Agent can delete staff in their company
    else if (user.role === 'agent') {
      if (user.company_id && existingStaff.company_id && existingStaff.company_id !== user.company_id) {
        throw new Error('Access denied: Cannot delete staff member from different company');
      }
    }
    // Other roles cannot delete staff
    else {
      throw new Error('Access denied: Insufficient permissions to delete staff member');
    }

    // Use transaction to handle all related records and avoid foreign key constraint errors
    try {
      await prisma.$transaction(async (tx) => {
      // 1. Delete staff property assignments (has cascade, but delete explicitly for clarity)
      await tx.staffPropertyAssignment.deleteMany({
        where: { staff_id: staffId }
      });

      // 2. Delete tasks assigned to this staff member
      await tx.task.deleteMany({
        where: { assigned_to: staffId }
      });

      // 3. Delete tasks assigned by this staff member (assigned_by is not nullable)
      await tx.task.deleteMany({
        where: { assigned_by: staffId }
      });

      // 4. Delete maintenance requests assigned to this staff member
      await tx.maintenanceRequest.deleteMany({
        where: { assigned_to: staffId }
      });

      // 5. Delete maintenance requests requested by this staff member (requested_by is not nullable)
      await tx.maintenanceRequest.deleteMany({
        where: { requested_by: staffId }
      });

      // 6. Delete inspections where this staff member is the inspector
      await tx.inspection.deleteMany({
        where: { inspector_id: staffId }
      });

      // 7. Delete emergency contacts assigned to this staff member
      await tx.emergencyContact.updateMany({
        where: { agent_assigned: staffId },
        data: { agent_assigned: null }
      });

      // 8. Delete emergency contacts created by this staff member
      await tx.emergencyContact.deleteMany({
        where: { created_by: staffId }
      });

      // 9. Delete conversation participants
      await tx.conversationParticipant.deleteMany({
        where: { user_id: staffId }
      });

      // 10. Delete conversations created by this staff member
      await tx.conversation.deleteMany({
        where: { created_by: staffId }
      });

      // 11. Delete message recipients
      await tx.messageRecipient.deleteMany({
        where: { recipient_id: staffId }
      });

      // 12. Delete messages sent by this staff member
      await tx.message.deleteMany({
        where: { sender_id: staffId }
      });

      // 13. Delete notifications
      await tx.notification.deleteMany({
        where: {
          OR: [
            { recipient_id: staffId },
            { sender_id: staffId }
          ]
        }
      });

      // 14. Get units and properties created by this staff member before deleting
      const unitsToDelete = await tx.unit.findMany({
        where: { created_by: staffId },
        select: { id: true }
      });
      const unitIds = unitsToDelete.map(u => u.id);

      const propertiesToDelete = await tx.property.findMany({
        where: { created_by: staffId },
        select: { id: true }
      });
      const propertyIds = propertiesToDelete.map(p => p.id);

      // 14a. Delete child records of units (leases, maintenance requests, invoices, tasks, inspections, tenant profiles, payments)
      if (unitIds.length > 0) {
        // Delete leases for these units
        await tx.lease.deleteMany({
          where: { unit_id: { in: unitIds } }
        });

        // Delete maintenance requests for these units
        await tx.maintenanceRequest.deleteMany({
          where: { unit_id: { in: unitIds } }
        });

        // Delete invoices for these units
        await tx.invoice.deleteMany({
          where: { unit_id: { in: unitIds } }
        });

        // Delete tasks for these units
        await tx.task.deleteMany({
          where: { unit_id: { in: unitIds } }
        });

        // Delete inspections for these units
        await tx.inspection.deleteMany({
          where: { unit_id: { in: unitIds } }
        });

        // Update tenant profiles that reference these units
        await tx.tenantProfile.updateMany({
          where: { current_unit_id: { in: unitIds } },
          data: { current_unit_id: null }
        });

        // Delete payments for these units
        await tx.payment.deleteMany({
          where: { unit_id: { in: unitIds } }
        });
      }

      // 14b. Delete child records of properties (leases, maintenance requests, invoices, tasks, inspections, tenant profiles, payments, units)
      if (propertyIds.length > 0) {
        // Delete leases for these properties
        await tx.lease.deleteMany({
          where: { property_id: { in: propertyIds } }
        });

        // Delete maintenance requests for these properties
        await tx.maintenanceRequest.deleteMany({
          where: { property_id: { in: propertyIds } }
        });

        // Delete invoices for these properties
        await tx.invoice.deleteMany({
          where: { property_id: { in: propertyIds } }
        });

        // Delete tasks for these properties
        await tx.task.deleteMany({
          where: { property_id: { in: propertyIds } }
        });

        // Delete inspections for these properties
        await tx.inspection.deleteMany({
          where: { property_id: { in: propertyIds } }
        });

        // Update tenant profiles that reference these properties
        await tx.tenantProfile.updateMany({
          where: { current_property_id: { in: propertyIds } },
          data: { current_property_id: null }
        });

        // Delete payments for these properties
        await tx.payment.deleteMany({
          where: { property_id: { in: propertyIds } }
        });

        // Delete units for these properties (they cascade, but delete explicitly for clarity)
        await tx.unit.deleteMany({
          where: { property_id: { in: propertyIds } }
        });
      }

      // 15. Now delete units created by this staff member (created_by is not nullable)
      await tx.unit.deleteMany({
        where: { created_by: staffId }
      });

      // 16. Now delete properties created by this staff member (created_by is not nullable)
      await tx.property.deleteMany({
        where: { created_by: staffId }
      });

      // 17. Update applications reviewed by this staff member
      await tx.application.updateMany({
        where: { reviewed_by: staffId },
        data: { reviewed_by: null }
      });

      // 18. Delete invoices issued by this staff member (issued_by is not nullable)
      // Note: InvoiceLineItems cascade delete, so we don't need to delete them explicitly
      await tx.invoice.deleteMany({
        where: { issued_by: staffId }
      });

      // 19. Delete lease modifications modified by this staff member (modified_by is not nullable)
      await tx.leaseModification.deleteMany({
        where: { modified_by: staffId }
      });

      // 20. Update payments processed by this staff member
      await tx.payment.updateMany({
        where: { processed_by: staffId },
        data: { processed_by: null }
      });

      // 21. Delete inspection photos uploaded by this staff member
      await tx.inspectionPhoto.deleteMany({
        where: { uploaded_by: staffId }
      });

      // 22. Delete user preferences and settings (cascade should handle, but explicit for safety)
      await tx.userPreferences.deleteMany({
        where: { user_id: staffId }
      });

      await tx.tenantPreferences.deleteMany({
        where: { user_id: staffId }
      });

      await tx.tenantNotificationSettings.deleteMany({
        where: { user_id: staffId }
      });

      await tx.securitySession.deleteMany({
        where: { user_id: staffId }
      });

      await tx.securityActivityLog.deleteMany({
        where: { user_id: staffId }
      });

      await tx.twoFactorAuth.deleteMany({
        where: { user_id: staffId }
      });

      // 23. Finally, delete the user
      await tx.user.delete({
        where: { id: staffId }
      });
    }, {
      timeout: 30000, // 30 second timeout for large deletions
    });

      console.log(`🗑️ ${role || 'Staff'} deleted successfully: ${staffId}`);
      return { success: true };
    } catch (error: any) {
      console.error(`❌ Error deleting ${role || 'staff'} member ${staffId}:`, error);
      // Provide more specific error messages
      if (error.code === 'P2003') {
        throw new Error('Cannot delete staff member: There are still records referencing this staff member that cannot be deleted.');
      } else if (error.code === 'P2025') {
        throw new Error('Staff member not found');
      } else if (error.message) {
        throw new Error(`Failed to delete staff member: ${error.message}`);
      } else {
        throw new Error('Failed to delete staff member due to database constraint');
      }
    }
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

    // Generate invitation link (no password - user will set it via link)
    const invitationLink = `${process.env.APP_URL || 'http://localhost:3000'}/account/setup?token=invitation-${staffId}&email=${encodeURIComponent(staffMember.email)}&first_name=${encodeURIComponent(staffMember.first_name || '')}&last_name=${encodeURIComponent(staffMember.last_name || '')}`;

    // Update staff member status - no password set, they'll set it via invitation link
    await prisma.user.update({
      where: { id: staffId },
      data: {
        status: 'pending', // User needs to set up their account via link
        email_verified: true, // Auto-verify email for invited users
        updated_at: new Date(),
      }
    });

    // Get role display name
    const roleDisplayName = staffMember.role.charAt(0).toUpperCase() + staffMember.role.slice(1);

    // Send invitation email with setup link
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
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
            .info { background: #e7f3ff; border: 1px solid #b3d9ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
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
              <p>You have been invited to join LetRents as a ${roleDisplayName.toLowerCase()}. Your account has been created and you can now set up your account to access the platform.</p>
              
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
        subject: `Welcome to LetRents - Complete Your ${roleDisplayName} Account Setup`,
        html: invitationHtml,
        text: `Welcome to LetRents!

You've been invited as a ${roleDisplayName.toLowerCase()}. Please complete your account setup:

Setup Link: ${invitationLink}

Click the link above to create your password and activate your account.

Best regards,
The LetRents Team`,
      });

      if (!emailResult.success) {
        console.error(`Failed to send ${roleDisplayName} invitation email:`, emailResult.error);
        // Log invitation link to console as fallback
        console.log(`\n📧 ${roleDisplayName.toUpperCase()} INVITATION (email service failed):`);
        console.log(`👤 Name: ${staffMember.first_name} ${staffMember.last_name}`);
        console.log(`📧 Email: ${staffMember.email}`);
        console.log(`🔗 Setup Link: ${invitationLink}\n`);
        
        throw new Error('Failed to send invitation email');
      } else {
        console.log(`✅ ${roleDisplayName} invitation sent successfully to ${staffMember.email}`);
        console.log(`🔗 Setup link generated (no password - user will set it via link)`);
      }

      return {
        staffId,
        role: staffMember.role,
        invitationSent: true,
        email: staffMember.email,
        setupLink: invitationLink, // Include setup link in response
        message: 'Invitation sent successfully with account setup link'
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
      // Agents can only see staff below their level (NOT other agents, agency_admins, or managers)
      allowedStaffRoles = ['caretaker', 'cleaner', 'security', 'maintenance', 'receptionist', 'accountant'];
    } else if (user.role === 'agency_admin') {
      // Agency admins can see agents and all staff below (NOT managers - SaaS team only)
      allowedStaffRoles = ['agent', 'caretaker', 'cleaner', 'security', 'maintenance', 'receptionist', 'accountant'];
    } else if (user.role === 'landlord') {
      // Landlords can see agents and all staff below (NOT managers - SaaS team only)
      allowedStaffRoles = ['agent', 'caretaker', 'cleaner', 'security', 'maintenance', 'receptionist', 'accountant'];
    } else {
      // Super admins can see all staff including managers
      allowedStaffRoles = ['agent', 'caretaker', 'cleaner', 'security', 'maintenance', 'receptionist', 'accountant', 'manager'];
    }
    
    // Extract property_ids from filters if provided
    const propertyIds = filters?.property_ids;
    delete filters?.property_ids; // Remove from filters to avoid conflicts
    
    // Extract company_id from filters if provided (for super_admin filtering by specific company)
    const filterCompanyId = filters?.company_id;
    delete filters?.company_id; // Remove from filters to avoid conflicts
    
    // Build where clause with company/agency scoping and role filtering
    let whereClause = buildWhereClause(user, {
      role: { in: allowedStaffRoles },
      ...filters,
    }, 'user');
    
    // If company_id filter is provided (e.g., when assigning caretaker to property),
    // use it instead of user's company_id (especially for super_admin)
    if (filterCompanyId && user.role === 'super_admin') {
      // Super admin can filter by any company_id
      whereClause.company_id = filterCompanyId;
    } else if (filterCompanyId && user.company_id) {
      // For non-super-admin users, only allow filtering by their own company_id
      if (filterCompanyId === user.company_id) {
        // User is filtering by their own company_id, which is allowed
        whereClause.company_id = filterCompanyId;
      } else {
        // User attempted to filter by a different company_id - prevent unauthorized access
        console.warn(`User ${user.user_id} attempted to filter by company_id ${filterCompanyId} but their company_id is ${user.company_id}`);
        // Don't override the whereClause - buildWhereClause already filtered by user.company_id
      }
    } else if (filterCompanyId && !user.company_id) {
      // If user has no company_id but filterCompanyId is provided, use it
      whereClause.company_id = filterCompanyId;
    }
    
    // If property_ids are provided, filter staff by their property assignments
    if (propertyIds && Array.isArray(propertyIds) && propertyIds.length > 0) {
      // Find all staff IDs that have assignments to the specified properties
      const staffWithAssignments = await prisma.staffPropertyAssignment.findMany({
        where: {
          property_id: { in: propertyIds },
          status: 'active'
        },
        select: {
          staff_id: true
        },
        distinct: ['staff_id']
      });
      
      const staffIds = staffWithAssignments.map((a: { staff_id: string }) => a.staff_id);
      
      // If no staff found for these properties, return empty array
      if (staffIds.length === 0) {
        console.log(`🔍 No staff found for property_ids: ${propertyIds.join(',')}`);
        return [];
      }
      
      // Add staff_id filter to whereClause
      whereClause.id = { in: staffIds };
    }
    
    console.log(`🔍 getCaretakers for ${user.role}:`, {
      allowedRoles: allowedStaffRoles,
      user_id: user.user_id,
      propertyIds: propertyIds,
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
        emergency_contact_email: true,
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
    staffService.deleteStaffMember(user, id), // Don't pass role - find by ID only
  
  inviteCaretaker: (user: JWTClaims, id: string) => 
    staffService.inviteStaffMember(user, id), // Don't pass role - let it auto-detect
  
  resetPassword: (user: JWTClaims, id: string) => 
    staffService.resetPassword(user, id, 'caretaker'),
};

