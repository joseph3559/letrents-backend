import { getPrisma } from '../config/prisma.js';
import { JWTClaims } from '../types/index.js';
import { buildWhereClause, formatDataForRole, getDashboardScope } from '../utils/roleBasedFiltering.js';

const prisma = getPrisma();

export const reportsService = {
  async getReports(user: JWTClaims, reportType?: string, period: string = 'monthly', propertyIds?: string[]) {
    const scope = getDashboardScope(user);
    let whereClause = buildWhereClause(user);

    // If property_ids are provided (for super_admin filtering), override the where clause
    // This ensures we only get properties matching the provided IDs
    if (propertyIds && propertyIds.length > 0) {
      // For super_admin, we want to filter by the provided property IDs
      // If user is super_admin, use propertyIds directly; otherwise merge with existing whereClause
      if (user.role === 'super_admin') {
        whereClause = { id: { in: propertyIds } };
      } else {
        whereClause = {
          ...whereClause,
          id: { in: propertyIds }
        };
      }
    }

    // Generate different reports based on type
    if (reportType) {
      switch (reportType) {
        case 'overview':
          // Return overview of all available reports (same as default behavior)
          break;
        case 'property':
          return await this.getPropertyReport(user, { period, property_ids: propertyIds });
        case 'financial':
          return await this.getFinancialReport(user, 'revenue', period, propertyIds);
        case 'occupancy':
          return await this.getOccupancyReport(user, period, propertyIds);
        case 'rent-collection':
          return await this.getRentCollectionReport(user, { period, property_ids: propertyIds });
        case 'maintenance':
          return await this.getMaintenanceReport(user, period, undefined, propertyIds);
        default:
          throw new Error('Invalid report type');
      }
    }

    // Return overview of all available reports
    // Build unit where clause - if propertyIds provided, filter by property_id
    const unitWhereClause: any = propertyIds && propertyIds.length > 0
      ? { property_id: { in: propertyIds } }
      : { property: whereClause };
    
    // Build maintenance where clause - if propertyIds provided, filter by property_id
    const maintenanceWhereClause: any = {};
    if (user.role !== 'super_admin' && user.company_id) {
      maintenanceWhereClause.company_id = user.company_id;
    }
    if (propertyIds && propertyIds.length > 0) {
      maintenanceWhereClause.property_id = { in: propertyIds };
    }
    
    const [propertyCount, unitCount, tenantCount, maintenanceCount] = await Promise.all([
      prisma.property.count({ where: whereClause }),
      prisma.unit.count({ where: unitWhereClause }),
      prisma.user.count({ 
        where: {
          role: 'tenant',
          company_id: user.company_id
        }
      }),
      prisma.maintenanceRequest.count({ where: maintenanceWhereClause })
    ]);

    return {
      availableReports: [
        {
          type: 'property',
          name: 'Property Report',
          description: 'Overview of all properties and their performance',
          count: propertyCount
        },
        {
          type: 'financial',
          name: 'Financial Report',
          description: 'Revenue, expenses, and financial analytics',
          count: null
        },
        {
          type: 'occupancy',
          name: 'Occupancy Report',
          description: 'Unit occupancy rates and trends',
          count: unitCount
        },
        {
          type: 'rent-collection',
          name: 'Rent Collection Report',
          description: 'Payment collection rates and outstanding amounts',
          count: null
        },
        {
          type: 'maintenance',
          name: 'Maintenance Report',
          description: 'Maintenance requests and completion rates',
          count: maintenanceCount
        }
      ],
      scope,
      period
    };
  },

  async getPropertyReport(user: JWTClaims, filters: any = {}) {
    let whereClause = buildWhereClause(user);
    
    // If property_ids are provided (for super_admin filtering), add them to where clause
    if (filters.property_ids && Array.isArray(filters.property_ids) && filters.property_ids.length > 0) {
      // For super_admin, use propertyIds directly; otherwise merge with existing whereClause
      if (user.role === 'super_admin') {
        whereClause = { id: { in: filters.property_ids } };
      } else {
        whereClause = {
          ...whereClause,
          id: { in: filters.property_ids }
        };
      }
    }
    
    const properties = await prisma.property.findMany({
      where: whereClause,
      include: {
        units: {
          select: {
            id: true,
            unit_number: true,
            status: true,
            rent_amount: true,
            current_tenant_id: true,
          }
        },
        owner: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          }
        },
        agency: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    const reportData = properties.map(property => {
      const totalUnits = property.units.length;
      const occupiedUnits = property.units.filter(unit => unit.status === 'occupied').length;
      const vacantUnits = totalUnits - occupiedUnits;
      const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;
      
      const totalRentAmount = property.units.reduce((sum, unit) => {
        return sum + (unit.rent_amount ? Number(unit.rent_amount) : 0);
      }, 0);
      
      const actualRevenue = property.units
        .filter(unit => unit.status === 'occupied')
        .reduce((sum, unit) => {
          return sum + (unit.rent_amount ? Number(unit.rent_amount) : 0);
        }, 0);

      return {
        id: property.id,
        name: property.name,
        type: property.type,
        location: `${property.street}, ${property.city}, ${property.region}`,
        totalUnits,
        occupiedUnits,
        vacantUnits,
        occupancyRate: Math.round(occupancyRate * 100) / 100,
        potentialRevenue: totalRentAmount,
        actualRevenue,
        revenueEfficiency: totalRentAmount > 0 ? Math.round((actualRevenue / totalRentAmount) * 100) : 0,
        owner: property.owner ? `${property.owner.first_name} ${property.owner.last_name}` : 'N/A',
        agency: property.agency?.name || 'Direct',
        created_at: property.created_at,
      };
    });

    // Calculate summary statistics
    const summary = {
      totalProperties: reportData.length,
      totalUnits: reportData.reduce((sum, p) => sum + p.totalUnits, 0),
      totalOccupiedUnits: reportData.reduce((sum, p) => sum + p.occupiedUnits, 0),
      totalVacantUnits: reportData.reduce((sum, p) => sum + p.vacantUnits, 0),
      averageOccupancyRate: reportData.length > 0 
        ? Math.round((reportData.reduce((sum, p) => sum + p.occupancyRate, 0) / reportData.length) * 100) / 100 
        : 0,
      totalPotentialRevenue: reportData.reduce((sum, p) => sum + p.potentialRevenue, 0),
      totalActualRevenue: reportData.reduce((sum, p) => sum + p.actualRevenue, 0),
    };

    return formatDataForRole(user, {
      summary,
      properties: reportData,
      generatedAt: new Date().toISOString(),
      period: filters.period || 'current'
    });
  },

  async getFinancialReport(user: JWTClaims, type: string = 'revenue', period: string = 'monthly', propertyIds?: string[]) {
    let whereClause = buildWhereClause(user);
    
    // If property_ids are provided (for super_admin filtering), add them to where clause
    if (propertyIds && propertyIds.length > 0) {
      // For super_admin, use propertyIds directly; otherwise merge with existing whereClause
      if (user.role === 'super_admin') {
        whereClause = { id: { in: propertyIds } };
      } else {
        whereClause = {
          ...whereClause,
          id: { in: propertyIds }
        };
      }
    }
    
    // Calculate date range based on period
    const now = new Date();
    let start_date: Date;
    
    switch (period) {
      case 'weekly':
        start_date = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        start_date = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarterly':
        start_date = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'yearly':
        start_date = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        start_date = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Build unit where clause - if propertyIds provided, filter by property_id directly
    const unitWhereClause: any = {
      status: 'occupied'
    };
    if (propertyIds && propertyIds.length > 0) {
      unitWhereClause.property_id = { in: propertyIds };
    } else {
      unitWhereClause.property = whereClause;
    }
    
    // Get revenue data from occupied units
    const revenueData = await prisma.unit.findMany({
      where: unitWhereClause,
      select: {
        id: true,
        unit_number: true,
        rent_amount: true,
        property: {
          select: {
            id: true,
            name: true,
          }
        },
        current_tenant: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          }
        }
      }
    });

    // Build invoice where clause for financial report
    const financialInvoiceWhereClause: any = {
      created_at: {
        gte: start_date
      }
    };
    if (user.role !== 'super_admin' && user.company_id) {
      financialInvoiceWhereClause.company_id = user.company_id;
    }
    // If propertyIds provided, filter invoices by property_id
    if (propertyIds && propertyIds.length > 0) {
      financialInvoiceWhereClause.property_id = { in: propertyIds };
    }
    
    // Get invoice data for actual collections
    const invoices = await prisma.invoice.findMany({
      where: financialInvoiceWhereClause,
      select: {
        id: true,
        total_amount: true,
        status: true,
        due_date: true,
        created_at: true,
      }
    });

    const totalPotentialRevenue = revenueData.reduce((sum, unit) => {
      return sum + (unit.rent_amount ? Number(unit.rent_amount) : 0);
    }, 0);

    const totalInvoiced = invoices.reduce((sum, invoice) => {
      return sum + (invoice.total_amount ? Number(invoice.total_amount) : 0);
    }, 0);

    const totalCollected = invoices
      .filter(invoice => invoice.status === 'paid')
      .reduce((sum, invoice) => {
        return sum + (invoice.total_amount ? Number(invoice.total_amount) : 0);
      }, 0);

    const totalOutstanding = invoices
      .filter(invoice => ['sent', 'overdue'].includes(invoice.status))
      .reduce((sum, invoice) => {
        return sum + (invoice.total_amount ? Number(invoice.total_amount) : 0);
      }, 0);

    const collectionRate = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0;

    return formatDataForRole(user, {
      period,
      start_date: start_date.toISOString(),
      end_date: now.toISOString(),
      summary: {
        totalPotentialRevenue,
        totalInvoiced,
        totalCollected,
        totalOutstanding,
        collectionRate: Math.round(collectionRate * 100) / 100,
        occupiedUnits: revenueData.length,
      },
      revenueByProperty: revenueData.reduce((acc: any, unit) => {
        const propertyId = unit.property.id;
        if (!acc[propertyId]) {
          acc[propertyId] = {
            propertyId,
            propertyName: unit.property.name,
            units: 0,
            totalRevenue: 0,
          };
        }
        acc[propertyId].units += 1;
        acc[propertyId].totalRevenue += unit.rent_amount ? Number(unit.rent_amount) : 0;
        return acc;
      }, {}),
      invoiceBreakdown: {
        total: invoices.length,
        paid: invoices.filter(i => i.status === 'paid').length,
        pending: invoices.filter(i => i.status === 'sent').length,
        overdue: invoices.filter(i => i.status === 'overdue').length,
      },
      generatedAt: new Date().toISOString(),
    });
  },

  async getOccupancyReport(user: JWTClaims, period: string = 'monthly', propertyIds?: string[]) {
    let whereClause = buildWhereClause(user);
    
    // If property_ids are provided (for super_admin filtering), add them to where clause
    if (propertyIds && propertyIds.length > 0) {
      // For super_admin, use propertyIds directly; otherwise merge with existing whereClause
      if (user.role === 'super_admin') {
        whereClause = { id: { in: propertyIds } };
      } else {
        whereClause = {
          ...whereClause,
          id: { in: propertyIds }
        };
      }
    }
    
    // Build unit where clause - if propertyIds provided, filter by property_id directly
    const unitWhereClause: any = propertyIds && propertyIds.length > 0
      ? { property_id: { in: propertyIds } }
      : { property: whereClause };
    
    const units = await prisma.unit.findMany({
      where: unitWhereClause,
      select: {
        id: true,
        unit_number: true,
        status: true,
        unit_type: true,
        rent_amount: true,
        property: {
          select: {
            id: true,
            name: true,
            type: true,
          }
        },
        current_tenant: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          }
        }
      }
    });

    const totalUnits = units.length;
    const occupiedUnits = units.filter(unit => unit.status === 'occupied').length;
    const vacantUnits = units.filter(unit => unit.status === 'vacant').length;
    const maintenanceUnits = units.filter(unit => ['maintenance', 'under_repair'].includes(unit.status)).length;
    const reservedUnits = units.filter(unit => unit.status === 'reserved').length;

    const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

    // Group by property
    const byProperty = units.reduce((acc: any, unit) => {
      const propertyId = unit.property.id;
      if (!acc[propertyId]) {
        acc[propertyId] = {
          propertyId,
          propertyName: unit.property.name,
          propertyType: unit.property.type,
          totalUnits: 0,
          occupiedUnits: 0,
          vacantUnits: 0,
          maintenanceUnits: 0,
          reservedUnits: 0,
          occupancyRate: 0,
        };
      }
      
      acc[propertyId].totalUnits += 1;
      
      switch (unit.status) {
        case 'occupied':
          acc[propertyId].occupiedUnits += 1;
          break;
        case 'vacant':
          acc[propertyId].vacantUnits += 1;
          break;
        case 'maintenance':
        case 'under_repair':
          acc[propertyId].maintenanceUnits += 1;
          break;
        case 'reserved':
          acc[propertyId].reservedUnits += 1;
          break;
      }
      
      acc[propertyId].occupancyRate = acc[propertyId].totalUnits > 0 
        ? (acc[propertyId].occupiedUnits / acc[propertyId].totalUnits) * 100 
        : 0;
      
      return acc;
    }, {});

    // Group by unit type
    const byUnitType = units.reduce((acc: any, unit) => {
      const unitType = unit.unit_type || 'unknown';
      if (!acc[unitType]) {
        acc[unitType] = {
          unitType,
          totalUnits: 0,
          occupiedUnits: 0,
          vacantUnits: 0,
          occupancyRate: 0,
        };
      }
      
      acc[unitType].totalUnits += 1;
      if (unit.status === 'occupied') {
        acc[unitType].occupiedUnits += 1;
      } else if (unit.status === 'vacant') {
        acc[unitType].vacantUnits += 1;
      }
      
      acc[unitType].occupancyRate = acc[unitType].totalUnits > 0 
        ? (acc[unitType].occupiedUnits / acc[unitType].totalUnits) * 100 
        : 0;
      
      return acc;
    }, {});

    return formatDataForRole(user, {
      period,
      summary: {
        totalUnits,
        occupiedUnits,
        vacantUnits,
        maintenanceUnits,
        reservedUnits,
        occupancyRate: Math.round(occupancyRate * 100) / 100,
      },
      byProperty: Object.values(byProperty),
      byUnitType: Object.values(byUnitType),
      unitDetails: units.map(unit => ({
        id: unit.id,
        unit_number: unit.unit_number,
        status: unit.status,
        unit_type: unit.unit_type,
        rent_amount: unit.rent_amount ? Number(unit.rent_amount) : 0,
        propertyName: unit.property.name,
        tenantName: unit.current_tenant 
          ? `${unit.current_tenant.first_name} ${unit.current_tenant.last_name}` 
          : null,
      })),
      generatedAt: new Date().toISOString(),
    });
  },

  async getRentCollectionReport(user: JWTClaims, filters: any = {}) {
    let whereClause = buildWhereClause(user);
    
    // If property_ids are provided (for super_admin filtering), add them to where clause
    if (filters.property_ids && Array.isArray(filters.property_ids) && filters.property_ids.length > 0) {
      // For super_admin, use propertyIds directly; otherwise merge with existing whereClause
      if (user.role === 'super_admin') {
        whereClause = { id: { in: filters.property_ids } };
      } else {
        whereClause = {
          ...whereClause,
          id: { in: filters.property_ids }
        };
      }
    }
    
    // Build invoice where clause
    const invoiceWhereClause: any = {};
    if (user.role !== 'super_admin' && user.company_id) {
      invoiceWhereClause.company_id = user.company_id;
    }
    // If property_ids provided, filter invoices by property_id
    if (filters.property_ids && Array.isArray(filters.property_ids) && filters.property_ids.length > 0) {
      invoiceWhereClause.property_id = { in: filters.property_ids };
    }
    
    // Add date filters to invoice where clause
    if (filters.start_date) {
      invoiceWhereClause.created_at = {
        ...invoiceWhereClause.created_at,
        gte: new Date(filters.start_date)
      };
    }
    if (filters.end_date) {
      invoiceWhereClause.created_at = {
        ...invoiceWhereClause.created_at,
        lte: new Date(filters.end_date)
      };
    }
    
    // Get all invoices with filtering
    const invoices = await prisma.invoice.findMany({
      where: invoiceWhereClause,
      include: {
        recipient: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          }
        },
        unit: {
          select: {
            id: true,
            unit_number: true,
            property: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    const totalInvoiced = invoices.reduce((sum, invoice) => {
      return sum + (invoice.total_amount ? Number(invoice.total_amount) : 0);
    }, 0);

    const totalCollected = invoices
      .filter(invoice => invoice.status === 'paid')
      .reduce((sum, invoice) => {
        return sum + (invoice.total_amount ? Number(invoice.total_amount) : 0);
      }, 0);

    const totalOutstanding = invoices
      .filter(invoice => ['sent', 'overdue'].includes(invoice.status))
      .reduce((sum, invoice) => {
        return sum + (invoice.total_amount ? Number(invoice.total_amount) : 0);
      }, 0);

    const collectionRate = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0;

    // Group by status
    const byStatus = invoices.reduce((acc: any, invoice) => {
      const status = invoice.status;
      if (!acc[status]) {
        acc[status] = {
          status,
          count: 0,
          totalAmount: 0,
        };
      }
      acc[status].count += 1;
      acc[status].totalAmount += invoice.total_amount ? Number(invoice.total_amount) : 0;
      return acc;
    }, {});

    return formatDataForRole(user, {
      period: filters.period || 'all',
      summary: {
        totalInvoices: invoices.length,
        totalInvoiced,
        totalCollected,
        totalOutstanding,
        collectionRate: Math.round(collectionRate * 100) / 100,
      },
      byStatus: Object.values(byStatus),
      invoices: invoices.map(invoice => {
        const amt = invoice.total_amount ? Number(invoice.total_amount) : 0;
        return {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          amount: amt,
          amount_due: amt,
          amount_paid: invoice.status === 'paid' ? amt : 0,
          status: invoice.status,
          due_date: invoice.due_date,
          created_at: invoice.created_at,
          tenant_name: (invoice as any).recipient
            ? `${((invoice as any).recipient.first_name || '')} ${((invoice as any).recipient.last_name || '')}`.trim() || 'Unknown'
            : 'Unknown',
          tenantName: (invoice as any).recipient
            ? `${((invoice as any).recipient.first_name || '')} ${((invoice as any).recipient.last_name || '')}`.trim() || 'Unknown'
            : 'Unknown',
          tenant_email: (invoice as any).recipient?.email || null,
          property_name: invoice.unit?.property?.name || 'Unknown',
          propertyName: invoice.unit?.property?.name || 'Unknown',
          unit_number: invoice.unit?.unit_number || 'Unknown',
        };
      }),
      generatedAt: new Date().toISOString(),
    });
  },

  async getMaintenanceReport(user: JWTClaims, period: string = 'monthly', filters: any = {}, propertyIds?: string[]) {
    let whereClause = buildWhereClause(user, {}, 'maintenance'); // ✅ Specify 'maintenance' modelType
    
    // If property_ids are provided (for super_admin filtering), filter by property_id
    if (propertyIds && propertyIds.length > 0) {
      // For super_admin, use propertyIds directly; otherwise merge with existing whereClause
      if (user.role === 'super_admin') {
        whereClause = { property_id: { in: propertyIds } };
      } else {
        whereClause = {
          ...whereClause,
          property_id: { in: propertyIds }
        };
      }
    }
    
    const maintenanceRequests = await prisma.maintenanceRequest.findMany({
      where: {
        ...whereClause,
        ...filters,
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
          }
        },
        unit: {
          select: {
            id: true,
            unit_number: true,
          }
        },
        // tenant: {
        //   select: {
        //     id: true,
        //     first_name: true,
        //     last_name: true,
        //   }
        // }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    const totalRequests = maintenanceRequests.length;
    const completedRequests = maintenanceRequests.filter(req => req.status === 'completed').length;
    const pendingRequests = maintenanceRequests.filter(req => ['open', 'in_progress'].includes(req.status)).length;
    const completionRate = totalRequests > 0 ? (completedRequests / totalRequests) * 100 : 0;

    // Group by status
    const byStatus = maintenanceRequests.reduce((acc: any, request) => {
      const status = request.status;
      if (!acc[status]) {
        acc[status] = {
          status,
          count: 0,
        };
      }
      acc[status].count += 1;
      return acc;
    }, {});

    // Group by category
    const byCategory = maintenanceRequests.reduce((acc: any, request) => {
      const category = request.category || 'other';
      if (!acc[category]) {
        acc[category] = {
          category,
          count: 0,
        };
      }
      acc[category].count += 1;
      return acc;
    }, {});

    // Group by priority
    const byPriority = maintenanceRequests.reduce((acc: any, request) => {
      const priority = request.priority || 'medium';
      if (!acc[priority]) {
        acc[priority] = {
          priority,
          count: 0,
        };
      }
      acc[priority].count += 1;
      return acc;
    }, {});

    return formatDataForRole(user, {
      period,
      summary: {
        totalRequests,
        completedRequests,
        pendingRequests,
        completionRate: Math.round(completionRate * 100) / 100,
      },
      byStatus: Object.values(byStatus),
      byCategory: Object.values(byCategory),
      byPriority: Object.values(byPriority),
      requests: maintenanceRequests.map(request => ({
        id: request.id,
        title: request.title,
        description: request.description,
        category: request.category,
        priority: request.priority,
        status: request.status,
        created_at: request.created_at,
        propertyName: 'Unknown', // request.property not available in current schema
        unit_number: request.unit?.unit_number || 'N/A',
        tenantName: 'Unknown', // request.tenant not available in current schema
      })),
      generatedAt: new Date().toISOString(),
    });
  },

  async exportReport(user: JWTClaims, reportType: string, format: string = 'csv', filters: any = {}) {
    let reportData: any;

    // Parse property_ids if provided
    let propertyIds: string[] | undefined = undefined;
    if (filters.property_ids) {
      if (typeof filters.property_ids === 'string') {
        propertyIds = filters.property_ids.split(',').map((id: string) => id.trim()).filter((id: string) => id.length > 0);
      } else if (Array.isArray(filters.property_ids)) {
        propertyIds = filters.property_ids.map((id: any) => String(id)).filter((id: string) => id.length > 0);
      }
    }

    // Generate the appropriate report
    switch (reportType) {
      case 'property':
        reportData = await this.getPropertyReport(user, filters);
        break;
      case 'financial':
        reportData = await this.getFinancialReport(user, 'revenue', filters.period || 'monthly', propertyIds);
        break;
      case 'occupancy':
        reportData = await this.getOccupancyReport(user, filters.period || 'monthly', propertyIds);
        break;
      case 'rent-collection':
        reportData = await this.getRentCollectionReport(user, filters);
        break;
      case 'maintenance':
        reportData = await this.getMaintenanceReport(user, filters.period || 'monthly', filters, propertyIds);
        break;
      default:
        throw new Error('Invalid report type for export');
    }

    if (format === 'csv') {
      // Convert to CSV format
      return this.convertToCSV(reportData, reportType);
    } else {
      // Return JSON format
      return JSON.stringify(reportData, null, 2);
    }
  },

  convertToCSV(data: any, reportType: string): string {
    let csvContent = '';

    switch (reportType) {
      case 'property':
        csvContent = 'Property Name,Type,Location,Total Units,Occupied Units,Vacant Units,Occupancy Rate,Potential Revenue,Actual Revenue,Owner,Agency\n';
        data.properties.forEach((property: any) => {
          csvContent += `"${property.name}","${property.type}","${property.location}",${property.totalUnits},${property.occupiedUnits},${property.vacantUnits},${property.occupancyRate}%,${property.potentialRevenue},${property.actualRevenue},"${property.owner}","${property.agency}"\n`;
        });
        break;
        
      case 'occupancy':
        csvContent = 'Unit Number,Status,Unit Type,Rent Amount,Property Name,Tenant Name\n';
        data.unitDetails.forEach((unit: any) => {
          csvContent += `"${unit.unit_number}","${unit.status}","${unit.unit_type}",${unit.rent_amount},"${unit.propertyName}","${unit.tenantName || 'N/A'}"\n`;
        });
        break;
        
      case 'rent-collection':
        csvContent = 'Invoice Number,Amount,Status,Due Date,Tenant Name,Property Name,Unit Number\n';
        data.invoices.forEach((invoice: any) => {
          csvContent += `"${invoice.invoice_number}",${invoice.total_amount},"${invoice.status}","${invoice.due_date}","${invoice.tenantName}","${invoice.propertyName}","${invoice.unit_number}"\n`;
        });
        break;
        
      case 'maintenance':
        csvContent = 'Title,Category,Priority,Status,Created Date,Property Name,Unit Number,Tenant Name\n';
        data.requests.forEach((request: any) => {
          csvContent += `"${request.title}","${request.category}","${request.priority}","${request.status}","${request.created_at}","${request.propertyName}","${request.unit_number}","${request.tenantName}"\n`;
        });
        break;
        
      default:
        csvContent = JSON.stringify(data, null, 2);
    }

    return csvContent;
  },
};
