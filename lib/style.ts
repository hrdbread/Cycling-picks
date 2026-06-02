/**
 * Visual helpers for the GameBoy-monochrome look.
 *
 * Avatars are generated as deterministic pixel grids from a hash of the
 * input key — same input always yields the same sprite, so a rider always
 * looks like themselves between renders.
 */

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32 PRNG — small, fast, stable across runtimes. */
function rng(seed: number): () => number {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a horizontally-mirrored grid of on/off pixels — feels like a
 * pixel sprite (Pokemon trainer style) because of the symmetry.
 */
export function pixelGrid(key: string, size = 5, density = 0.55): boolean[][] {
  const r = rng(hashSeed(key));
  const grid: boolean[][] = [];
  const half = Math.ceil(size / 2);
  for (let y = 0; y < size; y++) {
    const row = new Array<boolean>(size).fill(false);
    for (let x = 0; x < half; x++) {
      const on = r() < density;
      row[x] = on;
      row[size - 1 - x] = on;
    }
    grid.push(row);
  }
  return grid;
}

/** Two-letter monogram for team logos. */
export function teamMonogram(name: string): string {
  const skip = new Set(['team', 'pro', 'cycling', 'le', 'and', '|', '-', 'the']);
  const parts = name
    .replace(/[|]/g, ' ')
    .split(/\s+/)
    .filter((p) => !skip.has(p.toLowerCase()))
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** ISO 3166-1 alpha-2 → 3-letter country code (rough table). */
const CC3: Record<string, string> = {
  ad: 'AND', ae: 'UAE', ar: 'ARG', at: 'AUT', au: 'AUS',
  ba: 'BIH', be: 'BEL', bg: 'BGR', br: 'BRA', by: 'BLR',
  ca: 'CAN', ch: 'SUI', cl: 'CHI', cn: 'CHN', co: 'COL',
  cz: 'CZE', de: 'GER', dk: 'DEN', ec: 'ECU', ee: 'EST',
  er: 'ERI', es: 'ESP', et: 'ETH', fi: 'FIN', fr: 'FRA',
  gb: 'GBR', gr: 'GRE', hr: 'CRO', hu: 'HUN', ie: 'IRL',
  il: 'ISR', it: 'ITA', jp: 'JPN', kg: 'KGZ', kr: 'KOR',
  kz: 'KAZ', lt: 'LTU', lu: 'LUX', lv: 'LVA', mx: 'MEX',
  nl: 'NED', no: 'NOR', nz: 'NZL', pl: 'POL', pt: 'POR',
  ro: 'ROU', rs: 'SRB', ru: 'RUS', se: 'SWE', si: 'SLO',
  sk: 'SVK', tr: 'TUR', ua: 'UKR', us: 'USA', uz: 'UZB',
  ve: 'VEN', za: 'RSA',
};

export function countryCode(cc: string | null | undefined): string {
  if (!cc) return '???';
  return CC3[cc.toLowerCase()] ?? cc.toUpperCase().slice(0, 3);
}
