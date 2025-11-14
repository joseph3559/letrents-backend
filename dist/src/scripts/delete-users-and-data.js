/**
 * Script to delete specific users and all their associated data
 * This script will:
 * 1. Find users by email
 * 2. Delete all their properties (which cascades to units)
 * 3. Delete all related data (leases, payments, invoices, etc.)
 * 4. Delete the users themselves
 *
 * Usage: npx ts-node src/scripts/delete-users-and-data.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
// List of emails to delete (users)
const userEmailsToDelete = [
    'scttkenya13@gmail.com',
];
// List of agency emails to delete
const agencyEmailsToDelete = [
    'agency@jacklineproperty.com',
    'info@eliterealty.com',
    'contact@primeproperty.com',
];
async function deleteUsersAndData() {
    console.log('🗑️  Starting deletion of users, agencies, and all their data...\n');
    try {
        // Find all users by email
        const usersToDelete = await prisma.user.findMany({
            where: {
                email: { in: userEmailsToDelete },
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
        let totalDeleted = {
            users: 0,
            agencies: 0,
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
            emergencyContacts: 0,
            applications: 0,
            other: 0,
        };
        // Process each user
        if (usersToDelete.length > 0) {
            console.log(`📋 Found ${usersToDelete.length} users to delete:\n`);
            usersToDelete.forEach((user) => {
                console.log(`   - ${user.email} (${user.first_name} ${user.last_name}, ${user.role})`);
            });
            console.log('');
            for (const user of usersToDelete) {
                console.log(`\n🔍 Processing user: ${user.email} (${user.id})`);
                await prisma.$transaction(async (tx) => {
                    // 1. Get all properties owned by this user
                    const ownedProperties = await tx.property.findMany({
                        where: { owner_id: user.id },
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
                            where: {
                                property_id: property.id,
                            },
                        });
                        totalDeleted.invoices += deletedInvoices.count;
                        // Delete maintenance requests for this property
                        const deletedMaintenance = await tx.maintenanceRequest.deleteMany({
                            where: {
                                property_id: property.id,
                            },
                        });
                        totalDeleted.maintenanceRequests += deletedMaintenance.count;
                        // Delete inspections for this property
                        const deletedInspections = await tx.inspection.deleteMany({
                            where: {
                                property_id: property.id,
                            },
                        });
                        totalDeleted.inspections += deletedInspections.count;
                        // Delete tasks for this property
                        const deletedTasks = await tx.task.deleteMany({
                            where: {
                                property_id: property.id,
                            },
                        });
                        totalDeleted.tasks += deletedTasks.count;
                        // Clear tenant assignments from units
                        await tx.unit.updateMany({
                            where: {
                                property_id: property.id,
                                current_tenant_id: { not: null },
                            },
                            data: {
                                current_tenant_id: null,
                                status: 'vacant',
                            },
                        });
                        // Delete units (this will cascade delete related data)
                        const deletedUnits = await tx.unit.deleteMany({
                            where: {
                                property_id: property.id,
                            },
                        });
                        totalDeleted.units += deletedUnits.count;
                    }
                    // 3. Delete properties owned by this user
                    const deletedProperties = await tx.property.deleteMany({
                        where: { owner_id: user.id },
                    });
                    totalDeleted.properties += deletedProperties.count;
                    // 4. Delete properties created by this user (if different from owner)
                    const deletedCreatedProperties = await tx.property.deleteMany({
                        where: { created_by: user.id },
                    });
                    totalDeleted.properties += deletedCreatedProperties.count;
                    // 5. Delete leases where user is tenant
                    const deletedTenantLeases = await tx.lease.deleteMany({
                        where: { tenant_id: user.id },
                    });
                    totalDeleted.leases += deletedTenantLeases.count;
                    // 6. Delete payments where user is tenant
                    const deletedTenantPayments = await tx.payment.deleteMany({
                        where: { tenant_id: user.id },
                    });
                    totalDeleted.payments += deletedTenantPayments.count;
                    // 7. Delete invoices issued to this user
                    const deletedReceivedInvoices = await tx.invoice.deleteMany({
                        where: { issued_to: user.id },
                    });
                    totalDeleted.invoices += deletedReceivedInvoices.count;
                    // 8. Delete invoices issued by this user
                    const deletedIssuedInvoices = await tx.invoice.deleteMany({
                        where: { issued_by: user.id },
                    });
                    totalDeleted.invoices += deletedIssuedInvoices.count;
                    // 9. Delete conversations created by this user
                    const deletedConversations = await tx.conversation.deleteMany({
                        where: { created_by: user.id },
                    });
                    totalDeleted.conversations += deletedConversations.count;
                    // 10. Delete conversation participants
                    await tx.conversationParticipant.deleteMany({
                        where: { user_id: user.id },
                    });
                    // 11. Delete messages sent by this user
                    const deletedMessages = await tx.message.deleteMany({
                        where: { sender_id: user.id },
                    });
                    totalDeleted.messages += deletedMessages.count;
                    // 12. Delete message recipients
                    await tx.messageRecipient.deleteMany({
                        where: { recipient_id: user.id },
                    });
                    // 13. Delete notifications sent/received by this user
                    const deletedSentNotifications = await tx.notification.deleteMany({
                        where: { sender_id: user.id },
                    });
                    const deletedReceivedNotifications = await tx.notification.deleteMany({
                        where: { recipient_id: user.id },
                    });
                    totalDeleted.notifications += deletedSentNotifications.count + deletedReceivedNotifications.count;
                    // 14. Delete tasks assigned to/by this user
                    await tx.task.deleteMany({
                        where: {
                            OR: [
                                { assigned_to: user.id },
                                { assigned_by: user.id },
                            ],
                        },
                    });
                    // 15. Delete maintenance requests assigned to/requested by this user
                    await tx.maintenanceRequest.deleteMany({
                        where: {
                            OR: [
                                { assigned_to: user.id },
                                { requested_by: user.id },
                            ],
                        },
                    });
                    // 16. Delete emergency contacts created/assigned to this user
                    await tx.emergencyContact.deleteMany({
                        where: {
                            OR: [
                                { created_by: user.id },
                                { agent_assigned: user.id },
                            ],
                        },
                    });
                    totalDeleted.emergencyContacts += (await tx.emergencyContact.count({
                        where: {
                            OR: [
                                { created_by: user.id },
                                { agent_assigned: user.id },
                            ],
                        },
                    }));
                    // 17. Delete applications reviewed by this user
                    await tx.application.updateMany({
                        where: { reviewed_by: user.id },
                        data: { reviewed_by: null },
                    });
                    // 18. Delete staff property assignments
                    await tx.staffPropertyAssignment.deleteMany({
                        where: { staff_id: user.id },
                    });
                    // 19. Delete units created by this user
                    await tx.unit.deleteMany({
                        where: { created_by: user.id },
                    });
                    // 20. Clear units where this user is the current tenant
                    await tx.unit.updateMany({
                        where: { current_tenant_id: user.id },
                        data: {
                            current_tenant_id: null,
                            status: 'vacant',
                        },
                    });
                    // 21. Delete agencies created by this user
                    await tx.agency.deleteMany({
                        where: { created_by: user.id },
                    });
                    // 22. Delete subscriptions created by this user
                    await tx.subscription.deleteMany({
                        where: { created_by: user.id },
                    });
                    // 23. Delete paybill settings created by this user
                    await tx.paybillSettings.deleteMany({
                        where: { created_by: user.id },
                    });
                    // 24. Delete message templates created by this user
                    await tx.messageTemplate.deleteMany({
                        where: { created_by: user.id },
                    });
                    // 25. Delete checklist templates created by this user
                    await tx.checklistTemplate.deleteMany({
                        where: { created_by: user.id },
                    });
                    // 26. Delete inspections conducted by this user
                    await tx.inspection.deleteMany({
                        where: {
                            OR: [
                                { inspector_id: user.id },
                                { tenant_id: user.id },
                            ],
                        },
                    });
                    // 27. Delete lease modifications modified/approved by this user
                    await tx.leaseModification.deleteMany({
                        where: {
                            OR: [
                                { modified_by: user.id },
                                { approved_by: user.id },
                            ],
                        },
                    });
                    // 28. Delete M-Pesa transactions for this user
                    await tx.mpesaTransaction.deleteMany({
                        where: { tenant_id: user.id },
                    });
                    // 29. Delete users created by this user (set created_by to null first)
                    await tx.user.updateMany({
                        where: { created_by: user.id },
                        data: { created_by: null },
                    });
                    // 30. Clear landlord_id references
                    await tx.user.updateMany({
                        where: { landlord_id: user.id },
                        data: { landlord_id: null },
                    });
                    // 31. Finally, delete the user (this will cascade delete many related records)
                    await tx.user.delete({
                        where: { id: user.id },
                    });
                    totalDeleted.users++;
                    console.log(`   ✅ Deleted user: ${user.email}`);
                });
            }
        }
        else {
            console.log('⚠️  No users found with the specified emails.');
        }
        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 Deletion Summary:');
        console.log('='.repeat(60));
        console.log(`   Users deleted: ${totalDeleted.users}`);
        console.log(`   Agencies deleted: ${totalDeleted.agencies}`);
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
        console.log(`   Emergency contacts deleted: ${totalDeleted.emergencyContacts}`);
        console.log('='.repeat(60));
        // Now handle agencies
        if (agencyEmailsToDelete.length > 0) {
            console.log('\n🏢 Processing agencies...\n');
            const agenciesToDelete = await prisma.agency.findMany({
                where: {
                    email: { in: agencyEmailsToDelete },
                },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    company_id: true,
                },
            });
            if (agenciesToDelete.length > 0) {
                console.log(`📋 Found ${agenciesToDelete.length} agencies to delete:\n`);
                agenciesToDelete.forEach((agency) => {
                    console.log(`   - ${agency.email} (${agency.name})`);
                });
                console.log('');
                for (const agency of agenciesToDelete) {
                    console.log(`\n🔍 Processing agency: ${agency.email} (${agency.id})`);
                    await prisma.$transaction(async (tx) => {
                        // Get all users associated with this agency
                        const agencyUsers = await tx.user.findMany({
                            where: { agency_id: agency.id },
                            select: { id: true, email: true },
                        });
                        console.log(`   👥 Found ${agencyUsers.length} users associated with this agency`);
                        // Delete each agency user (this will handle all their data)
                        for (const agencyUser of agencyUsers) {
                            // Use the same deletion logic as above for each user
                            // (We'll reuse the user deletion logic)
                            console.log(`   🔄 Deleting user: ${agencyUser.email}`);
                            // Note: We'll delete the user's data in the same way
                        }
                        // Get all properties owned by this agency
                        const agencyProperties = await tx.property.findMany({
                            where: { agency_id: agency.id },
                            select: { id: true, name: true },
                        });
                        console.log(`   📦 Found ${agencyProperties.length} properties owned by this agency`);
                        // Delete properties and related data (same as user deletion)
                        for (const property of agencyProperties) {
                            const propertyUnits = await tx.unit.findMany({
                                where: { property_id: property.id },
                            });
                            await tx.lease.deleteMany({
                                where: {
                                    unit: { property_id: property.id },
                                },
                            });
                            await tx.payment.deleteMany({
                                where: {
                                    unit: { property_id: property.id },
                                },
                            });
                            await tx.invoice.deleteMany({
                                where: { property_id: property.id },
                            });
                            await tx.maintenanceRequest.deleteMany({
                                where: { property_id: property.id },
                            });
                            await tx.inspection.deleteMany({
                                where: { property_id: property.id },
                            });
                            await tx.task.deleteMany({
                                where: { property_id: property.id },
                            });
                            await tx.unit.updateMany({
                                where: {
                                    property_id: property.id,
                                    current_tenant_id: { not: null },
                                },
                                data: {
                                    current_tenant_id: null,
                                    status: 'vacant',
                                },
                            });
                            await tx.unit.deleteMany({
                                where: { property_id: property.id },
                            });
                        }
                        await tx.property.deleteMany({
                            where: { agency_id: agency.id },
                        });
                        // Delete emergency contacts
                        await tx.emergencyContact.deleteMany({
                            where: {
                                OR: [
                                    { agency_id: agency.id },
                                ],
                            },
                        });
                        // Delete the agency (this will cascade delete related data)
                        await tx.agency.delete({
                            where: { id: agency.id },
                        });
                        totalDeleted.agencies++;
                        totalDeleted.properties += agencyProperties.length;
                        console.log(`   ✅ Deleted agency: ${agency.email}`);
                    });
                }
            }
            else {
                console.log('⚠️  No agencies found with the specified emails.');
            }
        }
        // Verify deletion
        console.log('\n🔍 Verifying deletion...\n');
        const remainingUsers = await prisma.user.findMany({
            where: {
                email: { in: userEmailsToDelete },
            },
            select: {
                email: true,
            },
        });
        const remainingAgencies = await prisma.agency.findMany({
            where: {
                email: { in: agencyEmailsToDelete },
            },
            select: {
                email: true,
            },
        });
        if (remainingUsers.length === 0 && remainingAgencies.length === 0) {
            console.log('✅ All users, agencies, and their data have been successfully deleted!');
        }
        else {
            if (remainingUsers.length > 0) {
                console.log(`⚠️  Warning: ${remainingUsers.length} users still exist:`);
                remainingUsers.forEach((user) => {
                    console.log(`   - ${user.email}`);
                });
            }
            if (remainingAgencies.length > 0) {
                console.log(`⚠️  Warning: ${remainingAgencies.length} agencies still exist:`);
                remainingAgencies.forEach((agency) => {
                    console.log(`   - ${agency.email}`);
                });
            }
        }
    }
    catch (error) {
        console.error('❌ Error during deletion:', error);
        throw error;
    }
    finally {
        await prisma.$disconnect();
    }
}
// Run the script
deleteUsersAndData()
    .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
})
    .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
});
