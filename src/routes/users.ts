import { Router } from 'express';
import { 
  createUser, 
  getUser, 
  updateUser, 
  deleteUser, 
  listUsers,
  getCurrentUser,
  updateCurrentUser,
  changePassword,
  activateUser,
  deactivateUser
} from '../controllers/users.controller.js';
import { rbacResource } from '../middleware/rbac.js';

const router = Router();

// User CRUD operations
router.post('/', rbacResource('users', 'create'), createUser);
router.get('/', rbacResource('users', 'read'), listUsers);
router.get('/me', getCurrentUser); // No RBAC needed - users can always access their own profile
router.put('/me', updateCurrentUser); // No RBAC needed - users can always update their own profile
router.put('/me/password', changePassword); // No RBAC needed - users can always change their own password
router.get('/:id', rbacResource('users', 'read'), getUser);
router.put('/:id', rbacResource('users', 'update'), updateUser);
router.delete('/:id', rbacResource('users', 'delete'), deleteUser);

// Admin user management
router.put('/:id/activate', rbacResource('users', 'activate'), activateUser);
router.put('/:id/deactivate', rbacResource('users', 'deactivate'), deactivateUser);

export default router;
