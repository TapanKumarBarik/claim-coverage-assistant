/** `Object.entries` that keeps the key type of a `Record`. */
export function typedEntries<K extends string, V>(record: Readonly<Record<K, V>>): Array<[K, V]> {
  return Object.entries(record) as Array<[K, V]>;
}

/** Count for `key` in a `{ [key]: count }` map from the API, 0 when absent. */
export function countOf(counts: Readonly<Record<string, number>>, key: string): number {
  return counts[key] ?? 0;
}

/** Entries of a count map, biggest first (ties alphabetical) so bar lists read top-down. */
export function entriesByCount(counts: Readonly<Record<string, number>>): Array<[string, number]> {
  return Object.entries(counts).sort(([a, x], [b, y]) => y - x || a.localeCompare(b));
}
