import { getPrisma } from '../config/prisma.js';
import { JWTClaims } from '../types/index.js';
import { getNextInvoiceNumber, generatePropertyCode } from '../utils/invoice-number-generator.js';
import { UsersService } from './users.service.js';

export interface InvoiceFilters {
  tenant_id?: string;
  property_id?: string;
  property_ids?: string[]; // For filtering by multiple property IDs (super-admin)
  unit_id?: string;
  status?: string;
  invoice_type?: string;
  search_query?: string;
  sort_by?: string;
  sort_order?: string;
  limit?: number;
  offset?: number;
}

export interface CreateInvoiceRequest {
  tenant_id: string;
  property_id?: string;
  unit_id?: string;
  rent_amount?: number;
  total_amount?: number;
  description?: string;
  due_date?: string;
  notes?: string;
  invoice_type?: string;
  title?: string;
  utility_bills?: UtilityBill[];
  items?: InvoiceItem[];
  currency?: string;
}

export interface UtilityBill {
  type: string;
  name: string;
  amount: number;
  is_included: boolean;
}

export interface InvoiceItem {
  description: string;
  amount: number;
}

export interface UpdateInvoiceRequest {
  total_amount?: number;
  description?: string;
  due_date?: string;
  notes?: string;
  status?: string;
  items?: InvoiceItem[];
}

export interface InvoiceRecord {
  id: string;
  invoice_number: string;
  tenant_id: string;
  property_id?: string;
  unit_id?: string;
  total_amount: number;
  description: string;
  due_date: string;
  notes?: string;
  status: string;
  invoice_type: string;
  currency: string;
  items?: InvoiceItem[];
  created_by: string;
  issue_date: string;
  created_at: Date;
  updated_at: Date;
}

export class InvoicesService {
  private prisma = getPrisma();
  private usersService = new UsersService();

  async createInvoice(req: CreateInvoiceRequest, user: JWTClaims, retryCount: number = 0): Promise<any> {
    // Calculate total amount from rent and utility bills
    let totalAmount = req.total_amount || 0;
    
    if (!totalAmount) {
      // Calculate from rent_amount and utility bills - ensure numeric values
      totalAmount = Number(req.rent_amount || 0);
      
      if (req.utility_bills) {
        const utilityTotal = req.utility_bills
          .filter(bill => bill.is_included)
          .reduce((sum, bill) => sum + Number(bill.amount || 0), 0);
        totalAmount += utilityTotal;
      }
    }

    console.log('💰 Invoice calculation:', {
      rent_amount: req.rent_amount,
      utility_bills: req.utility_bills?.map(b => ({ name: b.name, amount: b.amount, is_included: b.is_included })),
      calculated_total: totalAmount,
    });

    // Validate required fields
    if (!req.tenant_id || totalAmount <= 0) {
      throw new Error('tenant ID and amount are required');
    }

    // Check if tenant exists and get tenant info
    const tenant = await this.prisma.user.findUnique({
      where: { 
        id: req.tenant_id,
        role: 'tenant' as any,
      },
      include: {
        assigned_units: {
          include: {
            property: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new Error('tenant not found');
    }

    // Check tenant access
    if (!this.hasTenantAccess(tenant, user)) {
      throw new Error('insufficient permissions to create invoice for this tenant');
    }

    // Validate user has company_id
    if (!user.company_id) {
      throw new Error('user must be associated with a company to create invoices');
    }

    // Get property and unit info from tenant if not provided
    const assignedUnit = tenant.assigned_units[0];
    const propertyId = req.property_id || assignedUnit?.property_id;
    const unitId = req.unit_id || assignedUnit?.id;

    // Set defaults - ensure due_date is always a Date object
    const preferences = await this.usersService.getCurrentUserPreferences(user);
    const defaultCurrency = preferences?.default_currency || 'KES';
    const dueDate = (() => {
      if (req.due_date) return new Date(req.due_date);
      const day = preferences?.default_rent_due_date || 5;
      const today = new Date();
      const target = new Date(today);
      target.setDate(day);
      if (target < today) {
        target.setMonth(target.getMonth() + 1);
        target.setDate(day);
      }
      return target;
    })();
    const description = req.description || 'Monthly Rent and Charges';
    const title = req.title || `Invoice for ${tenant.first_name} ${tenant.last_name}`;
    const invoiceType = req.invoice_type || 'monthly_rent';

    // Generate professional invoice number (INV-YYYY-MM-NNNN or INV-PROP-YYYY-MM-NNN)
    let propertyCode: string | undefined;
    if (propertyId) {
      const propertyData = await this.prisma.property.findUnique({
        where: { id: propertyId },
        select: { name: true },
      });
      if (propertyData) {
        propertyCode = generatePropertyCode(propertyData.name);
      }
    }
    
    // ✅ Generate invoice number with retry support
    const invoiceNumber = await getNextInvoiceNumber(
      this.prisma,
      user.company_id,
      propertyCode,
      retryCount // Pass retry count to handle collisions
    );

    // ✅ Wrap invoice creation in try-catch for collision handling
    let invoice: any;
    try {
      // Create invoice in database
      invoice = await this.prisma.invoice.create({
        data: {
        company_id: user.company_id,
        invoice_number: invoiceNumber,
        title,
        description,
        invoice_type: invoiceType,
        issued_by: user.user_id,
        issued_to: req.tenant_id,
        property_id: propertyId,
        unit_id: unitId,
        subtotal: totalAmount.toString(),
        tax_amount: "0", // No tax for now
        discount_amount: "0", // No discount for now
        total_amount: totalAmount.toString(),
        currency: req.currency || defaultCurrency,
        due_date: dueDate,
        status: 'sent' as const, // Changed from 'draft' to 'sent' - invoices are immediately active
        metadata: JSON.parse(JSON.stringify({
          rent_amount: (req.rent_amount || 0).toString(),
          utility_bills: (req.utility_bills || []).map(bill => ({
            ...bill,
            amount: bill.amount.toString() // Convert amount to string
          })),
          created_via: 'manual',
        })),
      },
      include: {
        issuer: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        recipient: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
            street: true,
            city: true,
          },
        },
        unit: {
          select: {
            id: true,
            unit_number: true,
            rent_amount: true,
          },
        },
      },
    });
    } catch (error: any) {
      // ✅ Handle invoice number collision with retry logic
      if (error.code === 'P2002' && error.meta?.target?.includes('invoice_number')) {
        if (retryCount < 5) {
          console.log(`⚠️ Invoice number collision detected, retrying (attempt ${retryCount + 1}/5)...`);
          // Small delay before retry to reduce collision probability
          await new Promise(resolve => setTimeout(resolve, 50 * (retryCount + 1)));
          return this.createInvoice(req, user, retryCount + 1);
        }
        throw new Error('Failed to generate unique invoice number after 5 attempts. Please try again.');
      }
      // Re-throw other errors
      throw error;
    }

    // Create line items
    const lineItems = [];

    // Add rent line item
    if (req.rent_amount && Number(req.rent_amount) > 0) {
      const rentAmount = Number(req.rent_amount);
      lineItems.push({
        invoice_id: invoice.id,
        description: 'Monthly Rent',
        quantity: 1,
        unit_price: rentAmount.toString(),
        total_price: rentAmount.toString(),
        metadata: {
          type: 'rent',
        },
      });
    }

    // Add utility line items
    if (req.utility_bills) {
      req.utility_bills
        .filter(bill => bill.is_included && Number(bill.amount) > 0)
        .forEach(bill => {
          const billAmount = Number(bill.amount);
          lineItems.push({
            invoice_id: invoice.id,
            description: bill.name,
            quantity: 1,
            unit_price: billAmount.toString(),
            total_price: billAmount.toString(),
            metadata: {
              type: 'utility',
              utility_type: bill.type,
            },
          });
        });
    }

    // Create line items in database
    if (lineItems.length > 0) {
      await this.prisma.invoiceLineItem.createMany({
        data: lineItems,
      });
    }

    // Fetch the complete invoice with line items
    const completeInvoice = await this.prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: {
        issuer: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        recipient: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
            street: true,
            city: true,
          },
        },
        unit: {
          select: {
            id: true,
            unit_number: true,
            rent_amount: true,
          },
        },
        line_items: true,
      },
    });

    // ✅ AUTOMATICALLY CREATE A PENDING PAYMENT RECORD FOR THIS INVOICE
    try {
      const paymentPeriod = dueDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
      
      await this.prisma.payment.create({
        data: {
          company_id: user.company_id,
          tenant_id: req.tenant_id,
          unit_id: unitId,
          property_id: propertyId,
          invoice_id: invoice.id,
          amount: totalAmount,
          currency: req.currency || defaultCurrency,
          payment_method: 'cash', // Default method, will be updated when actual payment is made
          payment_type: invoiceType === 'monthly_rent' ? 'rent' : 'other',
          status: 'pending',
          payment_date: dueDate, // Use invoice due date as payment date
          payment_period: paymentPeriod,
          receipt_number: `PENDING-${invoiceNumber}`,
          received_from: `${tenant.first_name} ${tenant.last_name}`,
          notes: `Payment for invoice ${invoiceNumber}`,
          created_by: user.user_id,
        },
      });

      console.log(`✅ Auto-created pending payment record for invoice ${invoiceNumber} - Amount: ${totalAmount} KES`);
    } catch (paymentError) {
      console.error('❌ Failed to create pending payment record for invoice:', paymentError);
      // Don't fail invoice creation if payment creation fails
    }

    // 🔐 Generate verification token and QR URL for invoice
    try {
      const { verificationService } = await import('./verification.service.js');
      await verificationService.ensureInvoiceVerificationToken(invoice.id);
    } catch (e) {
      // Never fail invoice creation if verification token generation fails
      console.warn('Failed to generate verification token for invoice:', e);
    }

    // 📄 Record official invoice snapshot (for exact regeneration/versioning)
    try {
      const { documentService } = await import('../modules/documents/document-service.js');
      await documentService.recordInvoiceSnapshot(invoice.id, user, 1);
    } catch (e) {
      // Never fail invoice creation if snapshot recording fails
    }

    return completeInvoice;
  }

  async getInvoice(id: string, user: JWTClaims): Promise<InvoiceRecord> {
    // TODO: Implement actual database lookup
    // For now, return a mock record
    const invoiceRecord: InvoiceRecord = {
      id,
      invoice_number: 'INV-001',
      tenant_id: 'tenant-123',
      property_id: '69b2b763-1853-48db-bce8-44b54c461b15',
      unit_id: undefined,
      total_amount: 1200.00,
      description: 'Monthly Rent - January 2025',
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: 'Please pay by due date',
      status: 'pending',
      invoice_type: 'monthly_rent',
      currency: 'KES',
      items: [
        { description: 'Monthly Rent', amount: 1000 },
        { description: 'Service Charge', amount: 200 },
      ],
      created_by: user.user_id,
      issue_date: new Date().toISOString().split('T')[0],
      created_at: new Date(),
      updated_at: new Date(),
    };

    return invoiceRecord;
  }

  async listInvoices(filters: InvoiceFilters, user: JWTClaims): Promise<any> {
    const limit = Math.min(filters.limit || 20, 100);
    const offset = filters.offset || 0;

    console.log('📋 listInvoices - User:', { role: user.role, company_id: user.company_id, agency_id: user.agency_id, user_id: user.user_id });

    // Build where clause for database query with STRICT role-based filtering
    const whereClause: any = {};
    
    // 🔒 CRITICAL: Role-based data isolation
    if (user.role === 'super_admin') {
      // Super admin sees all invoices - but filter by property_ids if provided
      if (filters.property_ids && filters.property_ids.length > 0) {
        whereClause.property_id = { in: filters.property_ids };
        console.log('✅ Super admin - filtering by property_ids:', filters.property_ids.length);
      } else {
        console.log('✅ Super admin - no filtering');
      }
    } else if (user.role === 'agency_admin') {
      // ⚠️ Agency admin sees all invoices for properties in their agency
      if (!user.agency_id) {
        console.error('❌ Agency admin has no agency_id! Cannot list invoices.');
        return { invoices: [], total: 0, stats: {} };
      }
      whereClause.property = {
        agency_id: user.agency_id,
      };
      console.log('✅ Agency admin filter applied - agency_id:', user.agency_id);
    } else if (user.role === 'landlord') {
      // ⚠️ FIXED: Landlord must ONLY see invoices from THEIR OWN properties
      whereClause.property = {
        owner_id: user.user_id,
      };
      console.log('✅ Landlord filter applied - owner_id:', user.user_id);
    } else if (user.role === 'agent') {
      // ⚠️ FIXED: Agent must ONLY see invoices from properties they are ASSIGNED to
      const agentAssignments = await this.prisma.staffPropertyAssignment.findMany({
        where: {
          staff_id: user.user_id,
          status: 'active',
        },
        select: { property_id: true },
      });
      const propertyIds = agentAssignments.map(a => a.property_id);
      
      if (propertyIds.length === 0) {
        console.log('⚠️ Agent has no assigned properties - returning empty result');
        return { invoices: [], total: 0, stats: {} };
      }
      whereClause.property_id = { in: propertyIds };
      console.log('✅ Agent filter applied - property_ids:', propertyIds.length);
    } else {
      // ⚠️ Other roles should not access invoice list
      console.error('❌ Unauthorized role accessing invoice list:', user.role);
      throw new Error('insufficient permissions to list invoices');
    }
    
    console.log('📊 Final whereClause:', JSON.stringify(whereClause, null, 2));

    // Apply filters
    if (filters.tenant_id) {
      whereClause.issued_to = filters.tenant_id;
    }

    // Handle property_ids (for super-admin) or property_id (single)
    if (filters.property_ids && filters.property_ids.length > 0) {
      // If property_ids is already set (from super_admin role filtering), don't override
      if (!whereClause.property_id) {
        whereClause.property_id = { in: filters.property_ids };
      }
    } else if (filters.property_id) {
      // Only apply property_id if property_ids wasn't already applied
      if (!whereClause.property_id) {
        whereClause.property_id = filters.property_id;
      }
    }

    if (filters.unit_id) {
      whereClause.unit_id = filters.unit_id;
    }

    if (filters.status) {
      whereClause.status = filters.status;
    }

    if (filters.invoice_type) {
      whereClause.invoice_type = filters.invoice_type;
    }

    // Search functionality
    if (filters.search_query) {
      const query = filters.search_query.toLowerCase();
      whereClause.OR = [
        {
          invoice_number: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          title: {
            contains: query,
            mode: 'insensitive',
          },
        },
      ];
    }

    try {
      // Get total count for pagination
      const totalCount = await this.prisma.invoice.count({
        where: whereClause,
      });

      // Fetch invoices with related data
      const invoices = await this.prisma.invoice.findMany({
        where: whereClause,
        include: {
          recipient: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              phone_number: true,
            },
          },
          property: {
            select: {
              id: true,
              name: true,
              street: true,
              city: true,
              region: true,
            },
          },
          unit: {
            select: {
              id: true,
              unit_number: true,
              rent_amount: true,
            },
          },
          issuer: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
          line_items: {
            select: {
              id: true,
              description: true,
              quantity: true,
              unit_price: true,
              total_price: true,
              metadata: true,
            },
            orderBy: {
              created_at: 'asc',
            },
          },
        },
        orderBy: [
          {
            created_at: 'desc',
          },
          {
            invoice_number: 'desc',
          },
        ],
        take: limit,
        skip: offset,
      });

      // Transform data to match the expected format
      const transformedInvoices = invoices.map(invoice => ({
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        tenant_id: invoice.issued_to,
        tenant_name: invoice.recipient ? `${invoice.recipient.first_name} ${invoice.recipient.last_name}`.trim() : 'Unknown Tenant',
        tenant_email: invoice.recipient?.email || '',
        tenant_phone: invoice.recipient?.phone_number || '',
        property_id: invoice.property_id,
        property_name: invoice.property?.name || 'Unknown Property',
        unit_id: invoice.unit_id,
        unit_number: invoice.unit?.unit_number || 'Unknown Unit',
        amount: Number(invoice.total_amount),
        subtotal: Number(invoice.subtotal),
        tax_amount: Number(invoice.tax_amount || 0),
        discount_amount: Number(invoice.discount_amount || 0),
        total_amount: Number(invoice.total_amount),
        description: invoice.description || '',
        title: invoice.title || '',
        notes: '', // Invoice model doesn't have notes field
        due_date: invoice.due_date.toISOString().split('T')[0],
        issue_date: invoice.issue_date.toISOString().split('T')[0],
        paid_date: invoice.paid_date ? invoice.paid_date.toISOString().split('T')[0] : null,
        status: invoice.status,
        invoice_type: invoice.invoice_type,
        currency: invoice.currency,
        payment_method: invoice.payment_method,
        payment_reference: invoice.payment_reference,
        invoice_items: invoice.line_items.map(item => ({
          description: item.description,
          amount: Number(item.unit_price),
          type: (item.metadata as any)?.type || 'item',
        })),
        sent_via: [], // TODO: Implement communication tracking
        reminder_count: 0, // TODO: Implement reminder tracking
        last_reminder_date: null, // TODO: Implement reminder tracking
        created_by: invoice.issued_by,
        created_at: invoice.created_at,
        updated_at: invoice.updated_at,
      }));

      return {
        invoices: transformedInvoices,
        total: totalCount,
        page: Math.floor(offset / limit) + 1,
        per_page: limit,
        total_pages: Math.ceil(totalCount / limit),
      };
    } catch (error) {
      console.error('Error fetching invoices from database:', error);
      throw new Error('Failed to fetch invoices');
    }
  }

  async updateInvoice(id: string, req: UpdateInvoiceRequest, user: JWTClaims): Promise<InvoiceRecord> {
    // TODO: Implement actual database update
    // For now, return updated mock record
    const updatedRecord: InvoiceRecord = {
      id,
      invoice_number: 'INV-001',
      tenant_id: 'tenant-123',
      property_id: '69b2b763-1853-48db-bce8-44b54c461b15',
      unit_id: undefined,
      total_amount: req.total_amount || 1200.00,
      description: req.description || 'Monthly Rent - January 2025',
      due_date: req.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: req.notes || 'Please pay by due date',
      status: req.status || 'pending',
      invoice_type: 'monthly_rent',
      currency: 'KES',
      items: req.items || [
        { description: 'Monthly Rent', amount: 1000 },
        { description: 'Service Charge', amount: 200 },
      ],
      created_by: user.user_id,
      issue_date: new Date().toISOString().split('T')[0],
      created_at: new Date(Date.now() - 86400000), // 1 day ago
      updated_at: new Date(),
    };

    return updatedRecord;
  }

  async deleteInvoice(id: string, user: JWTClaims): Promise<void> {
    if (!id) {
      throw new Error('invoice ID is required');
    }

    try {
      // First, check if the invoice exists and user has permission to delete it
      const invoice = await this.prisma.invoice.findUnique({
        where: { id },
        include: {
          issuer: true,
          company: true,
        },
      });

      if (!invoice) {
        throw new Error('invoice not found');
      }

      // Check permissions
      let hasPermission = false;

      // Super admin can delete any invoice
      if (user.role === 'super_admin') {
        hasPermission = true;
      }
      // Company admin can delete invoices from their company
      else if (user.role === 'agency_admin' && user.company_id === invoice.company_id) {
        hasPermission = true;
      }
      // Landlord can delete invoices they created or from their company
      else if (user.role === 'landlord' && 
               (invoice.issued_by === user.user_id || user.company_id === invoice.company_id)) {
        hasPermission = true;
      }

      if (!hasPermission) {
        throw new Error('insufficient permissions to delete this invoice');
      }

      // Check if invoice is paid - prevent deletion of paid invoices
      if (invoice.status === 'paid') {
        throw new Error('cannot delete paid invoices');
      }

      // Delete the invoice and its line items (cascading delete should handle line items)
      await this.prisma.invoice.delete({
        where: { id },
      });

      console.log(`✅ Invoice ${invoice.invoice_number} deleted successfully by ${user.email}`);
    } catch (error) {
      console.error('❌ Error deleting invoice:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to delete invoice');
    }
  }

  async sendInvoice(id: string, user: JWTClaims, sendOptions?: { method?: 'email' | 'sms' | 'both' }): Promise<any> {
    if (!id) {
      throw new Error('invoice ID is required');
    }

    try {
      // First, check if the invoice exists and user has permission
      const invoice = await this.prisma.invoice.findUnique({
        where: { id },
        include: {
          recipient: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              phone_number: true,
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
          company: true,
        },
      });

      if (!invoice) {
        throw new Error('invoice not found');
      }

      // Check permissions
      let hasPermission = false;
      if (user.role === 'super_admin') {
        hasPermission = true;
      } else if (user.role === 'agency_admin' && user.company_id === invoice.company_id) {
        hasPermission = true;
      } else if (user.role === 'landlord' && 
                 (invoice.issued_by === user.user_id || user.company_id === invoice.company_id)) {
        hasPermission = true;
      } else if (user.role === 'agent' && user.company_id === invoice.company_id) {
        // ✅ Agents can send invoices for properties they're assigned to
        if (invoice.property_id) {
          const assignment = await this.prisma.staffPropertyAssignment.findFirst({
            where: {
              staff_id: user.user_id,
              property_id: invoice.property_id,
              status: 'active',
            },
          });
          hasPermission = !!assignment;
        } else {
          // If no property_id on invoice, allow if same company
          hasPermission = true;
        }
      }

      if (!hasPermission) {
        throw new Error('insufficient permissions to send this invoice');
      }

      // ✅ Allow sending draft or sent invoices (idempotent), but not paid/cancelled/void
      const unsendableStatuses = ['paid', 'cancelled', 'void'];
      if (unsendableStatuses.includes(invoice.status)) {
        throw new Error(`cannot send invoice with status: ${invoice.status}. Only draft or sent invoices can be re-sent.`);
      }

      // Update invoice status to 'sent' if it's still draft
      const updatedInvoice = await this.prisma.invoice.update({
        where: { id },
        data: {
          status: 'sent', // Update to sent if it's draft, or keep as sent if already sent
          updated_at: new Date(),
        },
        include: {
          recipient: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              phone_number: true,
            },
          },
          property: {
            select: {
              id: true,
              name: true,
              street: true,
              city: true,
              region: true,
            },
          },
          unit: {
            select: {
              id: true,
              unit_number: true,
              rent_amount: true,
            },
          },
          issuer: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
          line_items: {
            select: {
              id: true,
              description: true,
              quantity: true,
              unit_price: true,
              total_price: true,
              metadata: true,
            },
            orderBy: {
              created_at: 'asc',
            },
          },
        },
      });

      // TODO: Implement actual email/SMS sending logic here
      // For now, just log the action
      const sendMethod = sendOptions?.method || 'email';
      console.log(`📧 Invoice ${invoice.invoice_number} sent via ${sendMethod} to ${invoice.recipient?.email || 'unknown recipient'}`);

      // Create notification and send push notification to tenant
      if (updatedInvoice.recipient?.id) {
        try {
          const { notificationsService } = await import('./notifications.service.js');
          const tenantName = invoice.recipient ? `${invoice.recipient.first_name} ${invoice.recipient.last_name}`.trim() : 'Tenant';
          
          await notificationsService.createNotification(user, {
            recipientId: updatedInvoice.recipient.id,
            title: `New Invoice: ${updatedInvoice.invoice_number}`,
            message: `You have a new invoice for ${updatedInvoice.currency || 'KES'} ${Number(updatedInvoice.total_amount).toLocaleString()}. Due date: ${new Date(updatedInvoice.due_date).toLocaleDateString()}`,
            notification_type: 'invoice',
            category: 'financial',
            priority: 'high',
            property_id: updatedInvoice.property_id,
            unit_id: updatedInvoice.unit_id,
            action_url: `/tenant/invoices/${updatedInvoice.id}`,
            action_required: true,
            channels: ['app', 'push'], // Include push in channels array
            metadata: {
              invoice_id: updatedInvoice.id,
              invoice_number: updatedInvoice.invoice_number,
              amount: updatedInvoice.total_amount,
              due_date: updatedInvoice.due_date,
            },
          });
          
          console.log(`✅ Push notification sent for invoice ${updatedInvoice.invoice_number} to tenant ${updatedInvoice.recipient.id}`);
        } catch (notificationError) {
          console.error('❌ Error sending notification for invoice:', notificationError);
          // Don't fail invoice sending if notification fails
        }
      }

      // 📄 Record invoice snapshot at send event (new revision)
      try {
        const { documentService } = await import('../modules/documents/document-service.js');
        await documentService.recordInvoiceSnapshot(updatedInvoice.id, user, 1);
      } catch {
        // Never fail send if snapshot recording fails
      }

      // Transform and return the updated invoice
      const transformedInvoice = {
        id: updatedInvoice.id,
        invoice_number: updatedInvoice.invoice_number,
        tenant_id: updatedInvoice.issued_to,
        tenant_name: updatedInvoice.recipient ? `${updatedInvoice.recipient.first_name} ${updatedInvoice.recipient.last_name}`.trim() : 'Unknown Tenant',
        tenant_email: updatedInvoice.recipient?.email || '',
        tenant_phone: updatedInvoice.recipient?.phone_number || '',
        property_id: updatedInvoice.property_id,
        property_name: updatedInvoice.property?.name || 'Unknown Property',
        unit_id: updatedInvoice.unit_id,
        unit_number: updatedInvoice.unit?.unit_number || 'Unknown Unit',
        amount: Number(updatedInvoice.total_amount),
        subtotal: Number(updatedInvoice.subtotal),
        tax_amount: Number(updatedInvoice.tax_amount || 0),
        discount_amount: Number(updatedInvoice.discount_amount || 0),
        total_amount: Number(updatedInvoice.total_amount),
        description: updatedInvoice.description || '',
        title: updatedInvoice.title || '',
        notes: '', // Invoice model doesn't have notes field
        due_date: updatedInvoice.due_date.toISOString().split('T')[0],
        issue_date: updatedInvoice.issue_date.toISOString().split('T')[0],
        paid_date: updatedInvoice.paid_date ? updatedInvoice.paid_date.toISOString().split('T')[0] : null,
        status: updatedInvoice.status,
        invoice_type: updatedInvoice.invoice_type,
        currency: updatedInvoice.currency,
        payment_method: updatedInvoice.payment_method,
        payment_reference: updatedInvoice.payment_reference,
        invoice_items: updatedInvoice.line_items.map(item => ({
          description: item.description,
          amount: Number(item.unit_price),
          type: (item.metadata as any)?.type || 'item',
        })),
        sent_via: [sendMethod], // Track how it was sent
        reminder_count: 0,
        last_reminder_date: null,
        created_by: updatedInvoice.issued_by,
        created_at: updatedInvoice.created_at,
        updated_at: updatedInvoice.updated_at,
      };

      return transformedInvoice;
    } catch (error) {
      console.error('❌ Error sending invoice:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to send invoice');
    }
  }

  async markAsPaid(id: string, user: JWTClaims, paymentData?: { method?: string; reference?: string; amount?: number }): Promise<any> {
    if (!id) {
      throw new Error('invoice ID is required');
    }

    try {
      // First, check if the invoice exists and user has permission
      const invoice = await this.prisma.invoice.findUnique({
        where: { id },
        include: {
          recipient: true,
          property: true,
          unit: true,
          company: true,
        },
      });

      if (!invoice) {
        throw new Error('invoice not found');
      }

      // Check permissions
      let hasPermission = false;
      if (user.role === 'super_admin') {
        hasPermission = true;
      } else if (user.role === 'agency_admin' && user.company_id === invoice.company_id) {
        hasPermission = true;
      } else if (user.role === 'landlord' && 
                 (invoice.issued_by === user.user_id || user.company_id === invoice.company_id)) {
        hasPermission = true;
      }

      if (!hasPermission) {
        throw new Error('insufficient permissions to mark this invoice as paid');
      }

      // Only sent or overdue invoices can be marked as paid
      if (!['sent', 'overdue'].includes(invoice.status)) {
        throw new Error(`cannot mark invoice as paid with status: ${invoice.status}. Only sent or overdue invoices can be marked as paid.`);
      }

      // Update invoice status to 'paid'
      const updatedInvoice = await this.prisma.invoice.update({
        where: { id },
        data: {
          status: 'paid',
          paid_date: new Date(),
          payment_method: paymentData?.method || 'manual',
          payment_reference: paymentData?.reference || null,
          updated_at: new Date(),
        },
        include: {
          recipient: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              phone_number: true,
            },
          },
          property: {
            select: {
              id: true,
              name: true,
              street: true,
              city: true,
              region: true,
            },
          },
          unit: {
            select: {
              id: true,
              unit_number: true,
              rent_amount: true,
            },
          },
          issuer: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
          line_items: {
            select: {
              id: true,
              description: true,
              quantity: true,
              unit_price: true,
              total_price: true,
              metadata: true,
            },
            orderBy: {
              created_at: 'asc',
            },
          },
        },
      });

      console.log(`💰 Invoice ${invoice.invoice_number} marked as paid by ${user.email}`);

      // 📄 Record invoice snapshot at paid event (new revision)
      try {
        const { documentService } = await import('../modules/documents/document-service.js');
        await documentService.recordInvoiceSnapshot(updatedInvoice.id, user, 1);
      } catch {
        // Never fail mark-paid if snapshot recording fails
      }

      // Transform and return the updated invoice (same format as sendInvoice)
      const transformedInvoice = {
        id: updatedInvoice.id,
        invoice_number: updatedInvoice.invoice_number,
        tenant_id: updatedInvoice.issued_to,
        tenant_name: updatedInvoice.recipient ? `${updatedInvoice.recipient.first_name} ${updatedInvoice.recipient.last_name}`.trim() : 'Unknown Tenant',
        tenant_email: updatedInvoice.recipient?.email || '',
        tenant_phone: updatedInvoice.recipient?.phone_number || '',
        property_id: updatedInvoice.property_id,
        property_name: updatedInvoice.property?.name || 'Unknown Property',
        unit_id: updatedInvoice.unit_id,
        unit_number: updatedInvoice.unit?.unit_number || 'Unknown Unit',
        amount: Number(updatedInvoice.total_amount),
        subtotal: Number(updatedInvoice.subtotal),
        tax_amount: Number(updatedInvoice.tax_amount || 0),
        discount_amount: Number(updatedInvoice.discount_amount || 0),
        total_amount: Number(updatedInvoice.total_amount),
        description: updatedInvoice.description || '',
        title: updatedInvoice.title || '',
        notes: '',
        due_date: updatedInvoice.due_date.toISOString().split('T')[0],
        issue_date: updatedInvoice.issue_date.toISOString().split('T')[0],
        paid_date: updatedInvoice.paid_date ? updatedInvoice.paid_date.toISOString().split('T')[0] : null,
        status: updatedInvoice.status,
        invoice_type: updatedInvoice.invoice_type,
        currency: updatedInvoice.currency,
        payment_method: updatedInvoice.payment_method,
        payment_reference: updatedInvoice.payment_reference,
        invoice_items: updatedInvoice.line_items.map(item => ({
          description: item.description,
          amount: Number(item.unit_price),
          type: (item.metadata as any)?.type || 'item',
        })),
        sent_via: [],
        reminder_count: 0,
        last_reminder_date: null,
        created_by: updatedInvoice.issued_by,
        created_at: updatedInvoice.created_at,
        updated_at: updatedInvoice.updated_at,
      };

      return transformedInvoice;
    } catch (error) {
      console.error('❌ Error marking invoice as paid:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to mark invoice as paid');
    }
  }

  async updateOverdueInvoices(): Promise<{ updated: number }> {
    try {
      // Get current date
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0); // Set to start of day

      const candidates = await this.prisma.invoice.findMany({
        where: {
          status: 'sent',
        },
        select: {
          id: true,
          due_date: true,
          issuer: {
            select: {
              preferences: {
                select: {
                  grace_period: true,
                },
              },
            },
          },
        },
      });

      let updated = 0;
      for (const invoice of candidates) {
        const grace = invoice.issuer?.preferences?.grace_period || 0;
        const graceDate = new Date(invoice.due_date);
        graceDate.setDate(graceDate.getDate() + grace);
        graceDate.setHours(0, 0, 0, 0);

        if (graceDate < currentDate) {
          await this.prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              status: 'overdue',
              updated_at: new Date(),
            },
          });
          updated += 1;
        }
      }

      console.log(`⏰ Updated ${updated} invoices to overdue status`);
      return { updated };
    } catch (error) {
      console.error('❌ Error updating overdue invoices:', error);
      throw new Error('Failed to update overdue invoices');
    }
  }

  async linkPaymentToInvoice(paymentId: string, invoiceId: string, user: JWTClaims): Promise<any> {
    if (!paymentId || !invoiceId) {
      throw new Error('payment ID and invoice ID are required');
    }

    try {
      // Get payment and invoice details
      const [payment, invoice] = await Promise.all([
        this.prisma.payment.findUnique({
          where: { id: paymentId },
          include: {
            tenant: true,
            unit: true,
            property: true,
          },
        }),
        this.prisma.invoice.findUnique({
          where: { id: invoiceId },
          include: {
            recipient: true,
            property: true,
            unit: true,
          },
        }),
      ]);

      if (!payment) {
        throw new Error('payment not found');
      }

      if (!invoice) {
        throw new Error('invoice not found');
      }

      // Check permissions
      let hasPermission = false;
      if (user.role === 'super_admin') {
        hasPermission = true;
      } else if (user.role === 'agency_admin' && user.company_id === invoice.company_id) {
        hasPermission = true;
      } else if (user.role === 'landlord' && 
                 (invoice.issued_by === user.user_id || user.company_id === invoice.company_id)) {
        hasPermission = true;
      }

      if (!hasPermission) {
        throw new Error('insufficient permissions to link payment to this invoice');
      }

      // Verify payment and invoice belong to same tenant
      if (payment.tenant_id !== invoice.issued_to) {
        throw new Error('payment and invoice must belong to the same tenant');
      }

      // Check if payment is already linked to another invoice
      if (payment.invoice_id && payment.invoice_id !== invoiceId) {
        throw new Error('payment is already linked to another invoice');
      }

      // Check if invoice is already paid
      if (invoice.status === 'paid') {
        throw new Error('invoice is already marked as paid');
      }

      // Link payment to invoice
      const updatedPayment = await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          invoice_id: invoiceId,
          updated_at: new Date(),
        },
      });

      // Calculate total payments for this invoice
      const totalPayments = await this.prisma.payment.aggregate({
        where: {
          invoice_id: invoiceId,
          status: 'approved',
        },
        _sum: {
          amount: true,
        },
      });

      const totalPaid = Number(totalPayments._sum.amount || 0);
      const invoiceAmount = Number(invoice.total_amount);

      console.log(`💰 Payment reconciliation - Invoice: ${invoiceAmount}, Paid: ${totalPaid}`);

      // Update invoice status if fully paid
      let updatedInvoice = invoice;
      if (totalPaid >= invoiceAmount) {
        updatedInvoice = await this.prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            status: 'paid',
            paid_date: new Date(),
            payment_method: payment.payment_method,
            payment_reference: payment.receipt_number,
            updated_at: new Date(),
          },
          include: {
            recipient: true,
            property: true,
            unit: true,
          },
        });

        console.log(`✅ Invoice ${invoice.invoice_number} automatically marked as paid (Amount: ${invoiceAmount}, Paid: ${totalPaid})`);
      }

      return {
        payment: updatedPayment,
        invoice: updatedInvoice,
        total_paid: totalPaid,
        invoice_amount: invoiceAmount,
        is_fully_paid: totalPaid >= invoiceAmount,
      };
    } catch (error) {
      console.error('❌ Error linking payment to invoice:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to link payment to invoice');
    }
  }

  async autoReconcilePayments(user: JWTClaims): Promise<{ reconciled: number; invoices_paid: number }> {
    try {
      let reconciledCount = 0;
      let invoicesPaidCount = 0;

      // Get all approved payments without invoice links from the same company
      const unlinkedPayments = await this.prisma.payment.findMany({
        where: {
          invoice_id: null,
          status: 'approved',
          ...(user.role !== 'super_admin' && { company_id: user.company_id }),
        },
        include: {
          tenant: true,
          unit: true,
          property: true,
        },
        orderBy: {
          payment_date: 'desc',
        },
      });

      // Get all unpaid invoices from the same company
      const unpaidInvoices = await this.prisma.invoice.findMany({
        where: {
          status: { in: ['sent', 'overdue'] },
          ...(user.role !== 'super_admin' && { company_id: user.company_id }),
        },
        include: {
          recipient: true,
          property: true,
          unit: true,
        },
        orderBy: {
          due_date: 'asc',
        },
      });

      console.log(`🔄 Auto-reconciliation: ${unlinkedPayments.length} unlinked payments, ${unpaidInvoices.length} unpaid invoices`);

      // Try to match payments to invoices
      for (const payment of unlinkedPayments) {
        // Find matching invoices for the same tenant
        const matchingInvoices = unpaidInvoices.filter(invoice => 
          invoice.issued_to === payment.tenant_id &&
          Number(invoice.total_amount) === Number(payment.amount) &&
          invoice.status !== 'paid'
        );

        if (matchingInvoices.length > 0) {
          // Use the oldest unpaid invoice
          const targetInvoice = matchingInvoices[0];
          
          try {
            const result = await this.linkPaymentToInvoice(payment.id, targetInvoice.id, user);
            reconciledCount++;
            
            if (result.is_fully_paid) {
              invoicesPaidCount++;
            }
            
            console.log(`✅ Auto-linked payment ${payment.receipt_number} to invoice ${targetInvoice.invoice_number}`);
          } catch (linkError) {
            console.warn(`⚠️ Failed to auto-link payment ${payment.receipt_number}:`, linkError);
          }
        }
      }

      console.log(`✅ Auto-reconciliation completed: ${reconciledCount} payments linked, ${invoicesPaidCount} invoices paid`);
      
      return {
        reconciled: reconciledCount,
        invoices_paid: invoicesPaidCount,
      };
    } catch (error) {
      console.error('❌ Error in auto-reconciliation:', error);
      throw new Error('Failed to auto-reconcile payments');
    }
  }

  private hasTenantAccess(tenant: any, user: JWTClaims): boolean {
    // Super admin has access to all tenants
    if (user.role === 'super_admin') return true;

    // Company scoping - user can only access tenants from their company
    if (user.company_id && tenant.company_id === user.company_id) return true;

    // Tenant can access their own invoices
    if (user.role === 'tenant' && tenant.id === user.user_id) return true;

    return false;
  }
}
