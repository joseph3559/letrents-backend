import { DashboardService } from '../services/dashboard.service.js';
import { writeSuccess, writeError } from '../utils/response.js';
const service = new DashboardService();
export const getDashboardStats = async (req, res) => {
    try {
        const user = req.user;
        const stats = await service.getDashboardStats(user);
        writeSuccess(res, 200, 'Dashboard stats retrieved successfully', stats);
    }
    catch (error) {
        const message = error.message || 'Failed to get dashboard stats';
        writeError(res, 500, message);
    }
};
export const getOnboardingStatus = async (req, res) => {
    try {
        const user = req.user;
        const status = await service.getOnboardingStatus(user);
        writeSuccess(res, 200, 'Onboarding status retrieved successfully', status);
    }
    catch (error) {
        const message = error.message || 'Failed to get onboarding status';
        writeError(res, 500, message);
    }
};
