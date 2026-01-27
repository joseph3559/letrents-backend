import { getPrisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import * as crypto from 'crypto';
/**
 * Verification Service - Bank-grade document verification system
 */
export class VerificationService {
    prisma = getPrisma();
    /**
     * Generate a secure verification token (UUID v4)
     */
    generateVerificationToken() {
        return crypto.randomUUID();
    }
    /**
     * Build verification URL for a document
     */
    buildVerificationUrl(documentType, documentNumber, token) {
        const baseUrl = env.appUrl || 'http://localhost:3000';
        return `${baseUrl}/verify/${documentType}/${documentNumber}?token=${token}`;
    }
    /**
     * Generate QR code as data URL (base64 PNG)
     */
    async generateQRCodeDataUrl(url) {
        try {
            // Dynamic import to handle ESM/CJS compatibility
            const qrcodeModule = await import('qrcode');
            // qrcode exports functions directly (not as default)
            const qrcode = qrcodeModule.default || qrcodeModule;
            if (typeof qrcode.toDataURL !== 'function') {
                throw new Error('qrcode.toDataURL is not a function. Available: ' + Object.keys(qrcode).join(', '));
            }
            const dataUrl = await qrcode.toDataURL(url, {
                errorCorrectionLevel: 'M',
                type: 'image/png',
                quality: 0.92,
                margin: 2,
                width: 200,
                color: {
                    dark: '#0b1f3a',
                    light: '#ffffff',
                },
            });
            return dataUrl;
        }
        catch (error) {
            console.error('Error generating QR code:', error);
            throw new Error('Failed to generate QR code. Please ensure qrcode package is installed.');
        }
    }
    /**
     * Generate QR code as SVG string (for PDF embedding)
     */
    async generateQRCodeSvg(url) {
        try {
            // Dynamic import to handle ESM/CJS compatibility
            const qrcodeModule = await import('qrcode');
            // qrcode exports functions directly (not as default)
            // In ESM, it might be default, in CJS it's direct
            const qrcode = qrcodeModule.default || qrcodeModule;
            // qrcode.toString is the function we need
            if (typeof qrcode.toString !== 'function') {
                throw new Error('qrcode.toString is not a function. Available: ' + Object.keys(qrcode).join(', '));
            }
            const svg = await qrcode.toString(url, {
                type: 'svg',
                errorCorrectionLevel: 'M',
                margin: 2,
                width: 200,
                color: {
                    dark: '#0b1f3a',
                    light: '#ffffff',
                },
            });
            if (!svg || typeof svg !== 'string' || svg.length < 100) {
                throw new Error(`Invalid QR code SVG generated. Length: ${svg?.length || 0}`);
            }
            // Ensure SVG has proper attributes for PDF rendering
            // Some PDF renderers need explicit width/height or viewBox
            let finalSvg = svg;
            // If SVG doesn't have explicit width/height in style, add them
            if (!finalSvg.includes('style=') || !finalSvg.includes('width:') || !finalSvg.includes('height:')) {
                // SVG from qrcode should already have width/height attributes, but ensure they're present
                if (!finalSvg.match(/width=["']\d+["']/)) {
                    finalSvg = finalSvg.replace(/<svg/, '<svg width="200" height="200"');
                }
            }
            return finalSvg;
        }
        catch (error) {
            console.error('Error generating QR code SVG:', error);
            throw new Error('Failed to generate QR code. Please ensure qrcode package is installed.');
        }
    }
    /**
     * Verify a payment receipt
     */
    async verifyReceipt(receiptNumber, token) {
        const payment = await this.prisma.payment.findUnique({
            where: { receipt_number: receiptNumber },
            include: {
                company: true,
                tenant: true,
                property: true,
                unit: true,
            },
        });
        if (!payment) {
            return {
                valid: false,
                documentType: 'receipt',
                documentNumber: receiptNumber,
                status: 'NOT_FOUND',
                message: 'Receipt not found',
            };
        }
        // Validate token
        if (!payment.verification_token || payment.verification_token !== token) {
            return {
                valid: false,
                documentType: 'receipt',
                documentNumber: receiptNumber,
                status: 'INVALID_TOKEN',
                message: 'Invalid verification token',
            };
        }
        // Validate company is active
        if (!payment.company || payment.company.status !== 'active') {
            return {
                valid: false,
                documentType: 'receipt',
                documentNumber: receiptNumber,
                status: 'COMPANY_INACTIVE',
                message: 'Company account is inactive',
            };
        }
        // Check if document is cancelled/voided
        if (payment.status === 'cancelled') {
            return {
                valid: false,
                documentType: 'receipt',
                documentNumber: receiptNumber,
                status: 'CANCELLED',
                message: 'This receipt has been cancelled',
            };
        }
        // Record verification (optional audit log)
        await this.prisma.payment.update({
            where: { id: payment.id },
            data: { verified_at: new Date() },
        });
        return {
            valid: true,
            documentType: 'receipt',
            documentNumber: receiptNumber,
            status: payment.status.toUpperCase(),
            amount: payment.amount.toString(),
            currency: payment.currency,
            companyName: payment.company.name,
            tenantName: payment.tenant ? `${payment.tenant.first_name} ${payment.tenant.last_name}`.trim() : undefined,
            propertyName: payment.property?.name,
            unitNumber: payment.unit?.unit_number,
            paymentMethod: payment.payment_method,
            issueDate: payment.payment_date.toISOString().split('T')[0],
            period: payment.payment_period ?? undefined,
            message: 'Receipt verified successfully',
        };
    }
    /**
     * Verify an invoice
     */
    async verifyInvoice(invoiceNumber, token) {
        const invoice = await this.prisma.invoice.findUnique({
            where: { invoice_number: invoiceNumber },
            include: {
                company: true,
                recipient: true,
                property: true,
                unit: true,
            },
        });
        if (!invoice) {
            return {
                valid: false,
                documentType: 'invoice',
                documentNumber: invoiceNumber,
                status: 'NOT_FOUND',
                message: 'Invoice not found',
            };
        }
        // Validate token
        if (!invoice.verification_token || invoice.verification_token !== token) {
            return {
                valid: false,
                documentType: 'invoice',
                documentNumber: invoiceNumber,
                status: 'INVALID_TOKEN',
                message: 'Invalid verification token',
            };
        }
        // Validate company is active
        if (!invoice.company || invoice.company.status !== 'active') {
            return {
                valid: false,
                documentType: 'invoice',
                documentNumber: invoiceNumber,
                status: 'COMPANY_INACTIVE',
                message: 'Company account is inactive',
            };
        }
        // Check if document is cancelled
        if (invoice.status === 'cancelled') {
            return {
                valid: false,
                documentType: 'invoice',
                documentNumber: invoiceNumber,
                status: 'CANCELLED',
                message: 'This invoice has been cancelled',
            };
        }
        // Record verification
        await this.prisma.invoice.update({
            where: { id: invoice.id },
            data: { verified_at: new Date() },
        });
        return {
            valid: true,
            documentType: 'invoice',
            documentNumber: invoiceNumber,
            status: invoice.status.toUpperCase(),
            amount: invoice.total_amount.toString(),
            currency: invoice.currency,
            companyName: invoice.company.name,
            tenantName: invoice.recipient ? `${invoice.recipient.first_name} ${invoice.recipient.last_name}`.trim() : undefined,
            propertyName: invoice.property?.name,
            unitNumber: invoice.unit?.unit_number,
            issueDate: invoice.issue_date.toISOString().split('T')[0],
            dueDate: invoice.due_date.toISOString().split('T')[0],
            paidDate: invoice.paid_date ? invoice.paid_date.toISOString().split('T')[0] : undefined,
            message: 'Invoice verified successfully',
        };
    }
    /**
     * Verify a refund receipt (payment with status=refunded)
     */
    async verifyRefund(receiptNumber, token) {
        const payment = await this.prisma.payment.findUnique({
            where: { receipt_number: receiptNumber },
            include: {
                company: true,
                tenant: true,
                property: true,
                unit: true,
            },
        });
        if (!payment) {
            return {
                valid: false,
                documentType: 'refund',
                documentNumber: receiptNumber,
                status: 'NOT_FOUND',
                message: 'Refund receipt not found',
            };
        }
        // Validate it's actually a refund
        if (payment.status !== 'refunded') {
            return {
                valid: false,
                documentType: 'refund',
                documentNumber: receiptNumber,
                status: 'NOT_REFUND',
                message: 'This receipt is not a refund',
            };
        }
        // Validate token
        if (!payment.verification_token || payment.verification_token !== token) {
            return {
                valid: false,
                documentType: 'refund',
                documentNumber: receiptNumber,
                status: 'INVALID_TOKEN',
                message: 'Invalid verification token',
            };
        }
        // Validate company is active
        if (!payment.company || payment.company.status !== 'active') {
            return {
                valid: false,
                documentType: 'refund',
                documentNumber: receiptNumber,
                status: 'COMPANY_INACTIVE',
                message: 'Company account is inactive',
            };
        }
        // Record verification
        await this.prisma.payment.update({
            where: { id: payment.id },
            data: { verified_at: new Date() },
        });
        return {
            valid: true,
            documentType: 'refund',
            documentNumber: receiptNumber,
            status: 'REFUNDED',
            amount: payment.amount.toString(),
            currency: payment.currency,
            companyName: payment.company.name,
            tenantName: payment.tenant ? `${payment.tenant.first_name} ${payment.tenant.last_name}`.trim() : undefined,
            propertyName: payment.property?.name,
            unitNumber: payment.unit?.unit_number,
            paymentMethod: payment.payment_method,
            issueDate: payment.payment_date.toISOString().split('T')[0],
            period: payment.payment_period ?? undefined,
            message: 'Refund receipt verified successfully',
        };
    }
    /**
     * Ensure verification token exists for a payment (generate if missing)
     */
    async ensurePaymentVerificationToken(paymentId) {
        const payment = await this.prisma.payment.findUnique({
            where: { id: paymentId },
            select: { receipt_number: true, verification_token: true, qr_url: true },
        });
        if (!payment) {
            throw new Error('Payment not found');
        }
        let token = payment.verification_token || '';
        if (!token) {
            token = this.generateVerificationToken();
            const qrUrl = this.buildVerificationUrl('receipt', payment.receipt_number, token);
            await this.prisma.payment.update({
                where: { id: paymentId },
                data: { verification_token: token, qr_url: qrUrl },
            });
            return { token, qrUrl };
        }
        const qrUrl = payment.qr_url || this.buildVerificationUrl('receipt', payment.receipt_number, token);
        if (!payment.qr_url) {
            await this.prisma.payment.update({
                where: { id: paymentId },
                data: { qr_url: qrUrl },
            });
        }
        return { token, qrUrl };
    }
    /**
     * Ensure verification token exists for an invoice (generate if missing)
     */
    async ensureInvoiceVerificationToken(invoiceId) {
        const invoice = await this.prisma.invoice.findUnique({
            where: { id: invoiceId },
            select: { invoice_number: true, verification_token: true, qr_url: true },
        });
        if (!invoice) {
            throw new Error('Invoice not found');
        }
        let token = invoice.verification_token || '';
        if (!token) {
            token = this.generateVerificationToken();
            const qrUrl = this.buildVerificationUrl('invoice', invoice.invoice_number, token);
            await this.prisma.invoice.update({
                where: { id: invoiceId },
                data: { verification_token: token, qr_url: qrUrl },
            });
            return { token, qrUrl };
        }
        const qrUrl = invoice.qr_url || this.buildVerificationUrl('invoice', invoice.invoice_number, token);
        if (!invoice.qr_url) {
            await this.prisma.invoice.update({
                where: { id: invoiceId },
                data: { qr_url: qrUrl },
            });
        }
        return { token, qrUrl };
    }
}
export const verificationService = new VerificationService();
