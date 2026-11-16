/**
 * Build an own-property accessor for a closed string-keyed table.
 *
 * Callers keep the table's inferred keys while arbitrary input strings pass
 * through this checked access boundary instead of widening the table itself.
 */
export const createClosedStringLookup =
  <Value>(table: Readonly<Record<string, Value>>) =>
  (key: string): Value | undefined =>
    Object.hasOwn(table, key) ? table[key] : undefined;
