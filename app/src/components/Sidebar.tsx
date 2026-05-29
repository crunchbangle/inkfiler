import { useMemo, useState } from "react";
import { useStore } from "../store";
import { buildTree } from "../tree";
import type { TreeNode } from "../types";

function Row({ node, depth }: { node: TreeNode; depth: number }) {
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const addNode = useStore((s) => s.addNode);
  const rename = useStore((s) => s.rename);
  const remove = useStore((s) => s.remove);
  const visibleIds = useStore((s) => s.visibleIds);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.title);
  const [collapsed, setCollapsed] = useState(false);

  const children = node.children.filter((c) => !visibleIds || visibleIds.has(c.id));
  const hasChildren = children.length > 0;

  const commit = () => {
    const t = draft.trim();
    if (t && t !== node.title) rename(node.id, t);
    else setDraft(node.title);
    setEditing(false);
  };

  return (
    <li>
      <div
        className={`tree-row${selectedId === node.id ? " selected" : ""}`}
        style={{ paddingLeft: depth * 14 + 6 }}
        onClick={() => select(node.id)}
      >
        <button
          className="twisty"
          onClick={(e) => {
            e.stopPropagation();
            setCollapsed((c) => !c);
          }}
          style={{ visibility: hasChildren ? "visible" : "hidden" }}
          aria-label={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? "▸" : "▾"}
        </button>

        {editing ? (
          <input
            className="rename-input"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setDraft(node.title);
                setEditing(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="tree-title"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setDraft(node.title);
              setEditing(true);
            }}
          >
            {node.title}
          </span>
        )}

        <span className="row-actions" onClick={(e) => e.stopPropagation()}>
          <button title="Add child" onClick={() => addNode(node.id)}>
            ＋
          </button>
          <button title="Rename" onClick={() => setEditing(true)}>
            ✎
          </button>
          <button
            title="Delete"
            onClick={() => {
              if (confirm(`Delete "${node.title}" and all its children?`)) remove(node.id);
            }}
          >
            🗑
          </button>
        </span>
      </div>

      {hasChildren && !collapsed && (
        <ul className="tree-children">
          {children.map((c) => (
            <Row key={c.id} node={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function Sidebar() {
  const nodes = useStore((s) => s.nodes);
  const addNode = useStore((s) => s.addNode);
  const visibleIds = useStore((s) => s.visibleIds);
  const searchQuery = useStore((s) => s.searchQuery);
  const runSearch = useStore((s) => s.runSearch);

  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const roots = tree.filter((n) => !visibleIds || visibleIds.has(n.id));

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <strong>InkFiler</strong>
        <button className="new-root" onClick={() => addNode(null)} title="New top-level node">
          ＋ New
        </button>
      </div>

      <input
        className="search"
        type="search"
        placeholder="Search…"
        value={searchQuery}
        onChange={(e) => runSearch(e.target.value)}
      />

      <ul className="tree">
        {roots.length === 0 ? (
          <li className="tree-empty">
            {visibleIds ? "No matches." : "No nodes yet — create one."}
          </li>
        ) : (
          roots.map((n) => <Row key={n.id} node={n} depth={0} />)
        )}
      </ul>
    </aside>
  );
}
