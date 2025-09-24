import { getPrisma } from '../config/prisma.js';
export class InvoicesService {
    prisma = getPrisma();
    async createInvoice(req, user) {
        // Calculate total amount from rent and utility bills
        let totalAmount = req.total_amount || 0;
        if (!totalAmount) {
            // Calculate from rent_amount and utility bills - ensure numeric values
            totalAmount = Number(req.rent_amount || 0);
            if (req.utility_bills) {
                const utilityTotal = req.utility_bills
                    .filter(bill => bill.is_included)
                    .reduce((sum, bill) => sum + Number(bill.amount || 0), 0);
                totalAmount += utilityTotal;
            }
        }
        console.log('💰 Invoice calculation:', {
            rent_amount: req.rent_amount,
            utility_bills: req.utility_bills?.map(b => ({ name: b.name, amount: b.amount, is_included: b.is_included })),
            calculated_total: totalAmount,
        });
        // Validate required fields
        if (!req.tenant_id || totalAmount <= 0) {
            throw new Error('tenant ID and amount are required');
        }
        // Check if tenant exists and get tenant info
        const tenant = await this.prisma.user.findUnique({
            where: {
                id: req.tenant_id,
                role: 'tenant',
            },
            include: {
                assigned_units: {
                    include: {
                        property: true,
                    },
                },
            },
        });
        if (!tenant) {
            throw new Error('tenant not found');
        }
        // Check tenant access
        if (!this.hasTenantAccess(tenant, user)) {
            throw new Error('insufficient permissions to create invoice for this tenant');
        }
        // Validate user has company_id
        if (!user.company_id) {
            throw new Error('user must be associated with a company to create invoices');
        }
        // Get property and unit info from tenant if not provided
        const assignedUnit = tenant.assigned_units[0];
        const propertyId = req.property_id || assignedUnit?.property_id;
        const unitId = req.unit_id || assignedUnit?.id;
        // Set defaults - ensure due_date is always a Date object
        const dueDate = req.due_date ? new Date(req.due_date) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const description = req.description || 'Monthly Rent and Charges';
        const title = req.title || `Invoice for ${tenant.first_name} ${tenant.last_name}`;
        const invoiceType = req.invoice_type || 'monthly_rent';
        // Generate invoice number
        const invoiceCount = await this.prisma.invoice.count({
            where: {
                company_id: user.company_id,
            },
        });
        const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(6, '0')}`;
        // Create invoice in database
        const invoice = await this.prisma.invoice.create({
            data: {
                company_id: user.company_id,
                invoice_number: invoiceNumber,
                title,
                description,
                invoice_type: invoiceType,
                issued_by: user.user_id,
                issued_to: req.tenant_id,
                property_id: propertyId,
                unit_id: unitId,
                subtotal: totalAmount.toString(),
                tax_amount: "0", // No tax for now
                discount_amount: "0", // No discount for now
                total_amount: totalAmount.toString(),
                currency: 'KES',
                due_date: dueDate,
                status: 'draft',
                metadata: JSON.parse(JSON.stringify({
                    rent_amount: (req.rent_amount || 0).toString(),
                    utility_bills: (req.utility_bills || []).map(bill => ({
                        ...bill,
                        amount: bill.amount.toString() // Convert amount to string
                    })),
                    created_via: 'manual',
                })),
            },
            include: {
                issuer: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                    },
                },
                recipient: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                    },
                },
                property: {
                    select: {
                        id: true,
                        name: true,
                        street: true,
                        city: true,
                    },
                },
                unit: {
                    select: {
                        id: true,
                        unit_number: true,
                        rent_amount: true,
                    },
                },
            },
        });
        // Create line items
        const lineItems = [];
        // Add rent line item
        if (req.rent_amount && Number(req.rent_amount) > 0) {
            const rentAmount = Number(req.rent_amount);
            lineItems.push({
                invoice_id: invoice.id,
                description: 'Monthly Rent',
                quantity: 1,
                unit_price: rentAmount.toString(),
                total_price: rentAmount.toString(),
                metadata: {
                    type: 'rent',
                },
            });
        }
        // Add utility line items
        if (req.utility_bills) {
            req.utility_bills
                .filter(bill => bill.is_included && Number(bill.amount) > 0)
                .forEach(bill => {
                const billAmount = Number(bill.amount);
                lineItems.push({
                    invoice_id: invoice.id,
                    description: bill.name,
                    quantity: 1,
                    unit_price: billAmount.toString(),
                    total_price: billAmount.toString(),
                    metadata: {
                        type: 'utility',
                        utility_type: bill.type,
                    },
                });
            });
        }
        // Create line items in database
        if (lineItems.length > 0) {
            await this.prisma.invoiceLineItem.createMany({
                data: lineItems,
            });
        }
        // Fetch the complete invoice with line items
        const completeInvoice = await this.prisma.invoice.findUnique({
            where: { id: invoice.id },
            include: {
                issuer: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                    },
                },
                recipient: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                    },
                },
                property: {
                    select: {
                        id: true,
                        name: true,
                        street: true,
                        city: true,
                    },
                },
                unit: {
                    select: {
                        id: true,
                        unit_number: true,
                        rent_amount: true,
                    },
                },
                line_items: true,
            },
        });
        return completeInvoice;
    }
    async getInvoice(id, user) {
        // TODO: Implement actual database lookup
        // For now, return a mock record
        const invoiceRecord = {
            id,
            invoice_number: 'INV-001',
            tenant_id: 'tenant-123',
            property_id: '69b2b763-1853-48db-bce8-44b54c461b15',
            unit_id: undefined,
            total_amount: 1200.00,
            description: 'Monthly Rent - January 2025',
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            notes: 'Please pay by due date',
            status: 'pending',
            invoice_type: 'monthly_rent',
            currency: 'KES',
            items: [
                { description: 'Monthly Rent', amount: 1000 },
                { description: 'Service Charge', amount: 200 },
            ],
            created_by: user.user_id,
            issue_date: new Date().toISOString().split('T')[0],
            created_at: new Date(),
            updated_at: new Date(),
        };
        return invoiceRecord;
    }
    async listInvoices(filters, user) {
        const limit = Math.min(filters.limit || 20, 100);
        const offset = filters.offset || 0;
        // Build where clause for database query
        const whereClause = {};
        // Company-based filtering for non-super-admin users
        if (user.role !== 'super_admin' && user.company_id) {
            whereClause.company_id = user.company_id;
        }
        // Apply filters
        if (filters.tenant_id) {
            whereClause.issued_to = filters.tenant_id;
        }
        if (filters.property_id) {
            whereClause.property_id = filters.property_id;
        }
        if (filters.unit_id) {
            whereClause.unit_id = filters.unit_id;
        }
        if (filters.status) {
            whereClause.status = filters.status;
        }
        if (filters.invoice_type) {
            whereClause.invoice_type = filters.invoice_type;
        }
        // Search functionality
        if (filters.search_query) {
            const query = filters.search_query.toLowerCase();
            whereClause.OR = [
                {
                    invoice_number: {
                        contains: query,
                        mode: 'insensitive',
                    },
                },
                {
                    description: {
                        contains: query,
                        mode: 'insensitive',
                    },
                },
                {
                    title: {
                        contains: query,
                        mode: 'insensitive',
                    },
                },
            ];
        }
        try {
            // Get total count for pagination
            const totalCount = await this.prisma.invoice.count({
                where: whereClause,
            });
            // Fetch invoices with related data
            const invoices = await this.prisma.invoice.findMany({
                where: whereClause,
                include: {
                    recipient: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            email: true,
                            phone_number: true,
                        },
                    },
                    property: {
                        select: {
                            id: true,
                            name: true,
                            street: true,
                            city: true,
                            region: true,
                        },
                    },
                    unit: {
                        select: {
                            id: true,
                            unit_number: true,
                            rent_amount: true,
                        },
                    },
                    issuer: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            email: true,
                        },
                    },
                    line_items: {
                        select: {
                            id: true,
                            description: true,
                            quantity: true,
                            unit_price: true,
                            total_price: true,
                            metadata: true,
                        },
                        orderBy: {
                            created_at: 'asc',
                        },
                    },
                },
                orderBy: [
                    {
                        created_at: 'desc',
                    },
                    {
                        invoice_number: 'desc',
                    },
                ],
                take: limit,
                skip: offset,
            });
            // Transform data to match the expected format
            const transformedInvoices = invoices.map(invoice => ({
                id: invoice.id,
                invoice_number: invoice.invoice_number,
                tenant_id: invoice.issued_to,
                tenant_name: invoice.recipient ? `${invoice.recipient.first_name} ${invoice.recipient.last_name}`.trim() : 'Unknown Tenant',
                tenant_email: invoice.recipient?.email || '',
                tenant_phone: invoice.recipient?.phone_number || '',
                property_id: invoice.property_id,
                property_name: invoice.property?.name || 'Unknown Property',
                unit_id: invoice.unit_id,
                unit_number: invoice.unit?.unit_number || 'Unknown Unit',
                amount: Number(invoice.total_amount),
                subtotal: Number(invoice.subtotal),
                tax_amount: Number(invoice.tax_amount || 0),
                discount_amount: Number(invoice.discount_amount || 0),
                total_amount: Number(invoice.total_amount),
                description: invoice.description || '',
                title: invoice.title || '',
                notes: '', // Invoice model doesn't have notes field
                due_date: invoice.due_date.toISOString().split('T')[0],
                issue_date: invoice.issue_date.toISOString().split('T')[0],
                paid_date: invoice.paid_date ? invoice.paid_date.toISOString().split('T')[0] : null,
                status: invoice.status,
                invoice_type: invoice.invoice_type,
                currency: invoice.currency,
                payment_method: invoice.payment_method,
                payment_reference: invoice.payment_reference,
                invoice_items: invoice.line_items.map(item => ({
                    description: item.description,
                    amount: Number(item.unit_price),
                    type: item.metadata?.type || 'item',
                })),
                sent_via: [], // TODO: Implement communication tracking
                reminder_count: 0, // TODO: Implement reminder tracking
                last_reminder_date: null, // TODO: Implement reminder tracking
                created_by: invoice.issued_by,
                created_at: invoice.created_at,
                updated_at: invoice.updated_at,
            }));
            return {
                invoices: transformedInvoices,
                total: totalCount,
                page: Math.floor(offset / limit) + 1,
                per_page: limit,
                total_pages: Math.ceil(totalCount / limit),
            };
        }
        catch (error) {
            console.error('Error fetching invoices from database:', error);
            throw new Error('Failed to fetch invoices');
        }
    }
    async updateInvoice(id, req, user) {
        // TODO: Implement actual database update
        // For now, return updated mock record
        const updatedRecord = {
            id,
            invoice_number: 'INV-001',
            tenant_id: 'tenant-123',
            property_id: '69b2b763-1853-48db-bce8-44b54c461b15',
            unit_id: undefined,
            total_amount: req.total_amount || 1200.00,
            description: req.description || 'Monthly Rent - January 2025',
            due_date: req.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            notes: req.notes || 'Please pay by due date',
            status: req.status || 'pending',
            invoice_type: 'monthly_rent',
            currency: 'KES',
            items: req.items || [
                { description: 'Monthly Rent', amount: 1000 },
                { description: 'Service Charge', amount: 200 },
            ],
            created_by: user.user_id,
            issue_date: new Date().toISOString().split('T')[0],
            created_at: new Date(Date.now() - 86400000), // 1 day ago
            updated_at: new Date(),
        };
        return updatedRecord;
    }
    async deleteInvoice(id, user) {
        if (!id) {
            throw new Error('invoice ID is required');
        }
        try {
            // First, check if the invoice exists and user has permission to delete it
            const invoice = await this.prisma.invoice.findUnique({
                where: { id },
                include: {
                    issuer: true,
                    company: true,
                },
            });
            if (!invoice) {
                throw new Error('invoice not found');
            }
            // Check permissions
            let hasPermission = false;
            // Super admin can delete any invoice
            if (user.role === 'super_admin') {
                hasPermission = true;
            }
            // Company admin can delete invoices from their company
            else if (user.role === 'agency_admin' && user.company_id === invoice.company_id) {
                hasPermission = true;
            }
            // Landlord can delete invoices they created or from their company
            else if (user.role === 'landlord' &&
                (invoice.issued_by === user.user_id || user.company_id === invoice.company_id)) {
                hasPermission = true;
            }
            if (!hasPermission) {
                throw new Error('insufficient permissions to delete this invoice');
            }
            // Check if invoice is paid - prevent deletion of paid invoices
            if (invoice.status === 'paid') {
                throw new Error('cannot delete paid invoices');
            }
            // Delete the invoice and its line items (cascading delete should handle line items)
            await this.prisma.invoice.delete({
                where: { id },
            });
            console.log(`✅ Invoice ${invoice.invoice_number} deleted successfully by ${user.email}`);
        }
        catch (error) {
            console.error('❌ Error deleting invoice:', error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Failed to delete invoice');
        }
    }
    async sendInvoice(id, user, sendOptions) {
        if (!id) {
            throw new Error('invoice ID is required');
        }
        try {
            // First, check if the invoice exists and user has permission
            const invoice = await this.prisma.invoice.findUnique({
                where: { id },
                include: {
                    recipient: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            email: true,
                            phone_number: true,
                        },
                    },
                    property: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    unit: {
                        select: {
                            id: true,
                            unit_number: true,
                        },
                    },
                    company: true,
                },
            });
            if (!invoice) {
                throw new Error('invoice not found');
            }
            // Check permissions (same as delete)
            let hasPermission = false;
            if (user.role === 'super_admin') {
                hasPermission = true;
            }
            else if (user.role === 'agency_admin' && user.company_id === invoice.company_id) {
                hasPermission = true;
            }
            else if (user.role === 'landlord' &&
                (invoice.issued_by === user.user_id || user.company_id === invoice.company_id)) {
                hasPermission = true;
            }
            if (!hasPermission) {
                throw new Error('insufficient permissions to send this invoice');
            }
            // Only draft invoices can be sent
            if (invoice.status !== 'draft') {
                throw new Error(`cannot send invoice with status: ${invoice.status}. Only draft invoices can be sent.`);
            }
            // Update invoice status to 'sent'
            const updatedInvoice = await this.prisma.invoice.update({
                where: { id },
                data: {
                    status: 'sent',
                    updated_at: new Date(),
                },
                include: {
                    recipient: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            email: true,
                            phone_number: true,
                        },
                    },
                    property: {
                        select: {
                            id: true,
                            name: true,
                            street: true,
                            city: true,
                            region: true,
                        },
                    },
                    unit: {
                        select: {
                            id: true,
                            unit_number: true,
                            rent_amount: true,
                        },
                    },
                    issuer: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            email: true,
                        },
                    },
                    line_items: {
                        select: {
                            id: true,
                            description: true,
                            quantity: true,
                            unit_price: true,
                            total_price: true,
                            metadata: true,
                        },
                        orderBy: {
                            created_at: 'asc',
                        },
                    },
                },
            });
            // TODO: Implement actual email/SMS sending logic here
            // For now, just log the action
            const sendMethod = sendOptions?.method || 'email';
            console.log(`📧 Invoice ${invoice.invoice_number} sent via ${sendMethod} to ${invoice.recipient?.email || 'unknown recipient'}`);
            // Transform and return the updated invoice
            const transformedInvoice = {
                id: updatedInvoice.id,
                invoice_number: updatedInvoice.invoice_number,
                tenant_id: updatedInvoice.issued_to,
                tenant_name: updatedInvoice.recipient ? `${updatedInvoice.recipient.first_name} ${updatedInvoice.recipient.last_name}`.trim() : 'Unknown Tenant',
                tenant_email: updatedInvoice.recipient?.email || '',
                tenant_phone: updatedInvoice.recipient?.phone_number || '',
                property_id: updatedInvoice.property_id,
                property_name: updatedInvoice.property?.name || 'Unknown Property',
                unit_id: updatedInvoice.unit_id,
                unit_number: updatedInvoice.unit?.unit_number || 'Unknown Unit',
                amount: Number(updatedInvoice.total_amount),
                subtotal: Number(updatedInvoice.subtotal),
                tax_amount: Number(updatedInvoice.tax_amount || 0),
                discount_amount: Number(updatedInvoice.discount_amount || 0),
                total_amount: Number(updatedInvoice.total_amount),
                description: updatedInvoice.description || '',
                title: updatedInvoice.title || '',
                notes: '', // Invoice model doesn't have notes field
                due_date: updatedInvoice.due_date.toISOString().split('T')[0],
                issue_date: updatedInvoice.issue_date.toISOString().split('T')[0],
                paid_date: updatedInvoice.paid_date ? updatedInvoice.paid_date.toISOString().split('T')[0] : null,
                status: updatedInvoice.status,
                invoice_type: updatedInvoice.invoice_type,
                currency: updatedInvoice.currency,
                payment_method: updatedInvoice.payment_method,
                payment_reference: updatedInvoice.payment_reference,
                invoice_items: updatedInvoice.line_items.map(item => ({
                    description: item.description,
                    amount: Number(item.unit_price),
                    type: item.metadata?.type || 'item',
                })),
                sent_via: [sendMethod], // Track how it was sent
                reminder_count: 0,
                last_reminder_date: null,
                created_by: updatedInvoice.issued_by,
                created_at: updatedInvoice.created_at,
                updated_at: updatedInvoice.updated_at,
            };
            return transformedInvoice;
        }
        catch (error) {
            console.error('❌ Error sending invoice:', error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Failed to send invoice');
        }
    }
    async markAsPaid(id, user, paymentData) {
        if (!id) {
            throw new Error('invoice ID is required');
        }
        try {
            // First, check if the invoice exists and user has permission
            const invoice = await this.prisma.invoice.findUnique({
                where: { id },
                include: {
                    recipient: true,
                    property: true,
                    unit: true,
                    company: true,
                },
            });
            if (!invoice) {
                throw new Error('invoice not found');
            }
            // Check permissions
            let hasPermission = false;
            if (user.role === 'super_admin') {
                hasPermission = true;
            }
            else if (user.role === 'agency_admin' && user.company_id === invoice.company_id) {
                hasPermission = true;
            }
            else if (user.role === 'landlord' &&
                (invoice.issued_by === user.user_id || user.company_id === invoice.company_id)) {
                hasPermission = true;
            }
            if (!hasPermission) {
                throw new Error('insufficient permissions to mark this invoice as paid');
            }
            // Only sent or overdue invoices can be marked as paid
            if (!['sent', 'overdue'].includes(invoice.status)) {
                throw new Error(`cannot mark invoice as paid with status: ${invoice.status}. Only sent or overdue invoices can be marked as paid.`);
            }
            // Update invoice status to 'paid'
            const updatedInvoice = await this.prisma.invoice.update({
                where: { id },
                data: {
                    status: 'paid',
                    paid_date: new Date(),
                    payment_method: paymentData?.method || 'manual',
                    payment_reference: paymentData?.reference || null,
                    updated_at: new Date(),
                },
                include: {
                    recipient: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            email: true,
                            phone_number: true,
                        },
                    },
                    property: {
                        select: {
                            id: true,
                            name: true,
                            street: true,
                            city: true,
                            region: true,
                        },
                    },
                    unit: {
                        select: {
                            id: true,
                            unit_number: true,
                            rent_amount: true,
                        },
                    },
                    issuer: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            email: true,
                        },
                    },
                    line_items: {
                        select: {
                            id: true,
                            description: true,
                            quantity: true,
                            unit_price: true,
                            total_price: true,
                            metadata: true,
                        },
                        orderBy: {
                            created_at: 'asc',
                        },
                    },
                },
            });
            console.log(`💰 Invoice ${invoice.invoice_number} marked as paid by ${user.email}`);
            // Transform and return the updated invoice (same format as sendInvoice)
            const transformedInvoice = {
                id: updatedInvoice.id,
                invoice_number: updatedInvoice.invoice_number,
                tenant_id: updatedInvoice.issued_to,
                tenant_name: updatedInvoice.recipient ? `${updatedInvoice.recipient.first_name} ${updatedInvoice.recipient.last_name}`.trim() : 'Unknown Tenant',
                tenant_email: updatedInvoice.recipient?.email || '',
                tenant_phone: updatedInvoice.recipient?.phone_number || '',
                property_id: updatedInvoice.property_id,
                property_name: updatedInvoice.property?.name || 'Unknown Property',
                unit_id: updatedInvoice.unit_id,
                unit_number: updatedInvoice.unit?.unit_number || 'Unknown Unit',
                amount: Number(updatedInvoice.total_amount),
                subtotal: Number(updatedInvoice.subtotal),
                tax_amount: Number(updatedInvoice.tax_amount || 0),
                discount_amount: Number(updatedInvoice.discount_amount || 0),
                total_amount: Number(updatedInvoice.total_amount),
                description: updatedInvoice.description || '',
                title: updatedInvoice.title || '',
                notes: '',
                due_date: updatedInvoice.due_date.toISOString().split('T')[0],
                issue_date: updatedInvoice.issue_date.toISOString().split('T')[0],
                paid_date: updatedInvoice.paid_date ? updatedInvoice.paid_date.toISOString().split('T')[0] : null,
                status: updatedInvoice.status,
                invoice_type: updatedInvoice.invoice_type,
                currency: updatedInvoice.currency,
                payment_method: updatedInvoice.payment_method,
                payment_reference: updatedInvoice.payment_reference,
                invoice_items: updatedInvoice.line_items.map(item => ({
                    description: item.description,
                    amount: Number(item.unit_price),
                    type: item.metadata?.type || 'item',
                })),
                sent_via: [],
                reminder_count: 0,
                last_reminder_date: null,
                created_by: updatedInvoice.issued_by,
                created_at: updatedInvoice.created_at,
                updated_at: updatedInvoice.updated_at,
            };
            return transformedInvoice;
        }
        catch (error) {
            console.error('❌ Error marking invoice as paid:', error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Failed to mark invoice as paid');
        }
    }
    async updateOverdueInvoices() {
        try {
            // Get current date
            const currentDate = new Date();
            currentDate.setHours(0, 0, 0, 0); // Set to start of day
            // Find all sent invoices that are past due date
            const overdueInvoices = await this.prisma.invoice.updateMany({
                where: {
                    status: 'sent',
                    due_date: {
                        lt: currentDate,
                    },
                },
                data: {
                    status: 'overdue',
                    updated_at: new Date(),
                },
            });
            console.log(`⏰ Updated ${overdueInvoices.count} invoices to overdue status`);
            return { updated: overdueInvoices.count };
        }
        catch (error) {
            console.error('❌ Error updating overdue invoices:', error);
            throw new Error('Failed to update overdue invoices');
        }
    }
    async linkPaymentToInvoice(paymentId, invoiceId, user) {
        if (!paymentId || !invoiceId) {
            throw new Error('payment ID and invoice ID are required');
        }
        try {
            // Get payment and invoice details
            const [payment, invoice] = await Promise.all([
                this.prisma.payment.findUnique({
                    where: { id: paymentId },
                    include: {
                        tenant: true,
                        unit: true,
                        property: true,
                    },
                }),
                this.prisma.invoice.findUnique({
                    where: { id: invoiceId },
                    include: {
                        recipient: true,
                        property: true,
                        unit: true,
                    },
                }),
            ]);
            if (!payment) {
                throw new Error('payment not found');
            }
            if (!invoice) {
                throw new Error('invoice not found');
            }
            // Check permissions
            let hasPermission = false;
            if (user.role === 'super_admin') {
                hasPermission = true;
            }
            else if (user.role === 'agency_admin' && user.company_id === invoice.company_id) {
                hasPermission = true;
            }
            else if (user.role === 'landlord' &&
                (invoice.issued_by === user.user_id || user.company_id === invoice.company_id)) {
                hasPermission = true;
            }
            if (!hasPermission) {
                throw new Error('insufficient permissions to link payment to this invoice');
            }
            // Verify payment and invoice belong to same tenant
            if (payment.tenant_id !== invoice.issued_to) {
                throw new Error('payment and invoice must belong to the same tenant');
            }
            // Check if payment is already linked to another invoice
            if (payment.invoice_id && payment.invoice_id !== invoiceId) {
                throw new Error('payment is already linked to another invoice');
            }
            // Check if invoice is already paid
            if (invoice.status === 'paid') {
                throw new Error('invoice is already marked as paid');
            }
            // Link payment to invoice
            const updatedPayment = await this.prisma.payment.update({
                where: { id: paymentId },
                data: {
                    invoice_id: invoiceId,
                    updated_at: new Date(),
                },
            });
            // Calculate total payments for this invoice
            const totalPayments = await this.prisma.payment.aggregate({
                where: {
                    invoice_id: invoiceId,
                    status: 'approved',
                },
                _sum: {
                    amount: true,
                },
            });
            const totalPaid = Number(totalPayments._sum.amount || 0);
            const invoiceAmount = Number(invoice.total_amount);
            console.log(`💰 Payment reconciliation - Invoice: ${invoiceAmount}, Paid: ${totalPaid}`);
            // Update invoice status if fully paid
            let updatedInvoice = invoice;
            if (totalPaid >= invoiceAmount) {
                updatedInvoice = await this.prisma.invoice.update({
                    where: { id: invoiceId },
                    data: {
                        status: 'paid',
                        paid_date: new Date(),
                        payment_method: payment.payment_method,
                        payment_reference: payment.receipt_number,
                        updated_at: new Date(),
                    },
                    include: {
                        recipient: true,
                        property: true,
                        unit: true,
                    },
                });
                console.log(`✅ Invoice ${invoice.invoice_number} automatically marked as paid (Amount: ${invoiceAmount}, Paid: ${totalPaid})`);
            }
            return {
                payment: updatedPayment,
                invoice: updatedInvoice,
                total_paid: totalPaid,
                invoice_amount: invoiceAmount,
                is_fully_paid: totalPaid >= invoiceAmount,
            };
        }
        catch (error) {
            console.error('❌ Error linking payment to invoice:', error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Failed to link payment to invoice');
        }
    }
    async autoReconcilePayments(user) {
        try {
            let reconciledCount = 0;
            let invoicesPaidCount = 0;
            // Get all approved payments without invoice links from the same company
            const unlinkedPayments = await this.prisma.payment.findMany({
                where: {
                    invoice_id: null,
                    status: 'approved',
                    ...(user.role !== 'super_admin' && { company_id: user.company_id }),
                },
                include: {
                    tenant: true,
                    unit: true,
                    property: true,
                },
                orderBy: {
                    payment_date: 'desc',
                },
            });
            // Get all unpaid invoices from the same company
            const unpaidInvoices = await this.prisma.invoice.findMany({
                where: {
                    status: { in: ['sent', 'overdue'] },
                    ...(user.role !== 'super_admin' && { company_id: user.company_id }),
                },
                include: {
                    recipient: true,
                    property: true,
                    unit: true,
                },
                orderBy: {
                    due_date: 'asc',
                },
            });
            console.log(`🔄 Auto-reconciliation: ${unlinkedPayments.length} unlinked payments, ${unpaidInvoices.length} unpaid invoices`);
            // Try to match payments to invoices
            for (const payment of unlinkedPayments) {
                // Find matching invoices for the same tenant
                const matchingInvoices = unpaidInvoices.filter(invoice => invoice.issued_to === payment.tenant_id &&
                    Number(invoice.total_amount) === Number(payment.amount) &&
                    invoice.status !== 'paid');
                if (matchingInvoices.length > 0) {
                    // Use the oldest unpaid invoice
                    const targetInvoice = matchingInvoices[0];
                    try {
                        const result = await this.linkPaymentToInvoice(payment.id, targetInvoice.id, user);
                        reconciledCount++;
                        if (result.is_fully_paid) {
                            invoicesPaidCount++;
                        }
                        console.log(`✅ Auto-linked payment ${payment.receipt_number} to invoice ${targetInvoice.invoice_number}`);
                    }
                    catch (linkError) {
                        console.warn(`⚠️ Failed to auto-link payment ${payment.receipt_number}:`, linkError);
                    }
                }
            }
            console.log(`✅ Auto-reconciliation completed: ${reconciledCount} payments linked, ${invoicesPaidCount} invoices paid`);
            return {
                reconciled: reconciledCount,
                invoices_paid: invoicesPaidCount,
            };
        }
        catch (error) {
            console.error('❌ Error in auto-reconciliation:', error);
            throw new Error('Failed to auto-reconcile payments');
        }
    }
    hasTenantAccess(tenant, user) {
        // Super admin has access to all tenants
        if (user.role === 'super_admin')
            return true;
        // Company scoping - user can only access tenants from their company
        if (user.company_id && tenant.company_id === user.company_id)
            return true;
        // Tenant can access their own invoices
        if (user.role === 'tenant' && tenant.id === user.user_id)
            return true;
        return false;
    }
}
