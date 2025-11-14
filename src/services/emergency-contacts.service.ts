import { PrismaClient } from '@prisma/client';
import { JWTClaims } from '../types/index.js';
import { getPrisma } from '../config/prisma.js';

const prisma = getPrisma();

export interface CreateEmergencyContactRequest {
  name: string;
  role: string;
  phone: string;
  email?: string;
  available24_7?: boolean;
  response_time?: string;
  specialties?: string[];
  property_ids?: string[];
  is_local?: boolean;
  verified?: boolean;
  agent_assigned?: string;
}

export interface UpdateEmergencyContactRequest extends Partial<CreateEmergencyContactRequest> {}

export class EmergencyContactsService {
  /**
   * Get all emergency contacts for a company/agency
   */
  async getEmergencyContacts(
    user: JWTClaims,
    filters?: {
      agencyId?: string; // For super-admin viewing as specific agency
      property_id?: string;
      search?: string;
    }
  ): Promise<any[]> {
    let companyId = user.company_id;
    let agencyId = filters?.agencyId;

    // If agencyId is provided (super-admin viewing as agency), get the agency's company_id
    if (filters?.agencyId && user.role === 'super_admin') {
      const agency = await prisma.agency.findUnique({
        where: { id: filters.agencyId },
        select: { company_id: true }
      });

      if (!agency || !agency.company_id) {
        throw new Error('Agency not found or has no associated company');
      }

      companyId = agency.company_id;
    } else if (user.role === 'agency_admin' && user.agency_id) {
      // Agency admin sees contacts for their agency
      agencyId = user.agency_id;
    }

    // For non-super-admin users, company_id must be present
    if (!companyId && user.role !== 'super_admin') {
      throw new Error('User must be associated with a company');
    }

    const where: any = {};

    // Only filter by company_id if we have one
    if (companyId) {
      where.company_id = companyId;
    }

    // Filter by agency_id if provided
    if (agencyId) {
      where.agency_id = agencyId;
    } else if (user.role === 'agency_admin') {
      // Agency admins only see contacts for their agency
      where.agency_id = user.agency_id;
    } else if (user.role === 'landlord') {
      // Landlords see contacts for their company (no agency filter)
      where.agency_id = null;
    }

    // Filter by property if provided
    if (filters?.property_id) {
      where.property_ids = {
        has: filters.property_id
      };
    }

    // Search filter
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { role: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    const contacts = await prisma.emergencyContact.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        },
        assigned_agent: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        },
        agency: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    return contacts;
  }

  /**
   * Get a single emergency contact by ID
   */
  async getEmergencyContact(contactId: string, user: JWTClaims): Promise<any> {
    const contact = await prisma.emergencyContact.findUnique({
      where: { id: contactId },
      include: {
        creator: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        },
        assigned_agent: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        },
        agency: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!contact) {
      throw new Error('Emergency contact not found');
    }

    // Check permissions
    if (user.role !== 'super_admin') {
      if (!user.company_id || contact.company_id !== user.company_id) {
        throw new Error('Insufficient permissions to access this contact');
      }

      if (user.role === 'agency_admin' && user.agency_id) {
        if (contact.agency_id !== user.agency_id) {
          throw new Error('Insufficient permissions to access this contact');
        }
      }
    }

    return contact;
  }

  /**
   * Create a new emergency contact
   */
  async createEmergencyContact(
    req: CreateEmergencyContactRequest,
    user: JWTClaims
  ): Promise<any> {
    // Check permissions
    if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
      throw new Error('Insufficient permissions to create emergency contacts');
    }

    let companyId = user.company_id;
    let agencyId: string | null = null;

    // Handle super admin creating for specific agency
    if (user.role === 'super_admin' && req.agent_assigned) {
      // If agent_assigned is provided, get their agency and company
      const agent = await prisma.user.findUnique({
        where: { id: req.agent_assigned },
        select: { company_id: true, agency_id: true }
      });

      if (agent) {
        companyId = agent.company_id || companyId;
        agencyId = agent.agency_id;
      }
    } else if (user.role === 'agency_admin' && user.agency_id) {
      // Agency admin creates contacts for their agency
      agencyId = user.agency_id;
    } else if (user.role === 'landlord') {
      // Landlord creates contacts for their company (no agency)
      agencyId = null;
    }

    if (!companyId) {
      throw new Error('Company ID is required');
    }

    const contact = await prisma.emergencyContact.create({
      data: {
        company_id: companyId,
        agency_id: agencyId,
        name: req.name,
        role: req.role,
        phone: req.phone,
        email: req.email || null,
        available24_7: req.available24_7 || false,
        response_time: req.response_time || null,
        specialties: req.specialties || [],
        property_ids: req.property_ids || [],
        is_local: req.is_local !== false,
        verified: req.verified || false,
        agent_assigned: req.agent_assigned || null,
        created_by: user.user_id
      },
      include: {
        creator: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        },
        assigned_agent: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        },
        agency: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return contact;
  }

  /**
   * Update an emergency contact
   */
  async updateEmergencyContact(
    contactId: string,
    req: UpdateEmergencyContactRequest,
    user: JWTClaims
  ): Promise<any> {
    // Check permissions
    if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
      throw new Error('Insufficient permissions to update emergency contacts');
    }

    const existingContact = await this.getEmergencyContact(contactId, user);

    const updateData: any = {
      updated_at: new Date()
    };

    if (req.name !== undefined) updateData.name = req.name;
    if (req.role !== undefined) updateData.role = req.role;
    if (req.phone !== undefined) updateData.phone = req.phone;
    if (req.email !== undefined) updateData.email = req.email || null;
    if (req.available24_7 !== undefined) updateData.available24_7 = req.available24_7;
    if (req.response_time !== undefined) updateData.response_time = req.response_time || null;
    if (req.specialties !== undefined) updateData.specialties = req.specialties;
    if (req.property_ids !== undefined) updateData.property_ids = req.property_ids;
    if (req.is_local !== undefined) updateData.is_local = req.is_local;
    if (req.verified !== undefined) updateData.verified = req.verified;
    if (req.agent_assigned !== undefined) updateData.agent_assigned = req.agent_assigned || null;

    const contact = await prisma.emergencyContact.update({
      where: { id: contactId },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        },
        assigned_agent: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        },
        agency: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return contact;
  }

  /**
   * Delete an emergency contact
   */
  async deleteEmergencyContact(contactId: string, user: JWTClaims): Promise<void> {
    // Check permissions
    if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
      throw new Error('Insufficient permissions to delete emergency contacts');
    }

    const existingContact = await this.getEmergencyContact(contactId, user);

    await prisma.emergencyContact.delete({
      where: { id: contactId }
    });
  }
}

