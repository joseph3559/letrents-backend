import { Request, Response } from 'express';
import { getPrisma } from '../config/prisma.js';
import { JWTClaims } from '../types/index.js';
import { notificationsService } from '../services/notifications.service.js';
import { emailService } from '../services/email.service.js';

const prisma = getPrisma();

// Get tenant dashboard summary
export const getTenantDashboard = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    
    if (user.role !== 'tenant') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Tenant role required.'
      });
    }

    // Get tenant profile with current unit and property info
    const tenant = await prisma.user.findUnique({
      where: { id: user.user_id },
      include: {
        tenant_profile: {
          include: {
            current_unit: {
              include: {
                property: true
              }
            },
            current_property: true
          }
        }
      }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // Get active leases count
    const activeLeases = await prisma.lease.count({
      where: {
        tenant_id: user.user_id,
        status: 'active'
      }
    });

    // ✅ CORRECT CALCULATION: Pending payments = Unpaid invoices
    // When an invoice is paid, it's marked as 'paid' and won't be in this query
    // So we don't need to subtract approved payments (that would be double-counting)
    
    // Get unpaid/overdue invoices (this is what tenant needs to pay)
    const unpaidInvoices = await prisma.invoice.aggregate({
      where: {
        issued_to: user.user_id,
        status: { in: ['draft', 'sent', 'overdue'] }
      },
      _sum: {
        total_amount: true
      },
      _count: {
        id: true
      }
    });
    const unpaidInvoicesAmount = Number(unpaidInvoices._sum.total_amount || 0);
    const unpaidInvoicesCount = unpaidInvoices._count.id;

    // Pending payments = unpaid invoices amount
    const pendingPaymentsAmount = unpaidInvoicesAmount;
    const pendingPaymentsCount = unpaidInvoicesCount;

    // Get maintenance requests count
    const maintenanceRequests = await prisma.maintenanceRequest.count({
      where: {
        requested_by: user.user_id,
        status: { in: ['pending', 'in_progress'] }
      }
    });

    // Get unread notifications count
    const unreadNotifications = await prisma.notification.count({
      where: {
        recipient_id: user.user_id,
        is_read: false
      }
    });

    // Get next rent due date from active lease
    const nextLease = await prisma.lease.findFirst({
      where: {
        tenant_id: user.user_id,
        status: 'active'
      },
      orderBy: {
        end_date: 'asc'
      }
    });

    // Calculate next rent due date (assuming monthly payments on payment_day)
    let nextRentDueDate = null;
    let totalRentAmount = 0;

    if (nextLease) {
      totalRentAmount = Number(nextLease.rent_amount);
      const today = new Date();
      const paymentDay = nextLease.payment_day || 1;
      
      // Calculate next payment date
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, paymentDay);
      if (today.getDate() <= paymentDay) {
        nextRentDueDate = new Date(today.getFullYear(), today.getMonth(), paymentDay);
      } else {
        nextRentDueDate = nextMonth;
      }
    }

    const dashboardData = {
      active_leases: activeLeases,
      pending_payments: pendingPaymentsAmount, // Total amount of pending payments
      pending_payments_count: pendingPaymentsCount, // Number of pending payments
      maintenance_requests: maintenanceRequests,
      unread_messages: unreadNotifications,
      unread_notices: unreadNotifications, // Same as notifications for now
      pending_checklists: 0, // TODO: Implement checklists
      next_rent_due_date: nextRentDueDate,
      total_rent_amount: totalRentAmount,
      tenant_info: {
        id: tenant.id,
        name: `${tenant.first_name} ${tenant.last_name}`,
        email: tenant.email,
        phone: tenant.phone_number,
        current_unit: tenant.tenant_profile?.current_unit ? {
          id: tenant.tenant_profile.current_unit.id,
          unit_number: tenant.tenant_profile.current_unit.unit_number,
          property_name: tenant.tenant_profile.current_unit.property.name
        } : null
      }
    };

    res.json({
      success: true,
      message: 'Dashboard data retrieved successfully',
      data: dashboardData
    });

  } catch (error: any) {
    console.error('Error getting tenant dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard data'
    });
  }
};

// Get tenant profile
export const getTenantProfile = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    
    if (user.role !== 'tenant') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Tenant role required.'
      });
    }

    const tenant = await prisma.user.findUnique({
      where: { id: user.user_id },
      include: {
        tenant_profile: {
          include: {
            current_unit: {
              include: {
                property: true
              }
            },
            current_property: true
          }
        }
      }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    const profileData = {
      id: tenant.id,
      first_name: tenant.first_name,
      last_name: tenant.last_name,
      email: tenant.email,
      phone_number: tenant.phone_number,
      status: tenant.status,
      email_verified: tenant.email_verified,
      created_at: tenant.created_at,
      account_balance: tenant.tenant_profile?.account_balance || 0, // ✅ Add advance payment balance
      tenant_profile: tenant.tenant_profile ? {
        id_number: tenant.tenant_profile.id_number,
        nationality: tenant.tenant_profile.nationality,
        profile_picture: tenant.tenant_profile.profile_picture,
        move_in_date: tenant.tenant_profile.move_in_date,
        lease_type: tenant.tenant_profile.lease_type,
        lease_start_date: tenant.tenant_profile.lease_start_date,
        lease_end_date: tenant.tenant_profile.lease_end_date,
        rent_amount: tenant.tenant_profile.rent_amount,
        deposit_amount: tenant.tenant_profile.deposit_amount,
        payment_frequency: tenant.tenant_profile.payment_frequency,
        payment_day: tenant.tenant_profile.payment_day,
        emergency_contact_name: tenant.tenant_profile.emergency_contact_name,
        emergency_contact_phone: tenant.tenant_profile.emergency_contact_phone,
        emergency_contact_relationship: tenant.tenant_profile.emergency_contact_relationship,
        preferred_communication_method: tenant.tenant_profile.preferred_communication_method,
        account_balance: tenant.tenant_profile.account_balance || 0, // ✅ Also add here for nested access
        current_unit: tenant.tenant_profile.current_unit,
        current_property: tenant.tenant_profile.current_property
      } : null
    };

    res.json({
      success: true,
      message: 'Profile retrieved successfully',
      data: profileData
    });

  } catch (error: any) {
    console.error('Error getting tenant profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile'
    });
  }
};

// Get tenant leases
export const getTenantLeases = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    
    if (user.role !== 'tenant') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Tenant role required.'
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const offset = (page - 1) * limit;

    const [leases, total] = await Promise.all([
      prisma.lease.findMany({
        where: {
          tenant_id: user.user_id
        },
        include: {
          unit: {
            include: {
              property: true
            }
          },
          property: true
        },
        orderBy: {
          created_at: 'desc'
        },
        skip: offset,
        take: limit
      }),
      prisma.lease.count({
        where: {
          tenant_id: user.user_id
        }
      })
    ]);

    res.json({
      success: true,
      message: 'Leases retrieved successfully',
      data: leases,
      pagination: {
        page,
        per_page: limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    });

  } catch (error: any) {
    console.error('Error getting tenant leases:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve leases'
    });
  }
};

// Get tenant payments
export const getTenantPayments = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    
    if (user.role !== 'tenant') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Tenant role required.'
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const offset = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: {
          tenant_id: user.user_id
        },
        include: {
          unit: {
            include: {
              property: true
            }
          },
          property: true,
          lease: true
        },
        orderBy: {
          payment_date: 'desc'
        },
        skip: offset,
        take: limit
      }),
      prisma.payment.count({
        where: {
          tenant_id: user.user_id
        }
      })
    ]);

    res.json({
      success: true,
      message: 'Payments retrieved successfully',
      data: {
        payments,
        total,
        page,
        per_page: limit,
        total_pages: Math.ceil(total / limit)
      },
      pagination: {
        page,
        per_page: limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    });

  } catch (error: any) {
    console.error('Error getting tenant payments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payments'
    });
  }
};

// Get single tenant payment details
export const getTenantPaymentById = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;
    
    if (user.role !== 'tenant') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Tenant role required.'
      });
    }

    const payment = await prisma.payment.findFirst({
      where: {
        id,
        tenant_id: user.user_id
      },
      include: {
        unit: {
          select: {
            id: true,
            unit_number: true
          }
        },
        property: {
          select: {
            id: true,
            name: true,
            street: true,
            city: true
          }
        },
        tenant: {
          select: {
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Fetch invoice separately if invoice_id exists
    let invoice = null;
    if (payment.invoice_id) {
      invoice = await prisma.invoice.findUnique({
        where: { id: payment.invoice_id },
        include: {
          line_items: {
            orderBy: {
              created_at: 'asc'
            }
          }
        }
      });
      
      console.log('📋 Invoice fetched for payment:', payment.id);
      console.log('📦 Invoice ID:', payment.invoice_id);
      console.log('📝 Line items count:', invoice?.line_items?.length || 0);
      if (invoice?.line_items && invoice.line_items.length > 0) {
        console.log('✅ Line items successfully fetched');
        invoice.line_items.forEach((item: any, index: number) => {
          console.log(`  ${index + 1}. ${item.description} - ${item.total_price}`);
        });
      } else {
        console.log('⚠️  No line items found for invoice');
      }
    }

    res.json({
      success: true,
      message: 'Payment details retrieved successfully',
      data: {
        ...payment,
        invoice
      }
    });

  } catch (error: any) {
    console.error('Error getting payment details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payment details'
    });
  }
};

// Get tenant invoices
export const getTenantInvoices = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    
    if (user.role !== 'tenant') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Tenant role required.'
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const offset = (page - 1) * limit;
    const status = req.query.status as string;

    const whereClause: any = {
      issued_to: user.user_id
    };

    if (status) {
      whereClause.status = status;
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where: whereClause,
        include: {
          property: {
            select: {
              id: true,
              name: true,
              street: true,
              city: true
            }
          },
          unit: {
            select: {
              id: true,
              unit_number: true
            }
          },
          recipient: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true
            }
          }
        },
        orderBy: {
          created_at: 'desc'
        },
        skip: offset,
        take: limit
      }),
      prisma.invoice.count({
        where: whereClause
      })
    ]);

    // Calculate summary statistics (unpaid invoices: sent + overdue)
    const pendingAmount = await prisma.invoice.aggregate({
      where: {
        issued_to: user.user_id,
        status: { in: ['sent', 'overdue'] }
      },
      _sum: {
        total_amount: true
      }
    });

    res.json({
      success: true,
      message: 'Invoices retrieved successfully',
      data: {
        invoices,
        total,
        pending_amount: pendingAmount._sum ? Number(pendingAmount._sum.total_amount || 0) : 0,
        page,
        per_page: limit,
        total_pages: Math.ceil(total / limit)
      }
    });

  } catch (error: any) {
    console.error('Error getting tenant invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve invoices'
    });
  }
};

// Get tenant pending payables with detailed breakdown
export const getTenantPendingPayables = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    
    if (user.role !== 'tenant') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Tenant role required.'
      });
    }

    // Get all pending/overdue invoices with line items for detailed breakdown
    const pendingInvoices = await prisma.invoice.findMany({
      where: {
        issued_to: user.user_id,
        status: { in: ['sent', 'overdue'] }
      },
      include: {
        line_items: {
          orderBy: {
            created_at: 'asc'
          }
        },
        property: {
          select: {
            id: true,
            name: true,
            street: true,
            city: true
          }
        },
        unit: {
          select: {
            id: true,
            unit_number: true
          }
        },
        issuer: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            role: true,
            company_id: true
          }
        }
      },
      orderBy: [
        { due_date: 'asc' },
        { created_at: 'desc' }
      ]
    });

    // Calculate total pending amount
    const totalPending = pendingInvoices.reduce((sum, inv) => 
      sum + Number(inv.total_amount), 0
    );

    // Get tenant's current lease for rent info
    const currentLease = await prisma.lease.findFirst({
      where: {
        tenant_id: user.user_id,
        status: 'active'
      },
      include: {
        unit: {
          include: {
            property: true
          }
        }
      },
      orderBy: {
        start_date: 'desc'
      }
    });

    // Get maintenance requests that may have charges
    const maintenanceWithCharges = await prisma.maintenanceRequest.findMany({
      where: {
        requested_by: user.user_id,
        actual_cost: { gt: 0 },
        status: 'completed'
      },
      include: {
        property: true,
        unit: true
      },
      orderBy: {
        completed_date: 'desc'
      },
      take: 10
    });

    // Group invoices by type for better display
    const invoicesByType = pendingInvoices.reduce((acc: any, invoice) => {
      const type = invoice.invoice_type || 'other';
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(invoice);
      return acc;
    }, {});

    // Calculate due status
    const today = new Date();
    const overdueInvoices = pendingInvoices.filter(inv => 
      new Date(inv.due_date) < today
    );
    const dueInvoices = pendingInvoices.filter(inv => {
      const dueDate = new Date(inv.due_date);
      const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
      return diffDays >= 0 && diffDays <= 7;
    });

    const responseData = {
      pending_invoices: pendingInvoices.map(inv => ({
        ...inv,
        total_amount: Number(inv.total_amount),
        subtotal: Number(inv.subtotal),
        tax_amount: Number(inv.tax_amount),
        discount_amount: Number(inv.discount_amount),
        line_items: inv.line_items.map(item => ({
          ...item,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          total_price: Number(item.total_price)
        })),
        is_overdue: new Date(inv.due_date) < today,
        days_until_due: Math.ceil((new Date(inv.due_date).getTime() - today.getTime()) / (1000 * 3600 * 24))
      })),
      summary: {
        total_pending: totalPending,
        total_invoices: pendingInvoices.length,
        overdue_count: overdueInvoices.length,
        overdue_amount: overdueInvoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0),
        due_soon_count: dueInvoices.length,
        due_soon_amount: dueInvoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0)
      },
      invoices_by_type: invoicesByType,
      current_lease: currentLease ? {
        id: currentLease.id,
        rent_amount: Number(currentLease.rent_amount),
        deposit_amount: Number(currentLease.deposit_amount),
        payment_frequency: currentLease.payment_frequency,
        payment_day: currentLease.payment_day,
        unit: currentLease.unit,
        late_fee_amount: currentLease.late_fee_amount ? Number(currentLease.late_fee_amount) : null
      } : null,
      maintenance_charges: maintenanceWithCharges.map(req => ({
        id: req.id,
        title: req.title,
        actual_cost: Number(req.actual_cost),
        completed_date: req.completed_date,
        property: req.property,
        unit: req.unit
      }))
    };

    res.json({
      success: true,
      message: 'Pending payables retrieved successfully',
      data: responseData
    });

  } catch (error: any) {
    console.error('Error getting tenant pending payables:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pending payables',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get tenant maintenance requests
export const getTenantMaintenance = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    
    if (user.role !== 'tenant') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Tenant role required.'
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const offset = (page - 1) * limit;

    const [maintenanceRequests, total] = await Promise.all([
      prisma.maintenanceRequest.findMany({
        where: {
          requested_by: user.user_id
        },
        include: {
          property: true,
          unit: true,
          assignee: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true
            }
          }
        },
        orderBy: {
          created_at: 'desc'
        },
        skip: offset,
        take: limit
      }),
      prisma.maintenanceRequest.count({
        where: {
          requested_by: user.user_id
        }
      })
    ]);

    res.json({
      success: true,
      message: 'Maintenance requests retrieved successfully',
      data: maintenanceRequests,
      pagination: {
        page,
        per_page: limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    });

  } catch (error: any) {
    console.error('Error getting tenant maintenance requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve maintenance requests'
    });
  }
};

// Get tenant notifications/notices
export const getTenantNotifications = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    
    if (user.role !== 'tenant') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Tenant role required.'
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const offset = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: {
          recipient_id: user.user_id
        },
        include: {
          sender: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              role: true
            }
          }
        },
        orderBy: {
          created_at: 'desc'
        },
        skip: offset,
        take: limit
      }),
      prisma.notification.count({
        where: {
          recipient_id: user.user_id
        }
      })
    ]);

    res.json({
      success: true,
      message: 'Notifications retrieved successfully',
      data: notifications,
      pagination: {
        page,
        per_page: limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    });

  } catch (error: any) {
    console.error('Error getting tenant notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve notifications'
    });
  }
};

// Create maintenance request
export const createMaintenanceRequest = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    
    if (user.role !== 'tenant') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Tenant role required.'
      });
    }

    const { title, description, category, priority, unit_id, property_id } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and category are required'
      });
    }

    // Get tenant's current unit if not provided
    let targetUnitId = unit_id;
    let targetPropertyId = property_id;

    if (!targetUnitId) {
      const tenant = await prisma.user.findUnique({
        where: { id: user.user_id },
        include: {
          tenant_profile: true
        }
      });

      if (tenant?.tenant_profile?.current_unit_id) {
        targetUnitId = tenant.tenant_profile.current_unit_id;
        targetPropertyId = tenant.tenant_profile.current_property_id;
      }
    }

    if (!targetPropertyId) {
      return res.status(400).json({
        success: false,
        message: 'Property ID is required'
      });
    }

    const maintenanceRequest = await prisma.maintenanceRequest.create({
      data: {
        company_id: user.company_id!,
        property_id: targetPropertyId,
        unit_id: targetUnitId,
        title,
        description,
        category,
        priority: priority || 'medium',
        status: 'pending',
        requested_by: user.user_id,
        requested_date: new Date()
      },
      include: {
        property: true,
        unit: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Maintenance request created successfully',
      data: maintenanceRequest
    });

  } catch (error: any) {
    console.error('❌ Error creating maintenance request:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to create maintenance request',
      error: error.message
    });
  }
};

// Update tenant profile
export const updateTenantProfile = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    
    if (user.role !== 'tenant') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Tenant role required.'
      });
    }

    const {
      first_name,
      last_name,
      phone_number,
      id_number,
      emergency_contact_name,
      emergency_contact_phone,
      emergency_contact_relationship,
      preferred_communication_method
    } = req.body;

    // Update user basic info
    const updatedUser = await prisma.user.update({
      where: { id: user.user_id },
      data: {
        ...(first_name && { first_name }),
        ...(last_name && { last_name }),
        ...(phone_number && { phone_number })
      }
    });

    // Update or create tenant profile
    const tenantProfile = await prisma.tenantProfile.upsert({
      where: { user_id: user.user_id },
      update: {
        ...(id_number !== undefined && { id_number }),
        ...(emergency_contact_name !== undefined && { emergency_contact_name }),
        ...(emergency_contact_phone !== undefined && { emergency_contact_phone }),
        ...(emergency_contact_relationship !== undefined && { emergency_contact_relationship }),
        ...(preferred_communication_method !== undefined && { preferred_communication_method })
      },
      create: {
        user_id: user.user_id,
        id_number,
        emergency_contact_name,
        emergency_contact_phone,
        emergency_contact_relationship,
        preferred_communication_method
      }
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: updatedUser,
        profile: tenantProfile
      }
    });

  } catch (error: any) {
    console.error('Error updating tenant profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
};

// Upload profile picture
export const uploadTenantProfilePicture = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    
    if (user.role !== 'tenant') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Tenant role required.'
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Import ImageKit service dynamically
    const { imagekitService } = await import('../services/imagekit.service.js');

    // Upload to ImageKit
    const fileName = `tenant-profile-${user.user_id}-${Date.now()}`;
    const uploadResult = await imagekitService.uploadFile(
      req.file.buffer,
      fileName,
      'tenant-profiles'
    );

    if (!uploadResult || !uploadResult.url) {
      throw new Error('Failed to upload image to ImageKit');
    }

    const profilePictureUrl = uploadResult.url;

    // Update tenant profile with profile picture URL
    const tenantProfile = await prisma.tenantProfile.upsert({
      where: { user_id: user.user_id },
      update: {
        profile_picture: profilePictureUrl
      },
      create: {
        user_id: user.user_id,
        profile_picture: profilePictureUrl
      }
    });

    res.json({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: {
        profile_picture: profilePictureUrl
      }
    });

  } catch (error: any) {
    console.error('Error uploading profile picture:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload profile picture'
    });
  }
};

// Submit lease edit request
export const submitLeaseEditRequest = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    
    if (user.role !== 'tenant') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Tenant role required.'
      });
    }

    const {
      lease_id,
      modification_type,
      details,
      proposed_effective_date,
      reason
    } = req.body;

    if (!lease_id || !modification_type || !details) {
      return res.status(400).json({
        success: false,
        message: 'Lease ID, modification type, and details are required'
      });
    }

    // Verify the lease belongs to this tenant
    const lease = await prisma.lease.findUnique({
      where: { id: lease_id },
      include: {
        property: true,
        unit: true
      }
    });

    if (!lease) {
      return res.status(404).json({
        success: false,
        message: 'Lease not found'
      });
    }

    if (lease.tenant_id !== user.user_id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this lease'
      });
    }

    // Create notification for landlord
    const tenant = await prisma.user.findUnique({
      where: { id: user.user_id },
      select: {
        first_name: true,
        last_name: true,
        email: true
      }
    });

    const notificationMessage = `Tenant ${tenant?.first_name} ${tenant?.last_name} has requested a lease modification for ${lease.property.name} - Unit ${lease.unit.unit_number}.\n\nModification Type: ${modification_type}\n\nDetails: ${details}${proposed_effective_date ? `\n\nProposed Effective Date: ${new Date(proposed_effective_date).toLocaleDateString()}` : ''}${reason ? `\n\nReason: ${reason}` : ''}`;

    // Send notification to property owner/landlord
    await notificationsService.createNotification(user, {
      company_id: user.company_id!,
      sender_id: user.user_id,
      recipient_id: lease.property.owner_id,
      notification_type: 'lease_modification_request',
      title: `Lease Modification Request - Unit ${lease.unit.unit_number}`,
      message: notificationMessage,
      priority: 'high',
      action_required: true,
      action_url: `/landlord/leases/${lease_id}`,
      metadata: {
        lease_id,
        modification_type,
        details,
        proposed_effective_date,
        reason,
        tenant_id: user.user_id,
        tenant_name: `${tenant?.first_name} ${tenant?.last_name}`,
        tenant_email: tenant?.email,
        property_id: lease.property_id,
        unit_id: lease.unit_id
      }
    });

    // Also create a notification for the tenant confirming submission
    await notificationsService.createNotification(user, {
      company_id: user.company_id!,
      sender_id: user.user_id,
      recipient_id: user.user_id,
      notification_type: 'lease_modification_submitted',
      title: 'Lease Modification Request Submitted',
      message: `Your lease modification request for ${lease.property.name} - Unit ${lease.unit.unit_number} has been submitted successfully. Your landlord will review your request and respond shortly.`,
      priority: 'medium',
      action_required: false,
      metadata: {
        lease_id,
        modification_type
      }
    });

    res.json({
      success: true,
      message: 'Lease modification request submitted successfully',
      data: {
        lease_id,
        modification_type,
        submitted_at: new Date()
      }
    });

  } catch (error: any) {
    console.error('Error submitting lease edit request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit lease modification request'
    });
  }
};

// Get lease modifications for tenant
export const getTenantLeaseModifications = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { leaseId } = req.params;

    if (user.role !== 'tenant') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Tenant role required.'
      });
    }

    if (!leaseId) {
      return res.status(400).json({
        success: false,
        message: 'Lease ID is required'
      });
    }

    // Dynamically import the service
    const { LeaseModificationsService } = await import('../services/lease-modifications.service.js');
    const modificationsService = new LeaseModificationsService();

    // Get modifications for the lease
    const modifications = await modificationsService.getLeaseModifications(leaseId, user);

    res.json({
      success: true,
      data: modifications,
      count: modifications.length
    });

  } catch (error: any) {
    console.error('Error fetching lease modifications:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch lease modifications'
    });
  }
};

// Get all lease modifications for current tenant
export const getTenantAllModifications = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;

    if (user.role !== 'tenant') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Tenant role required.'
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const modificationType = req.query.type as any;

    // Dynamically import the service
    const { LeaseModificationsService } = await import('../services/lease-modifications.service.js');
    const modificationsService = new LeaseModificationsService();

    // Get all modifications for tenant's leases
    const result = await modificationsService.getModifications({
      tenant_id: user.user_id,
      modification_type: modificationType,
      page,
      limit
    }, user);

    res.json({
      success: true,
      data: result.modifications,
      pagination: result.pagination
    });

  } catch (error: any) {
    console.error('Error fetching tenant modifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch lease modifications'
    });
  }
};

// Acknowledge a lease modification
export const acknowledgeTenantLeaseModification = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { modificationId } = req.params;

    if (user.role !== 'tenant') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Tenant role required.'
      });
    }

    if (!modificationId) {
      return res.status(400).json({
        success: false,
        message: 'Modification ID is required'
      });
    }

    // Dynamically import the service
    const { LeaseModificationsService } = await import('../services/lease-modifications.service.js');
    const modificationsService = new LeaseModificationsService();

    // Acknowledge the modification
    const modification = await modificationsService.acknowledgeModification(modificationId, user);

    res.json({
      success: true,
      message: 'Modification acknowledged successfully',
      data: modification
    });

  } catch (error: any) {
    console.error('Error acknowledging modification:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to acknowledge modification'
    });
  }
};

// Get unacknowledged modifications for tenant
export const getTenantUnacknowledgedModifications = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;

    if (user.role !== 'tenant') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Tenant role required.'
      });
    }

    // Dynamically import the service
    const { LeaseModificationsService } = await import('../services/lease-modifications.service.js');
    const modificationsService = new LeaseModificationsService();

    // Get unacknowledged modifications
    const modifications = await modificationsService.getUnacknowledgedModifications(user.user_id, user);

    res.json({
      success: true,
      data: modifications,
      count: modifications.length
    });

  } catch (error: any) {
    console.error('Error fetching unacknowledged modifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unacknowledged modifications'
    });
  }
};

// Get modification statistics for a lease
export const getTenantLeaseModificationStats = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { leaseId } = req.params;

    if (user.role !== 'tenant') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Tenant role required.'
      });
    }

    if (!leaseId) {
      return res.status(400).json({
        success: false,
        message: 'Lease ID is required'
      });
    }

    // Dynamically import the service
    const { LeaseModificationsService } = await import('../services/lease-modifications.service.js');
    const modificationsService = new LeaseModificationsService();

    // Get modification stats
    const stats = await modificationsService.getModificationStats(leaseId, user);

    res.json({
      success: true,
      data: stats
    });

  } catch (error: any) {
    console.error('Error fetching modification stats:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch modification statistics'
    });
  }
};

// Process tenant payment for selected invoices (clean flow)
export const processTenantPayment = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    if (user.role !== 'tenant') {
      return res.status(403).json({ success: false, message: 'Access denied. Tenant role required.' });
    }

    const { invoice_ids, transaction_id, reference_number, gateway_response } = req.body || {};
    const { processTenantOnlinePayment } = await import('../services/online-payment.service.js');
    const data = await processTenantOnlinePayment(user, {
      invoice_ids,
      transaction_id,
      reference_number,
      payment_method: 'online',
      gateway_response,
    });

    // Send custom LetRents receipt email (non-blocking)
    try {
      const tenant = await prisma.user.findUnique({
        where: { id: user.user_id },
        select: { email: true, first_name: true, last_name: true }
      });
      const firstInvoiceId = Array.isArray(invoice_ids) && invoice_ids.length > 0 ? invoice_ids[0] : null;
      const firstInvoice = firstInvoiceId
        ? await prisma.invoice.findUnique({
            where: { id: firstInvoiceId },
            include: { property: true, unit: true },
          })
        : null;

      if (tenant?.email) {
        const receipt = data?.receipts?.[0];
        await emailService.sendPaymentReceipt({
          to: tenant.email,
          tenant_name: `${tenant.first_name || ''} ${tenant.last_name || ''}`.trim() || 'Tenant',
          payment_amount: data?.total_amount || 0,
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'ONLINE',
          receipt_number: receipt?.receipt_number || 'N/A',
          property_name: firstInvoice?.property?.name || 'Your Property',
          unit_number: firstInvoice?.unit?.unit_number || 'Your Unit',
        });
      }
    } catch (emailErr) {
      console.error('Failed to send custom tenant receipt email:', emailErr);
    }

    // Optional: In-app notification for the tenant
    try {
      await notificationsService.createNotification(user, {
        user_id: user.user_id,
        type: 'payment_receipt',
        title: 'Payment Successful - Receipt Generated',
        message: `Your online payment of KSh ${(data?.total_amount || 0).toLocaleString()} has been processed.`,
        data: {
          invoices_paid: data?.invoices_paid,
          receipts: data?.receipts,
          transaction_id,
          reference_number,
        },
      });
    } catch (notifErr) {
      console.error('Failed to send in-app notification to tenant:', notifErr);
    }

    return res.status(200).json({ success: true, message: 'Payment processed successfully', data });
  } catch (error: any) {
    console.error('❌ Error in processTenantPayment:', { message: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: error.message || 'Failed to process payment' });
  }
};

// Cancel tenant's own pending payment
export const cancelTenantPendingPayment = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id: paymentId } = req.params;

    if (user.role !== 'tenant') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Tenant role required.'
      });
    }

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID is required'
      });
    }

    // Get the payment and verify it belongs to the tenant
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId }
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Verify the payment belongs to this tenant
    if (payment.tenant_id !== user.user_id) {
      return res.status(403).json({
        success: false,
        message: 'You can only cancel your own payments'
      });
    }

    // Only allow canceling pending payments
    if (payment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending payments can be cancelled'
      });
    }

    // Delete the pending payment
    await prisma.payment.delete({
      where: { id: paymentId }
    });

    res.json({
      success: true,
      message: 'Pending payment cancelled successfully',
      data: { id: paymentId }
    });

  } catch (error: any) {
    console.error('Error cancelling pending payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel pending payment'
    });
  }
};

// Cleanup duplicate/erroneous payment (for data fixes)
export const cleanupDuplicatePayment = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id: paymentId } = req.params;

    if (user.role !== 'tenant') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Tenant role required.'
      });
    }

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID is required'
      });
    }

    // Get the payment and verify it belongs to the tenant
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId }
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Verify the payment belongs to this tenant
    if (payment.tenant_id !== user.user_id) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own payments'
      });
    }

    // Allow deletion of duplicate/erroneous payments
    // Log the deletion for audit purposes
    console.log(`🗑️ Cleaning up duplicate payment: ${payment.receipt_number} (Amount: ${payment.amount}, Period: ${payment.payment_period})`);
    
    // Delete the payment
    await prisma.payment.delete({
      where: { id: paymentId }
    });

    res.json({
      success: true,
      message: 'Payment deleted successfully',
      data: { 
        id: paymentId,
        receipt_number: payment.receipt_number,
        amount: payment.amount,
        period: payment.payment_period
      }
    });

  } catch (error: any) {
    console.error('Error deleting payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete payment'
    });
  }
};
