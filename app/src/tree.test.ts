import { describe, expect, it } from "vitest";
import { buildTree, withAncestors } from "./tree";
import type { Node } from "./types";

function n(id: string, parent_id: string | null, sort_order = 0): Node {
  return {
    id,
    parent_id,
    title: id,
    sort_order,
    caption: "",
    created_at: 0,
    updated_at: 0,
  };
}

describe("buildTree", () => {
  it("nests children under parents", () => {
    const tree = buildTree([n("a", null), n("b", "a"), n("c", "a"), n("d", "b")]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("a");
    expect(tree[0].children.map((c) => c.id)).toEqual(["b", "c"]);
    expect(tree[0].children[0].children.map((c) => c.id)).toEqual(["d"]);
  });

  it("preserves input order (assumed pre-sorted by sort_order)", () => {
    const tree = buildTree([n("a", null, 0), n("b", null, 1), n("c", null, 2)]);
    expect(tree.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("treats nodes with a missing parent as roots", () => {
    const tree = buildTree([n("orphan", "ghost")]);
    expect(tree.map((t) => t.id)).toEqual(["orphan"]);
  });
});

describe("withAncestors", () => {
  const nodes = [n("a", null), n("b", "a"), n("c", "b"), n("x", null)];

  it("adds all ancestors of each match", () => {
    const result = withAncestors(nodes, new Set(["c"]));
    expect([...result].sort()).toEqual(["a", "b", "c"]);
  });

  it("leaves unrelated branches out", () => {
    const result = withAncestors(nodes, new Set(["b"]));
    expect(result.has("x")).toBe(false);
  });

  it("is a no-op for root matches", () => {
    const result = withAncestors(nodes, new Set(["a", "x"]));
    expect([...result].sort()).toEqual(["a", "x"]);
  });
});
