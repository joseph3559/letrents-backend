import { getPrisma } from '../config/prisma.js';
import { JWTClaims } from '../types/index.js';
import { buildWhereClause } from '../utils/roleBasedFiltering.js';

export interface CreatePaymentRequest {
  tenant_id: string;
  unit_id?: string;
  property_id?: string;
  lease_id?: string;
  invoice_id?: string;
  amount: number;
  currency?: string;
  payment_method: 'cash' | 'mpesa' | 'bank_transfer' | 'cheque' | 'mobile_money' | 'card' | 'online';
  payment_type: 'rent' | 'security_deposit' | 'utility' | 'maintenance' | 'late_fee' | 'penalty' | 'other';
  payment_date: string;
  payment_period?: string;
  receipt_number: string;
  transaction_id?: string;
  reference_number?: string;
  received_by?: string;
  received_from?: string;
  notes?: string;
  attachments?: any[];
  status?: 'pending' | 'approved' | 'completed' | 'failed' | 'cancelled' | 'refunded';
}

export interface UpdatePaymentRequest {
  amount?: number;
  payment_method?: 'cash' | 'mpesa' | 'bank_transfer' | 'cheque' | 'mobile_money' | 'card' | 'online';
  payment_type?: 'rent' | 'security_deposit' | 'utility' | 'maintenance' | 'late_fee' | 'penalty' | 'other';
  payment_date?: string;
  payment_period?: string;
  transaction_id?: string;
  reference_number?: string;
  received_by?: string;
  received_from?: string;
  notes?: string;
  attachments?: any[];
  status?: 'pending' | 'approved' | 'completed' | 'failed' | 'cancelled' | 'refunded';
  approval_notes?: string;
}

export interface PaymentFilters {
  tenant_id?: string;
  property_id?: string;
  unit_id?: string;
  payment_method?: string;
  payment_type?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  min_amount?: number;
  max_amount?: number;
}

export class PaymentsService {
  private prisma = getPrisma();

  async listPayments(filters: PaymentFilters = {}, user: JWTClaims, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    
    // Build base where clause based on user role
    const whereClause = buildWhereClause(user, {}, 'payment');
    
    // Add filters
    if (filters.tenant_id) {
      whereClause.tenant_id = filters.tenant_id;
    }
    
    if (filters.property_id) {
      whereClause.property_id = filters.property_id;
    }
    
    if (filters.unit_id) {
      whereClause.unit_id = filters.unit_id;
    }
    
    if (filters.payment_method) {
      whereClause.payment_method = filters.payment_method as any;
    }
    
    if (filters.payment_type) {
      whereClause.payment_type = filters.payment_type as any;
    }
    
    if (filters.status) {
      whereClause.status = filters.status as any;
    }
    
    if (filters.start_date || filters.end_date) {
      whereClause.payment_date = {};
      if (filters.start_date) {
        whereClause.payment_date.gte = new Date(filters.start_date);
      }
      if (filters.end_date) {
        whereClause.payment_date.lte = new Date(filters.end_date);
      }
    }
    
    if (filters.min_amount || filters.max_amount) {
      whereClause.amount = {};
      if (filters.min_amount) {
        whereClause.amount.gte = filters.min_amount;
      }
      if (filters.max_amount) {
        whereClause.amount.lte = filters.max_amount;
      }
    }

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: whereClause,
        include: {
          tenant: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              phone_number: true,
            },
          },
          unit: {
            select: {
              id: true,
              unit_number: true,
              property: {
                select: {
                  id: true,
                  name: true,
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
          lease: {
            select: {
              id: true,
              lease_number: true,
            },
          },
          processor: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
            },
          },
          creator: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where: whereClause }),
    ]);

    return {
      payments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getPayment(id: string, user: JWTClaims) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        tenant: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone_number: true,
          },
        },
        unit: {
          select: {
            id: true,
            unit_number: true,
            property: {
              select: {
                id: true,
                name: true,
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
        lease: {
          select: {
            id: true,
            lease_number: true,
          },
        },
        processor: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
        creator: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!payment) {
      throw new Error('payment not found');
    }

    // Check if user has access to this payment
    if (!this.hasPaymentAccess(payment, user)) {
      throw new Error('insufficient permissions to view this payment');
    }

    return payment;
  }

  async createPayment(data: CreatePaymentRequest, user: JWTClaims) {
    // Check permissions
    if (!['super_admin', 'agency_admin', 'landlord', 'agent', 'caretaker'].includes(user.role)) {
      throw new Error('insufficient permissions to create payments');
    }

    // Validate tenant exists and user has access
    const tenant = await this.prisma.user.findUnique({
      where: { 
        id: data.tenant_id,
        role: 'tenant' as any,
      },
    });

    if (!tenant) {
      throw new Error('tenant not found');
    }

    // Check tenant access
    if (!this.hasTenantAccess(tenant, user)) {
      throw new Error('insufficient permissions to create payment for this tenant');
    }

    // Generate receipt number if not provided
    const receiptNumber = data.receipt_number || `RCP-${Date.now()}`;

    // Create payment
    const payment = await this.prisma.payment.create({
      data: {
        company_id: user.company_id!,
        tenant_id: data.tenant_id,
        unit_id: data.unit_id,
        property_id: data.property_id,
        lease_id: data.lease_id,
        invoice_id: data.invoice_id,
        amount: data.amount,
        currency: data.currency || 'KES',
        payment_method: data.payment_method as any,
        payment_type: data.payment_type as any,
        status: data.status as any || 'pending',
        payment_date: new Date(data.payment_date),
        payment_period: data.payment_period,
        receipt_number: receiptNumber,
        transaction_id: data.transaction_id,
        reference_number: data.reference_number,
        received_by: data.received_by,
        received_from: data.received_from,
        notes: data.notes,
        attachments: data.attachments || [],
        created_by: user.user_id,
      },
      include: {
        tenant: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone_number: true,
          },
        },
        unit: {
          select: {
            id: true,
            unit_number: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Try to auto-reconcile this payment with pending invoices
    try {
      // Import InvoicesService dynamically to avoid circular imports
      const { InvoicesService } = await import('./invoices.service.js');
      const invoicesService = new InvoicesService();
      
      // Check if this payment can be auto-linked to an invoice
      const unpaidInvoices = await this.prisma.invoice.findMany({
        where: {
          status: { in: ['sent', 'overdue'] },
          issued_to: payment.tenant_id,
          company_id: payment.company_id,
        },
        orderBy: {
          due_date: 'asc',
        },
      });

      // Find matching invoice with exact amount
      const matchingInvoice = unpaidInvoices.find(invoice => 
        Number(invoice.total_amount) === Number(payment.amount)
      );

      if (matchingInvoice) {
        try {
          await invoicesService.linkPaymentToInvoice(payment.id, matchingInvoice.id, user);
          console.log(`✅ Auto-linked approved payment ${payment.receipt_number} to invoice ${matchingInvoice.invoice_number}`);
        } catch (linkError) {
          console.warn(`⚠️ Failed to auto-link payment ${payment.receipt_number}:`, linkError);
        }
      }
    } catch (autoLinkError) {
      console.warn('⚠️ Auto-reconciliation failed after payment approval:', autoLinkError);
    }

    return payment;
  }

  async updatePayment(id: string, data: UpdatePaymentRequest, user: JWTClaims) {
    // Get existing payment
    const existingPayment = await this.getPayment(id, user);

    // Check permissions to update
    if (!['super_admin', 'agency_admin', 'landlord', 'agent'].includes(user.role)) {
      throw new Error('insufficient permissions to update payments');
    }

    // Update payment
    const payment = await this.prisma.payment.update({
      where: { id },
      data: {
        ...data,
        payment_date: data.payment_date ? new Date(data.payment_date) : undefined,
        payment_method: data.payment_method as any,
        payment_type: data.payment_type as any,
        status: data.status as any,
        updated_at: new Date(),
      },
      include: {
        tenant: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone_number: true,
          },
        },
        unit: {
          select: {
            id: true,
            unit_number: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return payment;
  }

  async approvePayment(id: string, approvalData: { approval_notes?: string }, user: JWTClaims) {
    // Get existing payment
    const existingPayment = await this.getPayment(id, user);

    // Check permissions to approve
    if (!['super_admin', 'agency_admin', 'landlord', 'agent'].includes(user.role)) {
      throw new Error('insufficient permissions to approve payments');
    }

    // Only approve pending payments
    if (existingPayment.status !== 'pending') {
      throw new Error('only pending payments can be approved');
    }

    // Update payment status to approved
    const payment = await this.prisma.payment.update({
      where: { id },
      data: {
        status: 'approved',
        processed_by: user.user_id,
        processed_at: new Date(),
        approval_notes: approvalData.approval_notes,
        updated_at: new Date(),
      },
      include: {
        tenant: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone_number: true,
          },
        },
        unit: {
          select: {
            id: true,
            unit_number: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
          },
        },
        processor: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    return payment;
  }

  async deletePayment(id: string, user: JWTClaims) {
    // Get existing payment
    const existingPayment = await this.getPayment(id, user);

    // Check permissions to delete
    if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
      throw new Error('insufficient permissions to delete payments');
    }

    // Don't delete approved or completed payments
    if (['approved', 'completed'].includes(existingPayment.status)) {
      throw new Error('cannot delete approved or completed payments');
    }

    await this.prisma.payment.delete({
      where: { id },
    });
  }

  private hasPaymentAccess(payment: any, user: JWTClaims): boolean {
    // Super admin has access to all payments
    if (user.role === 'super_admin') return true;

    // Company scoping
    if (user.company_id && payment.company_id === user.company_id) return true;

    return false;
  }

  private hasTenantAccess(tenant: any, user: JWTClaims): boolean {
    // Super admin has access to all tenants
    if (user.role === 'super_admin') return true;

    // Company scoping
    if (user.company_id && tenant.company_id === user.company_id) return true;

    // Landlord can access their own tenants
    if (user.role === 'landlord' && tenant.landlord_id === user.user_id) return true;

    return false;
  }
}
