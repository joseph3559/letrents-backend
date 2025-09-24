import { Request, Response } from 'express';
import { careteakersService } from '../services/caretakers.service.js';
import { writeSuccess, writeError } from '../utils/response.js';
import { JWTClaims } from '../types/index.js';

export const careteakersController = {
  getCaretakers: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const filters = req.query;
      const caretakers = await careteakersService.getCaretakers(user, filters);
      writeSuccess(res, 200, 'Caretakers retrieved successfully', caretakers);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  createCaretaker: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const caretakerData = req.body;
      const caretaker = await careteakersService.createCaretaker(user, caretakerData);
      writeSuccess(res, 201, 'Caretaker created successfully', caretaker);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  getCaretaker: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { id } = req.params;
      const caretaker = await careteakersService.getCaretaker(user, id);
      
      if (!caretaker) {
        return writeError(res, 404, 'Caretaker not found');
      }
      
      writeSuccess(res, 200, 'Caretaker retrieved successfully', caretaker);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  updateCaretaker: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { id } = req.params;
      const updateData = req.body;
      const caretaker = await careteakersService.updateCaretaker(user, id, updateData);
      writeSuccess(res, 200, 'Caretaker updated successfully', caretaker);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  deleteCaretaker: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { id } = req.params;
      await careteakersService.deleteCaretaker(user, id);
      writeSuccess(res, 200, 'Caretaker deleted successfully');
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  inviteCaretaker: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { id } = req.params;
      const result = await careteakersService.inviteCaretaker(user, id);
      writeSuccess(res, 200, 'Caretaker invitation sent successfully', result);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  resetPassword: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { id } = req.params;
      const result = await careteakersService.resetPassword(user, id);
      writeSuccess(res, 200, 'Password reset initiated successfully', result);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },
};
