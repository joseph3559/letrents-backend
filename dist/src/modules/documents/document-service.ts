import { getPrisma } from '../../config/prisma.js';
import type { JWTClaims } from '../../types/index.js';
import type { DocumentType, TemplateVersion } from './document-types.js';
import { TemplateRegistry } from './template-registry.js';
import { renderTemplate } from './simple-template.js';
import { HtmlToPdfRenderer } from './html-to-pdf-renderer.js';
import { formatDate, formatDateTime, formatMoney } from './formatters.js';
import { verificationService } from '../../services/verification.service.js';
import crypto from 'crypto';

type PdfBuffer = Buffer;

function toNumber(val: any): number {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function escapeAttr(s: string): string {
  return String(s).replaceAll('"', '&quot;');
}

function buildLineItemsTable(items: Array<{ description: string; quantity?: number; unit_price?: number; total_price?: number }>, currency: string): string {
  const rows = items.map((it) => {
    const qty = it.quantity ?? 1;
    const unitPrice = it.unit_price ?? it.total_price ?? 0;
    const total = it.total_price ?? (qty * unitPrice);
    return `
      <tr>
        <td class="col-desc">${escapeAttr(it.description || '')}</td>
        <td class="col-qty num">${qty}</td>
        <td class="col-unit num">${formatMoney(unitPrice, currency)}</td>
        <td class="col-total num">${formatMoney(total, currency)}</td>
      </tr>`;
  }).join('\n');

  return `
    <table class="table">
      <thead>
        <tr>
          <th>Description</th>
          <th class="num">Qty</th>
          <th class="num">Unit price</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="4" class="muted">No line items</td></tr>`}
      </tbody>
    </table>
  `;
}

function buildKeyValueRows(rows: Array<{ label: string; value: string }>): string {
  return rows.map(r => `
    <div class="kv">
      <div class="kv-label">${escapeAttr(r.label)}</div>
      <div class="kv-value">${escapeAttr(r.value)}</div>
    </div>
  `).join('\n');
}

interface CacheEntry {
  expiresAt: number;
  value: PdfBuffer;
}

export class DocumentService {
  private prisma = getPrisma();
  private templates = new TemplateRegistry();
  private renderer = new HtmlToPdfRenderer();

  private cache = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<PdfBuffer>>();

  private cacheKey(parts: Record<string, string | number | undefined>): string {
    return Object.entries(parts)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
  }

  private getCached(key: string): PdfBuffer | null {
    const e = this.cache.get(key);
    if (!e) return null;
    if (Date.now() > e.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return e.value;
  }

  private setCached(key: string, value: PdfBuffer, ttlMs: number): void {
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /**
   * Clear template cache to force reload from disk.
   * Useful during development when templates are updated.
   */
  clearTemplateCache(documentType?: DocumentType, version?: TemplateVersion): void {
    if (documentType && version) {
      this.templates.clearTemplate({ documentType, version });
    } else {
      this.templates.clearCache();
    }
  }

  private async renderDocument(
    documentType: DocumentType,
    version: TemplateVersion,
    context: Record<string, unknown>,
    cacheKey: string
  ): Promise<PdfBuffer> {
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const existingInFlight = this.inFlight.get(cacheKey);
    if (existingInFlight) return existingInFlight;

    const p = (async () => {
      const tpl = this.templates.load({ documentType, version });
      await this.upsertTemplateRecord(documentType, version, tpl.html, tpl.css);
      const fullHtml = renderTemplate(tpl.html, {
        ...context,
        css: tpl.css,
      });
      
      // Debug: Log rendered HTML snippet for payment receipts
      if (documentType === 'payment_receipt') {
        // Check if template placeholders were replaced
        const hasUnreplacedPlaceholders = fullHtml.includes('{{sections.') || fullHtml.includes('{{{sections.');
        console.log('Has unreplaced placeholders:', hasUnreplacedPlaceholders);
        
        // Check if QR code SVG is present
        const hasQrSvg = fullHtml.includes('<svg') && fullHtml.includes('qr-container');
        const qrSectionIndex = fullHtml.indexOf('qr-section');
        if (qrSectionIndex > -1) {
          const qrSnippet = fullHtml.substring(qrSectionIndex, qrSectionIndex + 500);
          console.log('QR Section HTML:', qrSnippet);
          console.log('QR Section contains SVG:', qrSnippet.includes('<svg'));
        }
        
        // Check if actual content is present
        const hasInfoRows = fullHtml.includes('info-row');
        const hasBreakdownTable = fullHtml.includes('breakdown-table');
        const hasInfoPanel = fullHtml.includes('info-panel');
        
        console.log('Rendered HTML Check:', {
          hasInfoRows,
          hasBreakdownTable,
          hasInfoPanel,
          hasQrSvg,
          htmlLength: fullHtml.length,
        });
        
        // Log a snippet around the sections area
        const sectionsIndex = fullHtml.indexOf('sections-grid');
        if (sectionsIndex > -1) {
          const snippet = fullHtml.substring(sectionsIndex, sectionsIndex + 1000);
          console.log('Sections area HTML snippet:', snippet.substring(0, 500));
        }
      }
      
      const pdf = await this.renderer.renderPdfFromHtml(fullHtml, { format: 'A4' });
      this.setCached(cacheKey, pdf, 5 * 60 * 1000); // 5 min TTL
      return pdf;
    })().finally(() => {
      this.inFlight.delete(cacheKey);
    });

    this.inFlight.set(cacheKey, p);
    return p;
  }

  private templateChecksum(html: string, css: string): string {
    return crypto.createHash('sha256').update(html).update('\n/*css*/\n').update(css).digest('hex');
  }

  private async upsertTemplateRecord(documentType: DocumentType, version: TemplateVersion, html: string, css: string): Promise<void> {
    // Persist template content+checksum for auditability/versioning.
    // This does NOT change runtime loading (still filesystem), but ensures templates are tracked centrally.
    const checksum = this.templateChecksum(html, css);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;
    if (!prismaAny.documentTemplate) return;

    try {
      await prismaAny.documentTemplate.upsert({
        where: {
          document_type_version: { document_type: documentType, version },
        },
        update: {
          html,
          css,
          checksum,
          updated_at: new Date(),
        },
        create: {
          document_type: documentType,
          version,
          html,
          css,
          checksum,
        },
      });
    } catch {
      // Template tracking should never break document generation.
    }
  }

  private async getLatestSnapshot(documentType: DocumentType, entityType: string, entityId: string): Promise<any | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;
    if (!prismaAny.documentSnapshot) return null;
    return prismaAny.documentSnapshot.findFirst({
      where: {
        document_type: documentType,
        entity_type: entityType,
        entity_id: entityId,
      },
      orderBy: { revision: 'desc' },
    });
  }

  private async createSnapshotIfMissing(
    documentType: DocumentType,
    entityType: string,
    entityId: string,
    documentNumber: string | null,
    templateVersion: number,
    context: Record<string, unknown>,
    user: JWTClaims
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;
    if (!prismaAny.documentSnapshot) return;

    const existing = await this.getLatestSnapshot(documentType, entityType, entityId);
    if (existing) return;

    try {
      await prismaAny.documentSnapshot.create({
        data: {
          document_type: documentType,
          entity_type: entityType,
          entity_id: entityId,
          document_number: documentNumber,
          revision: 1,
          template_version: templateVersion,
          render_context: context,
          renderer_version: 'playwright',
          generated_by: user.user_id || null,
          generated_at: new Date(),
        },
      });
    } catch {
      // Snapshot recording should never break document generation.
    }
  }

  private async createSnapshotRevision(
    documentType: DocumentType,
    entityType: string,
    entityId: string,
    documentNumber: string | null,
    templateVersion: number,
    context: Record<string, unknown>,
    user: JWTClaims
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;
    if (!prismaAny.documentSnapshot) return;

    const latest = await this.getLatestSnapshot(documentType, entityType, entityId);
    const nextRevision = latest?.revision ? Number(latest.revision) + 1 : 1;

    try {
      await prismaAny.documentSnapshot.create({
        data: {
          document_type: documentType,
          entity_type: entityType,
          entity_id: entityId,
          document_number: documentNumber,
          revision: nextRevision,
          template_version: templateVersion,
          render_context: context,
          renderer_version: 'playwright',
          generated_by: user.user_id || null,
          generated_at: new Date(),
        },
      });
    } catch {
      // Snapshot recording should never break business flows.
    }
  }

  private buildInvoiceContext(invoice: any, qrCodeSvg: string = '', qrUrl: string = '', verificationToken: string = ''): Record<string, unknown> {
    const currency = invoice.currency || 'KES';
    const lineItems = (invoice.line_items || []).map((li: any) => ({
      description: li.description,
      quantity: toNumber(li.quantity),
      unit_price: toNumber(li.unit_price),
      total_price: toNumber(li.total_price),
    }));

    // Build totals rows (excluding grand total which is shown separately)
    const totalsRows: Array<{ label: string; value: string }> = [];
    const subtotal = toNumber(invoice.subtotal);
    const tax = toNumber(invoice.tax_amount);
    const discount = toNumber(invoice.discount_amount);
    
    if (subtotal > 0) {
      totalsRows.push({ label: 'Subtotal', value: formatMoney(subtotal, currency) });
    }
    if (tax > 0) {
      totalsRows.push({ label: 'Tax', value: formatMoney(tax, currency) });
    }
    if (discount > 0) {
      totalsRows.push({ label: 'Discount', value: formatMoney(discount, currency) });
    }

    return {
      meta: {
        documentTitle: 'Invoice',
        generatedAt: formatDateTime(new Date()),
        systemName: 'LetRents',
        supportEmail: 'support@letrents.com',
      },
      company: {
        name: invoice.company?.name || 'LetRents',
        address:
          invoice.company?.address ||
          [invoice.company?.street, invoice.company?.city, invoice.company?.region, invoice.company?.country]
            .filter(Boolean)
            .join(', ') || 'N/A',
        email: invoice.company?.email || 'N/A',
        phone: invoice.company?.phone_number || 'N/A',
        metaHtml: (() => {
          const address = invoice.company?.address ||
            [invoice.company?.street, invoice.company?.city, invoice.company?.region, invoice.company?.country]
              .filter(Boolean)
              .join(', ');
          const email = invoice.company?.email;
          const phone = invoice.company?.phone_number;
          
          const parts = [];
          if (address) parts.push(`<div class="company-meta">${escapeAttr(address)}</div>`);
          if (email || phone) {
            const contact = [email, phone].filter(Boolean).join(' | ');
            parts.push(`<div class="company-meta">${escapeAttr(contact)}</div>`);
          }
          return parts.join('\n') || '<div class="company-meta">N/A</div>';
        })(),
      },
      invoice: {
        invoiceNumber: invoice.invoice_number || '',
        status: String(invoice.status).toUpperCase(),
        statusClass: `status-${String(invoice.status).toUpperCase()}`,
        issueDate: formatDate(invoice.issue_date),
        dueDate: formatDate(invoice.due_date),
        paidDate: invoice.paid_date ? formatDate(invoice.paid_date) : '',
        title: invoice.title || 'Invoice',
        description: invoice.description || '',
        currency,
        subtotal: formatMoney(subtotal, currency),
        tax: formatMoney(tax, currency),
        discount: formatMoney(discount, currency),
        total: formatMoney(toNumber(invoice.total_amount), currency),
        paymentMethod: invoice.payment_method || '',
        paymentReference: invoice.payment_reference || '',
      },
      billTo: {
        name: invoice.recipient ? `${invoice.recipient.first_name || ''} ${invoice.recipient.last_name || ''}`.trim() : 'N/A',
        email: invoice.recipient?.email || 'N/A',
        phone: invoice.recipient?.phone_number || 'N/A',
      },
      property: {
        name: invoice.property?.name || 'N/A',
        address: [invoice.property?.street, invoice.property?.city, invoice.property?.region, invoice.property?.country]
          .filter(Boolean)
          .join(', ') || 'N/A',
        unitNumber: invoice.unit?.unit_number || 'N/A',
      },
      sections: {
        lineItemsTable: buildLineItemsTable(lineItems, currency),
        billToRows: this.buildInfoRows([
          { label: 'Name', value: invoice.recipient ? `${invoice.recipient.first_name || ''} ${invoice.recipient.last_name || ''}`.trim() || 'N/A' : 'N/A' },
          { label: 'Email', value: invoice.recipient?.email || 'N/A' },
          { label: 'Phone', value: invoice.recipient?.phone_number || 'N/A' },
        ]),
        invoiceInfoRows: this.buildInfoRows([
          { label: 'Issue Date', value: formatDate(invoice.issue_date) },
          { label: 'Due Date', value: formatDate(invoice.due_date) },
          ...(invoice.paid_date ? [{ label: 'Paid Date', value: formatDate(invoice.paid_date) }] : []),
        ]),
        propertySection: invoice.property?.name ? `
          <div class="info-section">
            <div class="section-title">Property Information</div>
            <div class="info-panel">
              ${this.buildInfoRows([
                ...(invoice.property?.name ? [{ label: 'Property', value: invoice.property.name }] : []),
                ...(invoice.unit?.unit_number ? [{ label: 'Unit Number', value: invoice.unit.unit_number }] : []),
              ])}
            </div>
          </div>
        ` : '',
        totalsRows: totalsRows.length > 0 ? totalsRows.map(t => `
          <div class="totals-row">
            <span>${escapeAttr(t.label)}</span>
            <span>${escapeAttr(t.value)}</span>
          </div>
        `).join('\n') : '',
        notesSection: invoice.description ? `
          <div class="notes-section">
            <div class="section-title">Notes</div>
            <div class="notes-content">${escapeAttr(invoice.description)}</div>
          </div>
        ` : '',
        qrCodeSvg: qrCodeSvg,
        qrUrl: qrUrl,
        verificationToken: verificationToken,
      },
    };
  }

  private buildPaymentReceiptContext(payment: any, invoice: any = null, qrCodeSvg: string = '', qrUrl: string = '', verificationToken: string = ''): Record<string, unknown> {
    const currency = payment.currency || 'KES';
    
    // Build breakdown table from invoice line items if available, otherwise create simple breakdown
    let breakdownTable = '';
    if (invoice?.line_items && invoice.line_items.length > 0) {
      const lineItems = invoice.line_items.map((li: any) => ({
        description: li.description || 'Rent',
        amount: formatMoney(toNumber(li.total_price || li.unit_price || payment.amount), currency),
      }));
      breakdownTable = this.buildPaymentBreakdownTable(lineItems, formatMoney(toNumber(payment.amount), currency), currency);
    } else {
      // Simple breakdown: just the payment amount
      const description = payment.payment_period 
        ? `Rent (${payment.payment_period})`
        : invoice?.title || 'Rent Payment';
      breakdownTable = this.buildPaymentBreakdownTable(
        [{ description, amount: formatMoney(toNumber(payment.amount), currency) }],
        formatMoney(toNumber(payment.amount), currency),
        currency
      );
    }

    return {
      meta: {
        documentTitle: 'Payment Receipt',
        generatedAt: formatDateTime(new Date()),
        systemName: 'LetRents',
        supportEmail: 'support@letrents.com',
      },
      company: {
        name: payment.company?.name || 'LetRents',
        address:
          payment.company?.address ||
          [payment.company?.street, payment.company?.city, payment.company?.region, payment.company?.country]
            .filter(Boolean)
            .join(', ') || 'N/A',
        email: payment.company?.email || 'N/A',
        phone: payment.company?.phone_number || 'N/A',
        registrationNumber: payment.company?.registration_number || '',
        metaHtml: (() => {
          const address = payment.company?.address ||
            [payment.company?.street, payment.company?.city, payment.company?.region, payment.company?.country]
              .filter(Boolean)
              .join(', ');
          const email = payment.company?.email;
          const phone = payment.company?.phone_number;
          
          const parts = [];
          if (address) parts.push(`<div class="company-meta">${escapeAttr(address)}</div>`);
          if (email || phone) {
            const contact = [email, phone].filter(Boolean).join(' | ');
            parts.push(`<div class="company-meta">${escapeAttr(contact)}</div>`);
          }
          return parts.join('\n') || '<div class="company-meta">N/A</div>';
        })(),
      },
      receipt: {
        receiptNumber: payment.receipt_number || '',
        status: String(payment.status).toUpperCase(),
        statusClass: `status-${String(payment.status).toUpperCase()}`,
        paymentDate: formatDateTime(payment.payment_date),
        amount: formatMoney(toNumber(payment.amount), currency),
        currency,
        method: String(payment.payment_method).toUpperCase(),
        referenceNumber: payment.reference_number || '',
        transactionId: payment.transaction_id || '',
        paymentPeriod: payment.payment_period || '',
        notes: payment.notes || '',
      },
      receivedFrom: {
        name: payment.tenant ? `${payment.tenant.first_name || ''} ${payment.tenant.last_name || ''}`.trim() : (payment.received_from || 'N/A'),
        email: payment.tenant?.email || 'N/A',
        phone: payment.tenant?.phone_number || 'N/A',
      },
      property: {
        name: payment.property?.name || 'N/A',
        unitNumber: payment.unit?.unit_number || 'N/A',
        rentalPeriod: payment.payment_period || 'N/A',
      },
      sections: {
        detailsRows: buildKeyValueRows([
          { label: 'Receipt number', value: payment.receipt_number },
          ...(payment.reference_number ? [{ label: 'Reference', value: payment.reference_number }] : []),
          ...(payment.transaction_id ? [{ label: 'Transaction ID', value: payment.transaction_id }] : []),
          { label: 'Payment date', value: formatDateTime(payment.payment_date) },
          ...(payment.payment_period ? [{ label: 'Period', value: payment.payment_period }] : []),
          { label: 'Method', value: String(payment.payment_method).toUpperCase() },
        ]),
        breakdownTable,
        // Consolidated two-column layout: Payer & Property
        payerPropertyRows: this.buildCompactInfoRows([
          { label: 'Payer', value: payment.tenant ? `${payment.tenant.first_name || ''} ${payment.tenant.last_name || ''}`.trim() || 'N/A' : (payment.received_from || 'N/A') },
          ...(payment.property?.name ? [{
            label: 'Property',
            value: payment.property.name + (payment.unit?.unit_number ? ` • Unit ${payment.unit.unit_number}` : '')
          }] : []),
          ...(payment.payment_period ? [{ label: 'Period', value: payment.payment_period }] : []),
        ]),
        // Consolidated two-column layout: Payment Details
        paymentDetailsRows: this.buildCompactInfoRows([
          {
            label: 'Date & Method',
            value: `${formatDateTime(payment.payment_date)} • ${String(payment.payment_method || 'N/A').toUpperCase()}`
          },
          ...(payment.reference_number ? [{ 
            label: 'Reference', 
            value: toShortReference(payment.reference_number)
          }] : []),
          ...(payment.transaction_id ? [{ label: 'Transaction ID', value: payment.transaction_id }] : []),
        ]),
        // Legacy sections (kept for backward compatibility if needed)
        payerInfoRows: this.buildInfoRows([
          { label: 'Name', value: payment.tenant ? `${payment.tenant.first_name || ''} ${payment.tenant.last_name || ''}`.trim() || 'N/A' : (payment.received_from || 'N/A') },
          { label: 'Email', value: payment.tenant?.email || 'N/A' },
          { label: 'Phone', value: payment.tenant?.phone_number || 'N/A' },
        ]),
        paymentInfoRows: this.buildInfoRows([
          ...(payment.transaction_id ? [{ label: 'Transaction ID', value: payment.transaction_id }] : []),
          ...(payment.reference_number ? [{ 
            label: 'Reference', 
            value: toShortReference(payment.reference_number)
          }] : []),
          { label: 'Payment Method', value: String(payment.payment_method || 'N/A').toUpperCase() },
          { label: 'Payment Date', value: formatDateTime(payment.payment_date) },
        ]),
        propertySection: payment.property?.name ? `
          <div class="info-section">
            <div class="section-title">Property Information</div>
            <div class="info-panel">
              ${this.buildInfoRows([
                ...(payment.property?.name ? [{ label: 'Property', value: payment.property.name }] : []),
                ...(payment.unit?.unit_number ? [{ label: 'Unit Number', value: payment.unit.unit_number }] : []),
                ...(payment.payment_period ? [{ label: 'Rental Period', value: payment.payment_period }] : []),
              ])}
            </div>
          </div>
        ` : '',
        notesSection: payment.notes ? `
          <div class="notes-section">
            <div class="section-title">Notes</div>
            <div class="notes-content">${escapeAttr(payment.notes)}</div>
          </div>
        ` : '',
        qrCodeSvg: qrCodeSvg || '<div style="color: red; padding: 20px; border: 1px solid red;">QR Code generation failed</div>',
        qrUrl: qrUrl,
        verificationToken: verificationToken || 'N/A',
        footerMeta: (() => {
          const parts = [
            `Generated ${formatDateTime(new Date())}`,
          ];
          if (payment.transaction_id) {
            parts.push(`TX: ${payment.transaction_id}`);
          }
          parts.push(`Powered by LetRents`);
          return parts.map((part, i) => 
            i === 0 ? `<span>${part}</span>` : `<span class="separator">•</span><span>${part}</span>`
          ).join('');
        })(),
      },
    };
  }

  private buildPaymentBreakdownTable(
    items: Array<{ description: string; amount: string }>,
    total: string,
    currency: string
  ): string {
    const rows = items.map((item) => `
      <tr>
        <td class="col-desc">${escapeAttr(item.description)}</td>
        <td class="col-amount num">${escapeAttr(item.amount)}</td>
      </tr>
    `).join('\n');

    // No duplicate total row - grand total is shown below table in template
    return `
      <table class="table breakdown-table">
        <thead>
          <tr>
            <th>Description</th>
            <th class="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="2" class="muted">No items</td></tr>`}
        </tbody>
      </table>
    `;
  }

  private buildInfoRows(rows: Array<{ label: string; value: string }>): string {
    if (!rows || rows.length === 0) {
      return '<div class="info-row"><span class="info-label">No data</span><span class="info-value">N/A</span></div>';
    }
    return rows.map(r => {
      const label = escapeAttr(r.label || '');
      const value = escapeAttr(r.value || 'N/A');
      return `
      <div class="info-row">
        <span class="info-label">${label}</span>
        <span class="info-value">${value}</span>
      </div>
    `;
    }).join('\n');
  }

  private buildCompactInfoRows(rows: Array<{ label: string; value: string }>): string {
    if (!rows || rows.length === 0) {
      return '<div class="info-row-compact"><span class="info-label-compact">No data</span><span class="info-value-compact">N/A</span></div>';
    }
    return rows.map(r => {
      const label = escapeAttr(r.label || '');
      const value = escapeAttr(r.value || 'N/A');
      return `
      <div class="info-row-compact">
        <span class="info-label-compact">${label}</span>
        <span class="info-value-compact">${value}</span>
      </div>
    `;
    }).join('\n');
  }

  private buildRefundReceiptContext(payment: any, qrCodeSvg: string = '', qrUrl: string = '', verificationToken: string = ''): Record<string, unknown> {
    const currency = payment.currency || 'KES';
    return {
      meta: {
        documentTitle: 'Refund Receipt',
        generatedAt: formatDateTime(new Date()),
        systemName: 'LetRents',
        supportEmail: 'support@letrents.com',
      },
      company: {
        name: payment.company?.name || 'LetRents',
        address:
          payment.company?.address ||
          [payment.company?.street, payment.company?.city, payment.company?.region, payment.company?.country]
            .filter(Boolean)
            .join(', ') || 'N/A',
        email: payment.company?.email || 'N/A',
        phone: payment.company?.phone_number || 'N/A',
        metaHtml: (() => {
          const address = payment.company?.address ||
            [payment.company?.street, payment.company?.city, payment.company?.region, payment.company?.country]
              .filter(Boolean)
              .join(', ');
          const email = payment.company?.email;
          const phone = payment.company?.phone_number;
          
          const parts = [];
          if (address) parts.push(`<div class="company-meta">${escapeAttr(address)}</div>`);
          if (email || phone) {
            const contact = [email, phone].filter(Boolean).join(' | ');
            parts.push(`<div class="company-meta">${escapeAttr(contact)}</div>`);
          }
          return parts.join('\n') || '<div class="company-meta">N/A</div>';
        })(),
      },
      refund: {
        receiptNumber: payment.receipt_number || '',
        status: String(payment.status).toUpperCase(),
        statusClass: `status-${String(payment.status).toUpperCase()}`,
        paymentDate: formatDateTime(payment.payment_date),
        amount: formatMoney(toNumber(payment.amount), currency),
        currency,
        method: String(payment.payment_method).toUpperCase(),
        referenceNumber: payment.reference_number || '',
        transactionId: payment.transaction_id || '',
        notes: payment.notes || '',
      },
      tenant: {
        name: payment.tenant ? `${payment.tenant.first_name || ''} ${payment.tenant.last_name || ''}`.trim() : (payment.received_from || 'N/A'),
        email: payment.tenant?.email || 'N/A',
        phone: payment.tenant?.phone_number || 'N/A',
      },
      property: {
        name: payment.property?.name || 'N/A',
        unitNumber: payment.unit?.unit_number || 'N/A',
      },
      sections: {
        detailsRows: buildKeyValueRows([
          ...(payment.reference_number ? [{ label: 'Reference', value: payment.reference_number }] : []),
          ...(payment.transaction_id ? [{ label: 'Transaction ID', value: payment.transaction_id }] : []),
          { label: 'Original Payment Date', value: formatDateTime(payment.payment_date) },
          { label: 'Payment Method', value: String(payment.payment_method || 'N/A').toUpperCase() },
        ]),
        tenantRows: this.buildInfoRows([
          { label: 'Name', value: payment.tenant ? `${payment.tenant.first_name || ''} ${payment.tenant.last_name || ''}`.trim() || 'N/A' : (payment.received_from || 'N/A') },
          { label: 'Email', value: payment.tenant?.email || 'N/A' },
          { label: 'Phone', value: payment.tenant?.phone_number || 'N/A' },
        ]),
        propertySection: payment.property?.name ? `
          <div class="info-section">
            <div class="section-title">Property Information</div>
            <div class="info-panel">
              ${this.buildInfoRows([
                ...(payment.property?.name ? [{ label: 'Property', value: payment.property.name }] : []),
                ...(payment.unit?.unit_number ? [{ label: 'Unit Number', value: payment.unit.unit_number }] : []),
              ])}
            </div>
          </div>
        ` : '',
        qrCodeSvg: qrCodeSvg,
        qrUrl: qrUrl,
        verificationToken: verificationToken,
      },
    };
  }

  private buildLeaseContext(lease: any): Record<string, unknown> {
    const currency = lease.currency || 'KES';
    return {
      meta: {
        documentTitle: 'Lease Agreement',
        generatedAt: formatDateTime(new Date()),
        systemName: 'LetRents',
      },
      company: {
        name: lease.company?.name || 'LetRents',
        address:
          lease.company?.address ||
          [lease.company?.street, lease.company?.city, lease.company?.region, lease.company?.country]
            .filter(Boolean)
            .join(', '),
        email: lease.company?.email || '',
        phone: lease.company?.phone_number || '',
      },
      lease: {
        leaseNumber: lease.lease_number,
        status: String(lease.status).toUpperCase(),
        leaseType: String(lease.lease_type),
        startDate: formatDate(lease.start_date),
        endDate: formatDate(lease.end_date),
        moveInDate: lease.move_in_date ? formatDate(lease.move_in_date) : '',
        noticePeriodDays: String(lease.notice_period_days ?? 30),
        rentAmount: formatMoney(toNumber(lease.rent_amount), currency),
        depositAmount: formatMoney(toNumber(lease.deposit_amount), currency),
        paymentFrequency: String(lease.payment_frequency || 'monthly'),
        paymentDay: String(lease.payment_day ?? 1),
        lateFeeAmount: lease.late_fee_amount ? formatMoney(toNumber(lease.late_fee_amount), currency) : '',
        lateFeeGraceDays: String(lease.late_fee_grace_days ?? 5),
        renewable: lease.renewable ? 'Yes' : 'No',
        autoRenewal: lease.auto_renewal ? 'Yes' : 'No',
        petsAllowed: lease.pets_allowed ? 'Yes' : 'No',
        smokingAllowed: lease.smoking_allowed ? 'Yes' : 'No',
        sublettingAllowed: lease.subletting_allowed ? 'Yes' : 'No',
        specialTerms: lease.special_terms || '',
        notes: lease.notes || '',
      },
      tenant: {
        name: lease.tenant ? `${lease.tenant.first_name} ${lease.tenant.last_name}`.trim() : '',
        email: lease.tenant?.email || '',
        phone: lease.tenant?.phone_number || '',
      },
      property: {
        name: lease.property?.name || '',
        address: [lease.property?.street, lease.property?.city, lease.property?.region, lease.property?.country]
          .filter(Boolean)
          .join(', '),
        unitNumber: lease.unit?.unit_number || '',
        unitType: lease.unit?.unit_type ? String(lease.unit.unit_type) : '',
      },
      sections: {
        termsList: `
          <ul class="terms">
            <li>The tenant shall pay rent on or before the due date for each period.</li>
            <li>The security deposit will be refunded upon termination, subject to inspection and applicable deductions.</li>
            <li>The tenant shall keep the premises in good condition and report maintenance issues promptly.</li>
            <li>No subletting is allowed without written consent from the landlord/agent.</li>
            <li>Notice period applies as stated in this agreement unless superseded by applicable law.</li>
          </ul>
        `,
      },
    };
  }

  /**
   * Record a new snapshot revision at the time of issuance/status change.
   * This stores the render context and template version without generating PDF bytes.
   */
  async recordInvoiceSnapshot(invoiceId: string, user: JWTClaims, version: TemplateVersion = 1): Promise<void> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        company: true,
        issuer: true,
        recipient: true,
        property: true,
        unit: true,
        line_items: { orderBy: { created_at: 'asc' } },
      },
    });
    if (!invoice) return;
    const context = this.buildInvoiceContext(invoice);
    await this.createSnapshotRevision('invoice', 'invoice', invoiceId, invoice.invoice_number, version, context, user);
  }

  async recordPaymentReceiptSnapshot(paymentId: string, user: JWTClaims, version: TemplateVersion = 1): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { company: true, tenant: true, property: true, unit: true },
    });
    if (!payment) return;
    const context = this.buildPaymentReceiptContext(payment);
    await this.createSnapshotRevision('payment_receipt', 'payment', paymentId, payment.receipt_number, version, context, user);
  }

  async recordRefundReceiptSnapshot(paymentId: string, user: JWTClaims, version: TemplateVersion = 1): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { company: true, tenant: true, property: true, unit: true },
    });
    if (!payment || payment.status !== 'refunded') return;
    const context = this.buildRefundReceiptContext(payment);
    await this.createSnapshotRevision('refund_receipt', 'payment', paymentId, payment.receipt_number, version, context, user);
  }

  async recordLeaseSnapshot(leaseId: string, user: JWTClaims, version: TemplateVersion = 1): Promise<void> {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      include: { company: true, tenant: true, property: true, unit: true },
    });
    if (!lease) return;
    const context = this.buildLeaseContext(lease);
    await this.createSnapshotRevision('lease', 'lease', leaseId, lease.lease_number, version, context, user);
  }

  async getInvoicePdf(invoiceId: string, user: JWTClaims, version: TemplateVersion = 1): Promise<PdfBuffer> {
    // Access control: leverage invoices read permissions via ownership/company scoping.
    // We enforce at controller/rbac level; here we still scope by company when possible.
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        company: true,
        issuer: true,
        recipient: true,
        property: true,
        unit: true,
        line_items: { orderBy: { created_at: 'asc' } },
      },
    });
    if (!invoice) throw new Error('invoice not found');

    // Company scoping for non-super-admin users
    if (user.role !== 'super_admin' && user.company_id && invoice.company_id !== user.company_id) {
      throw new Error('insufficient permissions to view this invoice');
    }

    // Ensure verification token exists
    const { token, qrUrl } = await verificationService.ensureInvoiceVerificationToken(invoiceId);
    
    // Generate QR code SVG for PDF embedding
    const qrCodeSvg = await verificationService.generateQRCodeSvg(qrUrl);
    
    const context = this.buildInvoiceContext(invoice, qrCodeSvg, qrUrl, token);

    const snapshot = await this.getLatestSnapshot('invoice', 'invoice', invoiceId);
    const templateVersion = snapshot?.template_version ?? version;
    
    // IMPORTANT: Always use fresh context for now to ensure new template structure works
    // The snapshot's render_context might be from an old template version
    const renderContext = context; // Use fresh context instead of snapshot
    
    await this.createSnapshotIfMissing('invoice', 'invoice', invoiceId, invoice.invoice_number, templateVersion, context, user);

    const ck = this.cacheKey({ t: 'invoice', id: invoiceId, v: templateVersion, updated: invoice.updated_at?.toISOString?.() });
    return this.renderDocument('invoice', templateVersion, renderContext, ck);
  }

  async getPaymentReceiptPdf(paymentId: string, user: JWTClaims, version: TemplateVersion = 1): Promise<PdfBuffer> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        company: true,
        tenant: true,
        property: true,
        unit: true,
      },
    });
    if (!payment) throw new Error('payment not found');
    if (user.role !== 'super_admin' && user.company_id && payment.company_id !== user.company_id) {
      // Tenants can access their own
      if (!(user.role === 'tenant' && payment.tenant_id === user.user_id)) {
        throw new Error('insufficient permissions to view this payment');
      }
    }

    // Fetch invoice with line items if invoice_id exists
    let invoice = null;
    if (payment.invoice_id) {
      invoice = await this.prisma.invoice.findUnique({
        where: { id: payment.invoice_id },
        include: {
          line_items: true,
        },
      });
    }

    // Ensure verification token exists
    const { token, qrUrl } = await verificationService.ensurePaymentVerificationToken(paymentId);
    
    // Generate QR code SVG for PDF embedding
    let qrCodeSvg = '';
    try {
      qrCodeSvg = await verificationService.generateQRCodeSvg(qrUrl);
      console.log('QR Code generated successfully, length:', qrCodeSvg.length);
      if (!qrCodeSvg || qrCodeSvg.length < 100) {
        console.error('QR code SVG is too short or empty:', qrCodeSvg.substring(0, 200));
      }
    } catch (error) {
      console.error('Failed to generate QR code SVG:', error);
      // Continue without QR code rather than failing the entire PDF generation
    }
    
    const context = this.buildPaymentReceiptContext(payment, invoice, qrCodeSvg, qrUrl, token);
    
    // Debug: Log context structure to verify data
    console.log('Payment Receipt Context Debug:', {
      hasCompany: !!context.company,
      hasReceipt: !!context.receipt,
      hasReceivedFrom: !!context.receivedFrom,
      hasSections: !!context.sections,
      hasQrCodeSvg: !!(context.sections as any)?.qrCodeSvg,
      qrCodeSvgLength: (context.sections as any)?.qrCodeSvg?.length || 0,
      hasVerificationToken: !!(context.sections as any)?.verificationToken,
      payerInfoRowsLength: (context.sections as any)?.payerInfoRows?.length || 0,
      paymentInfoRowsLength: (context.sections as any)?.paymentInfoRows?.length || 0,
      paidToRowsLength: (context.sections as any)?.paidToRows?.length || 0,
      hasBreakdownTable: !!(context.sections as any)?.breakdownTable,
    });
    
    // Debug: Log actual HTML snippets to verify content
    const sections = context.sections as any;
    console.log('Payer Info Rows Preview:', sections?.payerInfoRows?.substring(0, 200) || 'MISSING');
    console.log('Payment Info Rows Preview:', sections?.paymentInfoRows?.substring(0, 200) || 'MISSING');
    console.log('Breakdown Table Preview:', sections?.breakdownTable?.substring(0, 200) || 'MISSING');

    const snapshot = await this.getLatestSnapshot('payment_receipt', 'payment', paymentId);
    const templateVersion = snapshot?.template_version ?? version;
    
    // IMPORTANT: Always use fresh context for now to ensure new template structure works
    // The snapshot's render_context might be from an old template version
    // TODO: In production, we should check if template version matches and use snapshot if it does
    const renderContext = context; // Use fresh context instead of snapshot
    
    await this.createSnapshotIfMissing('payment_receipt', 'payment', paymentId, payment.receipt_number, templateVersion, context, user);

    const ck = this.cacheKey({ t: 'payment_receipt', id: paymentId, v: templateVersion, updated: payment.updated_at?.toISOString?.() });
    return this.renderDocument('payment_receipt', templateVersion, renderContext, ck);
  }

  async getRefundReceiptPdf(paymentId: string, user: JWTClaims, version: TemplateVersion = 1): Promise<PdfBuffer> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        company: true,
        tenant: true,
        property: true,
        unit: true,
      },
    });
    if (!payment) throw new Error('payment not found');
    if (payment.status !== 'refunded') throw new Error('payment is not refunded');

    if (user.role !== 'super_admin' && user.company_id && payment.company_id !== user.company_id) {
      if (!(user.role === 'tenant' && payment.tenant_id === user.user_id)) {
        throw new Error('insufficient permissions to view this refund');
      }
    }

    // Ensure verification token exists (same as payment receipt)
    const { token, qrUrl } = await verificationService.ensurePaymentVerificationToken(paymentId);
    
    // Generate QR code SVG for PDF embedding
    const qrCodeSvg = await verificationService.generateQRCodeSvg(qrUrl);
    
    const context = this.buildRefundReceiptContext(payment, qrCodeSvg, qrUrl, token);

    const snapshot = await this.getLatestSnapshot('refund_receipt', 'payment', paymentId);
    const templateVersion = snapshot?.template_version ?? version;
    
    // IMPORTANT: Always use fresh context for now to ensure new template structure works
    const renderContext = context; // Use fresh context instead of snapshot
    
    await this.createSnapshotIfMissing('refund_receipt', 'payment', paymentId, payment.receipt_number, templateVersion, context, user);

    const ck = this.cacheKey({ t: 'refund_receipt', id: paymentId, v: templateVersion, updated: payment.updated_at?.toISOString?.() });
    return this.renderDocument('refund_receipt', templateVersion, renderContext, ck);
  }

  async getLeasePdf(leaseId: string, user: JWTClaims, version: TemplateVersion = 1): Promise<PdfBuffer> {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      include: {
        company: true,
        tenant: true,
        property: true,
        unit: true,
      },
    });
    if (!lease) throw new Error('lease not found');
    if (user.role !== 'super_admin' && user.company_id && lease.company_id !== user.company_id) {
      if (!(user.role === 'tenant' && lease.tenant_id === user.user_id)) {
        throw new Error('insufficient permissions to view this lease');
      }
    }

    const context = this.buildLeaseContext(lease);

    const snapshot = await this.getLatestSnapshot('lease', 'lease', leaseId);
    const templateVersion = snapshot?.template_version ?? version;
    const renderContext = snapshot?.render_context ?? context;
    await this.createSnapshotIfMissing('lease', 'lease', leaseId, lease.lease_number, templateVersion, context, user);

    const ck = this.cacheKey({ t: 'lease', id: leaseId, v: templateVersion, updated: lease.updated_at?.toISOString?.() });
    return this.renderDocument('lease', templateVersion, renderContext, ck);
  }

  async getTenantStatementPdf(
    tenantId: string,
    startIso: string,
    endIso: string,
    user: JWTClaims,
    version: TemplateVersion = 1
  ): Promise<PdfBuffer> {
    // Access: tenant self or company roles within same company
    if (user.role === 'tenant' && user.user_id !== tenantId) {
      throw new Error('insufficient permissions to view this statement');
    }

    const tenant = await this.prisma.user.findUnique({
      where: { id: tenantId },
      include: { company: true },
    });
    if (!tenant) throw new Error('tenant not found');

    if (user.role !== 'super_admin' && user.company_id && tenant.company_id !== user.company_id) {
      throw new Error('insufficient permissions to view this statement');
    }

    const start = new Date(startIso);
    const end = new Date(endIso);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error('invalid date range');
    }

    const [invoices, payments] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          issued_to: tenantId,
          ...(tenant.company_id ? { company_id: tenant.company_id } : {}),
          created_at: { gte: start, lte: end },
        },
        include: { property: true, unit: true },
        orderBy: { created_at: 'asc' },
      }),
      this.prisma.payment.findMany({
        where: {
          tenant_id: tenantId,
          ...(tenant.company_id ? { company_id: tenant.company_id } : {}),
          payment_date: { gte: start, lte: end },
          status: { in: ['approved', 'completed', 'refunded', 'pending'] },
        },
        include: { property: true, unit: true },
        orderBy: { payment_date: 'asc' },
      }),
    ]);

    const currency = tenant.company?.settings && (tenant.company.settings as any)?.default_currency
      ? String((tenant.company.settings as any).default_currency)
      : 'KES';

    const invRows = invoices.map((inv) => `
      <tr>
        <td>${escapeAttr(inv.invoice_number)}</td>
        <td>${escapeAttr(inv.property?.name || '')}</td>
        <td>${escapeAttr(inv.unit?.unit_number || '')}</td>
        <td>${escapeAttr(String(inv.status).toUpperCase())}</td>
        <td class="num">${formatMoney(toNumber(inv.total_amount), inv.currency || currency)}</td>
        <td>${formatDate(inv.created_at)}</td>
      </tr>
    `).join('\n');

    const payRows = payments.map((p) => `
      <tr>
        <td>${escapeAttr(p.receipt_number)}</td>
        <td>${escapeAttr(p.property?.name || '')}</td>
        <td>${escapeAttr(p.unit?.unit_number || '')}</td>
        <td>${escapeAttr(String(p.status).toUpperCase())}</td>
        <td class="num">${formatMoney(toNumber(p.amount), p.currency || currency)}</td>
        <td>${formatDate(p.payment_date)}</td>
      </tr>
    `).join('\n');

    const context = {
      meta: {
        documentTitle: 'Statement',
        generatedAt: formatDateTime(new Date()),
        systemName: 'LetRents',
      },
      company: {
        name: tenant.company?.name || 'LetRents',
        address: tenant.company?.address || [tenant.company?.street, tenant.company?.city, tenant.company?.region, tenant.company?.country].filter(Boolean).join(', '),
        email: tenant.company?.email || '',
        phone: tenant.company?.phone_number || '',
      },
      tenant: {
        name: `${tenant.first_name} ${tenant.last_name}`.trim(),
        email: tenant.email || '',
        phone: tenant.phone_number || '',
      },
      statement: {
        startDate: formatDate(start),
        endDate: formatDate(end),
      },
      sections: {
        invoicesTable: `
          <table class="table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Property</th>
                <th>Unit</th>
                <th>Status</th>
                <th class="num">Amount</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${invRows || `<tr><td colspan="6" class="muted">No invoices in range</td></tr>`}
            </tbody>
          </table>
        `,
        paymentsTable: `
          <table class="table">
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Property</th>
                <th>Unit</th>
                <th>Status</th>
                <th class="num">Amount</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${payRows || `<tr><td colspan="6" class="muted">No payments in range</td></tr>`}
            </tbody>
          </table>
        `,
      },
    };

    const ck = this.cacheKey({ t: 'statement', id: tenantId, start: startIso, end: endIso, v: version, updated: tenant.updated_at?.toISOString?.() });
    return this.renderDocument('statement', version, context, ck);
  }

  async getReportPdf(
    reportType: string,
    title: string,
    rows: Array<Record<string, any>>,
    summary: Record<string, any>,
    user: JWTClaims,
    version: TemplateVersion = 1
  ): Promise<PdfBuffer> {
    // report access is enforced by /reports RBAC; we assume controller calls this.
    const company = user.company_id
      ? await this.prisma.company.findUnique({ where: { id: user.company_id } })
      : null;

    const keys = Array.from(new Set(rows.flatMap(r => Object.keys(r)))).slice(0, 12);
    const header = keys.map(k => `<th>${escapeAttr(k.replaceAll('_', ' '))}</th>`).join('');
    const body = rows.slice(0, 500).map(r => {
      const tds = keys.map(k => `<td>${escapeAttr(r[k] == null ? '' : String(r[k]))}</td>`).join('');
      return `<tr>${tds}</tr>`;
    }).join('\n');

    const summaryRows = Object.entries(summary).slice(0, 20).map(([k, v]) => ({
      label: k.replaceAll('_', ' '),
      value: v == null ? '' : String(v),
    }));

    const context = {
      meta: {
        documentTitle: title,
        generatedAt: formatDateTime(new Date()),
        systemName: 'LetRents',
      },
      company: {
        name: company?.name || 'LetRents',
        address: company?.address || [company?.street, company?.city, company?.region, company?.country].filter(Boolean).join(', '),
        email: company?.email || '',
        phone: company?.phone_number || '',
      },
      report: {
        reportType,
        title,
      },
      sections: {
        summaryRows: buildKeyValueRows(summaryRows),
        table: `
          <table class="table">
            <thead><tr>${header || '<th>Data</th>'}</tr></thead>
            <tbody>
              ${body || `<tr><td class="muted">No rows</td></tr>`}
            </tbody>
          </table>
        `,
      },
    };

    const ck = this.cacheKey({ t: 'report', rt: reportType, v: version });
    return this.renderDocument('report', version, context, ck);
  }
}

export const documentService = new DocumentService();

