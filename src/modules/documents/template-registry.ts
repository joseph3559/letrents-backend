import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { TemplateKey } from './document-types.js';

export interface LoadedTemplate {
  key: TemplateKey;
  html: string;
  css: string;
}

/**
 * Loads versioned HTML/CSS templates from disk.
 *
 * Runtime lookup order:
 * - Prefer templates co-located with compiled JS (dist) in production
 * - Fall back to src templates during development
 */
export class TemplateRegistry {
  private cache = new Map<string, LoadedTemplate>();

  private resolveTemplatesRoot(): string {
    // When compiled, this file lives at dist/src/modules/documents/...
    // We expect templates to be copied alongside it at build time.
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // dist case: dist/src/modules/documents/templates
    const distCandidate = path.resolve(__dirname, 'templates');
    if (fs.existsSync(distCandidate)) return distCandidate;

    // dev fallback: backend/src/modules/documents/templates (relative to cwd)
    const srcCandidate = path.resolve(process.cwd(), 'src/modules/documents/templates');
    return srcCandidate;
  }

  private cacheKey(key: TemplateKey): string {
    return `${key.documentType}@v${key.version}`;
  }

  load(key: TemplateKey): LoadedTemplate {
    const ck = this.cacheKey(key);
    const cached = this.cache.get(ck);
    if (cached) return cached;

    const root = this.resolveTemplatesRoot();
    const baseCssPath = path.join(root, 'base', 'base.css');
    const baseCss = fs.readFileSync(baseCssPath, 'utf-8');

    const dir = path.join(root, key.documentType, `v${key.version}`);
    const htmlPath = path.join(dir, 'template.html');
    const cssPath = path.join(dir, 'template.css');

    const html = fs.readFileSync(htmlPath, 'utf-8');
    const css = `${baseCss}\n\n${fs.readFileSync(cssPath, 'utf-8')}`;

    const loaded: LoadedTemplate = { key, html, css };
    this.cache.set(ck, loaded);
    return loaded;
  }

  /**
   * Clear the template cache to force reload from disk.
   * Useful during development when templates are updated.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear cache for a specific template.
   */
  clearTemplate(key: TemplateKey): void {
    const ck = this.cacheKey(key);
    this.cache.delete(ck);
  }
}

