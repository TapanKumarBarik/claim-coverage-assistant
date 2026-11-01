/** A set of string literals is "complete" when it covers every member of the contract union `T`. */
type Complete<T extends string, V extends readonly string[]> = [T] extends [V[number]] ? V : never;

/** `{ NOT_COVERED: "not_covered", ... }`: one upper-cased key per member. */
export type EnumObject<V extends string> = { readonly [K in V as Uppercase<K>]: K };

/**
 * Build an enum-like const object from the members of a contract union.
 * It fails to compile when a member is missing or unknown, so regenerating the API types
 * (`npm run gen:api`) points at every place that must learn about a new value.
 *
 *   const VERDICT = enumOf<Verdict>()(["covered", "not_covered", ...]);   // VERDICT.NOT_COVERED
 */
export function enumOf<T extends string>() {
  return <const V extends readonly T[]>(values: V & Complete<T, V>): EnumObject<V[number]> =>
    Object.fromEntries(values.map((value) => [value.toUpperCase(), value])) as unknown as EnumObject<V[number]>;
}

/** Narrow an unknown value to a member of a known list (e.g. an error code read from a response body). */
export function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}
