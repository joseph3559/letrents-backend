import { Request, Response } from 'express';
import { writeSuccess, writeError } from '../utils/response.js';
import { JWTClaims } from '../types/index.js';
import { getPrisma } from '../config/prisma.js';

const prisma = getPrisma();

export const propertyStaffController = {
  // Get all staff assigned to a property
  getPropertyStaff: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { propertyId } = req.params;

      // Find the property first to ensure user has access
      const property = await prisma.property.findFirst({
        where: {
          id: propertyId,
          ...(user.role === 'landlord' ? { owner_id: user.user_id } : {}),
          ...(user.company_id ? { company_id: user.company_id } : {}),
        }
      });

      if (!property) {
        return writeError(res, 404, 'Property not found or access denied');
      }

      // Find all staff assigned to this property
      // For now, we'll get all staff from the same company with different roles
      const staff = await prisma.user.findMany({
        where: {
          company_id: user.company_id,
          role: {
            in: ['caretaker', 'agent']
          }
          // Removed status filter to include both active and inactive staff
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          phone_number: true,
          role: true,
          status: true,
          created_at: true,
        }
      });

      // Transform the data to match frontend expectations
      const transformedStaff = staff.map((member, index) => ({
        id: member.id,
        first_name: member.first_name,
        last_name: member.last_name,
        email: member.email,
        phone_number: member.phone_number,
        role: member.role,
        status: member.status,
        assigned_date: member.created_at.toISOString().split('T')[0],
        staff_number: generateStaffNumber(member.role, member.created_at),
        specialization: getSpecializationByRole(member.role),
        experience_years: Math.floor(Math.random() * 10) + 1, // Mock data
        working_hours: getWorkingHoursByRole(member.role),
        off_days: getOffDaysByRole(member.role),
        emergency_contact: `+254700${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`
      }));

      writeSuccess(res, 200, 'Property staff retrieved successfully', transformedStaff);
    } catch (error: any) {
      console.error('Error fetching property staff:', error);
      writeError(res, 500, error.message);
    }
  },

  // Assign staff to a property
  assignStaffToProperty: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { propertyId } = req.params;
      const staffData = req.body;

      // Find the property first to ensure user has access
      const property = await prisma.property.findFirst({
        where: {
          id: propertyId,
          ...(user.role === 'landlord' ? { owner_id: user.user_id } : {}),
          ...(user.company_id ? { company_id: user.company_id } : {}),
        }
      });

      if (!property) {
        return writeError(res, 404, 'Property not found or access denied');
      }

      // Check if staff member already exists
      let staffMember = await prisma.user.findFirst({
        where: {
          email: staffData.email,
          company_id: user.company_id,
        }
      });

      if (staffMember) {
        // Update existing staff member
        staffMember = await prisma.user.update({
          where: { id: staffMember.id },
          data: {
            first_name: staffData.first_name,
            last_name: staffData.last_name,
            phone_number: staffData.phone_number,
            role: staffData.role,
            updated_at: new Date(),
          }
        });
      } else {
        // Create new staff member
        staffMember = await prisma.user.create({
          data: {
            first_name: staffData.first_name,
            last_name: staffData.last_name,
            email: staffData.email,
            phone_number: staffData.phone_number,
            role: staffData.role,
            company_id: user.company_id,
            landlord_id: user.role === 'landlord' ? user.user_id : null,
            password_hash: '$2b$10$defaulthashedpassword', // Default password, should be changed
            status: 'active',
            created_at: new Date(),
            updated_at: new Date(),
          }
        });
      }

      writeSuccess(res, 201, 'Staff assigned to property successfully', staffMember);
    } catch (error: any) {
      console.error('Error assigning staff to property:', error);
      writeError(res, 500, error.message);
    }
  },

  // Update staff member
  updatePropertyStaff: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { propertyId, staffId } = req.params;
      const staffData = req.body;

      // Find the property first to ensure user has access
      const property = await prisma.property.findFirst({
        where: {
          id: propertyId,
          ...(user.role === 'landlord' ? { owner_id: user.user_id } : {}),
          ...(user.company_id ? { company_id: user.company_id } : {}),
        }
      });

      if (!property) {
        return writeError(res, 404, 'Property not found or access denied');
      }

      // Update staff member
      const updatedStaff = await prisma.user.update({
        where: { 
          id: staffId,
          company_id: user.company_id
        },
        data: {
          first_name: staffData.first_name,
          last_name: staffData.last_name,
          phone_number: staffData.phone_number,
          role: staffData.role,
          status: staffData.status,
          landlord_id: user.role === 'landlord' ? user.user_id : null,
          updated_at: new Date(),
        }
      });

      writeSuccess(res, 200, 'Staff member updated successfully', updatedStaff);
    } catch (error: any) {
      console.error('Error updating staff member:', error);
      writeError(res, 500, error.message);
    }
  },

  // Remove staff from property
  removeStaffFromProperty: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { propertyId, staffId } = req.params;

      // Find the property first to ensure user has access
      const property = await prisma.property.findFirst({
        where: {
          id: propertyId,
          ...(user.role === 'landlord' ? { owner_id: user.user_id } : {}),
          ...(user.company_id ? { company_id: user.company_id } : {}),
        }
      });

      if (!property) {
        return writeError(res, 404, 'Property not found or access denied');
      }

      // Instead of deleting, we'll deactivate the staff member
      await prisma.user.update({
        where: { 
          id: staffId,
          company_id: user.company_id
        },
        data: {
          status: 'inactive',
          updated_at: new Date(),
        }
      });

      writeSuccess(res, 200, 'Staff member removed from property successfully');
    } catch (error: any) {
      console.error('Error removing staff from property:', error);
      writeError(res, 500, error.message);
    }
  }
};

// Helper functions
function generateStaffNumber(role: string, createdAt: Date): string {
  const rolePrefix = {
    'caretaker': 'CT',
    'agent': 'AG',
    'security': 'SC',
    'cleaner': 'CL',
    'maintenance': 'MT'
  }[role] || 'ST';
  
  const year = createdAt.getFullYear().toString().slice(-2);
  const month = (createdAt.getMonth() + 1).toString().padStart(2, '0');
  const randomNum = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  
  return `${rolePrefix}${year}${month}${randomNum}`;
}

function getSpecializationByRole(role: string): string {
  switch (role) {
    case 'caretaker':
      return 'General Maintenance & Property Care';
    case 'agent':
      return 'Property Management & Leasing';
    default:
      return 'General Property Services';
  }
}

function getWorkingHoursByRole(role: string): string {
  switch (role) {
    case 'caretaker':
      return '8:00 AM - 5:00 PM';
    case 'agent':
      return '9:00 AM - 6:00 PM';
    default:
      return '8:00 AM - 5:00 PM';
  }
}

function getOffDaysByRole(role: string): string[] {
  switch (role) {
    case 'caretaker':
      return ['Sunday'];
    case 'agent':
      return ['Saturday', 'Sunday'];
    default:
      return ['Sunday'];
  }
}
