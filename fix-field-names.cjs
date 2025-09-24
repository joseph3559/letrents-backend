#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Field mappings from camelCase to snake_case (Prisma schema)
const fieldMappings = {
  // User fields
  'firstName': 'first_name',
  'lastName': 'last_name',
  'phoneNumber': 'phone_number',
  'userId': 'user_id',
  'companyId': 'company_id',
  'agencyId': 'agency_id',
  'landlordId': 'landlord_id',
  'createdAt': 'created_at',
  'updatedAt': 'updated_at',
  'createdBy': 'created_by',
  
  // Unit fields
  'unitNumber': 'unit_number',
  'unitType': 'unit_type',
  'rentAmount': 'rent_amount',
  'depositAmount': 'deposit_amount',
  'currentTenantId': 'current_tenant_id',
  'leaseStartDate': 'lease_start_date',
  'leaseEndDate': 'lease_end_date',
  
  // Invoice fields
  'invoiceNumber': 'invoice_number',
  'dueDate': 'due_date',
  'paymentDate': 'payment_date',
  
  // Notification fields
  'isRead': 'is_read',
  'readAt': 'read_at',
  'recipientId': 'recipient_id',
  'senderId': 'sender_id',
  'recipientType': 'recipient_type',
  
  // Property fields
  'postalCode': 'postal_code',
  'yearBuilt': 'year_built',
  'numberOfUnits': 'number_of_units',
  'numberOfBedrooms': 'number_of_bedrooms',
  'numberOfBathrooms': 'number_of_bathrooms',
  'sizeSquareFeet': 'size_square_feet',
  'furnishingType': 'furnishing_type',
  'ownershipType': 'ownership_type',
  'ownerId': 'owner_id',
  'propertyId': 'property_id',
  'unitId': 'unit_id',
  'tenantId': 'tenant_id',
  'estimatedValue': 'estimated_value',
  'lastRenovation': 'last_renovation',
  'serviceChargeRate': 'service_charge_rate',
  'serviceChargeType': 'service_charge_type',
  'accessControl': 'access_control',
  'maintenanceSchedule': 'maintenance_schedule',
  
  // Maintenance fields
  'scheduledDate': 'scheduled_date',
  'completedAt': 'completed_at',
  'assignedToId': 'assigned_to_id',
  'estimatedCost': 'estimated_cost',
  'actualCost': 'actual_cost',
  'internalNotes': 'internal_notes',
  
  // Lease fields
  'startDate': 'start_date',
  'endDate': 'end_date',
  'leaseType': 'lease_type',
  'terminationReason': 'termination_reason',
  'terminationNotice': 'termination_notice',
  'previousLeaseId': 'previous_lease_id',
  'renewedLeaseId': 'renewed_lease_id',
  
  // Tenant fields
  'moveInDate': 'move_in_date',
  'idNumber': 'id_number',
  'emergencyContact': 'emergency_contact',
  'employmentInfo': 'employment_info',
  'paymentFrequency': 'payment_frequency',
  'paymentDay': 'payment_day',
};

// Files to process
const filesToProcess = [
  'src/services/caretakers.service.ts',
  'src/services/leases.service.ts', 
  'src/services/notifications.service.ts',
  'src/services/reports.service.ts',
  'src/controllers/caretakers.controller.ts',
  'src/controllers/leases.controller.ts',
  'src/controllers/notifications.controller.ts',
  'src/controllers/reports.controller.ts',
];

function fixFieldNames(content) {
  let fixedContent = content;
  
  // Fix Prisma select/include field names
  for (const [camelCase, snakeCase] of Object.entries(fieldMappings)) {
    // Fix in select objects: firstName: true -> first_name: true
    fixedContent = fixedContent.replace(
      new RegExp(`(\\s+)${camelCase}:\\s*true`, 'g'),
      `$1${snakeCase}: true`
    );
    
    // Fix in where clauses: user.firstName -> user.first_name  
    fixedContent = fixedContent.replace(
      new RegExp(`\\.${camelCase}(\\s|\\.|\\?|\\!)`, 'g'),
      `.${snakeCase}$1`
    );
    
    // Fix in data objects: firstName: value -> first_name: value
    fixedContent = fixedContent.replace(
      new RegExp(`(\\s+)${camelCase}:\\s*([^,\\n}]+)`, 'g'),
      `$1${snakeCase}: $2`
    );
  }
  
  // Fix specific JWT claims field access patterns
  fixedContent = fixedContent.replace(/user\.userId/g, 'user.user_id');
  fixedContent = fixedContent.replace(/user\.companyId/g, 'user.company_id');
  fixedContent = fixedContent.replace(/user\.agencyId/g, 'user.agency_id');
  fixedContent = fixedContent.replace(/user\.landlordId/g, 'user.landlord_id');
  
  // Fix Prisma updateMany data field names
  fixedContent = fixedContent.replace(/isRead:\s*true/g, 'is_read: true');
  fixedContent = fixedContent.replace(/readAt:\s*new Date\(\)/g, 'read_at: new Date()');
  
  // Fix Prisma where clause field names
  fixedContent = fixedContent.replace(/createdAt:\s*{/g, 'created_at: {');
  
  return fixedContent;
}

function processFile(filePath) {
  try {
    const fullPath = path.join(__dirname, filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`Skipping ${filePath} - file not found`);
      return;
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    const fixedContent = fixFieldNames(content);
    
    if (content !== fixedContent) {
      fs.writeFileSync(fullPath, fixedContent, 'utf8');
      console.log(`✅ Fixed field names in ${filePath}`);
    } else {
      console.log(`⏭️  No changes needed in ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

console.log('🔧 Fixing field name mismatches...\n');

filesToProcess.forEach(processFile);

console.log('\n✨ Field name fixes completed!');
