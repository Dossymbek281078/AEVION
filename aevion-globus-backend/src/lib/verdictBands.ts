/**
 * Threshold bands with a reachability contract.
 * ─────────────────────────────────────────────
 *
 * Modules across the platform map a score to a category with an inline ternary
 * in the route handler:
 *
 *   const level = score >= 60 ? "red" : score >= 30 ? "yellow" : "green";
 *
 * That is fine until a band becomes unreachable, which happens quietly and
 * survives review because the code reads correctly. QVenture shipped for months
 * with a "pass" verdict no submission could ever produce — every factor started
 * at a sector prior and only moved up, so the composite bottomed out around 59
 * against a threshold of 55. Fifty-five live analyses returned invest or watch
 * and not one pass, and nothing failed.
 *
 * A band nobody can reach is worse than a missing feature: the tool looks like
 * it discriminates while it does not, and the output is trusted accordingly.
 *
 * This gives bands a single definition, a classifier, and — the point of the
 * module — assertBandsReachable(), so a test can prove on real sample scores
 * that every band is attainable. Declaring bands here without asserting them
 * somewhere buys nothing over the ternary it replaces.
 */

export interface Band<T extends string> {
  /** Category returned when the score is at or above `min`. */
  label: T;
  /** Inclusive lower bound. */
  min: number;
}

export interface BandSet<T extends string> {
  name: string;
  /** Highest-first, as evaluated. */
  bands: ReadonlyArray<Band<T>>;
  classify(score: number): T;
}

/**
 * Define a band set. Bands may be given in any order; they are sorted
 * highest-first and validated for overlap and a bottom band at or below the
 * scale floor, so no score can fall through uncategorised.
 */
export function defineBands<T extends string>(
  name: string,
  bands: ReadonlyArray<Band<T>>,
  scale: readonly [number, number] = [0, 100],
): BandSet<T> {
  if (bands.length < 2) throw new Error(`${name}: a band set needs at least 2 bands`);

  const sorted = [...bands].sort((a, b) => b.min - a.min);

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].min === sorted[i - 1].min) {
      throw new Error(`${name}: bands "${sorted[i - 1].label}" and "${sorted[i].label}" share min ${sorted[i].min}`);
    }
  }
  const lowest = sorted[sorted.length - 1];
  if (lowest.min > scale[0]) {
    throw new Error(
      `${name}: lowest band "${lowest.label}" starts at ${lowest.min}, above the scale floor ${scale[0]} — ` +
      `scores below ${lowest.min} would be uncategorised`,
    );
  }

  return {
    name,
    bands: sorted,
    classify(score: number): T {
      for (const b of sorted) if (score >= b.min) return b.label;
      return lowest.label;
    },
  };
}

export interface ReachabilityReport<T extends string> {
  ok: boolean;
  /** Bands no sample reached. */
  unreachable: T[];
  /** Sample count per band. */
  counts: Record<string, number>;
  /** Human-readable summary, suitable for a test failure message. */
  message: string;
}

/**
 * Check that every band is actually produced by the supplied scores.
 *
 * Pass scores from real runs — a calibration fixture, a corpus of stored
 * results, a sweep of representative inputs. Synthetic values spanning the
 * scale prove nothing: the question is not whether the arithmetic works, it is
 * whether the engine can emit a score in that range at all.
 */
export function checkBandsReachable<T extends string>(
  set: BandSet<T>,
  samples: readonly number[],
): ReachabilityReport<T> {
  const counts: Record<string, number> = {};
  for (const b of set.bands) counts[b.label] = 0;
  for (const s of samples) counts[set.classify(s)]++;

  const unreachable = set.bands.map((b) => b.label).filter((l) => counts[l] === 0);
  const spread = samples.length
    ? `observed ${Math.min(...samples)}–${Math.max(...samples)} over ${samples.length} samples`
    : "no samples supplied";

  return {
    ok: unreachable.length === 0,
    unreachable,
    counts,
    message: unreachable.length === 0
      ? `${set.name}: all ${set.bands.length} bands reachable (${spread})`
      : `${set.name}: unreachable band(s) ${unreachable.join(", ")} — ${spread}. ` +
        `Either the thresholds do not match what the engine can emit, or the engine cannot vary enough to reach them.`,
  };
}

/** Throwing form, for use in tests. */
export function assertBandsReachable<T extends string>(set: BandSet<T>, samples: readonly number[]): void {
  const r = checkBandsReachable(set, samples);
  if (!r.ok) throw new Error(r.message);
}
