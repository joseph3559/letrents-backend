import { getPrisma } from '../config/prisma.js';
import bcrypt from 'bcryptjs';
/**
 * Universal Settings Service for all user roles
 * Works with tenants, landlords, staff, agents, and admins
 */
export class TenantSettingsService {
    prisma = getPrisma();
    /**
     * Check if user has permission to view target user's settings
     */
    async checkPermission(requestingUser, targetUserId) {
        // Super admin can access everything
        if (requestingUser.role === 'super_admin') {
            return true;
        }
        // Users can always access their own settings
        if (requestingUser.user_id === targetUserId) {
            return true;
        }
        // Landlords can view their tenants' settings
        if (requestingUser.role === 'landlord') {
            const tenant = await this.prisma.user.findFirst({
                where: {
                    id: targetUserId,
                    role: 'tenant',
                    landlord_id: requestingUser.user_id,
                    company_id: requestingUser.company_id,
                },
            });
            return !!tenant;
        }
        // Agency admins can view settings of users in their agency
        if (requestingUser.role === 'agency_admin' && requestingUser.agency_id) {
            const user = await this.prisma.user.findFirst({
                where: {
                    id: targetUserId,
                    agency_id: requestingUser.agency_id,
                },
            });
            return !!user;
        }
        // Property managers and caretakers can view tenants in their properties
        if (['property_manager', 'caretaker'].includes(requestingUser.role)) {
            const tenant = await this.prisma.user.findFirst({
                where: {
                    id: targetUserId,
                    role: 'tenant',
                    company_id: requestingUser.company_id,
                },
            });
            if (!tenant)
                return false;
            // Check if staff is assigned to tenant's property
            const tenantUnit = await this.prisma.unit.findFirst({
                where: {
                    current_tenant_id: targetUserId,
                },
                include: {
                    property: {
                        include: {
                            staff_assignments: {
                                where: {
                                    staff_id: requestingUser.user_id,
                                    status: 'active',
                                },
                            },
                        },
                    },
                },
            });
            return !!tenantUnit && !!tenantUnit.property && tenantUnit.property.staff_assignments.length > 0;
        }
        return false;
    }
    /**
     * Get preferences for any user (with permission check)
     * Used by landlords/staff to view tenant settings
     */
    async getUserPreferences(requestingUser, targetUserId) {
        try {
            const hasPermission = await this.checkPermission(requestingUser, targetUserId);
            if (!hasPermission) {
                throw new Error('Permission denied: You do not have access to view this user\'s settings');
            }
            const preferences = await this.prisma.tenantPreferences.findUnique({
                where: { user_id: targetUserId },
                include: {
                    user: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            email: true,
                            phone_number: true,
                            role: true,
                        },
                    },
                },
            });
            return preferences;
        }
        catch (error) {
            console.error('Error getting user preferences:', error);
            throw error;
        }
    }
    /**
     * Get notification settings for any user (with permission check)
     */
    async getUserNotificationSettings(requestingUser, targetUserId) {
        try {
            const hasPermission = await this.checkPermission(requestingUser, targetUserId);
            if (!hasPermission) {
                throw new Error('Permission denied: You do not have access to view this user\'s notification settings');
            }
            const settings = await this.prisma.tenantNotificationSettings.findUnique({
                where: { user_id: targetUserId },
                include: {
                    user: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            email: true,
                            phone_number: true,
                            role: true,
                        },
                    },
                },
            });
            return settings;
        }
        catch (error) {
            console.error('Error getting user notification settings:', error);
            throw error;
        }
    }
    /**
     * Check if tenant should receive a notification based on their settings
     * This is called by the notification service before sending notifications
     */
    async shouldReceiveNotification(userId, notificationType, category) {
        try {
            const settings = await this.prisma.tenantNotificationSettings.findUnique({
                where: { user_id: userId },
            });
            // If no settings, allow all notifications (default behavior)
            if (!settings)
                return true;
            // Check quiet hours
            if (settings.quiet_hours_start && settings.quiet_hours_end) {
                const now = new Date();
                const currentTime = now.getHours() * 60 + now.getMinutes();
                const startTime = new Date(settings.quiet_hours_start).getHours() * 60 +
                    new Date(settings.quiet_hours_start).getMinutes();
                const endTime = new Date(settings.quiet_hours_end).getHours() * 60 +
                    new Date(settings.quiet_hours_end).getMinutes();
                // Check if current time is within quiet hours
                if (startTime <= endTime) {
                    if (currentTime >= startTime && currentTime <= endTime) {
                        return false; // In quiet hours
                    }
                }
                else {
                    // Quiet hours span midnight
                    if (currentTime >= startTime || currentTime <= endTime) {
                        return false;
                    }
                }
            }
            // Check specific notification preferences based on type and category
            if (notificationType === 'email') {
                switch (category) {
                    case 'payment_reminder':
                        return settings.email_payment_reminders;
                    case 'payment_receipt':
                        return settings.email_payment_receipts;
                    case 'lease_update':
                        return settings.email_lease_updates;
                    case 'maintenance_update':
                        return settings.email_maintenance_updates;
                    case 'property_announcement':
                        return settings.email_property_announcements;
                    case 'landlord_message':
                        return settings.email_messages_from_landlord;
                    case 'marketing':
                        return settings.email_marketing;
                    default:
                        return true; // Allow unknown categories by default
                }
            }
            if (notificationType === 'sms') {
                switch (category) {
                    case 'payment_due':
                        return settings.sms_payment_due_alerts;
                    case 'urgent_maintenance':
                        return settings.sms_urgent_maintenance;
                    case 'security':
                        return settings.sms_security_alerts;
                    default:
                        return true;
                }
            }
            return true;
        }
        catch (error) {
            console.error('Error checking notification permission:', error);
            return true; // Default to allowing notifications on error
        }
    }
    /**
     * Get or create tenant preferences
     */
    async getPreferences(user) {
        try {
            let preferences = await this.prisma.tenantPreferences.findUnique({
                where: { user_id: user.user_id },
            });
            // Create default preferences if they don't exist
            if (!preferences && user.company_id) {
                preferences = await this.prisma.tenantPreferences.create({
                    data: {
                        user_id: user.user_id,
                        company_id: user.company_id,
                    },
                });
            }
            return preferences;
        }
        catch (error) {
            console.error('Error getting tenant preferences:', error);
            throw new Error('Failed to retrieve preferences');
        }
    }
    /**
     * Update tenant preferences
     */
    async updatePreferences(user, data) {
        try {
            const preferences = await this.prisma.tenantPreferences.upsert({
                where: { user_id: user.user_id },
                update: {
                    enable_email: data.enable_email,
                    enable_sms: data.enable_sms,
                    enable_push_notifications: data.enable_push_notifications,
                    primary_contact_method: data.primary_contact_method,
                    language: data.language,
                    currency: data.currency,
                    date_format: data.date_format,
                    timezone: data.timezone,
                    auto_pay_rent: data.auto_pay_rent,
                    payment_reminder_days: data.payment_reminder_days,
                    default_payment_method: data.default_payment_method,
                    updated_at: new Date(),
                },
                create: {
                    user_id: user.user_id,
                    company_id: user.company_id,
                    enable_email: data.enable_email,
                    enable_sms: data.enable_sms,
                    enable_push_notifications: data.enable_push_notifications,
                    primary_contact_method: data.primary_contact_method,
                    language: data.language,
                    currency: data.currency,
                    date_format: data.date_format,
                    timezone: data.timezone,
                    auto_pay_rent: data.auto_pay_rent,
                    payment_reminder_days: data.payment_reminder_days,
                    default_payment_method: data.default_payment_method,
                },
            });
            return preferences;
        }
        catch (error) {
            console.error('Error updating tenant preferences:', error);
            throw new Error('Failed to update preferences');
        }
    }
    /**
     * Get or create notification settings
     */
    async getNotificationSettings(user) {
        try {
            let settings = await this.prisma.tenantNotificationSettings.findUnique({
                where: { user_id: user.user_id },
            });
            // Create default settings if they don't exist
            if (!settings && user.company_id) {
                settings = await this.prisma.tenantNotificationSettings.create({
                    data: {
                        user_id: user.user_id,
                        company_id: user.company_id,
                    },
                });
            }
            return settings;
        }
        catch (error) {
            console.error('Error getting notification settings:', error);
            throw new Error('Failed to retrieve notification settings');
        }
    }
    /**
     * Update notification settings
     */
    async updateNotificationSettings(user, data) {
        try {
            const settings = await this.prisma.tenantNotificationSettings.upsert({
                where: { user_id: user.user_id },
                update: {
                    email_payment_reminders: data.email_payment_reminders,
                    email_payment_receipts: data.email_payment_receipts,
                    email_lease_updates: data.email_lease_updates,
                    email_maintenance_updates: data.email_maintenance_updates,
                    email_property_announcements: data.email_property_announcements,
                    email_messages_from_landlord: data.email_messages_from_landlord,
                    email_marketing: data.email_marketing,
                    sms_payment_due_alerts: data.sms_payment_due_alerts,
                    sms_urgent_maintenance: data.sms_urgent_maintenance,
                    sms_security_alerts: data.sms_security_alerts,
                    email_digest_frequency: data.email_digest_frequency,
                    quiet_hours_start: data.quiet_hours_start ? new Date(`1970-01-01T${data.quiet_hours_start}`) : null,
                    quiet_hours_end: data.quiet_hours_end ? new Date(`1970-01-01T${data.quiet_hours_end}`) : null,
                    updated_at: new Date(),
                },
                create: {
                    user_id: user.user_id,
                    company_id: user.company_id,
                    email_payment_reminders: data.email_payment_reminders,
                    email_payment_receipts: data.email_payment_receipts,
                    email_lease_updates: data.email_lease_updates,
                    email_maintenance_updates: data.email_maintenance_updates,
                    email_property_announcements: data.email_property_announcements,
                    email_messages_from_landlord: data.email_messages_from_landlord,
                    email_marketing: data.email_marketing,
                    sms_payment_due_alerts: data.sms_payment_due_alerts,
                    sms_urgent_maintenance: data.sms_urgent_maintenance,
                    sms_security_alerts: data.sms_security_alerts,
                    email_digest_frequency: data.email_digest_frequency,
                    quiet_hours_start: data.quiet_hours_start ? new Date(`1970-01-01T${data.quiet_hours_start}`) : null,
                    quiet_hours_end: data.quiet_hours_end ? new Date(`1970-01-01T${data.quiet_hours_end}`) : null,
                },
            });
            return settings;
        }
        catch (error) {
            console.error('Error updating notification settings:', error);
            throw new Error('Failed to update notification settings');
        }
    }
    /**
     * Change user password
     */
    async changePassword(user, currentPassword, newPassword) {
        try {
            // Get user
            const dbUser = await this.prisma.user.findUnique({
                where: { id: user.user_id },
            });
            if (!dbUser || !dbUser.password_hash) {
                throw new Error('User not found');
            }
            // Verify current password
            const isValidPassword = await bcrypt.compare(currentPassword, dbUser.password_hash);
            if (!isValidPassword) {
                throw new Error('Current password is incorrect');
            }
            // Hash new password
            const newPasswordHash = await bcrypt.hash(newPassword, 10);
            // Update password
            await this.prisma.user.update({
                where: { id: user.user_id },
                data: {
                    password_hash: newPasswordHash,
                    updated_at: new Date(),
                },
            });
            // Log security activity
            await this.logSecurityActivity(user, 'password_change', 'Password changed successfully');
            return { success: true, message: 'Password changed successfully' };
        }
        catch (error) {
            console.error('Error changing password:', error);
            throw error;
        }
    }
    /**
     * Get active sessions for user
     */
    async getActiveSessions(user, currentSessionId) {
        try {
            const sessions = await this.prisma.securitySession.findMany({
                where: {
                    user_id: user.user_id,
                    expires_at: {
                        gt: new Date(),
                    },
                },
                orderBy: {
                    last_active: 'desc',
                },
            });
            // Mark current session
            if (currentSessionId) {
                sessions.forEach((session) => {
                    session.is_current = session.session_id === currentSessionId;
                });
            }
            return sessions;
        }
        catch (error) {
            console.error('Error getting active sessions:', error);
            throw new Error('Failed to retrieve active sessions');
        }
    }
    /**
     * Revoke a specific session
     */
    async revokeSession(user, sessionId) {
        try {
            await this.prisma.securitySession.delete({
                where: {
                    session_id: sessionId,
                    user_id: user.user_id, // Ensure user can only revoke their own sessions
                },
            });
            // Log security activity
            await this.logSecurityActivity(user, 'session_revoked', `Session ${sessionId} revoked`);
            return { success: true, message: 'Session revoked successfully' };
        }
        catch (error) {
            console.error('Error revoking session:', error);
            throw new Error('Failed to revoke session');
        }
    }
    /**
     * Revoke all sessions except current
     */
    async revokeAllOtherSessions(user, currentSessionId) {
        try {
            const result = await this.prisma.securitySession.deleteMany({
                where: {
                    user_id: user.user_id,
                    session_id: {
                        not: currentSessionId,
                    },
                },
            });
            // Log security activity
            await this.logSecurityActivity(user, 'all_sessions_revoked', `Revoked ${result.count} sessions`);
            return { success: true, message: `Revoked ${result.count} sessions`, count: result.count };
        }
        catch (error) {
            console.error('Error revoking all sessions:', error);
            throw new Error('Failed to revoke sessions');
        }
    }
    /**
     * Get security activity log
     */
    async getSecurityActivity(user, limit = 20) {
        try {
            const activities = await this.prisma.securityActivityLog.findMany({
                where: {
                    user_id: user.user_id,
                },
                orderBy: {
                    created_at: 'desc',
                },
                take: limit,
            });
            return activities;
        }
        catch (error) {
            console.error('Error getting security activity:', error);
            throw new Error('Failed to retrieve security activity');
        }
    }
    /**
     * Log security activity
     */
    async logSecurityActivity(user, activityType, description, metadata) {
        try {
            await this.prisma.securityActivityLog.create({
                data: {
                    user_id: user.user_id,
                    activity_type: activityType,
                    activity_description: description,
                    device_type: metadata?.device_type || 'browser',
                    device_name: metadata?.device_name || 'Unknown',
                    ip_address: metadata?.ip_address,
                    location: metadata?.location,
                    user_agent: metadata?.user_agent,
                    success: true,
                    metadata: metadata || {},
                },
            });
        }
        catch (error) {
            console.error('Error logging security activity:', error);
        }
    }
    /**
     * Get 2FA settings
     */
    async get2FASettings(user) {
        try {
            const settings = await this.prisma.twoFactorAuth.findMany({
                where: {
                    user_id: user.user_id,
                },
            });
            // Hide sensitive data
            return settings.map((setting) => ({
                id: setting.id,
                method: setting.method,
                is_enabled: setting.is_enabled,
                phone_number: setting.phone_number ? `***${setting.phone_number.slice(-4)}` : null,
                enabled_at: setting.enabled_at,
                last_used_at: setting.last_used_at,
            }));
        }
        catch (error) {
            console.error('Error getting 2FA settings:', error);
            throw new Error('Failed to retrieve 2FA settings');
        }
    }
    /**
     * Enable 2FA (SMS)
     */
    async enable2FA(user, method, phoneNumber) {
        try {
            // For SMS, we need a phone number
            if (method === 'sms' && !phoneNumber) {
                throw new Error('Phone number is required for SMS authentication');
            }
            const twoFactor = await this.prisma.twoFactorAuth.upsert({
                where: {
                    user_id_method: {
                        user_id: user.user_id,
                        method: method,
                    },
                },
                update: {
                    is_enabled: true,
                    phone_number: phoneNumber,
                    enabled_at: new Date(),
                    updated_at: new Date(),
                },
                create: {
                    user_id: user.user_id,
                    method: method,
                    is_enabled: true,
                    phone_number: phoneNumber,
                    enabled_at: new Date(),
                },
            });
            // Log security activity
            await this.logSecurityActivity(user, '2fa_enabled', `Two-factor authentication enabled (${method})`);
            return twoFactor;
        }
        catch (error) {
            console.error('Error enabling 2FA:', error);
            throw new Error('Failed to enable two-factor authentication');
        }
    }
    /**
     * Disable 2FA
     */
    async disable2FA(user, method) {
        try {
            await this.prisma.twoFactorAuth.updateMany({
                where: {
                    user_id: user.user_id,
                    method: method,
                },
                data: {
                    is_enabled: false,
                    updated_at: new Date(),
                },
            });
            // Log security activity
            await this.logSecurityActivity(user, '2fa_disabled', `Two-factor authentication disabled (${method})`);
            return { success: true, message: 'Two-factor authentication disabled' };
        }
        catch (error) {
            console.error('Error disabling 2FA:', error);
            throw new Error('Failed to disable two-factor authentication');
        }
    }
    /**
     * Create or update security session (called during login)
     */
    async createOrUpdateSession(userId, sessionId, deviceInfo, expiresAt) {
        try {
            await this.prisma.securitySession.upsert({
                where: { session_id: sessionId },
                update: {
                    last_active: new Date(),
                    expires_at: expiresAt,
                },
                create: {
                    user_id: userId,
                    session_id: sessionId,
                    device_type: deviceInfo.device_type || 'browser',
                    device_name: deviceInfo.device_name || 'Unknown Device',
                    ip_address: deviceInfo.ip_address,
                    location: deviceInfo.location,
                    user_agent: deviceInfo.user_agent,
                    is_current: false,
                    expires_at: expiresAt,
                },
            });
        }
        catch (error) {
            console.error('Error creating/updating session:', error);
        }
    }
}
