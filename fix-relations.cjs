const fs = require('fs');
const path = require('path');

// Fix all the relation and field issues
const fixes = [
  // Fix relation names
  { from: 'users_properties_owner_idTousers', to: 'owner' },
  { from: 'units_units_current_tenant_idTousers', to: 'assigned_units' },
  { from: 'users_users_created_byTousers', to: 'creator' },
  { from: 'properties:', to: 'property:' },
  
  // Fix field access patterns
  { from: 'unit.properties', to: 'unit.property' },
  { from: 'currentUnit.properties', to: 'currentUnit.property' },
  { from: 'tenant.units_units_current_tenant_idTousers', to: 'tenant.assigned_units' },
  
  // Fix where clause issues
  { from: 'properties: whereClause', to: 'property: whereClause' },
  { from: 'properties: {', to: 'property: {' },
  
  // Fix count issues
  { from: 'unitsStats._count.id', to: 'unitsStats._count._all' },
  
  // Fix company_id issues
  { from: 'company_id: companyId,', to: 'company_id: companyId!,' },
  
  // Fix enum issues
  { from: "'pending_setup'", to: "'pending'" },
  
  // Fix JWT claims
  { from: 'nbf: Math.floor(Date.now() / 1000),', to: '// nbf: Math.floor(Date.now() / 1000),' },
  
  // Fix company lookup
  { from: 'where: { name: companyName }', to: 'where: { id: companyName }' }
];

function fixFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  for (const fix of fixes) {
    if (content.includes(fix.from)) {
      content = content.replace(new RegExp(fix.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), fix.to);
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
