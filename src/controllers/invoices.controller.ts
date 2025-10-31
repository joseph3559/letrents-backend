import { Request, Response } from 'express';
import { 
  InvoicesService, 
  InvoiceFilters, 
  CreateInvoiceRequest, 
  UpdateInvoiceRequest 
} from '../services/invoices.service.js';
import { JWTClaims } from '../types/index.js';
import { writeSuccess, writeError } from '../utils/response.js';

const service = new InvoicesService();

export const createInvoice = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const invoiceData: CreateInvoiceRequest = req.body;

    console.log('🧾 Creating invoice with data:', invoiceData);

    // Validate required fields
    if (!invoiceData.tenant_id) {
      return writeError(res, 400, 'Tenant ID is required');
    }

    // Calculate total amount if not provided
    let totalAmount = invoiceData.total_amount || 0;
    if (!totalAmount) {
      totalAmount = (invoiceData.rent_amount || 0);
      
      if (invoiceData.utility_bills) {
        const utilityTotal = invoiceData.utility_bills
          .filter(bill => bill.is_included)
          .reduce((sum, bill) => sum + bill.amount, 0);
        totalAmount += utilityTotal;
      }
    }

    if (totalAmount <= 0) {
      return writeError(res, 400, 'Invoice amount must be greater than 0');
    }

    const invoice = await service.createInvoice(invoiceData, user);
    
    // Check if invoice should be sent immediately
    const submitType = (req.body as any).submitType;
    let finalInvoice = invoice;
    
    if (submitType === 'send') {
      // Send the invoice immediately
      finalInvoice = await service.sendInvoice(invoice.id, user);
      console.log('✅ Invoice created and sent:', {
        id: finalInvoice.id,
        invoice_number: finalInvoice.invoice_number,
        status: finalInvoice.status,
        total_amount: finalInvoice.total_amount,
      });
    } else {
      console.log('✅ Invoice created as draft:', {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        total_amount: invoice.total_amount,
      });
    }

    writeSuccess(res, 201, 'Invoice created successfully', finalInvoice);
  } catch (error: any) {
    console.error('❌ Error creating invoice:', error);
    const message = error.message || 'Failed to create invoice';
    const status = message.includes('permissions') ? 403 :
                  message.includes('not found') ? 404 : 500;
    writeError(res, status, message);
  }
};

export const getInvoice = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;

    if (!id) {
      return writeError(res, 400, 'Invoice ID is required');
    }

    const invoice = await service.getInvoice(id, user);
    writeSuccess(res, 200, 'Invoice retrieved successfully', invoice);
  } catch (error: any) {
    const message = error.message || 'Failed to get invoice';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};

export const listInvoices = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    
    // Parse query parameters
    const filters: InvoiceFilters = {
      tenant_id: req.query.tenant_id as string,
      property_id: req.query.property_id as string,
      unit_id: req.query.unit_id as string,
      status: req.query.status as string,
      invoice_type: req.query.invoice_type as string,
      search_query: req.query.search as string,
      sort_by: req.query.sort_by as string,
      sort_order: req.query.sort_order as string,
      limit: req.query.limit ? Math.min(parseInt(req.query.limit as string), 100) : 20,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 
              req.query.page ? (parseInt(req.query.page as string) - 1) * (req.query.limit ? parseInt(req.query.limit as string) : 20) : 0,
    };

    const result = await service.listInvoices(filters, user);
    writeSuccess(res, 200, 'Invoices retrieved successfully', result);
  } catch (error: any) {
    const message = error.message || 'Failed to list invoices';
    writeError(res, 500, message);
  }
};

export const updateInvoice = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;
    const updateData: UpdateInvoiceRequest = req.body;

    if (!id) {
      return writeError(res, 400, 'Invoice ID is required');
    }

    const invoice = await service.updateInvoice(id, updateData, user);
    writeSuccess(res, 200, 'Invoice updated successfully', invoice);
  } catch (error: any) {
    const message = error.message || 'Failed to update invoice';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};

export const deleteInvoice = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;

    if (!id) {
      return writeError(res, 400, 'Invoice ID is required');
    }

    await service.deleteInvoice(id, user);
    writeSuccess(res, 200, 'Invoice deleted successfully');
  } catch (error: any) {
    const message = error.message || 'Failed to delete invoice';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};

export const sendInvoice = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;
    const { method } = req.body; // 'email', 'sms', or 'both'

    if (!id) {
      return writeError(res, 400, 'Invoice ID is required');
    }

    const updatedInvoice = await service.sendInvoice(id, user, { method });
    writeSuccess(res, 200, 'Invoice sent successfully', updatedInvoice);
  } catch (error: any) {
    console.error('❌ Error in sendInvoice controller:', error);
    const message = error.message || 'Failed to send invoice';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 :
                  message.includes('cannot send') ? 400 : 500;
    writeError(res, status, message);
  }
};

export const markInvoiceAsPaid = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;
    const { payment_method, payment_reference, amount } = req.body;

    if (!id) {
      return writeError(res, 400, 'Invoice ID is required');
    }

    const updatedInvoice = await service.markAsPaid(id, user, {
      method: payment_method,
      reference: payment_reference,
      amount: amount
    });
    
    writeSuccess(res, 200, 'Invoice marked as paid successfully', updatedInvoice);
  } catch (error: any) {
    console.error('❌ Error in markInvoiceAsPaid controller:', error);
    const message = error.message || 'Failed to mark invoice as paid';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 :
                  message.includes('cannot mark') ? 400 : 500;
    writeError(res, status, message);
  }
};

export const updateOverdueInvoices = async (req: Request, res: Response) => {
  try {
    const result = await service.updateOverdueInvoices();
    writeSuccess(res, 200, 'Overdue invoices updated successfully', result);
  } catch (error: any) {
    console.error('❌ Error in updateOverdueInvoices controller:', error);
    const message = error.message || 'Failed to update overdue invoices';
    writeError(res, 500, message);
  }
};

export const linkPaymentToInvoice = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { paymentId, invoiceId } = req.body;

    if (!paymentId || !invoiceId) {
      return writeError(res, 400, 'Payment ID and Invoice ID are required');
    }

    const result = await service.linkPaymentToInvoice(paymentId, invoiceId, user);
    writeSuccess(res, 200, 'Payment linked to invoice successfully', result);
  } catch (error: any) {
    console.error('❌ Error in linkPaymentToInvoice controller:', error);
    const message = error.message || 'Failed to link payment to invoice';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 :
                  message.includes('already') || message.includes('must belong') ? 400 : 500;
    writeError(res, status, message);
  }
};

export const autoReconcilePayments = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const result = await service.autoReconcilePayments(user);
    writeSuccess(res, 200, 'Payment auto-reconciliation completed successfully', result);
  } catch (error: any) {
    console.error('❌ Error in autoReconcilePayments controller:', error);
    const message = error.message || 'Failed to auto-reconcile payments';
    writeError(res, 500, message);
  }
};
