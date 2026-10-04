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

  it('returns NaN (never a false-positive 0) when an input is not finite', () => {
    expect(haversineDistanceMeters(NaN, BASE_LON, BASE_LAT, BASE_LON)).toBeNaN();
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

  it('links a report directly within range of the master even if it arrives later', () => {
    // a (master) <-> b both within 45h/500m of a. b is added after a.
    const reports = [
      report('a', { createdAt: BASE_TIME }),
      report('b', { createdAt: hoursAfter(BASE_TIME, 45) }),
    ];
    const clusters = detectDuplicateClusters(reports);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.reportIds).toEqual(['a', 'b']);
  });

  it('does NOT let a cluster drift beyond its master via a chain of close neighbors', () => {
    // a (master) -> b is 45h after a (within 48h of a, joins).
    // c is 90h after a (OUTSIDE 48h of master a) but only 45h after b.
    // A naive "link to nearest neighbor" algorithm would transitively
    // chain a-b-c together; anchoring to the master must not.
    const reports = [
      report('a', { createdAt: BASE_TIME }),
      report('b', { createdAt: hoursAfter(BASE_TIME, 45) }),
      report('c', { createdAt: hoursAfter(BASE_TIME, 90) }),
    ];
    const clusters = detectDuplicateClusters(reports);
    // Only {a, b} clusters. c has nothing else to join and forms its own
    // singleton, which is dropped (clusters need 2+ members).
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.masterId).toBe('a');
    expect(clusters[0]?.reportIds).toEqual(['a', 'b']);
  });

  it('starts a fresh cluster once reports drift past the master, instead of growing on', () => {
    // a (master) <-> b within range of a. c and d are each ~45h after the
    // previous report, walking the cluster far past a's own 48h window —
    // but c is within range of... nothing yet (a rejects it), so c
    // becomes its own new master, and d joins c's cluster instead.
    const reports = [
      report('a', { createdAt: BASE_TIME }),
      report('b', { createdAt: hoursAfter(BASE_TIME, 45) }),
      report('c', { createdAt: hoursAfter(BASE_TIME, 90) }),
      report('d', { createdAt: hoursAfter(BASE_TIME, 135) }),
    ];
    const clusters = detectDuplicateClusters(reports);
    expect(clusters).toHaveLength(2);
    const clustersByMaster = new Map(clusters.map((cluster) => [cluster.masterId, cluster]));
    expect(clustersByMaster.get('a')?.reportIds).toEqual(['a', 'b']);
    expect(clustersByMaster.get('c')?.reportIds).toEqual(['c', 'd']);
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

  it('never links a report with an unparseable createdAt (fails closed, not open)', () => {
    const reports = [
      report('a', { createdAt: BASE_TIME }),
      report('bad-date', { createdAt: 'not-a-real-date' }),
    ];
    expect(detectDuplicateClusters(reports)).toEqual([]);
  });

  it('never links a report with non-finite coordinates (fails closed, not open)', () => {
    const reports = [
      report('a', { createdAt: BASE_TIME }),
      report('bad-coords', { latitude: NaN, longitude: NaN, createdAt: BASE_TIME }),
      report('c', { createdAt: hoursAfter(BASE_TIME, 1) }),
    ];
    const clusters = detectDuplicateClusters(reports);
    // a and c still cluster together; bad-coords joins neither.
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.reportIds).toEqual(['a', 'c']);
  });

  it('does not throw when every report in the input has a bad timestamp', () => {
    const reports = [
      report('a', { createdAt: 'garbage' }),
      report('b', { createdAt: 'also-garbage' }),
    ];
    expect(() => detectDuplicateClusters(reports)).not.toThrow();
    expect(detectDuplicateClusters(reports)).toEqual([]);
  });
});
