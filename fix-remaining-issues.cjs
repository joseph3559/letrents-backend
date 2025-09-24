#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function fixControllerImports(content) {
  let fixed = content;
  
  // Fix response function imports
  fixed = fixed.replace(/import { sendSuccess, sendError }/g, 'import { successResponse, errorResponse }');
  fixed = fixed.replace(/sendSuccess\(/g, 'successResponse(');
  fixed = fixed.replace(/sendError\(/g, 'errorResponse(');
  
  // Fix JWTClaims import and add AuthenticatedRequest
  fixed = fixed.replace(
    /import { JWTClaims } from/g, 
    'import { JWTClaims, AuthenticatedRequest } from'
  );
  
  // Fix req.user type casting
  fixed = fixed.replace(/const user = req\.user as JWTClaims;/g, 'const user = (req as AuthenticatedRequest).user;');
  
  return fixed;
}

function fixRouteImports(content) {
  let fixed = content;
  
  // Fix auth middleware imports
  fixed = fixed.replace(/import { authMiddleware }/g, 'import { requireAuth }');
  fixed = fixed.replace(/authMiddleware\.requireAuth/g, 'requireAuth');
  
  return fixed;
}

function fixServiceIssues(content) {
  let fixed = content;
  
  // Fix Prisma model names that don't exist
  fixed = fixed.replace(/prisma\.lease\./g, 'prisma.lease.');  // This will need manual fix since Lease model doesn't exist
  
  // Fix field access patterns
  fixed = fixed.replace(/\.rentAmount/g, '.rent_amount');
  fixed = fixed.replace(/\.unitNumber/g, '.unit_number');
  fixed = fixed.replace(/\.unitType/g, '.unit_type');
  fixed = fixed.replace(/\.firstName/g, '.first_name');
  fixed = fixed.replace(/\.lastName/g, '.last_name');
  fixed = fixed.replace(/\.createdAt/g, '.created_at');
  fixed = fixed.replace(/\.invoiceNumber/g, '.invoice_number');
  fixed = fixed.replace(/\.dueDate/g, '.due_date');
  fixed = fixed.replace(/\.currentTenant/g, '.current_tenant');
  
  // Fix variable names
  fixed = fixed.replace(/let startDate:/g, 'let start_date:');
  fixed = fixed.replace(/startDate =/g, 'start_date =');
  fixed = fixed.replace(/startDate\./g, 'start_date.');
  
  // Fix Prisma select field names
  fixed = fixed.replace(/emailVerified: true/g, 'email_verified: true');
  fixed = fixed.replace(/currentTenant: {/g, 'current_tenant: {');
  
  // Fix Prisma update data field names
  fixed = fixed.replace(/password: hashedPassword/g, 'password_hash: hashedPassword');
  
  return fixed;
}

const fixes = [
  {
    files: [
      'src/controllers/caretakers.controller.ts',
      'src/controllers/leases.controller.ts', 
      'src/controllers/notifications.controller.ts',
      'src/controllers/reports.controller.ts'
    ],
    fix: fixControllerImports
  },
  {
    files: [
      'src/routes/caretakers.ts',
      'src/routes/leases.ts',
      'src/routes/notifications.ts', 
      'src/routes/reports.ts'
    ],
    fix: fixRouteImports
  },
  {
    files: [
      'src/services/caretakers.service.ts',
      'src/services/reports.service.ts'
    ],
    fix: fixServiceIssues
  }
];

function processFile(filePath, fixFunction) {
  try {
    const fullPath = path.join(__dirname, filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`Skipping ${filePath} - file not found`);
      return;
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    const fixedContent = fixFunction(content);
    
    if (content !== fixedContent) {
      fs.writeFileSync(fullPath, fixedContent, 'utf8');
      console.log(`✅ Fixed ${filePath}`);
    } else {
      console.log(`⏭️  No changes needed in ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

console.log('🔧 Fixing remaining TypeScript issues...\n');

fixes.forEach(({ files, fix }) => {
  files.forEach(file => processFile(file, fix));
});

console.log('\n✨ Remaining fixes completed!');
