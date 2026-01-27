import { documentService } from '../modules/documents/document-service.js';
import { reportsService } from '../services/reports.service.js';
function sendPdf(res, filename, pdf) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.status(200).send(pdf);
}
export const pdfDocumentsController = {
    invoicePdf: async (req, res) => {
        try {
            const user = req.user;
            const { invoiceId } = req.params;
            const pdf = await documentService.getInvoicePdf(invoiceId, user, 1);
            sendPdf(res, `Invoice-${invoiceId}.pdf`, pdf);
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message || 'Failed to generate invoice PDF' });
        }
    },
    paymentReceiptPdf: async (req, res) => {
        try {
            const user = req.user;
            const { paymentId } = req.params;
            const pdf = await documentService.getPaymentReceiptPdf(paymentId, user, 1);
            sendPdf(res, `Receipt-${paymentId}.pdf`, pdf);
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message || 'Failed to generate receipt PDF' });
        }
    },
    refundReceiptPdf: async (req, res) => {
        try {
            const user = req.user;
            const { paymentId } = req.params;
            const pdf = await documentService.getRefundReceiptPdf(paymentId, user, 1);
            sendPdf(res, `Refund-${paymentId}.pdf`, pdf);
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message || 'Failed to generate refund PDF' });
        }
    },
    leasePdf: async (req, res) => {
        try {
            const user = req.user;
            const { leaseId } = req.params;
            const pdf = await documentService.getLeasePdf(leaseId, user, 1);
            sendPdf(res, `Lease-${leaseId}.pdf`, pdf);
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message || 'Failed to generate lease PDF' });
        }
    },
    tenantStatementPdf: async (req, res) => {
        try {
            const user = req.user;
            const { tenantId } = req.params;
            const { start, end } = req.query;
            if (!start || !end) {
                return res.status(400).json({ success: false, message: 'start and end are required (YYYY-MM-DD)' });
            }
            const pdf = await documentService.getTenantStatementPdf(String(tenantId), String(start), String(end), user, 1);
            sendPdf(res, `Statement-${tenantId}-${start}-${end}.pdf`, pdf);
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message || 'Failed to generate statement PDF' });
        }
    },
    reportPdf: async (req, res) => {
        try {
            const user = req.user;
            const { type } = req.params;
            const filters = req.query;
            // Use the existing reports service to generate data; then render via the central PDF system.
            let reportData;
            switch (type) {
                case 'property':
                    reportData = await reportsService.getPropertyReport(user, filters);
                    break;
                case 'financial': {
                    // Parse property_ids for services expecting array
                    const property_ids = filters.property_ids;
                    const propertyIdsArray = typeof property_ids === 'string'
                        ? property_ids.split(',').map((id) => id.trim()).filter(Boolean)
                        : Array.isArray(property_ids)
                            ? property_ids.map((id) => String(id)).filter(Boolean)
                            : undefined;
                    reportData = await reportsService.getFinancialReport(user, filters.type || 'revenue', filters.period || 'monthly', propertyIdsArray);
                    break;
                }
                case 'occupancy': {
                    const property_ids = filters.property_ids;
                    const propertyIdsArray = typeof property_ids === 'string'
                        ? property_ids.split(',').map((id) => id.trim()).filter(Boolean)
                        : Array.isArray(property_ids)
                            ? property_ids.map((id) => String(id)).filter(Boolean)
                            : undefined;
                    reportData = await reportsService.getOccupancyReport(user, filters.period || 'monthly', propertyIdsArray);
                    break;
                }
                case 'rent-collection':
                    reportData = await reportsService.getRentCollectionReport(user, filters);
                    break;
                case 'maintenance': {
                    const property_ids = filters.property_ids;
                    const propertyIdsArray = typeof property_ids === 'string'
                        ? property_ids.split(',').map((id) => id.trim()).filter(Boolean)
                        : Array.isArray(property_ids)
                            ? property_ids.map((id) => String(id)).filter(Boolean)
                            : undefined;
                    reportData = await reportsService.getMaintenanceReport(user, filters.period || 'monthly', filters, propertyIdsArray);
                    break;
                }
                default:
                    return res.status(400).json({ success: false, message: 'Invalid report type' });
            }
            const summary = reportData?.summary || reportData?.overview || {};
            const rows = reportData?.properties ||
                reportData?.invoices ||
                reportData?.requests ||
                reportData?.unitDetails ||
                reportData?.availableReports ||
                [];
            const title = String(type).replaceAll('-', ' ').toUpperCase();
            const pdf = await documentService.getReportPdf(type, `LetRents — ${title} Report`, Array.isArray(rows) ? rows : [], summary, user, 1);
            sendPdf(res, `${type}_report.pdf`, pdf);
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message || 'Failed to generate report PDF' });
        }
    },
    renderReportPdf: async (req, res) => {
        try {
            const user = req.user;
            const { reportType, title, rows, summary } = req.body || {};
            const safeRows = Array.isArray(rows) ? rows : [];
            const safeSummary = summary && typeof summary === 'object' ? summary : {};
            const safeTitle = typeof title === 'string' && title.trim().length > 0 ? title.trim() : 'Report';
            const safeReportType = typeof reportType === 'string' && reportType.trim().length > 0 ? reportType.trim() : 'custom';
            const pdf = await documentService.getReportPdf(safeReportType, safeTitle, safeRows, safeSummary, user, 1);
            sendPdf(res, `${safeReportType}_report.pdf`, pdf);
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message || 'Failed to render report PDF' });
        }
    },
};
