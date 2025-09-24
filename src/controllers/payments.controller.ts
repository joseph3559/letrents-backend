import { Request, Response } from 'express';
import { 
  PaymentsService, 
  CreatePaymentRequest, 
  UpdatePaymentRequest,
  PaymentFilters 
} from '../services/payments.service.js';
import { JWTClaims } from '../types/index.js';
import { writeSuccess, writeError } from '../utils/response.js';

const service = new PaymentsService();

export const listPayments = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { page = 1, limit = 10, ...filters } = req.query;

    const result = await service.listPayments(
      filters as PaymentFilters,
      user,
      Number(page),
      Number(limit)
    );

    writeSuccess(res, 200, 'Payments retrieved successfully', result);
  } catch (error: any) {
    const message = error.message || 'Failed to retrieve payments';
    const status = message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};

export const getPayment = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;

    if (!id) {
      return writeError(res, 400, 'Payment ID is required');
    }

    const payment = await service.getPayment(id, user);
    writeSuccess(res, 200, 'Payment retrieved successfully', payment);
  } catch (error: any) {
    const message = error.message || 'Failed to retrieve payment';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};

export const createPayment = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const paymentData: CreatePaymentRequest = req.body;

    // Validate required fields
    if (!paymentData.tenant_id || !paymentData.amount || !paymentData.payment_method || !paymentData.payment_type) {
      return writeError(res, 400, 'Tenant ID, amount, payment method, and payment type are required');
    }

    const payment = await service.createPayment(paymentData, user);
    writeSuccess(res, 201, 'Payment created successfully', payment);
  } catch (error: any) {
    const message = error.message || 'Failed to create payment';
    const status = message.includes('permissions') ? 403 :
                  message.includes('not found') ? 404 : 500;
    writeError(res, status, message);
  }
};

export const updatePayment = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;
    const updateData: UpdatePaymentRequest = req.body;

    if (!id) {
      return writeError(res, 400, 'Payment ID is required');
    }

    const payment = await service.updatePayment(id, updateData, user);
    writeSuccess(res, 200, 'Payment updated successfully', payment);
  } catch (error: any) {
    const message = error.message || 'Failed to update payment';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};

export const approvePayment = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;
    const { approval_notes } = req.body;

    if (!id) {
      return writeError(res, 400, 'Payment ID is required');
    }

    const payment = await service.approvePayment(id, { approval_notes }, user);
    writeSuccess(res, 200, 'Payment approved successfully', payment);
  } catch (error: any) {
    const message = error.message || 'Failed to approve payment';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 :
                  message.includes('only pending') ? 400 : 500;
    writeError(res, status, message);
  }
};

export const deletePayment = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;

    if (!id) {
      return writeError(res, 400, 'Payment ID is required');
    }

    await service.deletePayment(id, user);
    writeSuccess(res, 200, 'Payment deleted successfully', null);
  } catch (error: any) {
    const message = error.message || 'Failed to delete payment';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 :
                  message.includes('cannot delete') ? 400 : 500;
    writeError(res, status, message);
  }
};

// Tenant-specific payment endpoints
export const getTenantPayments = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id: tenantId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!tenantId) {
      return writeError(res, 400, 'Tenant ID is required');
    }

    const filters: PaymentFilters = { tenant_id: tenantId };
    const result = await service.listPayments(filters, user, Number(page), Number(limit));

    writeSuccess(res, 200, 'Tenant payments retrieved successfully', result);
  } catch (error: any) {
    const message = error.message || 'Failed to retrieve tenant payments';
    const status = message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};

export const createTenantPayment = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id: tenantId } = req.params;
    const paymentData: CreatePaymentRequest = { ...req.body, tenant_id: tenantId };

    if (!tenantId) {
      return writeError(res, 400, 'Tenant ID is required');
    }

    // Validate required fields
    if (!paymentData.amount || !paymentData.payment_method || !paymentData.payment_type) {
      return writeError(res, 400, 'Amount, payment method, and payment type are required');
    }

    const payment = await service.createPayment(paymentData, user);
    writeSuccess(res, 201, 'Tenant payment created successfully', payment);
  } catch (error: any) {
    const message = error.message || 'Failed to create tenant payment';
    const status = message.includes('permissions') ? 403 :
                  message.includes('not found') ? 404 : 500;
    writeError(res, status, message);
  }
};
