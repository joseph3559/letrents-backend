import { Request, Response } from 'express';
import { verificationService } from '../services/verification.service.js';
import { writeSuccess, writeError } from '../utils/response.js';

export const verificationController = {
  /**
   * Verify a payment receipt
   * GET /verify/receipt/:receiptNumber
   */
  verifyReceipt: async (req: Request, res: Response) => {
    try {
      const { receiptNumber } = req.params;
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return writeError(res, 400, 'Verification token is required');
      }

      const result = await verificationService.verifyReceipt(receiptNumber, token);
      
      if (!result.valid) {
        return res.status(200).json({
          success: false,
          documentType: result.documentType,
          documentNumber: result.documentNumber,
          status: result.status,
          message: result.message,
        });
      }

      return writeSuccess(res, 200, 'Receipt verified successfully', result);
    } catch (error: any) {
      console.error('Error verifying receipt:', error);
      return writeError(res, 500, error.message || 'Failed to verify receipt');
    }
  },

  /**
   * Verify an invoice
   * GET /verify/invoice/:invoiceNumber
   */
  verifyInvoice: async (req: Request, res: Response) => {
    try {
      const { invoiceNumber } = req.params;
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return writeError(res, 400, 'Verification token is required');
      }

      const result = await verificationService.verifyInvoice(invoiceNumber, token);
      
      if (!result.valid) {
        return res.status(200).json({
          success: false,
          ...result,
        });
      }

      return writeSuccess(res, 200, 'Invoice verified successfully', result);
    } catch (error: any) {
      console.error('Error verifying invoice:', error);
      return writeError(res, 500, error.message || 'Failed to verify invoice');
    }
  },

  /**
   * Verify a refund receipt
   * GET /verify/refund/:receiptNumber
   */
  verifyRefund: async (req: Request, res: Response) => {
    try {
      const { receiptNumber } = req.params;
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return writeError(res, 400, 'Verification token is required');
      }

      const result = await verificationService.verifyRefund(receiptNumber, token);
      
      if (!result.valid) {
        return res.status(200).json({
          success: false,
          ...result,
        });
      }

      return writeSuccess(res, 200, 'Refund receipt verified successfully', result);
    } catch (error: any) {
      console.error('Error verifying refund:', error);
      return writeError(res, 500, error.message || 'Failed to verify refund receipt');
    }
  },
};
