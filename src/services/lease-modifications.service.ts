/**
 * Lease Modifications Service
 * Handles tracking and retrieval of lease modification history
 */

import { getPrisma } from '../config/prisma.js';
import { JWTClaims } from '../types/index.js';
import { LeaseModificationType } from '@prisma/client';

export interface LeaseModificationData {
  lease_id: string;
  modification_type: LeaseModificationType;
  field_name: string;
  old_value?: string | null;
  new_value?: string | null;
  reason?: string;
  description?: string;
  effective_date?: Date;
  metadata?: any;
}

export interface GetModificationsQuery {
  lease_id?: string;
  tenant_id?: string;
  modification_type?: LeaseModificationType;
  page?: number;
  limit?: number;
}

export class LeaseModificationsService {
  private prisma = getPrisma();

  /**
   * Get lease modifications with pagination and filtering
   */
  async getModifications(query: GetModificationsQuery, user: JWTClaims) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const offset = (page - 1) * limit;

    // Build where clause based on user role and filters
    const where: any = {
      company_id: user.company_id!,
    };

    // Filter by lease_id if provided
    if (query.lease_id) {
      where.lease_id = query.lease_id;
    }

    // Filter by tenant_id if provided (for tenants to see their own lease modifications)
    if (query.tenant_id) {
      where.lease = {
        tenant_id: query.tenant_id,
      };
    }

    // If user is a tenant, only show their own lease modifications
    if (user.role === 'tenant') {
      where.lease = {
        tenant_id: user.user_id,
      };
    }

    // Filter by modification type
    if (query.modification_type) {
      where.modification_type = query.modification_type;
    }

    // Get total count
    const totalCount = await this.prisma.leaseModification.count({ where });

    // Get modifications with relations
    const modifications = await this.prisma.leaseModification.findMany({
      where,
      include: {
        lease: {
          include: {
            unit: {
              select: {
                id: true,
                unit_number: true,
                unit_type: true,
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
            tenant: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
              },
            },
          },
        },
        modifier: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            role: true,
          },
        },
        approver: {
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
      skip: offset,
      take: limit,
    });

    return {
      modifications,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  /**
   * Get modifications for a specific lease
   */
  async getLeaseModifications(leaseId: string, user: JWTClaims) {
    // Verify access to lease
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      select: {
        id: true,
        tenant_id: true,
        property: {
          select: {
            owner_id: true,
          },
        },
      },
    });

    if (!lease) {
      throw new Error('Lease not found');
    }

    // Check permissions
    const hasAccess =
      user.role === 'super_admin' ||
      user.role === 'agency_admin' ||
      lease.property.owner_id === user.user_id ||
      lease.tenant_id === user.user_id;

    if (!hasAccess) {
      throw new Error('Access denied to view lease modifications');
    }

    // Get all modifications for this lease
    const modifications = await this.prisma.leaseModification.findMany({
      where: {
        lease_id: leaseId,
        company_id: user.company_id!,
      },
      include: {
        modifier: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            role: true,
          },
        },
        approver: {
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

    return modifications;
  }

  /**
   * Create a manual lease modification log entry
   */
  async createModification(data: LeaseModificationData, user: JWTClaims) {
    // Verify lease exists and user has permission
    const lease = await this.prisma.lease.findUnique({
      where: { id: data.lease_id },
      include: {
        property: true,
        tenant: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!lease) {
      throw new Error('Lease not found');
    }

    // Check permissions - only landlords and admins can create modifications
    const canModify =
      user.role === 'super_admin' ||
      user.role === 'agency_admin' ||
      user.role === 'landlord';

    if (!canModify) {
      throw new Error('Insufficient permissions to create lease modifications');
    }

    // Create the modification record
    const modification = await this.prisma.leaseModification.create({
      data: {
        lease_id: data.lease_id,
        company_id: user.company_id!,
        modification_type: data.modification_type,
        field_name: data.field_name,
        old_value: data.old_value,
        new_value: data.new_value,
        reason: data.reason,
        description: data.description,
        modified_by: user.user_id,
        modified_by_role: user.role,
        effective_date: data.effective_date,
        metadata: data.metadata || {},
        tenant_notified: false,
      },
      include: {
        lease: {
          include: {
            unit: true,
            property: true,
          },
        },
        modifier: {
          select: {
            first_name: true,
            last_name: true,
            role: true,
          },
        },
      },
    });

    // Send notification to tenant about the modification
    await this.notifyTenantOfModification(modification, lease);

    return modification;
  }

  /**
   * Mark a modification as acknowledged by tenant
   */
  async acknowledgeModification(modificationId: string, user: JWTClaims) {
    // Get the modification
    const modification = await this.prisma.leaseModification.findUnique({
      where: { id: modificationId },
      include: {
        lease: true,
      },
    });

    if (!modification) {
      throw new Error('Modification not found');
    }

    // Only the tenant can acknowledge their own lease modifications
    if (modification.lease.tenant_id !== user.user_id) {
      throw new Error('You can only acknowledge your own lease modifications');
    }

    // Update the modification
    return await this.prisma.leaseModification.update({
      where: { id: modificationId },
      data: {
        tenant_acknowledged: true,
        tenant_acknowledged_at: new Date(),
      },
    });
  }

  /**
   * Get unacknowledged modifications for a tenant
   */
  async getUnacknowledgedModifications(tenantId: string, user: JWTClaims) {
    // Verify user is the tenant or has admin access
    if (user.role === 'tenant' && user.user_id !== tenantId) {
      throw new Error('Access denied');
    }

    const modifications = await this.prisma.leaseModification.findMany({
      where: {
        lease: {
          tenant_id: tenantId,
        },
        tenant_acknowledged: false,
        company_id: user.company_id!,
      },
      include: {
        lease: {
          include: {
            unit: true,
            property: true,
          },
        },
        modifier: {
          select: {
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

    return modifications;
  }

  /**
   * Get modification statistics for a lease
   */
  async getModificationStats(leaseId: string, user: JWTClaims) {
    const modifications = await this.getLeaseModifications(leaseId, user);

    const stats = {
      total: modifications.length,
      byType: {} as Record<string, number>,
      recentCount: 0,
      unacknowledged: 0,
    };

    // Count by type
    modifications.forEach((mod: any) => {
      stats.byType[mod.modification_type] =
        (stats.byType[mod.modification_type] || 0) + 1;

      // Count recent (last 30 days)
      const daysSinceModification =
        (new Date().getTime() - new Date(mod.created_at).getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysSinceModification <= 30) {
        stats.recentCount++;
      }

      // Count unacknowledged
      if (!mod.tenant_acknowledged) {
        stats.unacknowledged++;
      }
    });

    return stats;
  }

  /**
   * Private method to notify tenant of lease modification
   */
  private async notifyTenantOfModification(modification: any, lease: any) {
    try {
      // Import notification service dynamically to avoid circular dependency
      const { notificationsService } = await import('./notifications.service.js');

      const user = {
        user_id: modification.modified_by,
        company_id: modification.company_id,
        role: modification.modified_by_role,
      } as JWTClaims;

      // Format the modification message
      const fieldLabel = this.getFieldLabel(modification.field_name);
      const changeDescription = this.formatChangeDescription(
        fieldLabel,
        modification.old_value,
        modification.new_value
      );

      const message = `Your lease for ${lease.property.name} - Unit ${lease.unit.unit_number} has been modified.\n\n${changeDescription}${modification.reason ? `\n\nReason: ${modification.reason}` : ''}${modification.effective_date ? `\n\nEffective Date: ${new Date(modification.effective_date).toLocaleDateString()}` : ''}`;

      await notificationsService.createNotification(user, {
        company_id: modification.company_id,
        sender_id: modification.modified_by,
        recipient_id: lease.tenant_id,
        notification_type: 'lease_modification',
        title: `Lease Modification: ${lease.property.name}`,
        message,
        priority: 'high',
        action_required: true,
        action_url: `/tenant?tab=lease`,
        metadata: {
          lease_id: lease.id,
          modification_id: modification.id,
          modification_type: modification.modification_type,
          field_name: modification.field_name,
        },
      });

      // Mark as notified
      await this.prisma.leaseModification.update({
        where: { id: modification.id },
        data: { tenant_notified: true },
      });
    } catch (error) {
      console.error('Failed to send modification notification:', error);
      // Don't throw - notification failure shouldn't block modification creation
    }
  }

  /**
   * Get human-readable field label
   */
  private getFieldLabel(fieldName: string): string {
    const labels: Record<string, string> = {
      rent_amount: 'Monthly Rent',
      deposit_amount: 'Security Deposit',
      start_date: 'Lease Start Date',
      end_date: 'Lease End Date',
      payment_frequency: 'Payment Frequency',
      payment_day: 'Payment Day',
      special_terms: 'Special Terms',
      pets_allowed: 'Pet Policy',
      smoking_allowed: 'Smoking Policy',
      subletting_allowed: 'Subletting Policy',
      status: 'Lease Status',
    };

    return labels[fieldName] || fieldName;
  }

  /**
   * Format change description for notification
   */
  private formatChangeDescription(
    field: string,
    oldValue: string | null,
    newValue: string | null
  ): string {
    if (!oldValue && newValue) {
      return `${field} set to: ${newValue}`;
    } else if (oldValue && !newValue) {
      return `${field} removed (was: ${oldValue})`;
    } else if (oldValue && newValue) {
      // Special formatting for currency values
      if (field.includes('Rent') || field.includes('Deposit')) {
        return `${field} changed from KES ${parseFloat(oldValue).toLocaleString()} to KES ${parseFloat(newValue).toLocaleString()}`;
      }
      // Special formatting for boolean values
      if (field.includes('Policy') || oldValue === 'true' || oldValue === 'false') {
        const oldStatus = oldValue === 'true' ? 'Allowed' : 'Not Allowed';
        const newStatus = newValue === 'true' ? 'Allowed' : 'Not Allowed';
        return `${field} changed from ${oldStatus} to ${newStatus}`;
      }
      // Default formatting
      return `${field} changed from ${oldValue} to ${newValue}`;
    }

    return `${field} modified`;
  }
}

