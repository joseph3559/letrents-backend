import { chromium, type Browser } from 'playwright';

export interface RenderPdfOptions {
  /**
   * Paper format.
   * - 'A4' is default and is the primary target.
   */
  format?: 'A4' | 'Letter';
  /**
   * Optional document title (metadata).
   */
  title?: string;
}

export class HtmlToPdfRenderer {
  private browserPromise: Promise<Browser> | null = null;

  private async getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--font-render-hinting=medium',
        ],
      });
    }
    return this.browserPromise;
  }

  async renderPdfFromHtml(fullHtml: string, options: RenderPdfOptions = {}): Promise<Buffer> {
    const browser = await this.getBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.setContent(fullHtml, { waitUntil: 'networkidle' });

      // Ensure fonts are ready before printing
      await page.evaluate(async () => {
        const anyDoc = document as any;
        if (anyDoc?.fonts?.ready) {
          await anyDoc.fonts.ready;
        }
      });

      const pdf = await page.pdf({
        format: options.format || 'A4',
        printBackground: true,
        displayHeaderFooter: false,
        preferCSSPageSize: true,
      });

      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => undefined);
      await context.close().catch(() => undefined);
    }
  }
}

