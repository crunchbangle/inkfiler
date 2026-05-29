use std::path::Path;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::models::{Canvas, LoadedNode, Node, Textbox};

/// SQLite-backed store. The connection is guarded by a mutex so it can live in
/// Tauri's managed state and be shared across command invocations.
pub struct Db {
    conn: Mutex<Connection>,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn new_id() -> String {
    Uuid::new_v4().to_string()
}

impl Db {
    /// Open (creating if needed) the database at `path` and run migrations.
    pub fn open(path: &Path) -> rusqlite::Result<Self> {
        let conn = Connection::open(path)?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        migrate(&conn)?;
        Ok(Db {
            conn: Mutex::new(conn),
        })
    }

    /// In-memory database for tests.
    #[cfg(test)]
    pub fn open_in_memory() -> rusqlite::Result<Self> {
        let conn = Connection::open_in_memory()?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        migrate(&conn)?;
        Ok(Db {
            conn: Mutex::new(conn),
        })
    }

    // ---- hierarchy -------------------------------------------------------

    pub fn get_tree(&self) -> rusqlite::Result<Vec<Node>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, parent_id, title, sort_order, caption, created_at, updated_at
             FROM node ORDER BY sort_order",
        )?;
        let rows = stmt
            .query_map([], row_to_node)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    }

    pub fn create_node(&self, parent_id: Option<String>, title: Option<String>) -> rusqlite::Result<Node> {
        let conn = self.conn.lock().unwrap();
        let id = new_id();
        let now = now_ms();
        let title = title.unwrap_or_else(|| "Untitled".to_string());
        // Append after the last sibling.
        let sort_order: f64 = conn.query_row(
            "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM node WHERE parent_id IS ?1",
            params![parent_id],
            |r| r.get(0),
        )?;
        conn.execute(
            "INSERT INTO node (id, parent_id, title, sort_order, caption, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, '', ?5, ?5)",
            params![id, parent_id, title, sort_order, now],
        )?;
        conn.execute(
            "INSERT INTO canvas (node_id, bounds, strokes, updated_at) VALUES (?1, NULL, '[]', ?2)",
            params![id, now],
        )?;
        reindex_node(&conn, &id)?;
        Ok(Node {
            id,
            parent_id,
            title,
            sort_order,
            caption: String::new(),
            created_at: now,
            updated_at: now,
        })
    }

    pub fn rename_node(&self, id: &str, title: &str) -> rusqlite::Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE node SET title = ?2, updated_at = ?3 WHERE id = ?1",
            params![id, title, now_ms()],
        )?;
        reindex_node(&conn, id)?;
        Ok(())
    }

    pub fn save_caption(&self, id: &str, caption: &str) -> rusqlite::Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE node SET caption = ?2, updated_at = ?3 WHERE id = ?1",
            params![id, caption, now_ms()],
        )?;
        reindex_node(&conn, id)?;
        Ok(())
    }

    pub fn move_node(
        &self,
        id: &str,
        new_parent_id: Option<String>,
        sort_order: f64,
    ) -> rusqlite::Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE node SET parent_id = ?2, sort_order = ?3, updated_at = ?4 WHERE id = ?1",
            params![id, new_parent_id, sort_order, now_ms()],
        )?;
        Ok(())
    }

    pub fn delete_node(&self, id: &str) -> rusqlite::Result<()> {
        let conn = self.conn.lock().unwrap();
        // Children, canvas, textboxes, node_tag rows cascade via FK.
        // FTS rows for the subtree are cleaned up explicitly below.
        let ids = descendant_ids(&conn, id)?;
        conn.execute("DELETE FROM node WHERE id = ?1", params![id])?;
        for d in ids {
            conn.execute("DELETE FROM node_fts WHERE node_id = ?1", params![d])?;
        }
        Ok(())
    }

    // ---- canvas / loading ------------------------------------------------

    pub fn load_node(&self, id: &str) -> rusqlite::Result<Option<LoadedNode>> {
        let conn = self.conn.lock().unwrap();
        let node = conn
            .query_row(
                "SELECT id, parent_id, title, sort_order, caption, created_at, updated_at
                 FROM node WHERE id = ?1",
                params![id],
                row_to_node,
            )
            .optional()?;
        let Some(node) = node else { return Ok(None) };

        let canvas = conn.query_row(
            "SELECT node_id, bounds, strokes, updated_at FROM canvas WHERE node_id = ?1",
            params![id],
            row_to_canvas,
        )?;

        let mut stmt = conn.prepare(
            "SELECT id, node_id, x, y, w, h, content, updated_at
             FROM textbox WHERE node_id = ?1",
        )?;
        let textboxes = stmt
            .query_map(params![id], row_to_textbox)?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        let mut tstmt = conn.prepare(
            "SELECT t.name FROM tag t
             JOIN node_tag nt ON nt.tag_id = t.id
             WHERE nt.node_id = ?1 ORDER BY t.name",
        )?;
        let tags = tstmt
            .query_map(params![id], |r| r.get::<_, String>(0))?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        Ok(Some(LoadedNode {
            node,
            canvas,
            textboxes,
            tags,
        }))
    }

    pub fn save_canvas(
        &self,
        node_id: &str,
        strokes: &serde_json::Value,
        bounds: &Option<serde_json::Value>,
    ) -> rusqlite::Result<()> {
        let conn = self.conn.lock().unwrap();
        let strokes_txt = strokes.to_string();
        let bounds_txt = bounds.as_ref().map(|b| b.to_string());
        conn.execute(
            "UPDATE canvas SET strokes = ?2, bounds = ?3, updated_at = ?4 WHERE node_id = ?1",
            params![node_id, strokes_txt, bounds_txt, now_ms()],
        )?;
        Ok(())
    }

    // ---- textboxes -------------------------------------------------------

    pub fn upsert_textbox(&self, tb: &Textbox) -> rusqlite::Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO textbox (id, node_id, x, y, w, h, content, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(id) DO UPDATE SET
                x = ?3, y = ?4, w = ?5, h = ?6, content = ?7, updated_at = ?8",
            params![tb.id, tb.node_id, tb.x, tb.y, tb.w, tb.h, tb.content, now_ms()],
        )?;
        reindex_node(&conn, &tb.node_id)?;
        Ok(())
    }

    pub fn delete_textbox(&self, id: &str) -> rusqlite::Result<()> {
        let conn = self.conn.lock().unwrap();
        let node_id: Option<String> = conn
            .query_row(
                "SELECT node_id FROM textbox WHERE id = ?1",
                params![id],
                |r| r.get(0),
            )
            .optional()?;
        conn.execute("DELETE FROM textbox WHERE id = ?1", params![id])?;
        if let Some(nid) = node_id {
            reindex_node(&conn, &nid)?;
        }
        Ok(())
    }

    // ---- tags ------------------------------------------------------------

    pub fn set_node_tags(&self, node_id: &str, names: &[String]) -> rusqlite::Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM node_tag WHERE node_id = ?1", params![node_id])?;
        for raw in names {
            let name = raw.trim();
            if name.is_empty() {
                continue;
            }
            conn.execute(
                "INSERT INTO tag (id, name) VALUES (?1, ?2) ON CONFLICT(name) DO NOTHING",
                params![new_id(), name],
            )?;
            let tag_id: String = conn.query_row(
                "SELECT id FROM tag WHERE name = ?1",
                params![name],
                |r| r.get(0),
            )?;
            conn.execute(
                "INSERT OR IGNORE INTO node_tag (node_id, tag_id) VALUES (?1, ?2)",
                params![node_id, tag_id],
            )?;
        }
        reindex_node(&conn, node_id)?;
        Ok(())
    }

    // ---- search ----------------------------------------------------------

    /// Returns matching node ids using FTS5 prefix matching.
    pub fn search(&self, query: &str) -> rusqlite::Result<Vec<String>> {
        let terms: Vec<String> = query
            .split_whitespace()
            .map(|t| format!("\"{}\"*", t.replace('"', "")))
            .collect();
        if terms.is_empty() {
            return Ok(vec![]);
        }
        let match_expr = terms.join(" ");
        let conn = self.conn.lock().unwrap();
        let mut stmt =
            conn.prepare("SELECT node_id FROM node_fts WHERE node_fts MATCH ?1")?;
        let rows = stmt
            .query_map(params![match_expr], |r| r.get::<_, String>(0))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    }
}

// ---- row mappers ---------------------------------------------------------

fn row_to_node(r: &rusqlite::Row) -> rusqlite::Result<Node> {
    Ok(Node {
        id: r.get(0)?,
        parent_id: r.get(1)?,
        title: r.get(2)?,
        sort_order: r.get(3)?,
        caption: r.get(4)?,
        created_at: r.get(5)?,
        updated_at: r.get(6)?,
    })
}

fn row_to_canvas(r: &rusqlite::Row) -> rusqlite::Result<Canvas> {
    let bounds_txt: Option<String> = r.get(1)?;
    let strokes_txt: String = r.get(2)?;
    Ok(Canvas {
        node_id: r.get(0)?,
        bounds: bounds_txt.and_then(|t| serde_json::from_str(&t).ok()),
        strokes: serde_json::from_str(&strokes_txt).unwrap_or(serde_json::json!([])),
        updated_at: r.get(3)?,
    })
}

fn row_to_textbox(r: &rusqlite::Row) -> rusqlite::Result<Textbox> {
    Ok(Textbox {
        id: r.get(0)?,
        node_id: r.get(1)?,
        x: r.get(2)?,
        y: r.get(3)?,
        w: r.get(4)?,
        h: r.get(5)?,
        content: r.get(6)?,
        updated_at: r.get(7)?,
    })
}

// ---- helpers -------------------------------------------------------------

/// Collect a node and all of its descendants (for FTS cleanup on delete).
fn descendant_ids(conn: &Connection, root: &str) -> rusqlite::Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "WITH RECURSIVE sub(id) AS (
             SELECT id FROM node WHERE id = ?1
             UNION ALL
             SELECT n.id FROM node n JOIN sub ON n.parent_id = sub.id
         ) SELECT id FROM sub",
    )?;
    let ids = stmt
        .query_map(params![root], |r| r.get::<_, String>(0))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(ids)
}

/// Rebuild the full-text index row for a node from its title, caption,
/// textbox contents and tags.
fn reindex_node(conn: &Connection, node_id: &str) -> rusqlite::Result<()> {
    let title: Option<String> = conn
        .query_row("SELECT title FROM node WHERE id = ?1", params![node_id], |r| {
            r.get(0)
        })
        .optional()?;
    let Some(title) = title else {
        conn.execute("DELETE FROM node_fts WHERE node_id = ?1", params![node_id])?;
        return Ok(());
    };
    let caption: String = conn.query_row(
        "SELECT caption FROM node WHERE id = ?1",
        params![node_id],
        |r| r.get(0),
    )?;
    let textbox_text: String = conn
        .query_row(
            "SELECT COALESCE(GROUP_CONCAT(content, ' '), '') FROM textbox WHERE node_id = ?1",
            params![node_id],
            |r| r.get(0),
        )
        .unwrap_or_default();
    let tags: String = conn
        .query_row(
            "SELECT COALESCE(GROUP_CONCAT(t.name, ' '), '')
             FROM tag t JOIN node_tag nt ON nt.tag_id = t.id WHERE nt.node_id = ?1",
            params![node_id],
            |r| r.get(0),
        )
        .unwrap_or_default();

    conn.execute("DELETE FROM node_fts WHERE node_id = ?1", params![node_id])?;
    conn.execute(
        "INSERT INTO node_fts (node_id, title, caption, textbox_text, tags)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![node_id, title, caption, textbox_text, tags],
    )?;
    Ok(())
}

fn migrate(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS node (
            id         TEXT PRIMARY KEY,
            parent_id  TEXT REFERENCES node(id) ON DELETE CASCADE,
            title      TEXT NOT NULL DEFAULT 'Untitled',
            sort_order REAL NOT NULL DEFAULT 0,
            caption    TEXT NOT NULL DEFAULT '',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
         );
         CREATE INDEX IF NOT EXISTS idx_node_parent ON node(parent_id, sort_order);

         CREATE TABLE IF NOT EXISTS canvas (
            node_id    TEXT PRIMARY KEY REFERENCES node(id) ON DELETE CASCADE,
            bounds     TEXT,
            strokes    TEXT NOT NULL DEFAULT '[]',
            updated_at INTEGER NOT NULL
         );

         CREATE TABLE IF NOT EXISTS textbox (
            id         TEXT PRIMARY KEY,
            node_id    TEXT NOT NULL REFERENCES node(id) ON DELETE CASCADE,
            x REAL, y REAL, w REAL, h REAL,
            content    TEXT NOT NULL DEFAULT '',
            updated_at INTEGER NOT NULL
         );
         CREATE INDEX IF NOT EXISTS idx_textbox_node ON textbox(node_id);

         CREATE TABLE IF NOT EXISTS tag (
            id   TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE COLLATE NOCASE
         );
         CREATE TABLE IF NOT EXISTS node_tag (
            node_id TEXT NOT NULL REFERENCES node(id) ON DELETE CASCADE,
            tag_id  TEXT NOT NULL REFERENCES tag(id)  ON DELETE CASCADE,
            PRIMARY KEY (node_id, tag_id)
         );

         CREATE VIRTUAL TABLE IF NOT EXISTS node_fts USING fts5(
            node_id UNINDEXED, title, caption, textbox_text, tags
         );",
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Textbox;

    fn tb(id: &str, node_id: &str, content: &str) -> Textbox {
        Textbox {
            id: id.into(),
            node_id: node_id.into(),
            x: 1.0,
            y: 2.0,
            w: 100.0,
            h: 50.0,
            content: content.into(),
            updated_at: 0,
        }
    }

    #[test]
    fn create_and_list_tree() {
        let db = Db::open_in_memory().unwrap();
        let root = db.create_node(None, Some("Root".into())).unwrap();
        let child = db.create_node(Some(root.id.clone()), Some("Child".into())).unwrap();

        let tree = db.get_tree().unwrap();
        assert_eq!(tree.len(), 2);
        assert_eq!(child.parent_id.as_deref(), Some(root.id.as_str()));
        assert_eq!(root.title, "Root");
    }

    #[test]
    fn siblings_get_increasing_sort_order() {
        let db = Db::open_in_memory().unwrap();
        let a = db.create_node(None, None).unwrap();
        let b = db.create_node(None, None).unwrap();
        let c = db.create_node(None, None).unwrap();
        assert!(a.sort_order < b.sort_order);
        assert!(b.sort_order < c.sort_order);
    }

    #[test]
    fn create_node_makes_empty_canvas() {
        let db = Db::open_in_memory().unwrap();
        let n = db.create_node(None, None).unwrap();
        let loaded = db.load_node(&n.id).unwrap().unwrap();
        assert_eq!(loaded.canvas.strokes, serde_json::json!([]));
        assert!(loaded.textboxes.is_empty());
        assert!(loaded.tags.is_empty());
    }

    #[test]
    fn save_and_load_canvas_round_trip() {
        let db = Db::open_in_memory().unwrap();
        let n = db.create_node(None, None).unwrap();
        let strokes = serde_json::json!([
            {"segments": [{"point": {"x": 1.0, "y": 2.0}, "time": 0, "pressure": 0.5}],
             "mode": "draw", "weight": 3, "smoothing": 0.85,
             "color": "#000", "adaptiveStroke": true}
        ]);
        let bounds = Some(serde_json::json!({"w": 1600, "h": 1200}));
        db.save_canvas(&n.id, &strokes, &bounds).unwrap();

        let loaded = db.load_node(&n.id).unwrap().unwrap();
        assert_eq!(loaded.canvas.strokes, strokes);
        assert_eq!(loaded.canvas.bounds, bounds);
    }

    #[test]
    fn rename_and_caption_persist() {
        let db = Db::open_in_memory().unwrap();
        let n = db.create_node(None, None).unwrap();
        db.rename_node(&n.id, "Renamed").unwrap();
        db.save_caption(&n.id, "a caption").unwrap();
        let loaded = db.load_node(&n.id).unwrap().unwrap();
        assert_eq!(loaded.node.title, "Renamed");
        assert_eq!(loaded.node.caption, "a caption");
    }

    #[test]
    fn tags_set_and_replace() {
        let db = Db::open_in_memory().unwrap();
        let n = db.create_node(None, None).unwrap();
        db.set_node_tags(&n.id, &["alpha".into(), "beta".into()]).unwrap();
        let mut tags = db.load_node(&n.id).unwrap().unwrap().tags;
        tags.sort();
        assert_eq!(tags, vec!["alpha", "beta"]);

        // Re-setting replaces, not appends.
        db.set_node_tags(&n.id, &["gamma".into()]).unwrap();
        assert_eq!(db.load_node(&n.id).unwrap().unwrap().tags, vec!["gamma"]);
    }

    #[test]
    fn textbox_upsert_update_delete() {
        let db = Db::open_in_memory().unwrap();
        let n = db.create_node(None, None).unwrap();
        db.upsert_textbox(&tb("t1", &n.id, "hello")).unwrap();
        assert_eq!(db.load_node(&n.id).unwrap().unwrap().textboxes.len(), 1);

        // Update same id.
        db.upsert_textbox(&tb("t1", &n.id, "updated")).unwrap();
        let boxes = db.load_node(&n.id).unwrap().unwrap().textboxes;
        assert_eq!(boxes.len(), 1);
        assert_eq!(boxes[0].content, "updated");

        db.delete_textbox("t1").unwrap();
        assert!(db.load_node(&n.id).unwrap().unwrap().textboxes.is_empty());
    }

    #[test]
    fn search_matches_title_caption_textbox_and_tags() {
        let db = Db::open_in_memory().unwrap();
        let n = db.create_node(None, Some("Alphabet".into())).unwrap();
        db.save_caption(&n.id, "betacaption").unwrap();
        db.upsert_textbox(&tb("t1", &n.id, "gammacontent")).unwrap();
        db.set_node_tags(&n.id, &["deltatag".into()]).unwrap();

        for q in ["alpha", "betacap", "gamma", "deltatag"] {
            assert_eq!(db.search(q).unwrap(), vec![n.id.clone()], "query {q}");
        }
        assert!(db.search("nomatch").unwrap().is_empty());
        assert!(db.search("").unwrap().is_empty());
    }

    #[test]
    fn delete_cascades_subtree_and_clears_fts() {
        let db = Db::open_in_memory().unwrap();
        let root = db.create_node(None, Some("RootName".into())).unwrap();
        let child = db.create_node(Some(root.id.clone()), Some("ChildName".into())).unwrap();
        db.upsert_textbox(&tb("t1", &child.id, "deep")).unwrap();

        db.delete_node(&root.id).unwrap();
        assert!(db.get_tree().unwrap().is_empty());
        // FTS rows for the whole subtree are gone.
        assert!(db.search("RootName").unwrap().is_empty());
        assert!(db.search("ChildName").unwrap().is_empty());
        assert!(db.search("deep").unwrap().is_empty());
    }

    #[test]
    fn move_node_reparents() {
        let db = Db::open_in_memory().unwrap();
        let a = db.create_node(None, None).unwrap();
        let b = db.create_node(None, None).unwrap();
        db.move_node(&b.id, Some(a.id.clone()), 1.0).unwrap();
        let moved = db.get_tree().unwrap().into_iter().find(|n| n.id == b.id).unwrap();
        assert_eq!(moved.parent_id.as_deref(), Some(a.id.as_str()));
    }
}
