# InkFiler — Prototype Implementation Plan

Companion to [inkfiler.md](inkfiler.md). Scope = the **Prototype** section: hierarchy, canvas, serialize, text. Storage = **SQLite via Tauri**.

## 1. Guiding decisions

| Decision | Choice | Why |
|---|---|---|
| Stroke storage | **Vector** (recorded atrament strokes as JSON), not raster PNG | Smaller, replayable, enables future layers/edit/composition; atrament records & replays natively |
| Undo/redo | **Built on the vector `Stroke[]`** (atrament has none built-in) | The recorded-strokes array is already the undo substrate — pop/replay; almost free given the design |
| DB access | **Rust commands + `rusqlite`**, not `tauri-plugin-sql` | Keeps SQL server-side; clean path to SQLCipher (encryption-at-rest MVP goal) and sync; typed API |
| Canvas extent | **Bounded** large canvas for prototype; store stroke coords in **world space** | Infinite pan/zoom is real work — defer it, but don't paint ourselves into a corner |
| Reorder | **Fractional `sort_order`** (REAL) | Insert-between by averaging; no mass renumber on drag |
| Search | **SQLite FTS5** over title + caption + textbox text + tags | Built into SQLite, cheap, beats LIKE; powers sidebar filter |
| Frontend state | **Zustand** | Lightweight tree/selection store, minimal boilerplate |

## 2. Architecture

```
┌─────────────────────────────────────────────┐
│ React (Vite, TS)                             │
│  Sidebar(tree, search, tags)  Toolbar        │
│  CanvasView(atrament) TextLayer CaptionPanel │
│        │  Zustand store (tree, selection)    │
│        │  @tauri-apps/api invoke()           │
└────────┼─────────────────────────────────────┘
         │  Tauri IPC (typed commands)
┌────────┼─────────────────────────────────────┐
│ Rust   ▼  commands: tree/node/canvas/text/tag │
│        rusqlite  ──►  SQLite file (app data)   │
│        (later: SQLCipher for encryption)       │
└────────────────────────────────────────────────┘
```

## 3. Data model

```sql
CREATE TABLE node (
  id         TEXT PRIMARY KEY,                 -- uuid v4
  parent_id  TEXT REFERENCES node(id) ON DELETE CASCADE,  -- NULL = root
  title      TEXT NOT NULL DEFAULT 'Untitled',
  sort_order REAL NOT NULL DEFAULT 0,          -- fractional index within parent
  caption    TEXT NOT NULL DEFAULT '',         -- accompanying text (searchable)
  created_at INTEGER NOT NULL,                 -- epoch ms
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_node_parent ON node(parent_id, sort_order);

CREATE TABLE canvas (                          -- 1:1 with node
  node_id    TEXT PRIMARY KEY REFERENCES node(id) ON DELETE CASCADE,
  bounds     TEXT,                             -- JSON {w,h}; NULL = unbounded (future)
  strokes    TEXT NOT NULL DEFAULT '[]',       -- JSON: Stroke[] (world coords)
  updated_at INTEGER NOT NULL
);

CREATE TABLE textbox (
  id         TEXT PRIMARY KEY,
  node_id    TEXT NOT NULL REFERENCES node(id) ON DELETE CASCADE,
  x REAL, y REAL, w REAL, h REAL,              -- world coords
  content    TEXT NOT NULL DEFAULT '',         -- searchable
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_textbox_node ON textbox(node_id);

CREATE TABLE tag (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);
CREATE TABLE node_tag (
  node_id TEXT NOT NULL REFERENCES node(id) ON DELETE CASCADE,
  tag_id  TEXT NOT NULL REFERENCES tag(id)  ON DELETE CASCADE,
  PRIMARY KEY (node_id, tag_id)
);

-- Full-text search index (kept in sync via triggers or in command code)
CREATE VIRTUAL TABLE node_fts USING fts5(
  node_id UNINDEXED, title, caption, textbox_text, tags
);
```

**Stroke JSON shape** (one element of `canvas.strokes`), mirrors atrament's `strokerecorded` payload:

```ts
type Stroke = {
  color: string; weight: number; mode: 'draw' | 'erase';
  smoothing: number; adaptiveStroke: boolean;
  segments: { x: number; y: number; time: number; pressure?: number }[];
};
```

## 4. Tauri command surface (Rust)

```
get_tree() -> Node[]                       // full tree, client builds nesting
create_node(parent_id?, title?) -> Node    // also creates empty canvas row
rename_node(id, title)
move_node(id, new_parent_id?, sort_order)  // drag reorder / reparent
delete_node(id)                            // cascade

load_node(id) -> { node, canvas, textboxes, tags }   // everything to render
save_canvas(node_id, strokes, bounds)      // debounced autosave
save_caption(node_id, caption)

upsert_textbox(tb) / delete_textbox(id)

set_node_tags(node_id, names[])            // create-missing + relink
search(query) -> node_id[]                 // FTS5, drives sidebar filter
```

All writes bump `updated_at` and refresh the FTS row for that node.

## 5. Frontend components

- **Sidebar** — recursive tree; create / add-child / rename (inline) / drag-reorder; tag chips; search box that filters visible nodes to FTS matches (+ ancestors so matches stay reachable).
- **Toolbar** — colour swatches + picker, weight slider, mode (draw/erase), clear.
- **CanvasView** — owns the atrament instance:
  - `recordStrokes = true`; on `strokerecorded`, push to in-memory `Stroke[]`, mark dirty.
  - Autosave: debounce ~600ms → `save_canvas`; flush on node switch & window close (`dirty`/`clean` events + Tauri close hook).
  - Load: replay strokes via `beginStroke`/`draw(x,y,px,py,pressure)`/`endStroke`, restoring per-stroke props first.
  - **Undo/redo** (no atrament built-in): keep the in-memory `Stroke[]` plus a `redoStack`. Undo = pop last → push to `redoStack` → `clear()` → replay remaining. Redo = pop `redoStack` → re-push → replay. A new stroke clears `redoStack`. Ctrl/Cmd+Z / Ctrl+Shift+Z (or Ctrl+Y). Each undo/redo reuses the autosave path. Naive full clear+replay is fine for the prototype; optimise later (snapshot every N strokes) if large canvases lag.
- **TextLayer** — absolutely-positioned editable divs over the canvas (textboxes); create on tool click, drag to move/resize, debounced `upsert_textbox`.
- **CaptionPanel** — textarea bound to node caption, debounced `save_caption`.

## 6. Build phases

1. **Scaffold** — `create-tauri-app` (Vite + React + TS), add `rusqlite`/`uuid`/`serde`; DB init + migrations on startup; Zustand store.
2. **Hierarchy** — node CRUD + reorder commands; Sidebar tree with create/child/rename/drag.
3. **Canvas** — atrament wrapper, toolbar (colour/weight/erase), draw with pressure hardware.
4. **Serialize** — vector save/load, debounced autosave, replay-on-load; verify round-trip fidelity. Add **undo/redo** here (stroke + redo stacks, keyboard shortcuts) since it shares the replay machinery.
5. **Text** — textboxes + caption, persisted.
6. **Search** — FTS5 wiring + sidebar filter (incl. tags).

## 7. Open questions / risks to validate during the build

1. **Stylus pressure on real hardware** — atrament exposes `PointerEvent.pressure` per segment, but this must be smoke-tested on the actual Wacom/tablet early in Phase 3 (webview pointer support varies). Fallback: `adaptiveStroke` (velocity-based).
2. **Infinite canvas** — deferred to post-prototype. Coords stored in world space so a viewport transform can be layered on later without data migration. Confirm bounded-but-large is acceptable for the prototype.
3. **Erase + vector replay** — atrament erase is destructive on the raster surface; with vector replay, an erase stroke must be replayed in order with `mode='erase'`. Validate erased regions reconstruct correctly after load.
4. **FTS sync** — keep `node_fts` correct as textboxes/tags change (refresh in command code rather than fragile triggers).
5. **Encryption (MVP, not prototype)** — `rusqlite` chosen partly so SQLCipher can be swapped in later with minimal frontend impact.
