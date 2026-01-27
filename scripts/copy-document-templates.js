import fs from 'fs';
import path from 'path';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Source templates directory not found: ${src}`);
  }
  ensureDir(dest);

  // Node 16+ supports fs.cpSync
  fs.cpSync(src, dest, { recursive: true });
}

const backendRoot = process.cwd();
const srcTemplates = path.join(backendRoot, 'src', 'modules', 'documents', 'templates');
const distTemplates = path.join(backendRoot, 'dist', 'src', 'modules', 'documents', 'templates');

copyDir(srcTemplates, distTemplates);
console.log(`✅ Copied document templates to dist: ${distTemplates}`);

