import { chromium } from 'playwright';
export class HtmlToPdfRenderer {
    browserPromise = null;
    async getBrowser() {
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
    async renderPdfFromHtml(fullHtml, options = {}) {
        const browser = await this.getBrowser();
        const context = await browser.newContext();
        const page = await context.newPage();
        try {
            await page.setContent(fullHtml, { waitUntil: 'networkidle' });
            // Ensure fonts are ready before printing
            await page.evaluate(async () => {
                const anyDoc = document;
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
        }
        finally {
            await page.close().catch(() => undefined);
            await context.close().catch(() => undefined);
        }
    }
}
