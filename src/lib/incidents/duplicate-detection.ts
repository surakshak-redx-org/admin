/**
 * Duplicate Detection Engine for incident reports.
 *
 * Groups incident reports that likely describe the same real-world event —
 * e.g. three different users reporting a chain snatching on the same
 * street within a short window of each other — into clusters, so the
 * Incidents page can surface them as a single master incident thread
 * instead of several unrelated-looking rows.
 *
 * This module is a pure, read-only grouping function. It is computed
 * entirely from whatever incident reports are already loaded in the
 * browser (see `(admin)/incidents/page.tsx`): it does not call Firestore,
 * does not write anything back, does not merge or delete any report, and
 * does not require any new field on `IncidentReport`. Clusters are simply
 * recomputed on the client whenever the loaded incidents list changes.
 */

/** Two reports within this distance of each other are considered linkable. */
export const DUPLICATE_DISTANCE_METERS = 500;

/**
 * Two reports filed within this many milliseconds of each other are
 * considered linkable. 48 hours is a deliberately generous default —
 * different witnesses to (or victims of) the same event often don't all
 * file a report the same day.
 */
export const DUPLICATE_TIME_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Mean Earth radius in meters, used by the haversine distance formula. */
const EARTH_RADIUS_METERS = 6_371_000;

const DEGREES_PER_RADIAN_PAIR = 180;

/** Minimum reports required for a group to count as a "cluster". */
const MIN_CLUSTER_SIZE = 2;

/**
 * The subset of `IncidentReport` fields the detector actually needs,
 * expressed independently of `Serialized<IncidentReport>` so this module
 * stays testable with plain fixtures and reusable anywhere incident-like
 * data shows up.
 */
export interface DuplicateDetectionInput {
  id: string;
  latitude: number;
  longitude: number;
  /** ISO-8601 string, matching `Serialized<IncidentReport>['createdAt']`. */
  createdAt: string;
  /**
   * When both reports being compared have a category and the categories
   * differ, the pair is never linked — that's a strong signal they're
   * different events. A report with no category never blocks a match on
   * this basis alone.
   */
  category?: string;
}

export interface DuplicateCluster {
  /** Id of the earliest (by `createdAt`) report in the cluster. */
  masterId: string;
  /** Every report id in the cluster, including the master, oldest first. */
  reportIds: string[];
}

export interface DetectDuplicateClustersOptions {
  /** Overrides {@link DUPLICATE_DISTANCE_METERS} — primarily for tests. */
  distanceMeters?: number;
  /** Overrides {@link DUPLICATE_TIME_WINDOW_MS} — primarily for tests. */
  timeWindowMs?: number;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / DEGREES_PER_RADIAN_PAIR;
}

/**
 * Great-circle distance between two lat/long points, in meters, via the
 * haversine formula. Accurate enough for the "same street" radius this
 * engine cares about; does not account for terrain or road routing.
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const halfChordSquared =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const angularDistance =
    2 * Math.atan2(Math.sqrt(halfChordSquared), Math.sqrt(1 - halfChordSquared));
  return EARTH_RADIUS_METERS * angularDistance;
}

/**
 * Minimal disjoint-set (union-find) structure with path compression and
 * union by rank, used to transitively group reports: if report A links to
 * B, and B links to C, A/B/C end up in one cluster even if A and C alone
 * fall outside the distance/time thresholds.
 */
class DisjointSet {
  private readonly parentById = new Map<string, string>();
  private readonly rankById = new Map<string, number>();

  add(id: string): void {
    if (!this.parentById.has(id)) {
      this.parentById.set(id, id);
      this.rankById.set(id, 0);
    }
  }

  find(id: string): string {
    const parent = this.parentById.get(id);
    if (parent === undefined) {
      throw new Error(`DisjointSet.find: unknown id "${id}"`);
    }
    if (parent === id) {
      return id;
    }
    const root = this.find(parent);
    this.parentById.set(id, root);
    return root;
  }

  union(idA: string, idB: string): void {
    const rootA = this.find(idA);
    const rootB = this.find(idB);
    if (rootA === rootB) return;

    const rankA = this.rankById.get(rootA) ?? 0;
    const rankB = this.rankById.get(rootB) ?? 0;
    if (rankA < rankB) {
      this.parentById.set(rootA, rootB);
    } else if (rankA > rankB) {
      this.parentById.set(rootB, rootA);
    } else {
      this.parentById.set(rootB, rootA);
      this.rankById.set(rootA, rankA + 1);
    }
  }
}

function categoriesConflict(categoryA: string | undefined, categoryB: string | undefined): boolean {
  return categoryA !== undefined && categoryB !== undefined && categoryA !== categoryB;
}

function getTimeMs(createdAt: string): number {
  return new Date(createdAt).getTime();
}

/**
 * Groups `reports` into duplicate clusters.
 *
 * Two reports are linked when they are within `distanceMeters` of each
 * other AND were filed within `timeWindowMs` of each other, AND — when
 * both specify a category — the categories agree. Linking is transitive
 * (see {@link DisjointSet}), so a chain of witness reports around one
 * event resolves to a single cluster even if the two most-distant reports
 * in the chain wouldn't be linked on their own.
 *
 * Only groups of {@link MIN_CLUSTER_SIZE} or more are returned, sorted by
 * each cluster's master (earliest) report, most recent first — a report
 * with no match to any other report is not included in the result at all.
 *
 * This is an O(n²) pairwise comparison. That's an acceptable tradeoff at
 * the data scale this dashboard already assumes elsewhere — e.g. the
 * Users and Community Posts pages' in-memory search — and can be revisited
 * with a spatial index (e.g. a geohash bucket pre-filter) if incident
 * volume ever grows large enough for it to matter.
 */
export function detectDuplicateClusters<T extends DuplicateDetectionInput>(
  reports: readonly T[],
  options: DetectDuplicateClustersOptions = {},
): DuplicateCluster[] {
  const distanceMeters = options.distanceMeters ?? DUPLICATE_DISTANCE_METERS;
  const timeWindowMs = options.timeWindowMs ?? DUPLICATE_TIME_WINDOW_MS;

  const reportById = new Map<string, T>();
  const sets = new DisjointSet();
  for (const report of reports) {
    reportById.set(report.id, report);
    sets.add(report.id);
  }

  for (let i = 0; i < reports.length; i += 1) {
    for (let j = i + 1; j < reports.length; j += 1) {
      const reportA = reports[i];
      const reportB = reports[j];
      if (!reportA || !reportB) continue;

      if (categoriesConflict(reportA.category, reportB.category)) continue;

      const timeDiffMs = Math.abs(getTimeMs(reportA.createdAt) - getTimeMs(reportB.createdAt));
      if (timeDiffMs > timeWindowMs) continue;

      const distanceBetweenReports = haversineDistanceMeters(
        reportA.latitude,
        reportA.longitude,
        reportB.latitude,
        reportB.longitude,
      );
      if (distanceBetweenReports > distanceMeters) continue;

      sets.union(reportA.id, reportB.id);
    }
  }

  const reportsByRoot = new Map<string, T[]>();
  for (const report of reports) {
    const root = sets.find(report.id);
    const group = reportsByRoot.get(root);
    if (group) {
      group.push(report);
    } else {
      reportsByRoot.set(root, [report]);
    }
  }

  const clusters: DuplicateCluster[] = [];
  for (const group of reportsByRoot.values()) {
    if (group.length < MIN_CLUSTER_SIZE) continue;

    const sortedByTime = [...group].sort((a, b) => getTimeMs(a.createdAt) - getTimeMs(b.createdAt));
    const master = sortedByTime[0];
    if (!master) continue;

    clusters.push({ masterId: master.id, reportIds: sortedByTime.map((report) => report.id) });
  }

  clusters.sort((clusterA, clusterB) => {
    const masterA = reportById.get(clusterA.masterId);
    const masterB = reportById.get(clusterB.masterId);
    const timeA = masterA ? getTimeMs(masterA.createdAt) : 0;
    const timeB = masterB ? getTimeMs(masterB.createdAt) : 0;
    return timeB - timeA;
  });

  return clusters;
}
