import { describe, expect, it } from 'vitest';

import type { DuplicateDetectionInput } from '@/lib/incidents/duplicate-detection';
import {
  DUPLICATE_DISTANCE_METERS,
  DUPLICATE_TIME_WINDOW_MS,
  detectDuplicateClusters,
  haversineDistanceMeters,
} from '@/lib/incidents/duplicate-detection';

/** MG Road, Bengaluru — a fixed real-world point used across fixtures. */
const BASE_LAT = 12.9716;
const BASE_LON = 77.5946;
const BASE_TIME = '2026-09-01T10:00:00.000Z';

function report(
  id: string,
  overrides: Partial<DuplicateDetectionInput> = {},
): DuplicateDetectionInput {
  return {
    id,
    latitude: BASE_LAT,
    longitude: BASE_LON,
    createdAt: BASE_TIME,
    ...overrides,
  };
}

function hoursAfter(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();
}

describe('haversineDistanceMeters', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineDistanceMeters(BASE_LAT, BASE_LON, BASE_LAT, BASE_LON)).toBe(0);
  });

  it('returns a plausible distance for two known Bengaluru landmarks', () => {
    // MG Road to Cubbon Park — roughly 1.2km apart in reality.
    const distance = haversineDistanceMeters(12.9716, 77.5946, 12.9763, 77.5929);
    expect(distance).toBeGreaterThan(400);
    expect(distance).toBeLessThan(2000);
  });

  it('is symmetric regardless of argument order', () => {
    const forward = haversineDistanceMeters(12.9716, 77.5946, 12.9763, 77.5929);
    const backward = haversineDistanceMeters(12.9763, 77.5929, 12.9716, 77.5946);
    expect(forward).toBeCloseTo(backward, 6);
  });
});

describe('detectDuplicateClusters', () => {
  it('returns no clusters for an empty input', () => {
    expect(detectDuplicateClusters([])).toEqual([]);
  });

  it('returns no clusters when there is only one report', () => {
    expect(detectDuplicateClusters([report('a')])).toEqual([]);
  });

  it('returns no clusters when no reports are within the distance threshold', () => {
    const reports = [
      report('a', { latitude: BASE_LAT, longitude: BASE_LON }),
      // roughly 11km away — well outside the 500m default
      report('b', { latitude: BASE_LAT + 0.1, longitude: BASE_LON + 0.1 }),
    ];
    expect(detectDuplicateClusters(reports)).toEqual([]);
  });

  it('returns no clusters when reports are close but outside the time window', () => {
    const reports = [
      report('a', { createdAt: BASE_TIME }),
      report('b', { createdAt: hoursAfter(BASE_TIME, 72) }), // outside the 48h default
    ];
    expect(detectDuplicateClusters(reports)).toEqual([]);
  });

  it('groups two reports that are close in both space and time', () => {
    const reports = [
      report('a', { createdAt: BASE_TIME }),
      report('b', { createdAt: hoursAfter(BASE_TIME, 2) }),
    ];
    const clusters = detectDuplicateClusters(reports);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.masterId).toBe('a');
    expect(clusters[0]?.reportIds).toEqual(['a', 'b']);
  });

  it('matches the chain-snatching example: three reports, one cluster, earliest is master', () => {
    const reports = [
      report('witness-2', { createdAt: hoursAfter(BASE_TIME, 1) }),
      report('victim', { createdAt: BASE_TIME }),
      report('witness-1', { createdAt: hoursAfter(BASE_TIME, 3) }),
    ];
    const clusters = detectDuplicateClusters(reports);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.masterId).toBe('victim');
    expect(clusters[0]?.reportIds).toEqual(['victim', 'witness-2', 'witness-1']);
  });

  it('transitively links a chain even when its two ends are outside the threshold alone', () => {
    // a <-> b <-> c, each pair ~0 distance apart in time, but a and c are
    // 90 hours apart (outside the 48h window) if compared directly.
    const reports = [
      report('a', { createdAt: BASE_TIME }),
      report('b', { createdAt: hoursAfter(BASE_TIME, 45) }),
      report('c', { createdAt: hoursAfter(BASE_TIME, 90) }),
    ];
    const clusters = detectDuplicateClusters(reports);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.reportIds).toEqual(['a', 'b', 'c']);
  });

  it('does not link reports with conflicting categories even if close in space and time', () => {
    const reports = [
      report('a', { category: 'theft' }),
      report('b', { createdAt: hoursAfter(BASE_TIME, 1), category: 'harassment' }),
    ];
    expect(detectDuplicateClusters(reports)).toEqual([]);
  });

  it('does link reports when only one of the pair has a category set', () => {
    const reports = [
      report('a', { category: 'theft' }),
      report('b', { createdAt: hoursAfter(BASE_TIME, 1) }), // no category
    ];
    const clusters = detectDuplicateClusters(reports);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.reportIds).toEqual(['a', 'b']);
  });

  it('links reports when both share the same category', () => {
    const reports = [
      report('a', { category: 'theft' }),
      report('b', { createdAt: hoursAfter(BASE_TIME, 1), category: 'theft' }),
    ];
    const clusters = detectDuplicateClusters(reports);
    expect(clusters).toHaveLength(1);
  });

  it('separates two independent clusters and excludes unmatched singletons', () => {
    const farLat = BASE_LAT + 1; // far enough away to never link to the base cluster
    const reports = [
      report('a1', { createdAt: BASE_TIME }),
      report('a2', { createdAt: hoursAfter(BASE_TIME, 1) }),
      report('b1', { latitude: farLat, createdAt: BASE_TIME }),
      report('b2', { latitude: farLat, createdAt: hoursAfter(BASE_TIME, 1) }),
      report('solo', { latitude: farLat + 1, createdAt: BASE_TIME }),
    ];
    const clusters = detectDuplicateClusters(reports);
    expect(clusters).toHaveLength(2);
    const allClusteredIds = clusters.flatMap((cluster) => cluster.reportIds);
    expect(allClusteredIds).not.toContain('solo');
    expect(allClusteredIds.sort()).toEqual(['a1', 'a2', 'b1', 'b2']);
  });

  it('sorts clusters by their master report, most recent first', () => {
    const older = BASE_TIME;
    const newer = hoursAfter(BASE_TIME, 200); // far enough to never cross-link
    const farLat = BASE_LAT + 1;
    const reports = [
      report('old-a', { createdAt: older }),
      report('old-b', { createdAt: hoursAfter(older, 1) }),
      report('new-a', { latitude: farLat, createdAt: newer }),
      report('new-b', { latitude: farLat, createdAt: hoursAfter(newer, 1) }),
    ];
    const clusters = detectDuplicateClusters(reports);
    expect(clusters).toHaveLength(2);
    expect(clusters[0]?.masterId).toBe('new-a');
    expect(clusters[1]?.masterId).toBe('old-a');
  });

  it('respects a custom distanceMeters override', () => {
    const reports = [
      report('a', { latitude: BASE_LAT, longitude: BASE_LON }),
      report('b', { latitude: BASE_LAT + 0.001, longitude: BASE_LON }), // ~111m away
    ];
    expect(detectDuplicateClusters(reports, { distanceMeters: 50 })).toEqual([]);
    expect(detectDuplicateClusters(reports, { distanceMeters: 200 })).toHaveLength(1);
  });

  it('respects a custom timeWindowMs override', () => {
    const reports = [
      report('a', { createdAt: BASE_TIME }),
      report('b', { createdAt: hoursAfter(BASE_TIME, 5) }),
    ];
    const oneHourMs = 60 * 60 * 1000;
    expect(detectDuplicateClusters(reports, { timeWindowMs: oneHourMs })).toEqual([]);
    expect(detectDuplicateClusters(reports, { timeWindowMs: 6 * oneHourMs })).toHaveLength(1);
  });

  it('exposes the documented default thresholds', () => {
    expect(DUPLICATE_DISTANCE_METERS).toBe(500);
    expect(DUPLICATE_TIME_WINDOW_MS).toBe(48 * 60 * 60 * 1000);
  });
});
