#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Specific Prisma field corrections based on actual schema
const prismaFieldFixes = {
  // Invoice model corrections
  'invoice.amount': 'invoice.total_amount',
  'amount: true': 'total_amount: true',
  'amount ?': 'total_amount ?',
  'amount:': 'total_amount:',
  'amount }': 'total_amount }',
  'amount,': 'total_amount,',
  'amount)': 'total_amount)',
  
  // User model corrections (already snake_case in schema)
  'first_name: true': 'first_name: true', // Keep as is
  'last_name: true': 'last_name: true',   // Keep as is
  
  // Unit model corrections
  'unit_number: true': 'unit_number: true', // Keep as is
  
  // Fix property access patterns
  '.amount': '.total_amount',
  
  // Fix orderBy patterns
  'createdAt:': 'created_at:',
  'updatedAt:': 'updated_at:',
};

function fixPrismaFields(content) {
  let fixedContent = content;
  
  // Fix invoice amount field references
  fixedContent = fixedContent.replace(/invoice\.amount/g, 'invoice.total_amount');
  fixedContent = fixedContent.replace(/(\s+)amount:\s*true/g, '$1total_amount: true');
  
  // Fix where clause field names
  fixedContent = fixedContent.replace(/(\s+)createdAt:\s*{/g, '$1created_at: {');
  
  // Fix orderBy field names
  fixedContent = fixedContent.replace(/orderBy:\s*{\s*createdAt:/g, 'orderBy: {\n    created_at:');
  
  // Fix specific field access patterns
  fixedContent = fixedContent.replace(/\.amount\s*\?/g, '.total_amount ?');
  fixedContent = fixedContent.replace(/Number\(invoice\.amount\)/g, 'Number(invoice.total_amount)');
  fixedContent = fixedContent.replace(/invoice\.amount\s*\?/g, 'invoice.total_amount ?');
  
  return fixedContent;
}

// Files to process
const filesToProcess = [
  'src/services/reports.service.ts',
  'src/services/notifications.service.ts',
  'src/services/leases.service.ts',
];

function processFile(filePath) {
  try {
    const fullPath = path.join(__dirname, filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`Skipping ${filePath} - file not found`);
      return;
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    const fixedContent = fixPrismaFields(content);
    
    if (content !== fixedContent) {
      fs.writeFileSync(fullPath, fixedContent, 'utf8');
      console.log(`✅ Fixed Prisma fields in ${filePath}`);
    } else {
      console.log(`⏭️  No changes needed in ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

console.log('🔧 Fixing Prisma field mismatches...\n');

filesToProcess.forEach(processFile);

console.log('\n✨ Prisma field fixes completed!');
