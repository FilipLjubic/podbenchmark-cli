/**
 * Returns `value` once it is known to be present, or throws naming what was
 * expected. For a lookup that holds by construction (a map built beside the
 * code that reads it, a slot a loop bound guarantees): a broken invariant fails
 * here, by name, instead of as `undefined` several calls later. A value that
 * may really be absent is narrowed with a check and handled instead.
 */
export function required<Value>(
  value: Value | null | undefined,
  what: string
): Value {
  if (value === null || value === undefined) {
    throw new Error(`Expected ${what}, but it is missing.`);
  }
  return value;
}

/**
 * The text of capture group `index` of a successful match. A group that is
 * neither optional nor inside an alternation takes part in every match, so a
 * missing one means the pattern changed and this reader did not: it fails here,
 * naming the group, rather than passing `undefined` on. Read a group that may
 * really be absent with `match[index]` and handle `undefined`.
 */
export function captureGroup(
  match: RegExpMatchArray | RegExpExecArray,
  index: number
): string {
  return required(
    match[index],
    `capture group ${index} of the match`
  );
}
