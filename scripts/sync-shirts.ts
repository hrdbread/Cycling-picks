/**
 * Downloads each team's jersey from procyclingstats and converts it to a
 * pixelated 4-tone B&W PNG, saved under public/shirts/<pcs_slug>.png.
 *
 *   npm run sync:shirts
 *
 * Run after sync:startlist (which captures the shirt URLs into the teams
 * table). Existing files are skipped unless --force is passed.
 */
import Jimp from 'jimp';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { db } from '../lib/db';

const PCS_BASE = process.env.PCS_BASE_URL || 'https://www.procyclingstats.com';
const OUT_DIR = resolve('public/shirts');
const TARGET_PX = 32;            // pixel grid the jersey is downscaled to
const PALETTE_LEVELS = 4;        // shades of grey

function quantize(v: number): number {
  // Map 0..255 onto PALETTE_LEVELS evenly-spaced grey values.
  const step = 255 / (PALETTE_LEVELS - 1);
  return Math.round(Math.round(v / step) * step);
}

async function main() {
  const force = process.argv.includes('--force');
  mkdirSync(OUT_DIR, { recursive: true });

  const teams = db()
    .prepare(
      "SELECT pcs_slug, name, shirt_url FROM teams WHERE shirt_url IS NOT NULL AND shirt_url <> ''",
    )
    .all() as Array<{ pcs_slug: string; name: string; shirt_url: string }>;

  if (teams.length === 0) {
    console.log('No teams with shirt URLs. Run sync:startlist first.');
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  // Warm up Cloudflare cookies by visiting a real page first.
  const warmup = await ctx.newPage();
  try {
    await warmup.goto(PCS_BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch {
    /* best effort */
  } finally {
    await warmup.close();
  }

  let saved = 0;
  let skipped = 0;
  let failed = 0;

  for (const team of teams) {
    const dest = resolve(OUT_DIR, `${team.pcs_slug}.png`);
    if (existsSync(dest) && !force) {
      skipped++;
      continue;
    }
    const url = team.shirt_url.startsWith('http')
      ? team.shirt_url
      : `${PCS_BASE}/${team.shirt_url.replace(/^\//, '')}`;
    try {
      const res = await ctx.request.get(url);
      if (!res.ok()) {
        console.warn(`  ✗ ${team.pcs_slug} → HTTP ${res.status()}`);
        failed++;
        continue;
      }
      const buf = Buffer.from(await res.body());

      const img = await Jimp.read(buf);
      // Trim transparent / near-white border so the jersey fills the frame.
      img.autocrop({ tolerance: 0.1, cropOnlyFrames: false });
      // Square it: pad with white, then resize to TARGET_PX x TARGET_PX with
      // nearest-neighbour to keep crisp pixel edges.
      const side = Math.max(img.bitmap.width, img.bitmap.height);
      const square = new Jimp(side, side, 0xffffffff);
      square.composite(
        img,
        Math.floor((side - img.bitmap.width) / 2),
        Math.floor((side - img.bitmap.height) / 2),
      );
      square
        .resize(TARGET_PX, TARGET_PX, Jimp.RESIZE_NEAREST_NEIGHBOR)
        .greyscale()
        .contrast(0.25);
      // Quantise to PALETTE_LEVELS shades for the chunky 4-tone GameBoy feel.
      square.scan(0, 0, TARGET_PX, TARGET_PX, function (x, y, idx) {
        const v = quantize(this.bitmap.data[idx]);
        this.bitmap.data[idx] = v;
        this.bitmap.data[idx + 1] = v;
        this.bitmap.data[idx + 2] = v;
        this.bitmap.data[idx + 3] = 255;
      });
      const out = await square.getBufferAsync(Jimp.MIME_PNG);
      writeFileSync(dest, out);
      saved++;
      console.log(`  ✓ ${team.pcs_slug}`);
    } catch (err) {
      failed++;
      console.warn(`  ✗ ${team.pcs_slug} → ${(err as Error).message}`);
    }
  }

  await browser.close();
  console.log(
    `\nDone. Saved ${saved}, skipped ${skipped}, failed ${failed}. Output: ${OUT_DIR}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
