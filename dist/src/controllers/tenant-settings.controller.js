import { TenantSettingsService } from '../services/tenant-settings.service.js';
const settingsService = new TenantSettingsService();
/**
 * Get tenant preferences
 */
export const getTenantPreferences = async (req, res) => {
    try {
        const user = req.user;
        if (user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Tenant role required.',
            });
        }
        const preferences = await settingsService.getPreferences(user);
        res.json({
            success: true,
            data: preferences,
        });
    }
    catch (error) {
        console.error('Error getting tenant preferences:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to retrieve preferences',
        });
    }
};
/**
 * Update tenant preferences
 */
export const updateTenantPreferences = async (req, res) => {
    try {
        const user = req.user;
        if (user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Tenant role required.',
            });
        }
        const preferences = await settingsService.updatePreferences(user, req.body);
        res.json({
            success: true,
            data: preferences,
            message: 'Preferences updated successfully',
        });
    }
    catch (error) {
        console.error('Error updating tenant preferences:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update preferences',
        });
    }
};
/**
 * Get notification settings
 */
export const getNotificationSettings = async (req, res) => {
    try {
        const user = req.user;
        if (user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Tenant role required.',
            });
        }
        const settings = await settingsService.getNotificationSettings(user);
        res.json({
            success: true,
            data: settings,
        });
    }
    catch (error) {
        console.error('Error getting notification settings:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to retrieve notification settings',
        });
    }
};
/**
 * Update notification settings
 */
export const updateNotificationSettings = async (req, res) => {
    try {
        const user = req.user;
        if (user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Tenant role required.',
            });
        }
        const settings = await settingsService.updateNotificationSettings(user, req.body);
        res.json({
            success: true,
            data: settings,
            message: 'Notification settings updated successfully',
        });
    }
    catch (error) {
        console.error('Error updating notification settings:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update notification settings',
        });
    }
};
/**
 * Change password
 */
export const changePassword = async (req, res) => {
    try {
        const user = req.user;
        if (user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Tenant role required.',
            });
        }
        const { currentPassword, newPassword, confirmPassword } = req.body;
        // Validate input
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'All password fields are required',
            });
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'New passwords do not match',
            });
        }
        // Password strength validation
        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long',
            });
        }
        const result = await settingsService.changePassword(user, currentPassword, newPassword);
        res.json({
            success: true,
            message: result.message,
        });
    }
    catch (error) {
        console.error('Error changing password:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to change password',
        });
    }
};
/**
 * Get active sessions
 */
export const getActiveSessions = async (req, res) => {
    try {
        const user = req.user;
        if (user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Tenant role required.',
            });
        }
        const currentSessionId = user.session_id;
        const sessions = await settingsService.getActiveSessions(user, currentSessionId);
        res.json({
            success: true,
            data: sessions,
            count: sessions.length,
        });
    }
    catch (error) {
        console.error('Error getting active sessions:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to retrieve sessions',
        });
    }
};
/**
 * Revoke a session
 */
export const revokeSession = async (req, res) => {
    try {
        const user = req.user;
        if (user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Tenant role required.',
            });
        }
        const { sessionId } = req.params;
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Session ID is required',
            });
        }
        const result = await settingsService.revokeSession(user, sessionId);
        res.json({
            success: true,
            message: result.message,
        });
    }
    catch (error) {
        console.error('Error revoking session:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to revoke session',
        });
    }
};
/**
 * Revoke all other sessions
 */
export const revokeAllOtherSessions = async (req, res) => {
    try {
        const user = req.user;
        if (user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Tenant role required.',
            });
        }
        const currentSessionId = user.session_id;
        const result = await settingsService.revokeAllOtherSessions(user, currentSessionId);
        res.json({
            success: true,
            message: result.message,
            count: result.count,
        });
    }
    catch (error) {
        console.error('Error revoking all sessions:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to revoke sessions',
        });
    }
};
/**
 * Get security activity log
 */
export const getSecurityActivity = async (req, res) => {
    try {
        const user = req.user;
        if (user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Tenant role required.',
            });
        }
        const limit = req.query.limit ? parseInt(req.query.limit) : 20;
        const activities = await settingsService.getSecurityActivity(user, limit);
        res.json({
            success: true,
            data: activities,
            count: activities.length,
        });
    }
    catch (error) {
        console.error('Error getting security activity:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to retrieve security activity',
        });
    }
};
/**
 * Get 2FA settings
 */
export const get2FASettings = async (req, res) => {
    try {
        const user = req.user;
        if (user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Tenant role required.',
            });
        }
        const settings = await settingsService.get2FASettings(user);
        res.json({
            success: true,
            data: settings,
        });
    }
    catch (error) {
        console.error('Error getting 2FA settings:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to retrieve 2FA settings',
        });
    }
};
/**
 * Enable 2FA
 */
export const enable2FA = async (req, res) => {
    try {
        const user = req.user;
        if (user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Tenant role required.',
            });
        }
        const { method, phoneNumber } = req.body;
        if (!method) {
            return res.status(400).json({
                success: false,
                message: 'Authentication method is required',
            });
        }
        const result = await settingsService.enable2FA(user, method, phoneNumber);
        res.json({
            success: true,
            data: result,
            message: 'Two-factor authentication enabled successfully',
        });
    }
    catch (error) {
        console.error('Error enabling 2FA:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to enable 2FA',
        });
    }
};
/**
 * Disable 2FA
 */
export const disable2FA = async (req, res) => {
    try {
        const user = req.user;
        if (user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Tenant role required.',
            });
        }
        const { method } = req.body;
        if (!method) {
            return res.status(400).json({
                success: false,
                message: 'Authentication method is required',
            });
        }
        const result = await settingsService.disable2FA(user, method);
        res.json({
            success: true,
            message: result.message,
        });
    }
    catch (error) {
        console.error('Error disabling 2FA:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to disable 2FA',
        });
    }
};
