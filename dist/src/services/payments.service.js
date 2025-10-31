import { getPrisma } from '../config/prisma.js';
import { buildWhereClause } from '../utils/roleBasedFiltering.js';
export class PaymentsService {
    prisma = getPrisma();
    async listPayments(filters = {}, user, page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        // Build base where clause based on user role
        const whereClause = buildWhereClause(user, {}, 'payment');
        // Add filters
        if (filters.tenant_id) {
            whereClause.tenant_id = filters.tenant_id;
        }
        if (filters.property_id) {
            whereClause.property_id = filters.property_id;
        }
        if (filters.unit_id) {
            whereClause.unit_id = filters.unit_id;
        }
        if (filters.payment_method) {
            whereClause.payment_method = filters.payment_method;
        }
        if (filters.payment_type) {
            whereClause.payment_type = filters.payment_type;
        }
        if (filters.status) {
            whereClause.status = filters.status;
        }
        if (filters.start_date || filters.end_date) {
            whereClause.payment_date = {};
            if (filters.start_date) {
                whereClause.payment_date.gte = new Date(filters.start_date);
            }
            if (filters.end_date) {
                whereClause.payment_date.lte = new Date(filters.end_date);
            }
        }
        if (filters.min_amount || filters.max_amount) {
            whereClause.amount = {};
            if (filters.min_amount) {
                whereClause.amount.gte = filters.min_amount;
            }
            if (filters.max_amount) {
                whereClause.amount.lte = filters.max_amount;
            }
        }
        const [payments, total] = await Promise.all([
            this.prisma.payment.findMany({
                where: whereClause,
                include: {
                    tenant: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            email: true,
                            phone_number: true,
                        },
                    },
                    unit: {
                        select: {
                            id: true,
                            unit_number: true,
                            property: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                    property: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    lease: {
                        select: {
                            id: true,
                            lease_number: true,
                        },
                    },
                    processor: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                        },
                    },
                    creator: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                        },
                    },
                },
                orderBy: { created_at: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.payment.count({ where: whereClause }),
        ]);
        return {
            payments,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
    async getPayment(id, user) {
        const payment = await this.prisma.payment.findUnique({
            where: { id },
            include: {
                tenant: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                        phone_number: true,
                    },
                },
                unit: {
                    select: {
                        id: true,
                        unit_number: true,
                        property: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
                property: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                lease: {
                    select: {
                        id: true,
                        lease_number: true,
                    },
                },
                processor: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                    },
                },
                creator: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                    },
                },
            },
        });
        if (!payment) {
            throw new Error('payment not found');
        }
        // Check if user has access to this payment
        if (!this.hasPaymentAccess(payment, user)) {
            throw new Error('insufficient permissions to view this payment');
        }
        // Manually fetch invoice if payment has invoice_id (since there's no relation in schema)
        let invoice = null;
        if (payment.invoice_id) {
            try {
                invoice = await this.prisma.invoice.findUnique({
                    where: { id: payment.invoice_id },
                    select: {
                        id: true,
                        invoice_number: true,
                        total_amount: true,
                        due_date: true,
                        line_items: true,
                    },
                });
            }
            catch (error) {
                console.error('Error fetching invoice for payment:', error);
            }
        }
        return {
            ...payment,
            invoice,
        };
    }
    async createPayment(data, user) {
        // Check permissions
        if (!['super_admin', 'agency_admin', 'landlord', 'agent', 'caretaker'].includes(user.role)) {
            throw new Error('insufficient permissions to create payments');
        }
        // Validate tenant exists and user has access
        const tenant = await this.prisma.user.findUnique({
            where: {
                id: data.tenant_id,
                role: 'tenant',
            },
        });
        if (!tenant) {
            throw new Error('tenant not found');
        }
        // Check tenant access
        if (!this.hasTenantAccess(tenant, user)) {
            throw new Error('insufficient permissions to create payment for this tenant');
        }
        // Generate professional receipt number and payment reference if not provided
        const { getNextReceiptNumber, generatePaymentReference } = await import('../utils/invoice-number-generator.js');
        const receiptNumber = data.receipt_number || await getNextReceiptNumber(this.prisma, user.company_id);
        const paymentReference = data.reference_number || generatePaymentReference();
        // Create payment
        const payment = await this.prisma.payment.create({
            data: {
                company_id: user.company_id,
                tenant_id: data.tenant_id,
                unit_id: data.unit_id,
                property_id: data.property_id,
                lease_id: data.lease_id,
                invoice_id: data.invoice_id,
                amount: data.amount,
                currency: data.currency || 'KES',
                payment_method: data.payment_method,
                payment_type: data.payment_type,
                status: data.status || 'pending',
                payment_date: new Date(data.payment_date),
                payment_period: data.payment_period,
                receipt_number: receiptNumber,
                transaction_id: data.transaction_id,
                reference_number: paymentReference,
                received_by: data.received_by,
                received_from: data.received_from,
                notes: data.notes,
                attachments: data.attachments || [],
                created_by: user.user_id,
            },
            include: {
                tenant: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                        phone_number: true,
                    },
                },
                unit: {
                    select: {
                        id: true,
                        unit_number: true,
                    },
                },
                property: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });
        // Try to auto-reconcile this payment with pending invoices
        try {
            // Import InvoicesService dynamically to avoid circular imports
            const { InvoicesService } = await import('./invoices.service.js');
            const invoicesService = new InvoicesService();
            // Check if this payment can be auto-linked to an invoice
            const unpaidInvoices = await this.prisma.invoice.findMany({
                where: {
                    status: { in: ['sent', 'overdue'] },
                    issued_to: payment.tenant_id,
                    company_id: payment.company_id,
                },
                orderBy: {
                    due_date: 'asc',
                },
            });
            // Find matching invoice with exact amount
            const matchingInvoice = unpaidInvoices.find(invoice => Number(invoice.total_amount) === Number(payment.amount));
            if (matchingInvoice) {
                try {
                    await invoicesService.linkPaymentToInvoice(payment.id, matchingInvoice.id, user);
                    console.log(`✅ Auto-linked approved payment ${payment.receipt_number} to invoice ${matchingInvoice.invoice_number}`);
                }
                catch (linkError) {
                    console.warn(`⚠️ Failed to auto-link payment ${payment.receipt_number}:`, linkError);
                }
            }
        }
        catch (autoLinkError) {
            console.warn('⚠️ Auto-reconciliation failed after payment approval:', autoLinkError);
        }
        return payment;
    }
    async updatePayment(id, data, user) {
        // Get existing payment
        const existingPayment = await this.getPayment(id, user);
        // Check permissions to update
        if (!['super_admin', 'agency_admin', 'landlord', 'agent'].includes(user.role)) {
            throw new Error('insufficient permissions to update payments');
        }
        // Update payment
        const payment = await this.prisma.payment.update({
            where: { id },
            data: {
                ...data,
                payment_date: data.payment_date ? new Date(data.payment_date) : undefined,
                payment_method: data.payment_method,
                payment_type: data.payment_type,
                status: data.status,
                updated_at: new Date(),
            },
            include: {
                tenant: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                        phone_number: true,
                    },
                },
                unit: {
                    select: {
                        id: true,
                        unit_number: true,
                    },
                },
                property: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });
        return payment;
    }
    async approvePayment(id, approvalData, user) {
        // Get existing payment
        const existingPayment = await this.getPayment(id, user);
        // Check permissions to approve
        if (!['super_admin', 'agency_admin', 'landlord', 'agent'].includes(user.role)) {
            throw new Error('insufficient permissions to approve payments');
        }
        // Only approve pending payments
        if (existingPayment.status !== 'pending') {
            throw new Error('only pending payments can be approved');
        }
        // Update payment status to approved
        const payment = await this.prisma.payment.update({
            where: { id },
            data: {
                status: 'approved',
                processed_by: user.user_id,
                processed_at: new Date(),
                approval_notes: approvalData.approval_notes,
                updated_at: new Date(),
            },
            include: {
                tenant: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                        phone_number: true,
                    },
                },
                unit: {
                    select: {
                        id: true,
                        unit_number: true,
                    },
                },
                property: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                processor: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                    },
                },
            },
        });
        // ✅ CRITICAL: If payment is linked to an invoice, mark the invoice as PAID
        if (payment.invoice_id) {
            try {
                // Fetch the invoice details
                const invoice = await this.prisma.invoice.findUnique({
                    where: { id: payment.invoice_id },
                    select: {
                        id: true,
                        invoice_number: true,
                        total_amount: true,
                        status: true,
                    },
                });
                if (!invoice) {
                    console.warn(`⚠️ Invoice ${payment.invoice_id} not found`);
                    return payment;
                }
                // Calculate total approved payments for this invoice
                const totalPayments = await this.prisma.payment.aggregate({
                    where: {
                        invoice_id: payment.invoice_id,
                        status: { in: ['approved', 'completed'] },
                    },
                    _sum: {
                        amount: true,
                    },
                });
                const totalPaid = Number(totalPayments._sum.amount || 0);
                const invoiceAmount = Number(invoice.total_amount || 0);
                console.log(`💰 Payment approved - Invoice reconciliation:`, {
                    invoiceId: payment.invoice_id,
                    invoiceNumber: invoice.invoice_number,
                    invoiceAmount,
                    totalPaid,
                    isFullyPaid: totalPaid >= invoiceAmount,
                });
                // If invoice is fully paid, mark it as paid
                if (totalPaid >= invoiceAmount) {
                    await this.prisma.invoice.update({
                        where: { id: payment.invoice_id },
                        data: {
                            status: 'paid',
                            paid_date: new Date(),
                            payment_method: payment.payment_method,
                            payment_reference: payment.receipt_number,
                            updated_at: new Date(),
                        },
                    });
                    console.log(`✅ Invoice ${invoice.invoice_number} automatically marked as PAID (Amount: ${invoiceAmount}, Paid: ${totalPaid})`);
                }
            }
            catch (error) {
                console.error('❌ Error updating invoice status:', error);
                // Don't fail payment approval if invoice update fails
            }
        }
        // 📧 SEND EMAIL RECEIPT TO TENANT
        try {
            if (payment.tenant && payment.tenant.email) {
                const { emailService } = await import('./email.service.js');
                await emailService.sendPaymentReceipt({
                    to: payment.tenant.email,
                    tenant_name: `${payment.tenant.first_name} ${payment.tenant.last_name}`,
                    payment_amount: Number(payment.amount),
                    payment_date: payment.payment_date.toISOString().split('T')[0],
                    payment_method: payment.payment_method,
                    receipt_number: payment.receipt_number || `RCP-${payment.id.substring(0, 8)}`,
                    property_name: payment.property?.name || 'Your Property',
                    unit_number: payment.unit?.unit_number || 'Your Unit',
                });
                // Mark receipt as sent
                await this.prisma.payment.update({
                    where: { id: payment.id },
                    data: { receipt_sent: true },
                });
                console.log(`📧 Payment receipt emailed to tenant: ${payment.tenant.email}`);
            }
        }
        catch (emailError) {
            console.error('❌ Failed to send email receipt to tenant:', emailError);
            // Don't fail the approval if email fails
        }
        // 🔔 SEND IN-APP NOTIFICATION TO TENANT
        try {
            if (payment.tenant && payment.tenant.id) {
                const { notificationsService } = await import('./notifications.service.js');
                await notificationsService.createNotification(user, {
                    user_id: payment.tenant.id,
                    type: 'payment_receipt',
                    title: 'Payment Approved - Receipt Generated',
                    message: `Your cash payment of KSh ${Number(payment.amount).toLocaleString()} has been approved. Receipt: ${payment.receipt_number}`,
                    data: {
                        payment_id: payment.id,
                        amount: payment.amount,
                        receipt_number: payment.receipt_number,
                        payment_date: payment.payment_date,
                        payment_method: payment.payment_method,
                    },
                });
                console.log(`🔔 In-app notification sent to tenant: ${payment.tenant.id}`);
            }
        }
        catch (notificationError) {
            console.error('❌ Failed to send in-app notification to tenant:', notificationError);
            // Don't fail the approval if notification fails
        }
        return payment;
    }
    async deletePayment(id, user) {
        // Get existing payment
        const existingPayment = await this.getPayment(id, user);
        // Check permissions to delete
        if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
            throw new Error('insufficient permissions to delete payments');
        }
        // Don't delete approved or completed payments
        if (['approved', 'completed'].includes(existingPayment.status)) {
            throw new Error('cannot delete approved or completed payments');
        }
        await this.prisma.payment.delete({
            where: { id },
        });
    }
    hasPaymentAccess(payment, user) {
        // Super admin has access to all payments
        if (user.role === 'super_admin')
            return true;
        // Tenants can access their own payments
        if (user.role === 'tenant' && payment.tenant_id === user.user_id)
            return true;
        // Company scoping (for landlords, agents, agency_admins, caretakers)
        if (user.company_id && payment.company_id === user.company_id)
            return true;
        return false;
    }
    hasTenantAccess(tenant, user) {
        // Super admin has access to all tenants
        if (user.role === 'super_admin')
            return true;
        // Company scoping
        if (user.company_id && tenant.company_id === user.company_id)
            return true;
        // Landlord can access their own tenants
        if (user.role === 'landlord' && tenant.landlord_id === user.user_id)
            return true;
        return false;
    }
}
