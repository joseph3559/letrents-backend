import { Request, Response } from 'express';
import { 
  PaymentsService, 
  CreatePaymentRequest, 
  UpdatePaymentRequest,
  PaymentFilters 
} from '../services/payments.service.js';
import { PaystackService } from '../services/paystack.service.js';
import { JWTClaims } from '../types/index.js';
import { writeSuccess, writeError } from '../utils/response.js';

const service = new PaymentsService();
const paystackService = new PaystackService();

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

export const sendPaymentReceipt = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id: paymentId } = req.params;
    const { tenant_id, tenant_email, tenant_name, send_email = true, send_in_app = true } = req.body;

    if (!paymentId) {
      return writeError(res, 400, 'Payment ID is required');
    }

    // Get the payment details
    const payment = await service.getPayment(paymentId, user);
    
    if (!payment) {
      return writeError(res, 404, 'Payment not found');
    }

    // Send email receipt if requested
    if (send_email && tenant_email) {
      const { emailService } = await import('../services/email.service.js');
      await emailService.sendPaymentReceipt({
        to: tenant_email,
        tenant_name: tenant_name || 'Valued Tenant',
        payment_amount: Number(payment.amount),
        payment_date: payment.payment_date.toISOString().split('T')[0],
        payment_method: payment.payment_method,
        receipt_number: payment.receipt_number || `RCP-${payment.id.substring(0, 8)}`,
        property_name: (payment as any).property?.name || 'Your Property',
        unit_number: (payment as any).unit?.unit_number || 'Your Unit',
      });
    }

    // Send in-app notification if requested
    if (send_in_app && tenant_id) {
      const { notificationsService } = await import('../services/notifications.service.js');
      await notificationsService.createNotification(user, {
        user_id: tenant_id,
        type: 'payment_receipt',
        title: 'Payment Receipt',
        message: `Receipt for your payment of KSh ${Number(payment.amount).toLocaleString()} has been generated.`,
        data: {
          payment_id: payment.id,
          amount: payment.amount,
          receipt_number: payment.receipt_number,
          payment_date: payment.payment_date,
        },
      });
    }

    writeSuccess(res, 200, 'Receipt sent successfully', { sent: true });
  } catch (error: any) {
    console.error('Error sending payment receipt:', error);
    const message = error.message || 'Failed to send payment receipt';
    writeError(res, 500, message);
  }
};

/**
 * Verify rent payment with Paystack
 */
export const verifyRentPayment = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { reference } = req.body;

    if (!reference) {
      return writeError(res, 400, 'Payment reference is required');
    }

    const result = await paystackService.verifyRentPayment(reference, user);
    
    writeSuccess(res, 200, 'Payment verified successfully', result);
  } catch (error: any) {
    const message = error.message || 'Failed to verify rent payment';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};

/**
 * Cleanup or manually update a pending payment
 */
export const updatePendingPayment = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;
    const { action } = req.body; // 'complete', 'cancel', or 'delete'

    if (!id) {
      return writeError(res, 400, 'Payment ID is required');
    }

    if (!action || !['complete', 'cancel', 'delete'].includes(action)) {
      return writeError(res, 400, 'Valid action is required: complete, cancel, or delete');
    }

    const payment = await service.getPayment(id, user);

    if (!payment) {
      return writeError(res, 404, 'Payment not found');
    }

    if (payment.status !== 'pending') {
      return writeError(res, 400, 'Only pending payments can be updated');
    }

    let updatedPayment;
    if (action === 'delete') {
      await service.deletePayment(id, user);
      return writeSuccess(res, 200, 'Pending payment deleted successfully', { id });
    } else if (action === 'complete') {
      updatedPayment = await service.updatePayment(id, {
        status: 'completed',
        payment_date: new Date().toISOString(),
        processed_by: user.user_id,
        processed_at: new Date().toISOString(),
        notes: payment.notes ? `${payment.notes} - Manually marked as completed` : 'Manually marked as completed',
      }, user);
    } else if (action === 'cancel') {
      updatedPayment = await service.updatePayment(id, {
        status: 'cancelled',
        notes: payment.notes ? `${payment.notes} - Cancelled` : 'Cancelled',
      }, user);
    }

    writeSuccess(res, 200, `Payment ${action}d successfully`, updatedPayment);
  } catch (error: any) {
    const message = error.message || 'Failed to update payment';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};

/**
 * Verify advance payment with Paystack
 */
export const verifyAdvancePayment = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { reference } = req.body;

    if (!reference) {
      return writeError(res, 400, 'Payment reference is required');
    }

    const result = await paystackService.processAdvancePayment(reference, user);
    
    writeSuccess(res, 200, 'Advance payment verified and processed successfully', result);
  } catch (error: any) {
    const message = error.message || 'Failed to verify advance payment';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};
