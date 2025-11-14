// ============================================================================
// Checklist & Inspection Service
// ============================================================================

import { PrismaClient, InspectionType, InspectionStatus, ItemCondition, ChecklistScope } from '@prisma/client';
import { JWTClaims } from '../types/index.js';

const prisma = new PrismaClient();

// ============================================================================
// INTERFACES
// ============================================================================

export interface CreateTemplateRequest {
  name: string;
  description?: string;
  inspection_type: InspectionType;
  scope?: ChecklistScope;
  property_id?: string;
  categories: Array<{
    name: string;
    description?: string;
    display_order?: number;
    items: Array<{
      name: string;
      description?: string;
      display_order?: number;
      is_required?: boolean;
      requires_photo?: boolean;
      requires_notes?: boolean;
    }>;
  }>;
}

export interface UpdateTemplateRequest extends Partial<CreateTemplateRequest> {
  is_active?: boolean;
}

export interface CreateInspectionRequest {
  template_id: string;
  inspection_type: InspectionType;
  property_id: string;
  unit_id: string;
  tenant_id?: string;
  scheduled_date?: Date;
}

export interface UpdateInspectionRequest {
  status?: InspectionStatus;
  scheduled_date?: Date;
  started_at?: Date;
  completed_at?: Date;
  overall_condition?: string;
  overall_notes?: string;
  inspector_signature?: string;
  tenant_signature?: string;
}

export interface RecordInspectionItemRequest {
  checklist_item_id: string;
  condition?: ItemCondition;
  notes?: string;
  has_issue?: boolean;
  is_critical?: boolean;
  photo_urls?: string[];
}

export class ChecklistsService {
  // ============================================================================
  // TEMPLATE MANAGEMENT
  // ============================================================================

  /**
   * Create a new checklist template with categories and items
   */
  async createTemplate(req: CreateTemplateRequest, user: JWTClaims): Promise<any> {
    // Check permissions
    if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
      throw new Error('Insufficient permissions to create templates');
    }

    const template = await prisma.checklistTemplate.create({
      data: {
        company_id: user.company_id!,
        name: req.name,
        description: req.description,
        inspection_type: req.inspection_type,
        scope: req.scope || 'company',
        property_id: req.property_id,
        created_by: user.user_id,
        categories: {
          create: req.categories.map((category, catIndex) => ({
            name: category.name,
            description: category.description,
            display_order: category.display_order ?? catIndex + 1,
            items: {
              create: category.items.map((item, itemIndex) => ({
                name: item.name,
                description: item.description,
                display_order: item.display_order ?? itemIndex + 1,
                is_required: item.is_required ?? false,
                requires_photo: item.requires_photo ?? false,
                requires_notes: item.requires_notes ?? false,
              })),
            },
          })),
        },
      },
      include: {
        categories: {
          include: {
            items: true,
          },
          orderBy: {
            display_order: 'asc',
          },
        },
      },
    });

    console.log(`✅ Created checklist template: ${template.name} (${template.inspection_type})`);
    return template;
  }

  /**
   * Get all templates for a company (with optional filtering)
   */
  async getTemplates(user: JWTClaims, filters?: {
    inspection_type?: InspectionType;
    property_id?: string;
    is_active?: boolean;
    agencyId?: string; // For super-admin viewing as specific agency
  }): Promise<any[]> {
    let companyId = user.company_id;
    
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
    }
    
    // For non-super-admin users, company_id must be present
    if (!companyId && user.role !== 'super_admin') {
      throw new Error('User must be associated with a company');
    }
    
    const where: any = {};
    
    // Only filter by company_id if we have one (skip for super admin without agencyId)
    if (companyId) {
      where.company_id = companyId;
    }

    if (filters?.inspection_type) {
      where.inspection_type = filters.inspection_type;
    }

    if (filters?.property_id) {
      where.property_id = filters.property_id;
    }

    if (filters?.is_active !== undefined) {
      where.is_active = filters.is_active;
    }

    const templates = await prisma.checklistTemplate.findMany({
      where,
      include: {
        categories: {
          include: {
            items: {
              orderBy: {
                display_order: 'asc',
              },
            },
          },
          orderBy: {
            display_order: 'asc',
          },
        },
        property: {
          select: {
            id: true,
            name: true,
          },
        },
        creator: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return templates;
  }

  /**
   * Get a single template by ID
   */
  async getTemplate(templateId: string, user: JWTClaims): Promise<any> {
    const template = await prisma.checklistTemplate.findFirst({
      where: {
        id: templateId,
        company_id: user.company_id!,
      },
      include: {
        categories: {
          include: {
            items: {
              orderBy: {
                display_order: 'asc',
              },
            },
          },
          orderBy: {
            display_order: 'asc',
          },
        },
        property: true,
        creator: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    return template;
  }

  /**
   * Update a template
   */
  async updateTemplate(templateId: string, req: UpdateTemplateRequest, user: JWTClaims): Promise<any> {
    // Check permissions
    if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
      throw new Error('Insufficient permissions to update templates');
    }

    const template = await prisma.checklistTemplate.findFirst({
      where: {
        id: templateId,
        company_id: user.company_id!,
      },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    const updated = await prisma.checklistTemplate.update({
      where: { id: templateId },
      data: {
        name: req.name,
        description: req.description,
        inspection_type: req.inspection_type,
        is_active: req.is_active,
        property_id: req.property_id,
      },
      include: {
        categories: {
          include: {
            items: true,
          },
        },
      },
    });

    console.log(`✅ Updated template: ${updated.name}`);
    return updated;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string, user: JWTClaims): Promise<void> {
    // Check permissions
    if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
      throw new Error('Insufficient permissions to delete templates');
    }

    const template = await prisma.checklistTemplate.findFirst({
      where: {
        id: templateId,
        company_id: user.company_id!,
      },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    await prisma.checklistTemplate.delete({
      where: { id: templateId },
    });

    console.log(`✅ Deleted template: ${template.name}`);
  }

  // ============================================================================
  // INSPECTION MANAGEMENT
  // ============================================================================

  /**
   * Create a new inspection
   */
  async createInspection(req: CreateInspectionRequest, user: JWTClaims): Promise<any> {
    // Check permissions
    if (!['super_admin', 'agency_admin', 'landlord', 'agent', 'caretaker'].includes(user.role)) {
      throw new Error('Insufficient permissions to create inspections');
    }

    // Validate required fields
    if (!req.template_id) {
      throw new Error('Template ID is required');
    }
    if (!req.property_id) {
      throw new Error('Property ID is required');
    }
    if (!req.unit_id) {
      throw new Error('Unit ID is required');
    }
    if (!req.inspection_type) {
      throw new Error('Inspection type is required');
    }

    console.log('🔍 Creating inspection with data:', JSON.stringify(req, null, 2));
    console.log('👤 User:', { user_id: user.user_id, company_id: user.company_id, role: user.role });

    // Verify template exists and belongs to company
    const template = await prisma.checklistTemplate.findFirst({
      where: {
        id: req.template_id,
        company_id: user.company_id!,
      },
      include: {
        categories: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!template) {
      throw new Error('Template not found or does not belong to your company');
    }

    console.log('✅ Template found:', template.name);

    // Verify unit exists and belongs to company
    const unit = await prisma.unit.findFirst({
      where: {
        id: req.unit_id,
        company_id: user.company_id!,
      },
    });

    if (!unit) {
      throw new Error('Unit not found or does not belong to your company');
    }

    console.log('✅ Unit found:', unit.unit_number);

    // Create inspection
    const inspection = await prisma.inspection.create({
      data: {
        company_id: user.company_id!,
        template_id: req.template_id,
        inspection_type: req.inspection_type,
        property_id: req.property_id,
        unit_id: req.unit_id,
        tenant_id: req.tenant_id,
        inspector_id: user.user_id,
        scheduled_date: req.scheduled_date,
        status: req.scheduled_date ? 'scheduled' : 'in_progress',
        // Create inspection items from template
        items: {
          create: template.categories.flatMap(category =>
            category.items.map(item => ({
              checklist_item_id: item.id,
            }))
          ),
        },
      },
      include: {
        template: {
          include: {
            categories: {
              include: {
                items: true,
              },
            },
          },
        },
        property: {
          select: {
            id: true,
            name: true,
          },
        },
        unit: {
          select: {
            id: true,
            unit_number: true,
          },
        },
        tenant: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        inspector: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            role: true,
          },
        },
        items: {
          include: {
            checklist_item: true,
          },
        },
      },
    });

    console.log(`✅ Created inspection for unit ${unit.unit_number} - Type: ${inspection.inspection_type}`);
    return inspection;
  }

  /**
   * Get all inspections (with optional filtering)
   */
  async getInspections(user: JWTClaims, filters?: {
    property_id?: string;
    unit_id?: string;
    tenant_id?: string;
    inspection_type?: InspectionType;
    status?: InspectionStatus;
    agencyId?: string; // For super-admin viewing as specific agency
  }): Promise<any[]> {
    let companyId = user.company_id;
    
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
    }
    
    // For non-super-admin users, company_id must be present
    if (!companyId && user.role !== 'super_admin') {
      throw new Error('User must be associated with a company');
    }
    
    const where: any = {};
    
    // Only filter by company_id if we have one (skip for super admin without agencyId)
    if (companyId) {
      where.company_id = companyId;
    }

    // Role-based filtering
    if (user.role === 'tenant') {
      where.tenant_id = user.user_id;
    } else if (user.role === 'caretaker') {
      // Caretakers can see inspections for properties they manage
      // This would require a property_staff table - for now, they see all
    }

    if (filters?.property_id) {
      where.property_id = filters.property_id;
    }

    if (filters?.unit_id) {
      where.unit_id = filters.unit_id;
    }

    if (filters?.tenant_id) {
      where.tenant_id = filters.tenant_id;
    }

    if (filters?.inspection_type) {
      where.inspection_type = filters.inspection_type;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    const inspections = await prisma.inspection.findMany({
      where,
      include: {
        template: {
          select: {
            id: true,
            name: true,
            inspection_type: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
          },
        },
        unit: {
          select: {
            id: true,
            unit_number: true,
          },
        },
        tenant: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        inspector: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            role: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return inspections;
  }

  /**
   * Get a single inspection by ID
   */
  async getInspection(inspectionId: string, user: JWTClaims): Promise<any> {
    const where: any = {
      id: inspectionId,
      company_id: user.company_id!,
    };

    // Tenants can only see their own inspections
    if (user.role === 'tenant') {
      where.tenant_id = user.user_id;
    }

    const inspection = await prisma.inspection.findFirst({
      where,
      include: {
        template: {
          include: {
            categories: {
              include: {
                items: {
                  orderBy: {
                    display_order: 'asc',
                  },
                },
              },
              orderBy: {
                display_order: 'asc',
              },
            },
          },
        },
        property: true,
        unit: true,
        tenant: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone_number: true,
          },
        },
        inspector: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            role: true,
          },
        },
        items: {
          include: {
            checklist_item: true,
          },
        },
        photos: {
          include: {
            uploader: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
              },
            },
          },
          orderBy: {
            created_at: 'desc',
          },
        },
      },
    });

    if (!inspection) {
      throw new Error('Inspection not found');
    }

    return inspection;
  }

  /**
   * Update an inspection
   */
  async updateInspection(inspectionId: string, req: UpdateInspectionRequest, user: JWTClaims): Promise<any> {
    const inspection = await prisma.inspection.findFirst({
      where: {
        id: inspectionId,
        company_id: user.company_id!,
      },
    });

    if (!inspection) {
      throw new Error('Inspection not found');
    }

    // Only inspector or admins can update
    if (inspection.inspector_id !== user.user_id && !['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
      throw new Error('Insufficient permissions to update this inspection');
    }

    const updated = await prisma.inspection.update({
      where: { id: inspectionId },
      data: {
        status: req.status,
        scheduled_date: req.scheduled_date,
        started_at: req.started_at,
        completed_at: req.completed_at,
        overall_condition: req.overall_condition,
        overall_notes: req.overall_notes,
        inspector_signature: req.inspector_signature,
        tenant_signature: req.tenant_signature,
      },
      include: {
        template: true,
        property: true,
        unit: true,
        tenant: true,
        inspector: true,
      },
    });

    console.log(`✅ Updated inspection ${inspectionId} - Status: ${updated.status}`);
    return updated;
  }

  /**
   * Record response for a specific inspection item
   */
  async recordInspectionItem(
    inspectionId: string,
    itemId: string,
    req: RecordInspectionItemRequest,
    user: JWTClaims
  ): Promise<any> {
    const inspection = await prisma.inspection.findFirst({
      where: {
        id: inspectionId,
        company_id: user.company_id!,
      },
    });

    if (!inspection) {
      throw new Error('Inspection not found');
    }

    // Verify inspection item exists
    const inspectionItem = await prisma.inspectionItem.findFirst({
      where: {
        id: itemId,
        inspection_id: inspectionId,
        checklist_item_id: req.checklist_item_id,
      },
    });

    if (!inspectionItem) {
      throw new Error('Inspection item not found');
    }

    const updated = await prisma.inspectionItem.update({
      where: { id: itemId },
      data: {
        condition: req.condition,
        notes: req.notes,
        has_issue: req.has_issue,
        is_critical: req.is_critical,
        photo_urls: req.photo_urls,
      },
      include: {
        checklist_item: true,
      },
    });

    // Update inspection counters
    if (req.has_issue) {
      await prisma.inspection.update({
        where: { id: inspectionId },
        data: {
          total_issues: { increment: 1 },
          critical_issues: req.is_critical ? { increment: 1 } : undefined,
        },
      });
    }

    console.log(`✅ Recorded inspection item: ${updated.checklist_item.name}`);
    return updated;
  }

  /**
   * Upload photo for an inspection
   */
  async uploadInspectionPhoto(
    inspectionId: string,
    photoData: {
      photo_url: string;
      thumbnail_url?: string;
      caption?: string;
      category?: string;
      file_size?: number;
      mime_type?: string;
    },
    user: JWTClaims
  ): Promise<any> {
    const inspection = await prisma.inspection.findFirst({
      where: {
        id: inspectionId,
        company_id: user.company_id!,
      },
    });

    if (!inspection) {
      throw new Error('Inspection not found');
    }

    const photo = await prisma.inspectionPhoto.create({
      data: {
        inspection_id: inspectionId,
        photo_url: photoData.photo_url,
        thumbnail_url: photoData.thumbnail_url,
        caption: photoData.caption,
        category: photoData.category,
        file_size: photoData.file_size,
        mime_type: photoData.mime_type,
        uploaded_by: user.user_id,
      },
      include: {
        uploader: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    console.log(`✅ Uploaded photo for inspection ${inspectionId}`);
    return photo;
  }

  /**
   * Delete an inspection
   */
  async deleteInspection(inspectionId: string, user: JWTClaims): Promise<void> {
    // Check permissions
    if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
      throw new Error('Insufficient permissions to delete inspections');
    }

    const inspection = await prisma.inspection.findFirst({
      where: {
        id: inspectionId,
        company_id: user.company_id!,
      },
    });

    if (!inspection) {
      throw new Error('Inspection not found');
    }

    await prisma.inspection.delete({
      where: { id: inspectionId },
    });

    console.log(`✅ Deleted inspection ${inspectionId}`);
  }
}

