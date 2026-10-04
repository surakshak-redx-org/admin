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

/** Two reports within this distance of a cluster's master are linkable. */
export const DUPLICATE_DISTANCE_METERS = 500;

/**
 * Two reports filed within this many milliseconds of a cluster's master
 * are linkable. 48 hours is a deliberately generous default — different
 * witnesses to (or victims of) the same event often don't all file a
 * report the same day.
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
   *
   * Note: as of this writing, `GET /api/incidents` must include
   * `'category'` in its Firestore field-select list for this to ever be
   * populated on real data — see `INCIDENT_LIST_FIELDS` in
   * `src/app/api/incidents/route.ts`. Without it every report reaches
   * this function with `category: undefined`, and this check is silently
   * a no-op.
   */
  category?: string;
}

export interface DuplicateCluster {
  /** Id of the report that anchors this cluster (see algorithm notes below). */
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
 *
 * Returns `NaN` if any input is not a finite number — callers must treat
 * `NaN` as "not within range" (never as "within range"), since `NaN`
 * compares false against every threshold in both directions.
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

function categoriesConflict(categoryA: string | undefined, categoryB: string | undefined): boolean {
  return categoryA !== undefined && categoryB !== undefined && categoryA !== categoryB;
}

function getTimeMs(createdAt: string): number {
  return new Date(createdAt).getTime();
}

/**
 * True when `report` is close enough to `master` to join its cluster:
 * same category or at least one uncategorized, within the time window,
 * and within the distance threshold.
 *
 * Every numeric comparison below is written as a positive "is within
 * range" check (`value <= threshold`), never as its negated opposite
 * (`value > threshold`). This matters because `report.createdAt`,
 * `latitude`, or `longitude` can be missing or unparseable on real data,
 * which makes the computed time difference or distance `NaN` — and `NaN`
 * compares `false` against *every* relational operator. Written as
 * `diff > threshold`, a `NaN` diff would make that check false too,
 * i.e. "not over the threshold", silently treating bad data as a match.
 * Written as `diff <= threshold`, a `NaN` diff makes the check false in
 * the *safe* direction: not within range, so the pair is correctly
 * rejected instead of incorrectly linked.
 */
function isWithinClusterOf<T extends DuplicateDetectionInput>(
  report: T,
  master: T,
  distanceMeters: number,
  timeWindowMs: number,
): boolean {
  if (categoriesConflict(master.category, report.category)) return false;

  const timeDiffMs = Math.abs(getTimeMs(master.createdAt) - getTimeMs(report.createdAt));
  if (!(timeDiffMs <= timeWindowMs)) return false;

  const distance = haversineDistanceMeters(
    master.latitude,
    master.longitude,
    report.latitude,
    report.longitude,
  );
  if (!(distance <= distanceMeters)) return false;

  return true;
}

/**
 * Groups `reports` into duplicate clusters.
 *
 * Reports are processed oldest-first. Each report either joins the
 * nearest existing cluster whose **master** (its earliest, founding
 * report) it is within `distanceMeters` and `timeWindowMs` of — or, if no
 * cluster's master qualifies, it starts a brand new cluster of its own as
 * that cluster's master.
 *
 * Every membership check is anchored to a cluster's master specifically,
 * not to whichever other member happens to be nearby. This is
 * deliberate: a cluster must not be able to drift arbitrarily far from
 * where it started just because each report is close to the *previous*
 * one. For example, if reports land roughly every two days in the same
 * neighborhood over several months, A-to-B, B-to-C, C-to-D, etc. might
 * each individually fall inside the 48-hour window — but D could be
 * months away from A. Anchoring every comparison to the master (here,
 * A) means D only joins A's cluster if D is *itself* within range of A;
 * otherwise D starts a new cluster, and the original cluster's spread
 * stays bounded by its own thresholds no matter how many reports pass
 * through the area over time.
 *
 * Only groups of {@link MIN_CLUSTER_SIZE} or more are returned, sorted by
 * each cluster's master, most recent first — a report that never joins
 * another report's cluster, and that no later report joins either, is
 * not included in the result at all.
 *
 * This is an O(n·k) comparison, where k is the number of clusters formed
 * so far (worst case O(n²), same as a full pairwise scan). That's an
 * acceptable tradeoff at the data scale this dashboard already assumes
 * elsewhere — e.g. the Users and Community Posts pages' in-memory search
 * — and can be revisited with a spatial index (e.g. a geohash bucket
 * pre-filter) if incident volume ever grows large enough for it to
 * matter.
 */
export function detectDuplicateClusters<T extends DuplicateDetectionInput>(
  reports: readonly T[],
  options: DetectDuplicateClustersOptions = {},
): DuplicateCluster[] {
  const distanceMeters = options.distanceMeters ?? DUPLICATE_DISTANCE_METERS;
  const timeWindowMs = options.timeWindowMs ?? DUPLICATE_TIME_WINDOW_MS;

  // Reports with an unparseable createdAt sort as NaN; push them to the
  // end rather than let Array.sort's comparator receive NaN (which has
  // unspecified, engine-dependent behavior). They'll never successfully
  // join or found a useful cluster anyway — see isWithinClusterOf's
  // fail-closed handling of NaN time diffs — so their relative order
  // among themselves doesn't affect the result.
  const sortedReports = [...reports].sort((a, b) => {
    const timeA = getTimeMs(a.createdAt);
    const timeB = getTimeMs(b.createdAt);
    const safeTimeA = Number.isFinite(timeA) ? timeA : Number.POSITIVE_INFINITY;
    const safeTimeB = Number.isFinite(timeB) ? timeB : Number.POSITIVE_INFINITY;
    return safeTimeA - safeTimeB;
  });

  interface ClusterInProgress {
    master: T;
    members: T[];
  }

  const clustersInProgress: ClusterInProgress[] = [];

  for (const report of sortedReports) {
    let bestCluster: ClusterInProgress | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const cluster of clustersInProgress) {
      if (!isWithinClusterOf(report, cluster.master, distanceMeters, timeWindowMs)) continue;

      const distance = haversineDistanceMeters(
        cluster.master.latitude,
        cluster.master.longitude,
        report.latitude,
        report.longitude,
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        bestCluster = cluster;
      }
    }

    if (bestCluster) {
      bestCluster.members.push(report);
    } else {
      clustersInProgress.push({ master: report, members: [report] });
    }
  }

  return clustersInProgress
    .filter((cluster) => cluster.members.length >= MIN_CLUSTER_SIZE)
    .sort((a, b) => getTimeMs(b.master.createdAt) - getTimeMs(a.master.createdAt))
    .map((cluster) => ({
      masterId: cluster.master.id,
      reportIds: cluster.members.map((member) => member.id),
    }));
}
