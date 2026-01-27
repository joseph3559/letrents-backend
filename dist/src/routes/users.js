import { Router } from 'express';
import { createUser, getUser, updateUser, deleteUser, listUsers, getCurrentUser, updateCurrentUser, changePassword, activateUser, deactivateUser, getCurrentUserPreferences, updateCurrentUserPreferences, uploadProfilePicture, upgradeToAgency, registerPushToken, unregisterPushToken } from '../controllers/users.controller.js';
import multer from 'multer';
// Configure multer for profile picture uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only image files are allowed'));
        }
    },
});
import { getUserPreferences, getUserNotificationSettings, getUserSecurityActivity, getTenantsCommunicationPreferences } from '../controllers/user-settings.controller.js';
import { rbacResource } from '../middleware/rbac.js';
const router = Router();
// User CRUD operations
router.post('/', rbacResource('users', 'create'), createUser);
router.get('/', rbacResource('users', 'read'), listUsers);
router.get('/me', getCurrentUser); // No RBAC needed - users can always access their own profile
router.put('/me', updateCurrentUser); // No RBAC needed - users can always update their own profile
router.put('/me/password', changePassword); // No RBAC needed - users can always change their own password
router.post('/me/profile-picture', upload.single('file'), uploadProfilePicture); // No RBAC needed - users can upload their own profile picture
router.post('/me/upgrade-to-agency', upgradeToAgency);
router.post('/me/push-token', registerPushToken);
router.post('/me/push-token/unregister', unregisterPushToken);
// User Preferences
router.get('/me/preferences', getCurrentUserPreferences); // No RBAC needed - users can access their own preferences
router.put('/me/preferences', updateCurrentUserPreferences); // No RBAC needed - users can update their own preferences
router.get('/:id', rbacResource('users', 'read'), getUser);
router.put('/:id', rbacResource('users', 'update'), updateUser);
router.delete('/:id', rbacResource('users', 'delete'), deleteUser);
// Admin user management
router.put('/:id/activate', rbacResource('users', 'activate'), activateUser);
router.put('/:id/deactivate', rbacResource('users', 'deactivate'), deactivateUser);
// User Settings Access (for landlords/staff/admins viewing tenant/user settings)
// These routes allow authorized users to view settings of users they manage
router.get('/tenants/communication-preferences', getTenantsCommunicationPreferences); // Get all tenants' communication preferences
router.get('/:userId/preferences', getUserPreferences); // Get specific user's preferences
router.get('/:userId/notification-settings', getUserNotificationSettings); // Get specific user's notification settings
router.get('/:userId/security-activity', getUserSecurityActivity); // Get specific user's security activity
export default router;
