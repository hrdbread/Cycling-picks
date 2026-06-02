import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

let _set: Set<string> | null = null;

function load(): Set<string> {
  if (_set) return _set;
  const dir = resolve('public/shirts');
  try {
    if (!existsSync(dir)) {
      _set = new Set();
      return _set;
    }
    const files = readdirSync(dir);
    _set = new Set(
      files
        .filter((f) => f.toLowerCase().endsWith('.png'))
        .map((f) => f.replace(/\.png$/i, '')),
    );
  } catch {
    _set = new Set();
  }
  return _set;
}

/** Returns true if a pixelated jersey exists for this team slug. */
export function hasShirt(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return load().has(slug);
}

/** URL the browser can fetch the shirt from. */
export function shirtUrl(slug: string): string {
  return `/shirts/${slug}.png`;
}

/** Force a re-scan, e.g. after running the sync script. */
export function refreshShirts(): void {
  _set = null;
}
