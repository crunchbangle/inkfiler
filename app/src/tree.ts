import type { Node, TreeNode } from "./types";

/** Build a nested tree from the flat node list (already sorted by sort_order). */
export function buildTree(nodes: Node[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  for (const n of nodes) byId.set(n.id, { ...n, children: [] });

  const roots: TreeNode[] = [];
  for (const n of nodes) {
    const tn = byId.get(n.id)!;
    if (n.parent_id && byId.has(n.parent_id)) {
      byId.get(n.parent_id)!.children.push(tn);
    } else {
      roots.push(tn);
    }
  }
  return roots;
}

/** Ids of a node plus all its ancestors — used to keep search matches reachable. */
export function withAncestors(nodes: Node[], matches: Set<string>): Set<string> {
  const parentOf = new Map<string, string | null>();
  for (const n of nodes) parentOf.set(n.id, n.parent_id);

  const result = new Set<string>(matches);
  for (const id of matches) {
    let cur = parentOf.get(id) ?? null;
    while (cur && !result.has(cur)) {
      result.add(cur);
      cur = parentOf.get(cur) ?? null;
    }
  }
  return result;
}
