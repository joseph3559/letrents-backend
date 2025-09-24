#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function fixControllers(content) {
  let fixed = content;
  
  // Fix response function imports and usage
  fixed = fixed.replace(/import { successResponse, errorResponse }/g, 'import { writeSuccess, writeError }');
  fixed = fixed.replace(/successResponse\(/g, 'writeSuccess(');
  fixed = fixed.replace(/errorResponse\(/g, 'writeError(');
  
  // Fix AuthenticatedRequest import (remove it since we don't have it)
  fixed = fixed.replace(/, AuthenticatedRequest/g, '');
  
  // Fix req.user access (go back to simple casting)
  fixed = fixed.replace(/const user = \(req as AuthenticatedRequest\)\.user;/g, 'const user = (req as any).user as JWTClaims;');
  
  // Fix writeSuccess calls to match the actual function signature
  // writeSuccess(res, status, message, data)
  fixed = fixed.replace(/writeSuccess\(res, ([^,]+), ([^,]+), (\d+)\)/g, 'writeSuccess(res, $3, $2, $1)');
  fixed = fixed.replace(/writeSuccess\(res, null, ([^,]+)\)/g, 'writeSuccess(res, 200, $1)');
  
  // Fix writeError calls to match the actual function signature  
  // writeError(res, status, message, error)
  fixed = fixed.replace(/writeError\(res, ([^,]+), (\d+)\)/g, 'writeError(res, $2, $1)');
  
  return fixed;
}

const controllerFiles = [
  'src/controllers/caretakers.controller.ts',
  'src/controllers/leases.controller.ts', 
  'src/controllers/notifications.controller.ts',
  'src/controllers/reports.controller.ts'
];

function processFile(filePath) {
  try {
    const fullPath = path.join(__dirname, filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`Skipping ${filePath} - file not found`);
      return;
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    const fixedContent = fixControllers(content);
    
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

console.log('🔧 Final controller fixes...\n');

controllerFiles.forEach(processFile);

console.log('\n✨ Controller fixes completed!');
