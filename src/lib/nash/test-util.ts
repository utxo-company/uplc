// Test helper: narrow a discriminated union by its `tag` with a proper
// TypeScript `asserts` type predicate, so downstream code sees the narrowed
// variant without `as` casts.

export function assertTag<
  T extends { readonly tag: string },
  Tag extends T["tag"],
>(x: T, tag: Tag): asserts x is Extract<T, { readonly tag: Tag }> {
  if (x.tag !== tag) {
    throw new Error(`expected tag ${tag}, got ${x.tag}`);
  }
}
