import { Request, Response } from 'express';
import { MpesaService, PaybillSettingsRequest, C2BTransactionData } from '../services/mpesa.service.js';
import { JWTClaims } from '../types/index.js';
import { writeSuccess, writeError } from '../utils/response.js';

const service = new MpesaService();

export const createPaybillSettings = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const settingsData: PaybillSettingsRequest = req.body;

    // Validate required fields
    if (!settingsData.paybillNumber || !settingsData.businessShortcode || !settingsData.consumerKey || !settingsData.consumerSecret) {
      return writeError(res, 400, 'Paybill number, business shortcode, consumer key, and consumer secret are required');
    }

    const settings = await service.createPaybillSettings(settingsData, user);
    writeSuccess(res, 201, 'Paybill settings created successfully', settings);
  } catch (error: any) {
    const message = error.message || 'Failed to create paybill settings';
    const status = message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};

export const getPaybillSettings = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const settings = await service.getPaybillSettings(user);
    
    if (!settings) {
      return writeError(res, 404, 'No paybill settings found');
    }

    writeSuccess(res, 200, 'Paybill settings retrieved successfully', settings);
  } catch (error: any) {
    const message = error.message || 'Failed to retrieve paybill settings';
    writeError(res, 500, message);
  }
};

export const getTransactions = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { page = 1, limit = 10, status, start_date, end_date } = req.query;

    const filters = {
      status: status as string,
      start_date: start_date as string,
      end_date: end_date as string,
    };

    const result = await service.getTransactions(user, Number(page), Number(limit), filters);
    writeSuccess(res, 200, 'M-Pesa transactions retrieved successfully', result);
  } catch (error: any) {
    const message = error.message || 'Failed to retrieve M-Pesa transactions';
    writeError(res, 500, message);
  }
};

export const getTransactionStats = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { period = 'monthly' } = req.query;

    const stats = await service.getTransactionStats(user, period as string);
    writeSuccess(res, 200, 'M-Pesa transaction statistics retrieved successfully', stats);
  } catch (error: any) {
    const message = error.message || 'Failed to retrieve M-Pesa transaction statistics';
    writeError(res, 500, message);
  }
};

export const reconcileTransaction = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;

    if (!id) {
      return writeError(res, 400, 'Transaction ID is required');
    }

    const payment = await service.reconcileTransaction(id, user);
    writeSuccess(res, 200, 'Transaction reconciled successfully', payment);
  } catch (error: any) {
    const message = error.message || 'Failed to reconcile transaction';
    const status = message.includes('not found') ? 404 :
                  message.includes('already reconciled') ? 400 : 500;
    writeError(res, status, message);
  }
};

// C2B Callback endpoints (called by Safaricom)
export const c2bValidation = async (req: Request, res: Response) => {
  try {
    const transactionData: C2BTransactionData = req.body;
    console.log('🔍 M-Pesa C2B Validation:', transactionData);

    const result = await service.validateC2BTransaction(transactionData);
    res.json(result);
  } catch (error: any) {
    console.error('Error in C2B validation:', error);
    res.json({
      ResultCode: 1,
      ResultDesc: 'Validation error',
    });
  }
};

export const c2bConfirmation = async (req: Request, res: Response) => {
  try {
    const transactionData: C2BTransactionData = req.body;
    console.log('🔍 M-Pesa C2B Confirmation:', transactionData);

    const result = await service.confirmC2BTransaction(transactionData);
    res.json(result);
  } catch (error: any) {
    console.error('Error in C2B confirmation:', error);
    res.json({
      ResultCode: 1,
      ResultDesc: 'Confirmation error',
    });
  }
};
