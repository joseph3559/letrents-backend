import { MpesaService } from '../services/mpesa.service.js';
import { writeSuccess, writeError } from '../utils/response.js';
const service = new MpesaService();
export const createPaybillSettings = async (req, res) => {
    try {
        const user = req.user;
        const settingsData = req.body;
        // Validate required fields
        if (!settingsData.paybillNumber || !settingsData.businessShortcode || !settingsData.consumerKey || !settingsData.consumerSecret) {
            return writeError(res, 400, 'Paybill number, business shortcode, consumer key, and consumer secret are required');
        }
        const settings = await service.createPaybillSettings(settingsData, user);
        writeSuccess(res, 201, 'Paybill settings created successfully', settings);
    }
    catch (error) {
        const message = error.message || 'Failed to create paybill settings';
        const status = message.includes('permissions') ? 403 : 500;
        writeError(res, status, message);
    }
};
export const getPaybillSettings = async (req, res) => {
    try {
        const user = req.user;
        const settings = await service.getPaybillSettings(user);
        if (!settings) {
            return writeError(res, 404, 'No paybill settings found');
        }
        writeSuccess(res, 200, 'Paybill settings retrieved successfully', settings);
    }
    catch (error) {
        const message = error.message || 'Failed to retrieve paybill settings';
        writeError(res, 500, message);
    }
};
export const getTransactions = async (req, res) => {
    try {
        const user = req.user;
        const { page = 1, limit = 10, status, start_date, end_date } = req.query;
        const filters = {
            status: status,
            start_date: start_date,
            end_date: end_date,
        };
        const result = await service.getTransactions(user, Number(page), Number(limit), filters);
        writeSuccess(res, 200, 'M-Pesa transactions retrieved successfully', result);
    }
    catch (error) {
        const message = error.message || 'Failed to retrieve M-Pesa transactions';
        writeError(res, 500, message);
    }
};
export const getTransactionStats = async (req, res) => {
    try {
        const user = req.user;
        const { period = 'monthly' } = req.query;
        const stats = await service.getTransactionStats(user, period);
        writeSuccess(res, 200, 'M-Pesa transaction statistics retrieved successfully', stats);
    }
    catch (error) {
        const message = error.message || 'Failed to retrieve M-Pesa transaction statistics';
        writeError(res, 500, message);
    }
};
export const reconcileTransaction = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        if (!id) {
            return writeError(res, 400, 'Transaction ID is required');
        }
        const payment = await service.reconcileTransaction(id, user);
        writeSuccess(res, 200, 'Transaction reconciled successfully', payment);
    }
    catch (error) {
        const message = error.message || 'Failed to reconcile transaction';
        const status = message.includes('not found') ? 404 :
            message.includes('already reconciled') ? 400 : 500;
        writeError(res, status, message);
    }
};
// C2B Callback endpoints (called by Safaricom)
export const c2bValidation = async (req, res) => {
    try {
        const transactionData = req.body;
        console.log('🔍 M-Pesa C2B Validation:', transactionData);
        const result = await service.validateC2BTransaction(transactionData);
        res.json(result);
    }
    catch (error) {
        console.error('Error in C2B validation:', error);
        res.json({
            ResultCode: 1,
            ResultDesc: 'Validation error',
        });
    }
};
export const c2bConfirmation = async (req, res) => {
    try {
        const transactionData = req.body;
        console.log('🔍 M-Pesa C2B Confirmation:', transactionData);
        const result = await service.confirmC2BTransaction(transactionData);
        res.json(result);
    }
    catch (error) {
        console.error('Error in C2B confirmation:', error);
        res.json({
            ResultCode: 1,
            ResultDesc: 'Confirmation error',
        });
    }
};
