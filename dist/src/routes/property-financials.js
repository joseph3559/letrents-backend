import { Router } from 'express';
import { propertyFinancialsController } from '../controllers/property-financials.controller.js';
import { rbacResource } from '../middleware/rbac.js';
const router = Router();
// Property payment history
router.get('/:propertyId/payments', rbacResource('properties', 'read'), propertyFinancialsController.getPropertyPayments);
// Property utility bills
router.get('/:propertyId/utility-bills', rbacResource('properties', 'read'), propertyFinancialsController.getPropertyUtilityBills);
// Property outstanding balance
router.get('/:propertyId/outstanding-balance', rbacResource('properties', 'read'), propertyFinancialsController.getPropertyOutstandingBalance);
// Property monthly expenses
router.get('/:propertyId/monthly-expenses', rbacResource('properties', 'read'), propertyFinancialsController.getPropertyMonthlyExpenses);
// Property M-Pesa transactions
router.get('/:propertyId/mpesa-transactions', rbacResource('properties', 'read'), propertyFinancialsController.getPropertyMpesaTransactions);
export default router;
