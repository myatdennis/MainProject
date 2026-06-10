/**
 * Rolling 30-day personal baseline engine for HRV and resting HR.
 * Stored in MMKV so it survives app restarts.
 */
import { healthCache, getObject, setObject } from './storage';

const BASELINE_KEY = 'baseline_v1';
const MIN_DAYS_RELIABLE = 14;
const WINDOW_DAYS = 30;

export interface BaselineData {
  hrv: number[];       // rolling window, most-recent last
  restingHr: number[]; // rolling window, most-recent last
  dates: string[];     // ISO date per entry (same index)
  lastUpdated: string; // ISO date
}

export interface ComputedBaseline {
  hrvMedian: number;
  restingHrMedian: number;
  daysOfData: number;
  isReliable: boolean; // true once ≥ 14 days
}

function loadRaw(): BaselineData {
  return getObject<BaselineData>(healthCache, BASELINE_KEY) ?? {
    hrv: [],
    restingHr: [],
    dates: [],
    lastUpdated: '',
  };
}

function saveRaw(data: BaselineData) {
  setObject(healthCache, BASELINE_KEY, data);
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Add a new day's reading to the rolling baseline.
 * No-op if the date was already recorded.
 */
export function updateBaseline(entry: {
  date: string;
  hrv: number | null;
  restingHr: number | null;
}): void {
  const data = loadRaw();

  // Skip if already recorded this date
  if (data.dates.includes(entry.date)) return;

  data.dates.push(entry.date);
  data.hrv.push(entry.hrv ?? median(data.hrv) || 45);
  data.restingHr.push(entry.restingHr ?? median(data.restingHr) || 65);

  // Trim to window
  if (data.dates.length > WINDOW_DAYS) {
    data.dates = data.dates.slice(-WINDOW_DAYS);
    data.hrv = data.hrv.slice(-WINDOW_DAYS);
    data.restingHr = data.restingHr.slice(-WINDOW_DAYS);
  }

  data.lastUpdated = new Date().toISOString().split('T')[0];
  saveRaw(data);
}

/**
 * Seed baseline from historical data (called after HealthKit permission grant).
 * Entries should be oldest-first.
 */
export function seedBaseline(
  entries: Array<{ date: string; hrv: number | null; restingHr: number | null }>,
): void {
  const data: BaselineData = {
    hrv: [],
    restingHr: [],
    dates: [],
    lastUpdated: new Date().toISOString().split('T')[0],
  };

  // Take only the most recent WINDOW_DAYS entries
  const recent = entries.slice(-WINDOW_DAYS);

  for (const e of recent) {
    data.dates.push(e.date);
    data.hrv.push(e.hrv ?? 45);
    data.restingHr.push(e.restingHr ?? 65);
  }

  saveRaw(data);
}

export function getComputedBaseline(): ComputedBaseline {
  const data = loadRaw();

  // Filter nullish stand-ins
  const validHrv = data.hrv.filter((v) => v > 0);
  const validHr = data.restingHr.filter((v) => v > 0);

  return {
    hrvMedian: validHrv.length > 0 ? median(validHrv) : 45,
    restingHrMedian: validHr.length > 0 ? median(validHr) : 65,
    daysOfData: data.dates.length,
    isReliable: data.dates.length >= MIN_DAYS_RELIABLE,
  };
}

export function isStressed(hrv: number | null, restingHr: number | null): boolean {
  if (hrv == null || restingHr == null) return false;
  const { hrvMedian, restingHrMedian } = getComputedBaseline();
  return restingHr > restingHrMedian + 5 && hrv < hrvMedian * 0.85;
}
