import { TenantSettingsService } from '../services/tenant-settings.service.js';
const settingsService = new TenantSettingsService();
/**
 * Get any user's preferences (for landlords/staff/admins)
 * Requires appropriate permissions
 */
export const getUserPreferences = async (req, res) => {
    try {
        const user = req.user;
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required',
            });
        }
        const preferences = await settingsService.getUserPreferences(user, userId);
        if (!preferences) {
            return res.status(404).json({
                success: false,
                message: 'User preferences not found',
            });
        }
        res.json({
            success: true,
            data: preferences,
        });
    }
    catch (error) {
        console.error('Error getting user preferences:', error);
        if (error.message.includes('Permission denied')) {
            return res.status(403).json({
                success: false,
                message: error.message,
            });
        }
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to retrieve user preferences',
        });
    }
};
/**
 * Get any user's notification settings (for landlords/staff/admins)
 * Requires appropriate permissions
 */
export const getUserNotificationSettings = async (req, res) => {
    try {
        const user = req.user;
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required',
            });
        }
        const settings = await settingsService.getUserNotificationSettings(user, userId);
        if (!settings) {
            return res.status(404).json({
                success: false,
                message: 'User notification settings not found',
            });
        }
        res.json({
            success: true,
            data: settings,
        });
    }
    catch (error) {
        console.error('Error getting user notification settings:', error);
        if (error.message.includes('Permission denied')) {
            return res.status(403).json({
                success: false,
                message: error.message,
            });
        }
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to retrieve user notification settings',
        });
    }
};
/**
 * Get security activity for any user (for landlords/staff/admins)
 * Requires appropriate permissions
 */
export const getUserSecurityActivity = async (req, res) => {
    try {
        const user = req.user;
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required',
            });
        }
        // Create a temporary claims object for the target user
        const targetUserClaims = {
            ...user,
            user_id: userId,
        };
        // Check permission first
        const hasPermission = await settingsService.checkPermission(user, userId);
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'Permission denied: You do not have access to view this user\'s security activity',
            });
        }
        const limit = req.query.limit ? parseInt(req.query.limit) : 20;
        const activities = await settingsService.getSecurityActivity(targetUserClaims, limit);
        res.json({
            success: true,
            data: activities,
            count: activities.length,
        });
    }
    catch (error) {
        console.error('Error getting user security activity:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to retrieve security activity',
        });
    }
};
/**
 * Get all tenants' notification preferences (for landlords)
 * Used to see how tenants prefer to be contacted
 */
export const getTenantsCommunicationPreferences = async (req, res) => {
    try {
        const user = req.user;
        // Only landlords, property managers, and admins can access this
        if (!['landlord', 'property_manager', 'super_admin'].includes(user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
            });
        }
        const tenants = await settingsService.prisma.user.findMany({
            where: {
                role: 'tenant',
                ...(user.role === 'landlord' && { landlord_id: user.user_id }),
                ...(user.company_id && { company_id: user.company_id }),
                status: 'active',
            },
            select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
                phone_number: true,
                tenant_preferences: {
                    select: {
                        primary_contact_method: true,
                        enable_email: true,
                        enable_sms: true,
                        enable_push_notifications: true,
                        language: true,
                    },
                },
                tenant_notification_settings: {
                    select: {
                        email_messages_from_landlord: true,
                        sms_urgent_maintenance: true,
                        email_digest_frequency: true,
                        quiet_hours_start: true,
                        quiet_hours_end: true,
                    },
                },
            },
        });
        res.json({
            success: true,
            data: tenants,
            count: tenants.length,
        });
    }
    catch (error) {
        console.error('Error getting tenants communication preferences:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to retrieve communication preferences',
        });
    }
};
