import { getPrisma } from '../config/prisma.js';
import { JWTClaims } from '../types/index.js';

export interface MaintenanceFilters {
  property_id?: string;
  property_ids?: string[]; // For filtering by multiple property IDs (super-admin)
  unit_id?: string;
  tenant_id?: string;
  category?: string;
  priority?: string;
  status?: string;
  search_query?: string;
  sort_by?: string;
  sort_order?: string;
  limit?: number;
  offset?: number;
}

export interface CreateMaintenanceRequest {
  property_id?: string;
  unit_id?: string;
  tenant_id?: string;
  title: string;
  description: string;
  category?: string;
  priority?: string;
}

export interface UpdateMaintenanceRequest {
  title?: string;
  description?: string;
  category?: string;
  priority?: string;
  status?: string;
  notes?: string;
  internal_notes?: string;
  assigned_to?: string;
  scheduled_date?: Date;
  completed_date?: Date;
  estimated_cost?: number;
  actual_cost?: number;
}

export interface MaintenanceRecord {
  id: string;
  property_id?: string;
  unit_id?: string;
  tenant_id?: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export class MaintenanceService {
  private prisma = getPrisma();

  async createMaintenanceRequest(req: CreateMaintenanceRequest, user: JWTClaims): Promise<MaintenanceRecord> {
    // Validate required fields
    if (!req.title || !req.description) {
      throw new Error('title and description are required');
    }

    // Set defaults
    const category = req.category || 'general';
    const priority = req.priority || 'medium';

    // For now, we'll create a mock maintenance record since there's no maintenance table in Prisma schema
    // In a real implementation, this would save to a maintenance_requests table
    const maintenanceRecord: MaintenanceRecord = {
      id: `maint-${Date.now()}`,
      property_id: req.property_id,
      unit_id: req.unit_id,
      tenant_id: req.tenant_id,
      title: req.title,
      description: req.description,
      category,
      priority,
      status: 'pending',
      created_by: user.user_id,
      created_at: new Date(),
      updated_at: new Date(),
    };

    // TODO: Save to actual maintenance_requests table when it exists
    // await this.prisma.maintenanceRequest.create({ data: maintenanceRecord });

    return maintenanceRecord;
  }

  async getMaintenanceRequest(id: string, user: JWTClaims): Promise<any> {
    // Fetch the maintenance request from database with all relations
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
      include: {
        property: true,
        unit: true,
        requester: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone_number: true,
            role: true,
          }
        },
        assignee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone_number: true,
            role: true,
          }
        }
      }
    });

    if (!request) {
      throw new Error('Maintenance request not found');
    }

    // Check if user has permission to view this request
    if (user.company_id && request.company_id !== user.company_id) {
      throw new Error('You do not have permission to view this maintenance request');
    }

    // Transform data to include flat fields for easier frontend consumption
    return {
      ...request,
      property_name: request.property?.name,
      unit_number: request.unit?.unit_number,
      tenant_name: request.requester ? `${request.requester.first_name} ${request.requester.last_name}` : 'Unknown Tenant',
      tenant_id: request.requester?.id,
      assignee_name: request.assignee ? `${request.assignee.first_name} ${request.assignee.last_name}` : null,
    };
  }

  async listMaintenanceRequests(filters: MaintenanceFilters, user: JWTClaims): Promise<any> {
    const limit = Math.min(filters.limit || 20, 100);
    const offset = filters.offset || 0;

    // Build where clause based on filters and user permissions
    const where: any = {};

    // Apply role-based filtering
    if (user.company_id) {
      where.company_id = user.company_id;
    }

    // Handle property_ids (for super-admin) or property_id (single)
    if (filters.property_ids && filters.property_ids.length > 0) {
      where.property_id = { in: filters.property_ids };
    } else if (filters.property_id) {
      where.property_id = filters.property_id;
    }

    if (filters.unit_id) {
      where.unit_id = filters.unit_id;
    }

    if (filters.tenant_id) {
      where.requested_by = filters.tenant_id;
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.priority) {
      where.priority = filters.priority;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search_query) {
      where.OR = [
        { title: { contains: filters.search_query, mode: 'insensitive' } },
        { description: { contains: filters.search_query, mode: 'insensitive' } },
      ];
    }

    // Fetch from database with relations
    const [requests, total] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where,
        include: {
          property: true,
          unit: true,
          requester: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              phone_number: true,
              role: true,
            }
          },
          assignee: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              phone_number: true,
              role: true,
            }
          }
        },
        orderBy: filters.sort_by ? { [filters.sort_by]: filters.sort_order || 'desc' } : { created_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.maintenanceRequest.count({ where })
    ]);

    // Transform data to include flat fields for easier frontend consumption
    const transformedRequests = requests.map(req => ({
      ...req,
      property_name: req.property?.name,
      unit_number: req.unit?.unit_number,
      tenant_name: req.requester ? `${req.requester.first_name} ${req.requester.last_name}` : 'Unknown Tenant',
      tenant_id: req.requester?.id,
      assignee_name: req.assignee ? `${req.assignee.first_name} ${req.assignee.last_name}` : null,
    }));

    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.floor(offset / limit) + 1;

    return {
      maintenance: transformedRequests,
      total,
      page: currentPage,
      per_page: limit,
      total_pages: totalPages,
    };
  }

  async updateMaintenanceRequest(id: string, req: UpdateMaintenanceRequest, user: JWTClaims): Promise<any> {
    // First, check if the request exists and user has permission
    const existingRequest = await this.prisma.maintenanceRequest.findUnique({
      where: { id }
    });

    if (!existingRequest) {
      throw new Error('Maintenance request not found');
    }

    // Check permissions
    if (user.company_id && existingRequest.company_id !== user.company_id) {
      throw new Error('You do not have permission to update this maintenance request');
    }

    // Build update data object, only including fields that are provided
    const updateData: any = {
      updated_at: new Date(),
    };

    if (req.title !== undefined) updateData.title = req.title;
    if (req.description !== undefined) updateData.description = req.description;
    if (req.category !== undefined) updateData.category = req.category;
    if (req.priority !== undefined) updateData.priority = req.priority;
    if (req.status !== undefined) updateData.status = req.status;
    if (req.notes !== undefined) updateData.notes = req.notes;
    if (req.internal_notes !== undefined) updateData.internal_notes = req.internal_notes;
    if (req.assigned_to !== undefined) updateData.assigned_to = req.assigned_to;
    if (req.scheduled_date !== undefined) updateData.scheduled_date = req.scheduled_date;
    if (req.completed_date !== undefined) updateData.completed_date = req.completed_date;
    if (req.estimated_cost !== undefined) updateData.estimated_cost = req.estimated_cost;
    if (req.actual_cost !== undefined) updateData.actual_cost = req.actual_cost;

    // Update the request
    const updatedRequest = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: updateData,
      include: {
        property: true,
        unit: true,
        requester: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone_number: true,
            role: true,
          }
        },
        assignee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone_number: true,
            role: true,
          }
        }
      }
    });

    // Transform data to include flat fields
    return {
      ...updatedRequest,
      property_name: updatedRequest.property?.name,
      unit_number: updatedRequest.unit?.unit_number,
      tenant_name: updatedRequest.requester ? `${updatedRequest.requester.first_name} ${updatedRequest.requester.last_name}` : 'Unknown Tenant',
      tenant_id: updatedRequest.requester?.id,
      assignee_name: updatedRequest.assignee ? `${updatedRequest.assignee.first_name} ${updatedRequest.assignee.last_name}` : null,
    };
  }

  async deleteMaintenanceRequest(id: string, user: JWTClaims): Promise<void> {
    if (!id) {
      throw new Error('Maintenance request ID is required');
    }

    // First, check if the request exists and user has permission
    const existingRequest = await this.prisma.maintenanceRequest.findUnique({
      where: { id }
    });

    if (!existingRequest) {
      throw new Error('Maintenance request not found');
    }

    // Check permissions
    if (user.company_id && existingRequest.company_id !== user.company_id) {
      throw new Error('You do not have permission to delete this maintenance request');
    }

    // Check role permissions (only admins can delete)
    if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
      throw new Error('Insufficient permissions to delete maintenance requests');
    }

    // Delete the request
    await this.prisma.maintenanceRequest.delete({
      where: { id }
    });
  }

  async getMaintenanceOverview(user: JWTClaims): Promise<any> {
    // For now, return mock overview data
    // TODO: Implement actual database queries
    return {
      total_requests: 0,
      pending_requests: 0,
      in_progress_requests: 0,
      completed_requests: 0,
      overdue_requests: 0,
      high_priority_requests: 0,
      average_completion_time: 0,
      recent_requests: []
    };
  }
}
