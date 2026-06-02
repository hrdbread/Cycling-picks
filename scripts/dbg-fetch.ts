/* Quick debug helper: dump the rendered HTML for a PCS page so we can see
 * what selectors actually match. Not part of normal flow.
 *
 *   npm exec tsx scripts/dbg-fetch.ts -- giro-d-italia/2026/startlist/extended
 */
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const path = process.argv[2];
if (!path) {
  console.error('Usage: tsx scripts/dbg-fetch.ts <pcs-path>');
  process.exit(1);
}
const url = `https://www.procyclingstats.com/${path.replace(/^\//, '')}`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();
  const res = await page.goto(url, { waitUntil: 'domcontentloaded' });
  console.log('status', res?.status());
  await page.waitForTimeout(3000);
  const html = await page.content();
  writeFileSync('/tmp/pcs-debug.html', html);
  console.log(`Saved ${html.length} bytes to /tmp/pcs-debug.html`);
  console.log('\nTitle:', await page.title());
  console.log('Sample anchors with rider/:');
  const sample = await page.$$eval('a[href*="rider/"]', (els) =>
    els.slice(0, 5).map((e) => ({ href: (e as HTMLAnchorElement).href, text: e.textContent?.trim() })),
  );
  console.log(JSON.stringify(sample, null, 2));
  console.log('\nSample anchors with team/:');
  const teams = await page.$$eval('a[href*="team/"]', (els) =>
    els.slice(0, 5).map((e) => ({ href: (e as HTMLAnchorElement).href, text: e.textContent?.trim() })),
  );
  console.log(JSON.stringify(teams, null, 2));
  await browser.close();
})();
