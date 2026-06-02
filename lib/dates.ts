import { GrandTour } from './db';

export type TourPhase =
  | { state: 'not-open'; reason: 'no-startlist'; expectedFrom: Date | null; daysUntilStart: number | null }
  | { state: 'open'; lockAt: Date | null; daysUntilLock: number | null }
  | { state: 'locked'; daysUntilEnd: number | null; endAt: Date | null }
  | { state: 'finished' };

export function isPicksLocked(tour: GrandTour): boolean {
  if (tour.locked || tour.status === 'active' || tour.status === 'finished') {
    return true;
  }
  if (!tour.start_date) return false;
  const start = new Date(tour.start_date + 'T00:00:00Z');
  return Date.now() >= start.getTime();
}

export function tourPhase(tour: GrandTour, riderCount: number): TourPhase {
  if (tour.status === 'finished') return { state: 'finished' };
  const start = tour.start_date ? new Date(tour.start_date + 'T00:00:00Z') : null;
  const end = tour.end_date ? new Date(tour.end_date + 'T23:59:59Z') : null;
  const now = new Date();
  if (isPicksLocked(tour)) {
    return {
      state: 'locked',
      daysUntilEnd: end ? daysBetween(now, end) : null,
      endAt: end,
    };
  }
  if (riderCount === 0) {
    // PCS typically publishes startlists ~2 weeks before a Grand Tour.
    const expected =
      start ? new Date(start.getTime() - 14 * 86400_000) : null;
    return {
      state: 'not-open',
      reason: 'no-startlist',
      expectedFrom: expected,
      daysUntilStart: start ? daysBetween(now, start) : null,
    };
  }
  return {
    state: 'open',
    lockAt: start,
    daysUntilLock: start ? daysBetween(now, start) : null,
  };
}

export function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.ceil(ms / 86400_000);
}

const FMT = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

export function formatDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return FMT.format(d);
}

export function relativeDays(n: number | null | undefined): string {
  if (n == null) return '';
  if (n <= 0) return 'today';
  if (n === 1) return 'tomorrow';
  return `in ${n} days`;
}
