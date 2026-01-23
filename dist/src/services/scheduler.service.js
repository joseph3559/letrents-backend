import * as cron from 'node-cron';
import { InvoicesService } from './invoices.service.js';
import { emailService } from './email.service.js';
import { getPrisma } from '../config/prisma.js';
const prisma = getPrisma();
const invoicesService = new InvoicesService();
export class SchedulerService {
    static instance;
    tasks = new Map();
    constructor() { }
    static getInstance() {
        if (!SchedulerService.instance) {
            SchedulerService.instance = new SchedulerService();
        }
        return SchedulerService.instance;
    }
    /**
     * Initialize all scheduled tasks
     */
    initializeScheduledTasks() {
        console.log('🕒 Initializing scheduled tasks...');
        // 1. Daily: Update overdue invoices (every day at midnight)
        this.scheduleTask('update-overdue-invoices', '0 0 * * *', async () => {
            try {
                console.log('⏰ Running overdue invoices update...');
                const result = await invoicesService.updateOverdueInvoices();
                console.log(`✅ Updated ${result.updated} invoices to overdue status`);
            }
            catch (error) {
                console.error('❌ Error updating overdue invoices:', error);
            }
        });
        // 2. Daily: Send rent payment reminders (every day at 9 AM)
        this.scheduleTask('rent-payment-reminders', '0 9 * * *', async () => {
            try {
                console.log('📧 Sending rent payment reminders...');
                await this.sendRentPaymentReminders();
            }
            catch (error) {
                console.error('❌ Error sending rent reminders:', error);
            }
        });
        // 3. Weekly: Send lease expiration notifications (every Monday at 10 AM)
        this.scheduleTask('lease-expiration-alerts', '0 10 * * 1', async () => {
            try {
                console.log('📬 Checking for lease expirations...');
                await this.sendLeaseExpirationAlerts();
            }
            catch (error) {
                console.error('❌ Error sending lease expiration alerts:', error);
            }
        });
        // 4. Weekly: Database cleanup (every Sunday at 2 AM)
        this.scheduleTask('database-cleanup', '0 2 * * 0', async () => {
            try {
                console.log('🧹 Running database cleanup...');
                await this.performDatabaseCleanup();
            }
            catch (error) {
                console.error('❌ Error during database cleanup:', error);
            }
        });
        console.log(`✅ Initialized ${this.tasks.size} scheduled tasks`);
    }
    /**
     * Schedule a new task
     */
    scheduleTask(name, schedule, task) {
        const scheduledTask = cron.schedule(schedule, task, {
            timezone: 'Africa/Nairobi' // Adjust to your timezone
        });
        this.tasks.set(name, scheduledTask);
        console.log(`📅 Scheduled task: ${name} (${schedule})`);
    }
    /**
     * Send rent payment reminders for invoices due in 3, 7, and 30 days
     */
    async sendRentPaymentReminders() {
        const today = new Date();
        const reminderDays = [3, 7, 30]; // Days before due date
        for (const days of reminderDays) {
            const reminderDate = new Date(today);
            reminderDate.setDate(today.getDate() + days);
            reminderDate.setHours(0, 0, 0, 0);
            const nextDay = new Date(reminderDate);
            nextDay.setDate(reminderDate.getDate() + 1);
            // Find invoices due in X days that haven't been reminded
            const invoicesDue = await prisma.invoice.findMany({
                where: {
                    status: 'sent',
                    due_date: {
                        gte: reminderDate,
                        lt: nextDay
                    }
                    // TODO: Add reminder tracking fields to avoid duplicate reminders
                },
                include: {
                    recipient: true,
                    property: true,
                    unit: true,
                    issuer: {
                        select: {
                            preferences: {
                                select: {
                                    late_rent_reminder_enabled: true,
                                },
                            },
                        },
                    },
                }
            });
            console.log(`📧 Found ${invoicesDue.length} invoices due in ${days} days`);
            for (const invoice of invoicesDue) {
                try {
                    if (invoice.issuer?.preferences?.late_rent_reminder_enabled === false) {
                        continue;
                    }
                    if (!invoice.recipient.email) {
                        console.warn(`⚠️ No email found for invoice recipient ${invoice.recipient.id}`);
                        continue;
                    }
                    await emailService.sendEmail({
                        to: invoice.recipient.email,
                        subject: `Rent Payment Reminder - Due in ${days} days`,
                        html: this.generateReminderEmailTemplate(invoice, days),
                        type: 'rent_reminder'
                    });
                    // TODO: Update reminder tracking in database
                    console.log(`✅ Sent reminder to ${invoice.recipient.email} for invoice ${invoice.id}`);
                }
                catch (error) {
                    console.error(`❌ Failed to send reminder for invoice ${invoice.id}:`, error);
                }
            }
        }
        await this.sendLateRentPaymentReminders();
    }
    async sendLateRentPaymentReminders() {
        const today = new Date();
        const reminderDay = today.getDate();
        const overdueInvoices = await prisma.invoice.findMany({
            where: {
                status: 'overdue',
            },
            include: {
                recipient: true,
                property: true,
                unit: true,
                issuer: {
                    select: {
                        preferences: {
                            select: {
                                late_rent_reminder_enabled: true,
                                late_rent_reminder_date: true,
                            },
                        },
                    },
                },
            },
        });
        for (const invoice of overdueInvoices) {
            const prefs = invoice.issuer?.preferences;
            if (!prefs?.late_rent_reminder_enabled)
                continue;
            if (prefs.late_rent_reminder_date && prefs.late_rent_reminder_date !== reminderDay) {
                continue;
            }
            if (!invoice.recipient.email)
                continue;
            try {
                await emailService.sendEmail({
                    to: invoice.recipient.email,
                    subject: `Late Rent Reminder - Invoice ${invoice.invoice_number}`,
                    html: this.generateReminderEmailTemplate(invoice, 0),
                    type: 'late_rent_reminder',
                });
            }
            catch (error) {
                console.error(`❌ Failed to send late reminder for invoice ${invoice.id}:`, error);
            }
        }
    }
    /**
     * Send lease expiration alerts for leases expiring in 30 and 60 days
     */
    async sendLeaseExpirationAlerts() {
        const today = new Date();
        const alertDays = [30, 60]; // Days before lease expiration
        for (const days of alertDays) {
            const expirationDate = new Date(today);
            expirationDate.setDate(today.getDate() + days);
            expirationDate.setHours(0, 0, 0, 0);
            const nextDay = new Date(expirationDate);
            nextDay.setDate(expirationDate.getDate() + 1);
            const expiringLeases = await prisma.lease.findMany({
                where: {
                    status: 'active',
                    end_date: {
                        gte: expirationDate,
                        lt: nextDay
                    }
                },
                include: {
                    tenant: true,
                    property: {
                        include: {
                            owner: true // This is the landlord
                        }
                    },
                    unit: true,
                    creator: {
                        select: {
                            preferences: {
                                select: {
                                    auto_lease_renewal_reminders: true,
                                },
                            },
                        },
                    },
                }
            });
            console.log(`📬 Found ${expiringLeases.length} leases expiring in ${days} days`);
            for (const lease of expiringLeases) {
                try {
                    if (lease.creator?.preferences?.auto_lease_renewal_reminders === false) {
                        continue;
                    }
                    // Notify landlord
                    if (lease.property.owner.email) {
                        await emailService.sendEmail({
                            to: lease.property.owner.email,
                            subject: `Lease Expiration Alert - ${days} days remaining`,
                            html: this.generateLeaseExpirationTemplate(lease, days, 'landlord'),
                            type: 'lease_expiration'
                        });
                    }
                    else {
                        console.warn(`⚠️ No email found for property owner ${lease.property.owner.id}`);
                    }
                    // Notify tenant
                    if (lease.tenant.email) {
                        await emailService.sendEmail({
                            to: lease.tenant.email,
                            subject: `Your lease expires in ${days} days`,
                            html: this.generateLeaseExpirationTemplate(lease, days, 'tenant'),
                            type: 'lease_expiration'
                        });
                    }
                    else {
                        console.warn(`⚠️ No email found for tenant ${lease.tenant.id}`);
                    }
                    console.log(`✅ Sent lease expiration alerts for lease ${lease.id}`);
                }
                catch (error) {
                    console.error(`❌ Failed to send lease expiration alert for lease ${lease.id}:`, error);
                }
            }
        }
    }
    /**
     * Perform database cleanup tasks
     */
    async performDatabaseCleanup() {
        try {
            // Clean up old read notifications (older than 90 days)
            const oldNotificationsDate = new Date();
            oldNotificationsDate.setDate(oldNotificationsDate.getDate() - 90);
            const deletedNotifications = await prisma.notification.deleteMany({
                where: {
                    is_read: true,
                    read_at: {
                        lt: oldNotificationsDate
                    }
                }
            });
            console.log(`🧹 Cleaned up ${deletedNotifications.count} old notifications`);
            // TODO: Add more cleanup tasks as needed
            // - Clean up expired sessions
            // - Archive old maintenance requests
            // - Clean up temporary files
        }
        catch (error) {
            console.error('❌ Error during database cleanup:', error);
        }
    }
    /**
     * Generate email template for rent reminders
     */
    generateReminderEmailTemplate(invoice, days) {
        return `
      <h2>Rent Payment Reminder</h2>
      <p>Dear ${invoice.tenant.first_name} ${invoice.tenant.last_name},</p>
      <p>This is a friendly reminder that your rent payment is due in <strong>${days} days</strong>.</p>
      <p><strong>Payment Details:</strong></p>
      <ul>
        <li>Amount: KES ${invoice.amount}</li>
        <li>Due Date: ${invoice.due_date.toLocaleDateString()}</li>
        <li>Property: ${invoice.lease?.property?.name || 'N/A'}</li>
        <li>Unit: ${invoice.lease?.unit?.unit_number || 'N/A'}</li>
      </ul>
      <p>Please ensure payment is made before the due date to avoid late fees.</p>
      <p>Thank you,<br>LetRents Property Management</p>
    `;
    }
    /**
     * Generate email template for lease expiration alerts
     */
    generateLeaseExpirationTemplate(lease, days, recipientType) {
        const recipientName = recipientType === 'landlord'
            ? `${lease.landlord.first_name} ${lease.landlord.last_name}`
            : `${lease.tenant.first_name} ${lease.tenant.last_name}`;
        return `
      <h2>Lease Expiration Notice</h2>
      <p>Dear ${recipientName},</p>
      <p>This is to inform you that a lease agreement will expire in <strong>${days} days</strong>.</p>
      <p><strong>Lease Details:</strong></p>
      <ul>
        <li>Property: ${lease.property.name}</li>
        <li>Unit: ${lease.unit.unit_number}</li>
        <li>Tenant: ${lease.tenant.first_name} ${lease.tenant.last_name}</li>
        <li>Expiration Date: ${lease.end_date.toLocaleDateString()}</li>
        <li>Monthly Rent: KES ${lease.monthly_rent}</li>
      </ul>
      <p>${recipientType === 'landlord'
            ? 'Please contact your tenant to discuss lease renewal options.'
            : 'Please contact your landlord to discuss lease renewal or moving arrangements.'}</p>
      <p>Best regards,<br>LetRents Property Management</p>
    `;
    }
    /**
     * Stop all scheduled tasks
     */
    stopAllTasks() {
        console.log('🛑 Stopping all scheduled tasks...');
        this.tasks.forEach((task, name) => {
            task.stop();
            console.log(`⏹️ Stopped task: ${name}`);
        });
        this.tasks.clear();
    }
    /**
     * Get status of all scheduled tasks
     */
    getTasksStatus() {
        const status = {};
        this.tasks.forEach((task, name) => {
            status[name] = {
                running: task.getStatus() === 'scheduled'
            };
        });
        return status;
    }
}
