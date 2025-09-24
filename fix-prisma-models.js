const fs = require('fs');
const path = require('path');

// Mapping of plural to singular model names
const modelMappings = {
  'users': 'user',
  'companies': 'company',
  'agencies': 'agency',
  'properties': 'property',
  'units': 'unit',
  'refresh_tokens': 'refreshToken',
  'password_reset_tokens': 'passwordResetToken',
  'email_verification_tokens': 'emailVerificationToken',
  'user_sessions': 'userSession',
  'conversations': 'conversation',
  'messages': 'message',
  'message_recipients': 'messageRecipient',
  'message_templates': 'messageTemplate',
  'notifications': 'notification',
  'notification_preferences': 'notificationPreference',
  'maintenance_requests': 'maintenanceRequest',
  'invoices': 'invoice',
  'invoice_line_items': 'invoiceLineItem',
  'tenant_profiles': 'tenantProfile'
};

// Also fix the JwtClaims -> JWTClaims issue
const typeMappings = {
  'JwtClaims': 'JWTClaims'
};

function fixFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  // Fix Prisma model references
  for (const [plural, singular] of Object.entries(modelMappings)) {
    const regex = new RegExp(`this\\.prisma\\.${plural}`, 'g');
    if (content.match(regex)) {
      content = content.replace(regex, `this.prisma.${singular}`);
      changed = true;
    }
  }
  
  // Fix type imports
  for (const [oldType, newType] of Object.entries(typeMappings)) {
    const regex = new RegExp(`\\b${oldType}\\b`, 'g');
    if (content.match(regex)) {
      content = content.replace(regex, newType);
      changed = true;
    }
  }
  
  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${filePath}`);
  }
}

// Get all TypeScript files in src directory
function getAllTsFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...getAllTsFiles(fullPath));
    } else if (item.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Fix all TypeScript files
const srcDir = path.join(__dirname, 'src');
const tsFiles = getAllTsFiles(srcDir);

console.log(`Fixing ${tsFiles.length} TypeScript files...`);
tsFiles.forEach(fixFile);
console.log('Done!');
