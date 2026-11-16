/**
 * The only value an iterable yields, or `undefined` when it yields none or
 * several. It replaces `size === 1 ? [...values][0]! : null`, where the
 * assertion stood in for the size check beside it.
 */
export function soleMember<Value>(values: Iterable<Value>): Value | undefined {
  const iterator = values[Symbol.iterator]();
  const first = iterator.next();
  if (first.done || !iterator.next().done) return undefined;
  return first.value;
}
