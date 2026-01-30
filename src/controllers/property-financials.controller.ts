import { Request, Response } from 'express';
import { writeSuccess, writeError } from '../utils/response.js';
import { JWTClaims } from '../types/index.js';
import { getPrisma } from '../config/prisma.js';

const prisma = getPrisma();

export const propertyFinancialsController = {
  // Get property payment history
  getPropertyPayments: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { propertyId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      // Verify property access
      const property = await prisma.property.findFirst({
        where: {
          id: propertyId,
          ...(user.role === 'landlord' ? { owner_id: user.user_id } : {}),
          ...(user.company_id ? { company_id: user.company_id } : {}),
        }
      });

      if (!property) {
        return writeError(res, 404, 'Property not found or access denied');
      }

      // Get payments for this property
      const payments = await prisma.payment.findMany({
        where: {
          property_id: propertyId,
          ...(user.company_id ? { company_id: user.company_id } : {}),
        },
        include: {
          tenant: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            }
          },
          unit: {
            select: {
              id: true,
              unit_number: true,
            }
          },
        },
        orderBy: {
          payment_date: 'desc'
        },
        take: Number(limit),
        skip: Number(offset),
      });

      // Get total count
      const totalCount = await prisma.payment.count({
        where: {
          property_id: propertyId,
          ...(user.company_id ? { company_id: user.company_id } : {}),
        }
      });

      writeSuccess(res, 200, 'Property payments retrieved successfully', {
        payments,
        total: totalCount,
        limit: Number(limit),
        offset: Number(offset),
      });
    } catch (error: any) {
      console.error('Error getting property payments:', error);
      writeError(res, 500, error.message);
    }
  },

  // Get property utility bills (payments with type 'utility')
  getPropertyUtilityBills: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { propertyId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      // Verify property access
      const property = await prisma.property.findFirst({
        where: {
          id: propertyId,
          ...(user.role === 'landlord' ? { owner_id: user.user_id } : {}),
          ...(user.company_id ? { company_id: user.company_id } : {}),
        }
      });

      if (!property) {
        return writeError(res, 404, 'Property not found or access denied');
      }

      // Get utility payments for this property
      const utilityBills = await prisma.payment.findMany({
        where: {
          property_id: propertyId,
          payment_type: 'utility',
          ...(user.company_id ? { company_id: user.company_id } : {}),
        },
        include: {
          tenant: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            }
          },
          unit: {
            select: {
              id: true,
              unit_number: true,
            }
          },
        },
        orderBy: {
          payment_date: 'desc'
        },
        take: Number(limit),
        skip: Number(offset),
      });

      // Get total count
      const totalCount = await prisma.payment.count({
        where: {
          property_id: propertyId,
          payment_type: 'utility',
          ...(user.company_id ? { company_id: user.company_id } : {}),
        }
      });

      writeSuccess(res, 200, 'Property utility bills retrieved successfully', {
        utilityBills,
        total: totalCount,
        limit: Number(limit),
        offset: Number(offset),
      });
    } catch (error: any) {
      console.error('Error getting property utility bills:', error);
      writeError(res, 500, error.message);
    }
  },

  // Get property outstanding balance
  getPropertyOutstandingBalance: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { propertyId } = req.params;

      // Verify property access
      const property = await prisma.property.findFirst({
        where: {
          id: propertyId,
          ...(user.role === 'landlord' ? { owner_id: user.user_id } : {}),
          ...(user.company_id ? { company_id: user.company_id } : {}),
        }
      });

      if (!property) {
        return writeError(res, 404, 'Property not found or access denied');
      }

      // Get all invoices for this property
      const invoices = await prisma.invoice.findMany({
        where: {
          property_id: propertyId,
          status: {
            in: ['draft', 'sent', 'overdue']
          },
          ...(user.company_id ? { company_id: user.company_id } : {}),
        },
        select: {
          id: true,
          total_amount: true,
          status: true,
          due_date: true,
        }
      });

      // Calculate outstanding balance
      const outstandingBalance = invoices.reduce((total, invoice) => {
        return total + Number(invoice.total_amount);
      }, 0);

      // Count overdue invoices
      const overdueCount = invoices.filter(invoice => 
        new Date(invoice.due_date) < new Date() && 
        ['draft', 'sent', 'overdue'].includes(invoice.status)
      ).length;

      writeSuccess(res, 200, 'Property outstanding balance retrieved successfully', {
        outstandingBalance,
        totalInvoices: invoices.length,
        overdueInvoices: overdueCount,
        invoices: invoices.map(invoice => ({
          id: invoice.id,
          amount: Number(invoice.total_amount),
          status: invoice.status,
          due_date: invoice.due_date,
          is_overdue: new Date(invoice.due_date) < new Date(),
        }))
      });
    } catch (error: any) {
      console.error('Error getting property outstanding balance:', error);
      writeError(res, 500, error.message);
    }
  },

  // Get property monthly expenses
  getPropertyMonthlyExpenses: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { propertyId } = req.params;
      const { year, month } = req.query;

      // Default to current month if not specified
      const currentDate = new Date();
      const targetYear = year ? Number(year) : currentDate.getFullYear();
      const targetMonth = month ? Number(month) : currentDate.getMonth() + 1;

      // Verify property access
      const property = await prisma.property.findFirst({
        where: {
          id: propertyId,
          ...(user.role === 'landlord' ? { owner_id: user.user_id } : {}),
          ...(user.company_id ? { company_id: user.company_id } : {}),
        }
      });

      if (!property) {
        return writeError(res, 404, 'Property not found or access denied');
      }

      // Get start and end dates for the month
      const startDate = new Date(targetYear, targetMonth - 1, 1);
      const endDate = new Date(targetYear, targetMonth, 0);

      // Get maintenance expenses
      const maintenanceExpenses = await prisma.maintenanceRequest.findMany({
        where: {
          property_id: propertyId,
          status: 'completed',
          completed_date: {
            gte: startDate,
            lte: endDate,
          }
        },
        select: {
          id: true,
          title: true,
          actual_cost: true,
          completed_date: true,
          category: true,
        }
      });

      // Get utility expenses (utility payments made by landlord)
      const utilityExpenses = await prisma.payment.findMany({
        where: {
          property_id: propertyId,
          payment_type: 'utility',
          payment_date: {
            gte: startDate,
            lte: endDate,
          },
          ...(user.company_id ? { company_id: user.company_id } : {}),
        },
        select: {
          id: true,
          amount: true,
          payment_date: true,
          notes: true,
        }
      });

      // Calculate totals
      const maintenanceTotal = maintenanceExpenses.reduce((total, expense) => 
        total + Number(expense.actual_cost || 0), 0
      );

      const utilityTotal = utilityExpenses.reduce((total, expense) => 
        total + Number(expense.amount), 0
      );

      const totalExpenses = maintenanceTotal + utilityTotal;

      writeSuccess(res, 200, 'Property monthly expenses retrieved successfully', {
        year: targetYear,
        month: targetMonth,
        totalExpenses,
        breakdown: {
          maintenance: {
            total: maintenanceTotal,
            count: maintenanceExpenses.length,
            items: maintenanceExpenses.map(expense => ({
              id: expense.id,
              title: expense.title,
              amount: Number(expense.actual_cost || 0),
              date: expense.completed_date,
              category: expense.category,
            }))
          },
          utilities: {
            total: utilityTotal,
            count: utilityExpenses.length,
            items: utilityExpenses.map(expense => ({
              id: expense.id,
              amount: Number(expense.amount),
              date: expense.payment_date,
              notes: expense.notes,
            }))
          }
        }
      });
    } catch (error: any) {
      console.error('Error getting property monthly expenses:', error);
      writeError(res, 500, error.message);
    }
  },

  // Get M-Pesa transactions for property
  getPropertyMpesaTransactions: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { propertyId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      // Verify property access
      const property = await prisma.property.findFirst({
        where: {
          id: propertyId,
          ...(user.role === 'landlord' ? { owner_id: user.user_id } : {}),
          ...(user.company_id ? { company_id: user.company_id } : {}),
        }
      });

      if (!property) {
        return writeError(res, 404, 'Property not found or access denied');
      }

      // Get M-Pesa transactions for this property
      const mpesaTransactions = await prisma.mpesaTransaction.findMany({
        where: {
          property_id: propertyId,
          ...(user.company_id ? { company_id: user.company_id } : {}),
        },
        include: {
          payment: {
            select: {
              id: true,
              receipt_number: true,
              status: true,
            }
          },
          tenant: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              phone_number: true,
            }
          },
        },
        orderBy: {
          created_at: 'desc'
        },
        take: Number(limit),
        skip: Number(offset),
      });

      // Get total count
      const totalCount = await prisma.mpesaTransaction.count({
        where: {
          property_id: propertyId,
          ...(user.company_id ? { company_id: user.company_id } : {}),
        }
      });

      writeSuccess(res, 200, 'Property M-Pesa transactions retrieved successfully', {
        transactions: mpesaTransactions,
        total: totalCount,
        limit: Number(limit),
        offset: Number(offset),
      });
    } catch (error: any) {
      console.error('Error getting property M-Pesa transactions:', error);
      writeError(res, 500, error.message);
    }
  }
};
