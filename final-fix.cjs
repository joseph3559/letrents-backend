const fs = require('fs');
const path = require('path');

// Final comprehensive fixes
const fixes = [
  // Fix JWT claims
  { from: 'aud: env.jwt.audience,', to: '// aud: env.jwt.audience,' },
  
  // Fix company creation
  { from: 'max_property: 100,', to: 'max_properties: 100,' },
  
  // Fix count access
  { from: 'unitsStats._count._all', to: 'unitsStats._count?.id' },
  
  // Fix relation names in includes
  { from: 'agencies:', to: 'agency:' },
  { from: 'users_units_current_tenant_idTousers:', to: 'current_tenant:' },
  
  // Fix property access
  { from: 'unitInfo.properties?.name', to: 'unitInfo.property?.name' },
  { from: 'unitInfo?.properties?.name', to: 'unitInfo?.property?.name' }
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

console.log(`Applying final fixes to ${tsFiles.length} TypeScript files...`);
tsFiles.forEach(fixFile);
console.log('Done!');
