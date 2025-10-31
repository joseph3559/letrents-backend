import { Request, Response } from 'express';
import { CleanupService } from '../services/cleanup.service.js';
import { writeSuccess, writeError } from '../utils/response.js';
import { JWTClaims } from '../types/index.js';

const service = new CleanupService();

/**
 * Run cleanup tasks manually
 * Only accessible by super_admin
 */
export const runCleanup = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;

    // Only super admins can run cleanup
    if (user.role !== 'super_admin') {
      return writeError(res, 403, 'Only super admins can run cleanup tasks');
    }

    const result = await service.runCleanupTasks();
    writeSuccess(res, 200, 'Cleanup tasks completed successfully', result);
  } catch (error: any) {
    const message = error.message || 'Failed to run cleanup tasks';
    writeError(res, 500, message);
  }
};

/**
 * Get cleanup status
 */
export const getCleanupStatus = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;

    // Only super admins can view cleanup status
    if (user.role !== 'super_admin') {
      return writeError(res, 403, 'Only super admins can view cleanup status');
    }

    const status = await service.getCleanupStatus();
    writeSuccess(res, 200, 'Cleanup status retrieved successfully', status);
  } catch (error: any) {
    const message = error.message || 'Failed to get cleanup status';
    writeError(res, 500, message);
  }
};

