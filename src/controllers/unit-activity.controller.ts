import { Request, Response } from 'express';
import { UnitActivityService } from '../services/unit-activity.service.js';
import { JWTClaims } from '../types/index.js';
import { writeError, writeSuccess } from '../utils/response.js';

const service = new UnitActivityService();

export const getUnitActivity = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id: unitId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

    if (!unitId) {
      return writeError(res, 400, 'Unit ID is required');
    }

    const activities = await service.listUnitActivity(unitId, user, limit);

    writeSuccess(res, 200, 'Unit activity retrieved successfully', activities);
  } catch (error: any) {
    const message = error.message || 'Failed to get unit activity';
    writeError(res, 500, message);
  }
};
