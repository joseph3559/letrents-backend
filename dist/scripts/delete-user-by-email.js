/**
 * Script to delete a specific user by email and all their associated data
 * Usage: npx ts-node src/scripts/delete-user-by-email.ts
 */
import { getPrisma } from '../config/prisma.js';
const prisma = getPrisma();
const userEmailToDelete = 'scttkenya13@gmail.com';
async function deleteUserByEmail() {
    console.log(`🗑️  Starting deletion of user: ${userEmailToDelete}\n`);
    try {
        // Find user by email
        const userToDelete = await prisma.user.findUnique({
            where: {
                email: userEmailToDelete,
            },
            select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true,
                role: true,
                company_id: true,
                agency_id: true,
            },
        });
        if (!userToDelete) {
            console.log(`❌ User with email ${userEmailToDelete} not found.`);
            return;
        }
        console.log(`📋 Found user: ${userToDelete.email} (${userToDelete.first_name} ${userToDelete.last_name}, ${userToDelete.role})\n`);
        let totalDeleted = {
            properties: 0,
            units: 0,
            leases: 0,
            payments: 0,
            invoices: 0,
            maintenanceRequests: 0,
            conversations: 0,
            messages: 0,
            notifications: 0,
            tasks: 0,
            inspections: 0,
            subscriptions: 0,
        };
        await prisma.$transaction(async (tx) => {
            // 1. Get all properties owned by this user
            const ownedProperties = await tx.property.findMany({
                where: { owner_id: userToDelete.id },
                select: { id: true, name: true },
            });
            console.log(`   📦 Found ${ownedProperties.length} properties owned by this user`);
            // 2. For each property, delete related data
            for (const property of ownedProperties) {
                // Get units for this property
                const propertyUnits = await tx.unit.findMany({
                    where: { property_id: property.id },
                    select: { id: true },
                });
                // Delete leases for units in this property
                const deletedLeases = await tx.lease.deleteMany({
                    where: {
                        unit: {
                            property_id: property.id,
                        },
                    },
                });
                totalDeleted.leases += deletedLeases.count;
                // Delete payments for units in this property
                const deletedPayments = await tx.payment.deleteMany({
                    where: {
                        unit: {
                            property_id: property.id,
                        },
                    },
                });
                totalDeleted.payments += deletedPayments.count;
                // Delete invoices for this property
                const deletedInvoices = await tx.invoice.deleteMany({
                    where: { property_id: property.id },
                });
                totalDeleted.invoices += deletedInvoices.count;
                // Delete maintenance requests for this property
                const deletedMaintenance = await tx.maintenanceRequest.deleteMany({
                    where: { property_id: property.id },
                });
                totalDeleted.maintenanceRequests += deletedMaintenance.count;
                // Delete units
                const deletedUnits = await tx.unit.deleteMany({
                    where: { property_id: property.id },
                });
                totalDeleted.units += deletedUnits.count;
            }
            // Delete properties
            const deletedProperties = await tx.property.deleteMany({
                where: { owner_id: userToDelete.id },
            });
            totalDeleted.properties = deletedProperties.count;
            // 3. Delete subscriptions
            const deletedSubscriptions = await tx.subscription.deleteMany({
                where: { company_id: userToDelete.company_id || undefined },
            });
            totalDeleted.subscriptions = deletedSubscriptions.count;
            // 4. Delete conversations and messages
            // Delete conversation participants first
            await tx.conversationParticipant.deleteMany({
                where: { user_id: userToDelete.id },
            });
            const deletedConversations = await tx.conversation.deleteMany({
                where: { created_by: userToDelete.id },
            });
            totalDeleted.conversations = deletedConversations.count;
            // Delete message recipients first
            await tx.messageRecipient.deleteMany({
                where: { recipient_id: userToDelete.id },
            });
            const deletedMessages = await tx.message.deleteMany({
                where: { sender_id: userToDelete.id },
            });
            totalDeleted.messages = deletedMessages.count;
            // 5. Delete notifications
            const deletedNotifications = await tx.notification.deleteMany({
                where: {
                    OR: [
                        { recipient_id: userToDelete.id },
                        { sender_id: userToDelete.id },
                    ],
                },
            });
            totalDeleted.notifications = deletedNotifications.count;
            // 6. Delete tasks
            const deletedTasks = await tx.task.deleteMany({
                where: {
                    OR: [
                        { assigned_to: userToDelete.id },
                        { assigned_by: userToDelete.id },
                    ],
                },
            });
            totalDeleted.tasks = deletedTasks.count;
            // 7. Delete inspections
            const deletedInspections = await tx.inspection.deleteMany({
                where: {
                    OR: [
                        { inspector_id: userToDelete.id },
                        { tenant_id: userToDelete.id },
                    ],
                },
            });
            totalDeleted.inspections = deletedInspections.count;
            // 8. Delete email verification tokens
            await tx.emailVerificationToken.deleteMany({
                where: { user_id: userToDelete.id },
            });
            // 9. Delete refresh tokens
            await tx.refreshToken.deleteMany({
                where: { user_id: userToDelete.id },
            });
            // 10. Clear references to this user
            await tx.user.updateMany({
                where: { created_by: userToDelete.id },
                data: { created_by: null },
            });
            await tx.user.updateMany({
                where: { landlord_id: userToDelete.id },
                data: { landlord_id: null },
            });
            // 11. Delete company if user is the owner
            if (userToDelete.company_id) {
                const company = await tx.company.findUnique({
                    where: { id: userToDelete.company_id },
                    include: {
                        users: true,
                    },
                });
                if (company && company.users.length === 1) {
                    // Only this user in the company, delete the company
                    await tx.company.delete({
                        where: { id: userToDelete.company_id },
                    });
                    console.log(`   🏢 Deleted company: ${company.name}`);
                }
            }
            // 12. Finally, delete the user
            await tx.user.delete({
                where: { id: userToDelete.id },
            });
            console.log(`   ✅ Deleted user: ${userToDelete.email}`);
        }, {
            timeout: 30000, // 30 seconds timeout
        });
        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 Deletion Summary:');
        console.log('='.repeat(60));
        console.log(`   Properties deleted: ${totalDeleted.properties}`);
        console.log(`   Units deleted: ${totalDeleted.units}`);
        console.log(`   Leases deleted: ${totalDeleted.leases}`);
        console.log(`   Payments deleted: ${totalDeleted.payments}`);
        console.log(`   Invoices deleted: ${totalDeleted.invoices}`);
        console.log(`   Maintenance requests deleted: ${totalDeleted.maintenanceRequests}`);
        console.log(`   Conversations deleted: ${totalDeleted.conversations}`);
        console.log(`   Messages deleted: ${totalDeleted.messages}`);
        console.log(`   Notifications deleted: ${totalDeleted.notifications}`);
        console.log(`   Tasks deleted: ${totalDeleted.tasks}`);
        console.log(`   Inspections deleted: ${totalDeleted.inspections}`);
        console.log(`   Subscriptions deleted: ${totalDeleted.subscriptions}`);
        console.log('='.repeat(60));
        console.log('\n✅ User deletion completed successfully!\n');
    }
    catch (error) {
        console.error('❌ Error deleting user:', error);
        throw error;
    }
    finally {
        await prisma.$disconnect();
    }
}
// Run the script
deleteUserByEmail()
    .then(() => {
    console.log('Script completed.');
    process.exit(0);
})
    .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
});
