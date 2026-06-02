import * as cheerio from 'cheerio';
import { chromium, Browser } from 'playwright';

/**
 * Scraper for procyclingstats.com. PCS sits behind Cloudflare's bot
 * protection, so plain HTTP fetches get a 403 + JS challenge. We use a real
 * headless Chromium via Playwright to render the page; cheerio parses it.
 *
 * Be polite: each invocation only opens the browser once, fetches a handful
 * of pages, then closes. Run a few times per day at most.
 */

const BASE = process.env.PCS_BASE_URL || 'https://www.procyclingstats.com';

let _browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.isConnected()) return _browser;
  _browser = await chromium.launch({ headless: true });
  return _browser;
}

export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}

async function fetchHtml(path: string): Promise<string> {
  const url = path.startsWith('http') ? path : `${BASE}/${path.replace(/^\//, '')}`;
  const browser = await getBrowser();
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const status = res?.status() ?? 0;
    if (status >= 400) {
      throw new Error(`PCS ${url} returned ${status}`);
    }
    // Cloudflare interstitial briefly shows "Just a moment...". Wait for the
    // real page title or a known content selector to settle.
    await page
      .waitForSelector('a[href*="rider/"], table.results, .pageContent', {
        timeout: 15000,
      })
      .catch(() => undefined);
    return await page.content();
  } finally {
    await page.close();
    await ctx.close();
  }
}

export type PcsRider = {
  pcs_slug: string;
  name: string;
  country: string | null;
  team_slug: string | null;
  team_name: string | null;
  bib: number | null;
};

export type PcsTeam = {
  pcs_slug: string;
  name: string;
  shirt_url: string | null;
};

export type PcsStandingRow = {
  position: number;
  rider_slug?: string;
  rider_name?: string;
  team_slug?: string;
  team_name?: string;
  gap_seconds: number | null;
};

function parseGap(raw: string): number | null {
  const txt = raw.trim();
  if (!txt || txt === '-' || txt === ',,' || txt.toLowerCase() === 'same time') {
    return 0;
  }
  const cleaned = txt.replace(/^\+/, '').replace(/^in\s+/i, '').trim();
  const parts = cleaned.split(':').map((p) => p.replace(/[^0-9]/g, ''));
  if (parts.some((p) => p === '')) return null;
  const nums = parts.map((p) => parseInt(p, 10));
  if (nums.some((n) => Number.isNaN(n))) return null;
  if (nums.length === 3) return nums[0] * 3600 + nums[1] * 60 + nums[2];
  if (nums.length === 2) return nums[0] * 60 + nums[1];
  if (nums.length === 1) return nums[0];
  return null;
}

/**
 * Extracts the gap text from a result-table row. PCS renders each gap twice
 * (visible <font> + hidden <span class="hide"> for layout reasons), and uses
 * ",," in the visible copy to mean "same gap as the previous row" while the
 * real value sits in the hidden span. Strategy:
 *   1. Prefer the <span class="hide"> text (always the real number).
 *   2. Else the <font> text.
 *   3. Else the whole cell text.
 * Returns the trimmed string ready for parseGap, or empty.
 */
function extractGapText(
  $: cheerio.CheerioAPI,
  $row: ReturnType<cheerio.CheerioAPI>,
): string {
  const $cell = $row.find('td.time, td.gap, .time, .gap').last();
  if ($cell.length === 0) return '';
  const hidden = $cell.find('span.hide').first().text().trim();
  if (hidden) return hidden;
  const font = $cell.find('font').first().text().trim();
  if (font && font !== ',,') return font;
  return $cell.text().trim();
}

function slugFromHref(href: string | undefined, prefix: string): string | null {
  if (!href) return null;
  const m = href.match(new RegExp(`${prefix}/([^/?#]+)`));
  return m ? m[1] : null;
}

function cleanTeamName(raw: string): string {
  // PCS suffixes like " (WT)" or " (PRT)" indicate division — strip for display.
  return raw.replace(/\s*\((WT|PRT|PCT|UCI|CT)\)\s*$/i, '').trim();
}

/** Fetch the full startlist for a race, e.g. race/giro-d-italia/2026/startlist */
export async function fetchStartlist(
  raceSlug: string,
  year: number,
): Promise<{ riders: PcsRider[]; teams: PcsTeam[] }> {
  const html = await fetchHtml(`race/${raceSlug}/${year}/startlist`);
  const $ = cheerio.load(html);

  const teamsMap = new Map<string, PcsTeam>();
  const riders: PcsRider[] = [];

  // Layout (PCS startlist_v4):
  //   ul.startlist_v4 > li (one per team)
  //     .shirtCont > a > img            — team jersey image
  //     .ridersCont
  //       a.team[href="team/<slug>"]    — team link
  //       ul > li                       — each rider
  //         span.bib                    — bib number
  //         span.flag.<cc>              — 2-letter country class
  //         a[href="rider/<slug>"]      — rider link
  $('ul.startlist_v4 > li').each((_, teamLi) => {
    const $team = $(teamLi);
    const teamLink = $team.find('a.team[href*="team/"]').first();
    const teamSlug = slugFromHref(teamLink.attr('href'), 'team');
    const teamName = teamLink.text().trim() ? cleanTeamName(teamLink.text().trim()) : null;
    if (!teamSlug) return;
    const shirtImg = $team.find('.shirtCont img').attr('src') ?? null;
    teamsMap.set(teamSlug, {
      pcs_slug: teamSlug,
      name: teamName ?? teamSlug,
      shirt_url: shirtImg,
    });

    $team.find('.ridersCont > ul > li').each((__, riderLi) => {
      const $r = $(riderLi);
      const link = $r.find('a[href*="rider/"]').first();
      const riderSlug = slugFromHref(link.attr('href'), 'rider');
      if (!riderSlug) return;
      const name = link.text().trim();
      const flagClass = $r.find('.flag').attr('class') || '';
      const flagMatch = flagClass.match(/flag\s+([a-z]{2})/i);
      const country = flagMatch ? flagMatch[1].toLowerCase() : null;
      const bibText = $r.find('.bib').first().text().trim();
      const bib = /^\d+$/.test(bibText) ? parseInt(bibText, 10) : null;
      riders.push({
        pcs_slug: riderSlug,
        name,
        country,
        team_slug: teamSlug,
        team_name: teamName,
        bib,
      });
    });
  });

  const seen = new Set<string>();
  const dedup = riders.filter((r) => {
    if (seen.has(r.pcs_slug)) return false;
    seen.add(r.pcs_slug);
    return true;
  });
  return { riders: dedup, teams: [...teamsMap.values()] };
}

/**
 * PCS stage pages contain multiple result tables (stage result, GC, points,
 * KOM, youth, team) inside sibling `.resTab` containers. Only one is visible
 * at a time but they're all in the DOM. We classify each container and pick
 * the right one for the classification we asked for.
 *
 *   stage result : 1st  .resTab with rider links + per-stage "+m:ss" times
 *   GC           : 2nd  .resTab with rider links + cumulative "H:MM:SS" times
 *   points / KOM : .resTab with rider links but fewer rows
 *   team standings: .resTab with TEAM links and no rider links
 *
 * For the final-overall pages (`/race/{slug}/{year}/gc`) the page sometimes
 * uses a single table without `.resTab` wrappers, so we fall back to that.
 */
function pickResTab(
  $: cheerio.CheerioAPI,
  kind: 'gc' | 'teams',
): ReturnType<cheerio.CheerioAPI> | null {
  const tabs = $('.resTab').toArray();
  // Tag each tab by what it contains
  const tagged = tabs.map((t) => {
    const $t = $(t);
    const rows = $t.find('table.results tbody tr').length;
    const riderLinks = $t.find('table.results tbody a[href*="rider/"]').length;
    const teamLinks = $t.find('table.results tbody a[href*="team/"]').length;
    // Heuristic: GC rows show H:MM:SS cumulative time (with at least one colon
    // in the gap column); stage-result rows show "+m:ss". Both contain rider
    // links and similar row counts, so we use the time format to break the
    // tie. A team-standings table is distinct because it has team links but
    // no rider links per row.
    const firstRowText = $t.find('table.results tbody tr').first().text();
    const looksLikeRiderRow = riderLinks > rows / 2;
    const looksLikeTeamRow = !looksLikeRiderRow && teamLinks > 0;
    return { $tab: $t, rows, riderLinks, teamLinks, firstRowText, looksLikeRiderRow, looksLikeTeamRow };
  });

  if (kind === 'teams') {
    const teamTab = tagged.find((t) => t.looksLikeTeamRow && t.rows >= 5);
    return teamTab ? teamTab.$tab : null;
  }
  // GC: the second rider-result tab (the first one is the per-stage result).
  // Falls back to the only rider tab if there is just one.
  const riderTabs = tagged.filter((t) => t.looksLikeRiderRow && t.rows >= 10);
  if (riderTabs.length === 0) return null;
  if (riderTabs.length === 1) return riderTabs[0].$tab;
  return riderTabs[1].$tab;
}

/**
 * Fetch the GC standings after a given stage.
 *  - stage = 0 returns the final overall standings (race/<slug>/<year>/gc).
 *  - stage = N returns standings after stage N.
 */
export async function fetchGcStandings(
  raceSlug: string,
  year: number,
  stage: number,
): Promise<PcsStandingRow[]> {
  const path =
    stage === 0
      ? `race/${raceSlug}/${year}/gc`
      : `race/${raceSlug}/${year}/stage-${stage}/gc`;
  const html = await fetchHtml(path);
  const $ = cheerio.load(html);
  const $scope = pickResTab($, 'gc');
  const $rows = $scope
    ? $scope.find('table.results tbody tr')
    : // Fallback: race-level GC pages sometimes render a single table without
      // .resTab wrappers. Take the first table with rider links.
      $('table.results').filter((_, t) => $(t).find('a[href*="rider/"]').length > 0).first().find('tbody tr');

  const rows: PcsStandingRow[] = [];
  $rows.each((_, el) => {
    const $tr = $(el);
    const tds = $tr.find('td');
    if (tds.length < 3) return;
    const position = parseInt($(tds[0]).text().trim(), 10);
    if (Number.isNaN(position)) return;
    const riderLink = $tr.find('a[href*="rider/"]').first();
    const rider_slug = slugFromHref(riderLink.attr('href'), 'rider') ?? undefined;
    if (!rider_slug) return;
    const rider_name = riderLink.text().trim() || undefined;
    const gapText = extractGapText($, $tr);
    // Position 1's gap cell holds the leader's cumulative race time
    // ("13:10:05"), not a gap. Store null so the UI renders "—".
    const gap_seconds = position === 1 ? null : parseGap(gapText);
    rows.push({
      position,
      rider_slug,
      rider_name,
      gap_seconds,
    });
  });
  return rows;
}

export async function fetchTeamStandings(
  raceSlug: string,
  year: number,
  stage: number,
): Promise<PcsStandingRow[]> {
  const path =
    stage === 0
      ? `race/${raceSlug}/${year}/teams`
      : `race/${raceSlug}/${year}/stage-${stage}/teams`;
  const html = await fetchHtml(path);
  const $ = cheerio.load(html);
  const $scope = pickResTab($, 'teams');
  const $rows = $scope
    ? $scope.find('table.results tbody tr')
    : $('table.results')
        .filter((_, t) => $(t).find('a[href*="team/"]').length > 0 && $(t).find('a[href*="rider/"]').length === 0)
        .first()
        .find('tbody tr');

  // PCS stage "/teams" pages now render two team tables inside one .resTab:
  // the overall team classification first, then that day's team result. They
  // both number positions 1..N, so without de-duping the second (stage) table
  // overwrites the overall standings in the upsert (wrong leader). Keep only
  // the first occurrence of each position — the overall classification.
  const rows: PcsStandingRow[] = [];
  const seenPositions = new Set<number>();
  $rows.each((_, el) => {
    const $tr = $(el);
    const tds = $tr.find('td');
    if (tds.length < 2) return;
    const position = parseInt($(tds[0]).text().trim(), 10);
    if (Number.isNaN(position)) return;
    if (seenPositions.has(position)) return;
    seenPositions.add(position);
    const teamLink = $tr.find('a[href*="team/"]').first();
    const team_slug = slugFromHref(teamLink.attr('href'), 'team') ?? undefined;
    if (!team_slug) return;
    const team_name = teamLink.text().trim() || undefined;
    const gapText = extractGapText($, $tr);
    const gap_seconds = position === 1 ? null : parseGap(gapText);
    rows.push({
      position,
      team_slug,
      team_name,
      gap_seconds,
    });
  });
  return rows;
}

/** Returns latest completed stage number for a race in a given year, or 0 if none. */
export async function fetchLatestCompletedStage(
  raceSlug: string,
  year: number,
): Promise<number> {
  // Strategy 1: parse the stage list on the overview page. PCS marks completed
  // stages with a result icon and links them to `.../stage-N/result/result`.
  const html = await fetchHtml(`race/${raceSlug}/${year}/overview`);
  const $ = cheerio.load(html);
  let max = 0;
  $('a[href*="/stage-"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(/stage-(\d+)/);
    if (!m) return;
    const n = parseInt(m[1], 10);
    const $row = $(el).closest('tr');
    const cls = $row.attr('class') || '';
    const iconClass = $row.find('.icon').attr('class') || '';
    const finished =
      /finished|done|completed|result/i.test(iconClass) ||
      /\bresult\b/i.test(href);
    if (finished && n > max) max = n;
  });
  if (max > 0) return max;

  // Strategy 2: fall back to dates. The overview table usually has a date
  // column ("dd/mm" or "yyyy-mm-dd"); a stage in the past is finished.
  $('tr').each((_, tr) => {
    const $tr = $(tr);
    const stageLink = $tr.find('a[href*="stage-"]').first().attr('href') || '';
    const m = stageLink.match(/stage-(\d+)/);
    if (!m) return;
    const n = parseInt(m[1], 10);
    const text = $tr.text();
    const dm = text.match(/(\d{2})[\/.-](\d{2})/);
    if (!dm) return;
    const now = new Date();
    const stageDate = new Date(now.getFullYear(), parseInt(dm[2], 10) - 1, parseInt(dm[1], 10));
    if (stageDate.getTime() < now.getTime() - 12 * 3600 * 1000 && n > max) {
      max = n;
    }
  });
  return max;
}
