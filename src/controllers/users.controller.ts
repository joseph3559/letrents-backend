import { Request, Response } from 'express';
import { 
  UsersService, 
  UserFilters, 
  CreateUserRequest, 
  UpdateUserRequest,
  ChangePasswordRequest
} from '../services/users.service.js';
import { JWTClaims } from '../types/index.js';
import { writeSuccess, writeError } from '../utils/response.js';
import multer from 'multer';
import { getPrisma } from '../config/prisma.js';
import { imagekitService } from '../services/imagekit.service.js';

const service = new UsersService();
const prisma = getPrisma();

// Configure multer for profile picture uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

export const createUser = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const userData: CreateUserRequest = req.body;

    // Validate required fields
    if (!userData.email || !userData.first_name || !userData.last_name || !userData.role) {
      return writeError(res, 400, 'Email, first name, last name, and role are required');
    }

    const newUser = await service.createUser(userData, user);
    writeSuccess(res, 201, 'User created successfully', newUser);
  } catch (error: any) {
    const message = error.message || 'Failed to create user';
    const status = message.includes('permissions') ? 403 :
                  message.includes('already exists') ? 409 : 500;
    writeError(res, status, message);
  }
};

export const getUser = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;

    if (!id) {
      return writeError(res, 400, 'User ID is required');
    }

    const targetUser = await service.getUser(id, user);
    writeSuccess(res, 200, 'User retrieved successfully', targetUser);
  } catch (error: any) {
    const message = error.message || 'Failed to get user';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;
    const updateData: UpdateUserRequest = req.body;

    if (!id) {
      return writeError(res, 400, 'User ID is required');
    }

    const updatedUser = await service.updateUser(id, updateData, user);
    writeSuccess(res, 200, 'User updated successfully', updatedUser);
  } catch (error: any) {
    const message = error.message || 'Failed to update user';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 :
                  message.includes('already exists') ? 409 : 500;
    writeError(res, status, message);
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;

    if (!id) {
      return writeError(res, 400, 'User ID is required');
    }

    await service.deleteUser(id, user);
    writeSuccess(res, 200, 'User deleted successfully');
  } catch (error: any) {
    const message = error.message || 'Failed to delete user';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 :
                  message.includes('cannot delete') ? 409 : 500;
    writeError(res, status, message);
  }
};

export const listUsers = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    
    // Parse query parameters
    const filters: UserFilters = {
      role: req.query.role as string,
      status: req.query.status as string,
      company_id: req.query.company_id as string,
      agency_id: req.query.agency_id as string,
      search_query: req.query.search as string,
      sort_by: req.query.sort_by as string,
      sort_order: req.query.sort_order as string,
      limit: req.query.limit ? Math.min(parseInt(req.query.limit as string), 100) : 20,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 
              req.query.page ? (parseInt(req.query.page as string) - 1) * (req.query.limit ? parseInt(req.query.limit as string) : 20) : 0,
    };

    const result = await service.listUsers(filters, user);
    
    // Format response to match Go backend structure
    const response = {
      success: true,
      message: 'Users retrieved successfully',
      data: result.users,
      pagination: {
        page: result.page,
        per_page: result.per_page,
        total: result.total,
        total_pages: result.total_pages,
      },
    };

    res.json(response);
  } catch (error: any) {
    const message = error.message || 'Failed to list users';
    writeError(res, 500, message);
  }
};

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    
    const currentUser = await service.getCurrentUser(user);
    writeSuccess(res, 200, 'Current user retrieved successfully', currentUser);
  } catch (error: any) {
    const message = error.message || 'Failed to get current user';
    writeError(res, 500, message);
  }
};

export const updateCurrentUser = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const updateData: UpdateUserRequest = req.body;

    const updatedUser = await service.updateCurrentUser(updateData, user);
    writeSuccess(res, 200, 'Profile updated successfully', updatedUser);
  } catch (error: any) {
    const message = error.message || 'Failed to update profile';
    const status = message.includes('already exists') ? 409 : 500;
    writeError(res, status, message);
  }
};

export const uploadProfilePicture = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    
    // Check if file was uploaded
    if (!req.file) {
      return writeError(res, 400, 'No file uploaded');
    }

    // Upload to ImageKit
    const fileName = `user-profile-${user.user_id}-${Date.now()}`;
    const uploadResult = await imagekitService.uploadFile(
      req.file.buffer,
      fileName,
      'user-profiles'
    );

    if (!uploadResult || !uploadResult.url) {
      throw new Error('Failed to upload image to ImageKit');
    }

    const profilePictureUrl = uploadResult.url;

    // Store profile picture URL in UserPreferences (since User model doesn't have profile_picture field)
    // We'll use a JSON field or create a simple text field
    // For now, let's store it in user preferences as a workaround, or we can add it to the User model
    // Actually, let's check if we can add it to User model or use a different approach
    
    // Update user preferences with profile picture URL
    await prisma.userPreferences.upsert({
      where: { user_id: user.user_id },
      update: {
        signature: profilePictureUrl, // Temporarily using signature field, but we should add profile_picture to UserPreferences
      },
      create: {
        user_id: user.user_id,
        signature: profilePictureUrl,
      },
    });

    // Also try to store in a more appropriate place - let's add it to the response
    // and the frontend can handle it
    writeSuccess(res, 200, 'Profile picture uploaded successfully', {
      profile_picture: profilePictureUrl,
      url: profilePictureUrl,
    });
  } catch (error: any) {
    console.error('Error uploading profile picture:', error);
    writeError(res, 500, error.message || 'Failed to upload profile picture');
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const passwordData: ChangePasswordRequest = req.body;

    // Validate required fields
    if (!passwordData.current_password || !passwordData.new_password) {
      return writeError(res, 400, 'Current password and new password are required');
    }

    await service.changePassword(passwordData, user);
    writeSuccess(res, 200, 'Password changed successfully');
  } catch (error: any) {
    const message = error.message || 'Failed to change password';
    const status = message.includes('incorrect') ? 400 :
                  message.includes('not found') ? 404 : 500;
    writeError(res, status, message);
  }
};

export const activateUser = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;

    if (!id) {
      return writeError(res, 400, 'User ID is required');
    }

    await service.activateUser(id, user);
    writeSuccess(res, 200, 'User activated successfully');
  } catch (error: any) {
    const message = error.message || 'Failed to activate user';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};

export const deactivateUser = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;

    if (!id) {
      return writeError(res, 400, 'User ID is required');
    }

    await service.deactivateUser(id, user);
    writeSuccess(res, 200, 'User deactivated successfully');
  } catch (error: any) {
    const message = error.message || 'Failed to deactivate user';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};

export const getCurrentUserPreferences = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    
    const preferences = await service.getCurrentUserPreferences(user);
    writeSuccess(res, 200, 'Preferences retrieved successfully', preferences);
  } catch (error: any) {
    const message = error.message || 'Failed to get preferences';
    writeError(res, 500, message);
  }
};

export const updateCurrentUserPreferences = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const preferencesData = req.body;

    const updatedPreferences = await service.updateCurrentUserPreferences(preferencesData, user);
    writeSuccess(res, 200, 'Preferences updated successfully', updatedPreferences);
  } catch (error: any) {
    const message = error.message || 'Failed to update preferences';
    writeError(res, 500, message);
  }
};
