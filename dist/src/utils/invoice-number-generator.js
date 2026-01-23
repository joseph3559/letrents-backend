/**
 * Professional Invoice Number Generator for LetRents
 * Generates human-readable, sequential invoice numbers with year/month tracking
 */
/**
 * Generate a professional invoice number
 * Format: INV-YYMM-NNN
 * Example: INV-2510-001, INV-2510-002
 *
 * For property-specific: INV-PROP-YYMM-NNN
 * Example: INV-SKY-2510-001 (SKY = Skyline Apartments code)
 */
export function generateInvoiceNumber(sequenceNumber, options) {
    const now = new Date();
    const year = options?.year || now.getFullYear();
    const month = String(options?.month || now.getMonth() + 1).padStart(2, '0');
    const shortYear = String(year).slice(-2);
    // Format sequence number with leading zeros (3 digits)
    const sequence = String(sequenceNumber).padStart(3, '0');
    // If property code is provided, include it
    if (options?.propertyCode) {
        const propCode = options.propertyCode.toUpperCase().slice(0, 4);
        return `INV-${propCode}-${shortYear}${month}-${sequence}`;
    }
    // Standard format: INV-YYMM-NNN
    return `INV-${shortYear}${month}-${sequence}`;
}
/**
 * Generate a receipt number for payments
 * Format: RCT-YYMM-NNN
 * Example: RCT-2510-001
 */
export function generateReceiptNumber(sequenceNumber, year, month) {
    const now = new Date();
    const y = year || now.getFullYear();
    const m = String(month || now.getMonth() + 1).padStart(2, '0');
    const shortYear = String(y).slice(-2);
    const sequence = String(sequenceNumber).padStart(3, '0');
    return `RCT-${shortYear}${m}-${sequence}`;
}
/**
 * Generate M-Pesa style payment reference (readable and unique)
 * Format: PAY-YYMM-NNN
 * Example: PAY-2510-042
 */
export function generatePaymentReference() {
    const now = new Date();
    const shortYear = String(now.getFullYear()).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const sequence = Math.floor(100 + Math.random() * 900);
    return `PAY-${shortYear}${month}-${sequence}`;
}
/**
 * Generate a professional transaction reference with timestamp
 * Format: TXN-YYMMDD-NNN
 * Example: TXN-251030-042
 */
export function generateTransactionReference(sequenceNumber) {
    const now = new Date();
    const year = now.getFullYear();
    const shortYear = String(year).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const sequence = String(sequenceNumber).padStart(3, '0');
    return `TXN-${shortYear}${month}${day}-${sequence}`;
}
/**
 * Get the next receipt number for a company
 * This queries the database to find the latest payment for the current month
 */
export async function getNextReceiptNumber(prisma, companyId) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStr = String(month).padStart(2, '0');
    const shortYear = String(year).slice(-2);
    const prefix = `RCT-${shortYear}${monthStr}`;
    // Find the latest payment for this month
    const latestPayment = await prisma.payment.findFirst({
        where: {
            company_id: companyId,
            receipt_number: {
                startsWith: prefix,
            },
        },
        orderBy: {
            receipt_number: 'desc',
        },
    });
    let sequenceNumber = 1;
    if (latestPayment) {
        // Extract sequence from the last receipt number
        const parts = latestPayment.receipt_number.split('-');
        const lastPart = parts[parts.length - 1];
        sequenceNumber = parseInt(lastPart, 10) + 1;
    }
    return generateReceiptNumber(sequenceNumber, year, month);
}
/**
 * Generate a lease agreement number
 * Format: LSE-YYMM-NNN
 * Example: LSE-2510-001
 *
 * For property-specific: LSE-PROP-YYMM-NNN
 * Example: LSE-SKY-2510-001 (SKY = Skyline Apartments code)
 */
export function generateLeaseNumber(sequenceNumber, propertyCode, year, month) {
    const now = new Date();
    const y = year || now.getFullYear();
    const m = String(month || now.getMonth() + 1).padStart(2, '0');
    const shortYear = String(y).slice(-2);
    const sequence = String(sequenceNumber).padStart(3, '0');
    if (propertyCode) {
        const propCode = propertyCode.toUpperCase().slice(0, 4);
        return `LSE-${propCode}-${shortYear}${m}-${sequence}`;
    }
    return `LSE-${shortYear}${m}-${sequence}`;
}
/**
 * Get the next lease number for a company (async version)
 * This queries the database to find the latest lease for the current month
 */
export async function getNextLeaseNumber(prisma, companyId, propertyCode) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStr = String(month).padStart(2, '0');
    const shortYear = String(year).slice(-2);
    const prefix = propertyCode
        ? `LSE-${propertyCode.toUpperCase().slice(0, 4)}-${shortYear}${monthStr}`
        : `LSE-${shortYear}${monthStr}`;
    // Find the latest lease for this month
    const latestLease = await prisma.lease.findFirst({
        where: {
            company_id: companyId,
            lease_number: {
                startsWith: prefix,
            },
        },
        orderBy: {
            lease_number: 'desc',
        },
    });
    let sequenceNumber = 1;
    if (latestLease) {
        // Extract sequence from the last lease number
        const parts = latestLease.lease_number.split('-');
        const lastPart = parts[parts.length - 1];
        sequenceNumber = parseInt(lastPart, 10) + 1;
    }
    return generateLeaseNumber(sequenceNumber, propertyCode, year, month);
}
/**
 * Parse invoice number to extract components
 */
export function parseInvoiceNumber(invoiceNumber) {
    // Try to match property-specific format: INV-PROP-YYMM-NNN
    const propMatch = invoiceNumber.match(/^INV-([A-Z]{2,4})-(\d{2})(\d{2})-(\d{3})$/);
    if (propMatch) {
        return {
            prefix: 'INV',
            propertyCode: propMatch[1],
            year: 2000 + parseInt(propMatch[2]),
            month: parseInt(propMatch[3]),
            sequence: parseInt(propMatch[4]),
        };
    }
    // Try to match standard format: INV-YYMM-NNN
    const stdMatch = invoiceNumber.match(/^INV-(\d{2})(\d{2})-(\d{3})$/);
    if (stdMatch) {
        return {
            prefix: 'INV',
            year: 2000 + parseInt(stdMatch[1]),
            month: parseInt(stdMatch[2]),
            sequence: parseInt(stdMatch[3]),
        };
    }
    // Backward compatibility: INV-PROP-YYYY-MM-NNNN
    const legacyPropMatch = invoiceNumber.match(/^INV-([A-Z]{2,4})-(\d{4})-(\d{2})-(\d{4})$/);
    if (legacyPropMatch) {
        return {
            prefix: 'INV',
            propertyCode: legacyPropMatch[1],
            year: parseInt(legacyPropMatch[2]),
            month: parseInt(legacyPropMatch[3]),
            sequence: parseInt(legacyPropMatch[4]),
        };
    }
    // Backward compatibility: INV-YYYY-MM-NNNN
    const legacyStdMatch = invoiceNumber.match(/^INV-(\d{4})-(\d{2})-(\d{4})$/);
    if (legacyStdMatch) {
        return {
            prefix: 'INV',
            year: parseInt(legacyStdMatch[1]),
            month: parseInt(legacyStdMatch[2]),
            sequence: parseInt(legacyStdMatch[3]),
        };
    }
    return null;
}
/**
 * Get the next invoice number for a company
 * This queries the database to find the latest invoice for the current month
 *
 * @param attempt - Retry attempt number (used for collision handling)
 */
export async function getNextInvoiceNumber(prisma, companyId, propertyCode, attempt = 0) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    // Start and end of current month
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);
    // Find the latest invoice for this month
    const latestInvoice = await prisma.invoice.findFirst({
        where: {
            company_id: companyId,
            created_at: {
                gte: monthStart,
                lte: monthEnd,
            },
        },
        orderBy: {
            invoice_number: 'desc',
        },
    });
    let sequenceNumber = 1;
    if (latestInvoice) {
        // Parse the invoice number to extract sequence
        const parsed = parseInvoiceNumber(latestInvoice.invoice_number);
        if (parsed && parsed.year === year && parsed.month === month) {
            sequenceNumber = (parsed.sequence || 0) + 1;
        }
    }
    // Add attempt offset to handle concurrent requests
    if (attempt > 0) {
        sequenceNumber += attempt;
    }
    const invoiceNumber = generateInvoiceNumber(sequenceNumber, {
        companyId,
        propertyCode,
        year,
        month,
    });
    // ✅ Check if this invoice number already exists
    const existing = await prisma.invoice.findFirst({
        where: {
            company_id: companyId,
            invoice_number: invoiceNumber,
        },
    });
    // If invoice number exists and we haven't exceeded retry limit, try again
    if (existing && attempt < 10) {
        console.log(`⚠️ Invoice number collision detected: ${invoiceNumber}, retrying (attempt ${attempt + 1}/10)...`);
        return getNextInvoiceNumber(prisma, companyId, propertyCode, attempt + 1);
    }
    return invoiceNumber;
}
/**
 * Validate invoice number format
 */
export function isValidInvoiceNumber(invoiceNumber) {
    const parsed = parseInvoiceNumber(invoiceNumber);
    return parsed !== null;
}
/**
 * Generate property code from property name
 * Example: "Skyline Apartments" -> "SKY"
 * Example: "Green Valley Estates" -> "GVE"
 */
export function generatePropertyCode(propertyName) {
    const words = propertyName.trim().toUpperCase().split(/\s+/);
    if (words.length === 1) {
        // Single word: take first 3 characters
        return words[0].slice(0, 3);
    }
    else if (words.length === 2) {
        // Two words: take first letter of each + first letter of second word
        return words[0][0] + words[1][0] + (words[1][1] || '');
    }
    else {
        // Three or more words: take first letter of first 3 words
        return words.slice(0, 3).map(w => w[0]).join('');
    }
}
