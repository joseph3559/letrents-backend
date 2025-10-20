import { Request, Response } from 'express';
import { getPrisma } from '../config/prisma.js';
import { JWTClaims } from '../types/index.js';

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

    // Get pending payments count
    const pendingPayments = await prisma.payment.count({
      where: {
        tenant_id: user.user_id,
        status: 'pending'
      }
    });

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
      pending_payments: pendingPayments,
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
      data: payments,
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
