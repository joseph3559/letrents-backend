import { getPrisma } from '../config/prisma.js';
import { JWTClaims } from '../types/index.js';

export interface MaintenanceFilters {
  property_id?: string;
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

  async getMaintenanceRequest(id: string, user: JWTClaims): Promise<MaintenanceRecord> {
    // TODO: Implement actual database lookup
    // For now, return a mock record
    const maintenanceRecord: MaintenanceRecord = {
      id,
      property_id: '69b2b763-1853-48db-bce8-44b54c461b15',
      unit_id: undefined,
      tenant_id: undefined,
      title: 'Leaking tap in bathroom',
      description: 'Tenant reported leaking tap in Unit A1 bathroom',
      category: 'plumbing',
      priority: 'medium',
      status: 'pending',
      created_by: user.user_id,
      created_at: new Date(),
      updated_at: new Date(),
    };

    return maintenanceRecord;
  }

  async listMaintenanceRequests(filters: MaintenanceFilters, user: JWTClaims): Promise<any> {
    const limit = Math.min(filters.limit || 20, 100);
    const offset = filters.offset || 0;

    // TODO: Implement actual database query with filters
    // For now, return mock data
    const mockMaintenanceRequests: MaintenanceRecord[] = [
      {
        id: '01a4ab28-d1cb-4c86-8e87-73cee5d65f13',
        property_id: '69b2b763-1853-48db-bce8-44b54c461b15',
        unit_id: undefined,
        tenant_id: undefined,
        title: 'Leaking tap in bathroom',
        description: 'Tenant reported leaking tap in Unit A1 bathroom',
        category: 'plumbing',
        priority: 'medium',
        status: 'pending',
        created_by: user.user_id,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    // Apply basic filtering
    let filteredRequests = mockMaintenanceRequests;

    if (filters.property_id) {
      filteredRequests = filteredRequests.filter(req => req.property_id === filters.property_id);
    }

    if (filters.unit_id) {
      filteredRequests = filteredRequests.filter(req => req.unit_id === filters.unit_id);
    }

    if (filters.tenant_id) {
      filteredRequests = filteredRequests.filter(req => req.tenant_id === filters.tenant_id);
    }

    if (filters.category) {
      filteredRequests = filteredRequests.filter(req => req.category === filters.category);
    }

    if (filters.priority) {
      filteredRequests = filteredRequests.filter(req => req.priority === filters.priority);
    }

    if (filters.status) {
      filteredRequests = filteredRequests.filter(req => req.status === filters.status);
    }

    if (filters.search_query) {
      const query = filters.search_query.toLowerCase();
      filteredRequests = filteredRequests.filter(req => 
        req.title.toLowerCase().includes(query) ||
        req.description.toLowerCase().includes(query)
      );
    }

    // Apply pagination
    const paginatedRequests = filteredRequests.slice(offset, offset + limit);
    const total = filteredRequests.length;
    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.floor(offset / limit) + 1;

    return {
      maintenance: paginatedRequests,
      total,
      page: currentPage,
      per_page: limit,
      total_pages: totalPages,
    };
  }

  async updateMaintenanceRequest(id: string, req: UpdateMaintenanceRequest, user: JWTClaims): Promise<MaintenanceRecord> {
    // TODO: Implement actual database update
    // For now, return updated mock record
    const updatedRecord: MaintenanceRecord = {
      id,
      property_id: '69b2b763-1853-48db-bce8-44b54c461b15',
      unit_id: undefined,
      tenant_id: undefined,
      title: req.title || 'Leaking tap in bathroom',
      description: req.description || 'Tenant reported leaking tap in Unit A1 bathroom',
      category: req.category || 'plumbing',
      priority: req.priority || 'medium',
      status: req.status || 'pending',
      created_by: user.user_id,
      created_at: new Date(Date.now() - 86400000), // 1 day ago
      updated_at: new Date(),
    };

    return updatedRecord;
  }

  async deleteMaintenanceRequest(id: string, user: JWTClaims): Promise<void> {
    // TODO: Implement actual database deletion
    // For now, just validate the request
    if (!id) {
      throw new Error('maintenance request ID is required');
    }

    // Check permissions (only creator or admin can delete)
    if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
      throw new Error('insufficient permissions to delete maintenance requests');
    }
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
